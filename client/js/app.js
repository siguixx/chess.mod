import {
  ALL_CAMPAIGNS,
  CAMPAIGN_MAP,
  isChapterUnlocked,
  isCampaignLevelUnlocked,
  getCampaignUnlockReason
} from '/shared/config/campaigns.js';
import {
  COSMETIC_AVATARS,
  COSMETIC_FRAMES,
  COSMETIC_BOARDS,
  COSMETIC_PIECE_SKINS,
  COSMETIC_POWERS,
  MOD_VIP_PLAN
} from '/shared/config/cosmetics.js';
import { MOD_TEMPLATES, validateAndNormalizeMod } from '/shared/mods/modRuntime.js';
import { SoundEngine } from './sound.js';
import { VFXEngine } from './vfx.js';
import { BattleController } from './battleController.js';
import { renderAvatarMarkup, SVGS } from './svgs.js';
import { getBossPortraitSVG } from './portraits.js';
import { api } from './api.js';
import { mpSocket } from './socket.js';

function showToast(message, type = 'info') {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

function processAvatarUpload(file) {
  return new Promise((resolve, reject) => {
    const allowed = ['image/png', 'image/jpeg', 'image/webp'];
    if (!file || !allowed.includes(file.type)) return reject(new Error('Solo se permiten imágenes PNG, JPG o WebP.'));
    if (file.size > 2 * 1024 * 1024) return reject(new Error('La imagen supera el máximo de 2 MB.'));
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('El archivo no es una imagen válida.'));
      img.onload = () => {
        const size = 128;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const side = Math.min(img.width, img.height);
        ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
        let out = canvas.toDataURL('image/webp', 0.82);
        if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.82);
        resolve(out);
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

class ChessModApp {
  constructor() {
    this.user = null;
    this.googleOAuthConfigured = false;
    this.activeScreen = 'play';
    this.activeCampaignTab = 'maya';
    this.activeShopTab = 'powers';
    this.vipBillingStatus = { billingConfigured: false };
    this.savedMods = this.loadSavedMods();
    this.activePrivateRoomCode = null;
    this.selectedAiDifficulty = 3;
    this.selectedTimedMinutes = 3;
    this.inQueue = false;
    this.queueTimeMinutes = 10;
    this.queueTimerInterval = null;
    this.queueStartedAt = 0;

    this.sound = new SoundEngine();
    this.vfx = new VFXEngine(this.sound);
    this.battle = new BattleController({
      sound: this.sound,
      vfx: this.vfx,
      toast: showToast,
      onUserUpdated: (u) => this.setUser(u),
      onExitToMenu: () => {
        this.refreshCurrentUser();
        this.switchScreen(this.activeScreen);
      }
    });

    this.bindMenuEvents();
    this.bindSocketEvents();
    this.syncSettingsUI();
    this.bootstrap();
  }

  async bootstrap() {
    try {
      const res = await api.me();
      this.googleOAuthConfigured = Boolean(res.googleOAuthConfigured);
      if (res.authenticated && res.user) {
        this.setUser(res.user);
        mpSocket.connect();
      } else {
        this.renderAllScreens();
      }
    } catch {
      this.renderAllScreens();
    }
    this.checkVipPaymentReturn();
    api.getVipStatus().then((st) => { this.vipBillingStatus = st || {}; this.syncVipBillingUI(); }).catch(() => {});
    this.initModsWorkshopEditor();
    this.checkSecretBossUrl();
    window.addEventListener('hashchange', () => this.checkSecretBossUrl());
  }

  async checkVipPaymentReturn() {
    const params = new URLSearchParams(window.location.search || '');
    const sessionId = params.get('vip_session_id');
    if (sessionId && api.getToken()) {
      try {
        const res = await api.verifyModVipPayment(sessionId);
        if (res.user) {
          this.sound.play('vip_activate');
          this.setUser(res.user);
          showToast('👑 ¡Pago de $5 USD verificado! Mod VIP activado por 30 días.', 'success');
        }
      } catch (err) {
        showToast(err.message || 'No se pudo verificar el pago de Mod VIP.', 'error');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }
  }

  syncVipBillingUI() {
    const note = document.getElementById('vip-billing-status-note');
    if (!note) return;
    if (this.vipBillingStatus?.billingConfigured) {
      note.innerHTML = '💳 Pasarela de cobro real activa (<strong>$5.00 USD / mes</strong>). Serás redirigido para completar tu pago seguro.';
    } else {
      note.innerHTML = '🔒 <strong>Cobro real obligatorio ($5.00 USD / mes):</strong> La pasarela Stripe aún no tiene llaves configuradas en este servidor (<code>STRIPE_SECRET_KEY</code>). Mod VIP jamás se activa gratis sin cobro verificado.';
    }
  }

  loadSavedMods() {
    try {
      const raw = localStorage.getItem('chess_mod_open_mods_v1');
      const parsed = raw ? JSON.parse(raw) : [];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    } catch {}
    return [...MOD_TEMPLATES];
  }

  persistSavedMods() {
    try { localStorage.setItem('chess_mod_open_mods_v1', JSON.stringify(this.savedMods)); } catch {}
  }

  initModsWorkshopEditor() {
    const editor = document.getElementById('mod-code-editor');
    if (editor && !editor.value.trim()) {
      editor.value = JSON.stringify(MOD_TEMPLATES[0], null, 2);
    }
    this.renderModsWorkshop();
  }

  checkSecretBossUrl() {
    const pathname = (window.location.pathname || '').toLowerCase();
    const params = new URLSearchParams(window.location.search || '');
    const hash = (window.location.hash || '').toLowerCase();
    const isBlacky = pathname === '/blacky'
      || pathname.endsWith('/blacky')
      || (params.get('boss') || '').toLowerCase() === 'blacky'
      || (params.get('secret') || '').toLowerCase() === 'blacky'
      || hash === '#blacky';

    if (isBlacky && this.battle.mode !== 'blacky') {
      this.battle.startBlackySecretBoss({ playIntro: true, minutes: this.battle.selectedMinutes });
    }
  }

  async refreshCurrentUser() {
    try {
      const res = await api.me();
      if (res.authenticated && res.user) this.setUser(res.user);
    } catch {}
  }

  setUser(user) {
    this.user = user;
    this.battle.setUserProfile(user);
    this.applyEquippedBoardTheme();
    this.renderAllScreens();
  }

  applyEquippedBoardTheme() {
    const themeId = this.user?.boardThemeId || 'board_classic_maya';
    const theme = COSMETIC_BOARDS.find((b) => b.id === themeId) || COSMETIC_BOARDS[0];
    const root = document.documentElement;
    root.style.setProperty('--sq-light', theme.light);
    root.style.setProperty('--sq-dark', theme.dark);
    root.style.setProperty('--board-pedestal-bg', theme.pedestal);
  }

  switchScreen(screenName) {
    this.activeScreen = screenName;
    document.querySelectorAll('.nav-btn').forEach((b) => {
      b.classList.toggle('active', b.dataset.screen === screenName);
    });
    document.querySelectorAll('.screen-section').forEach((sec) => {
      sec.classList.toggle('active', sec.id === `screen-${screenName}`);
    });

    if (screenName === 'ranking') this.loadLeaderboard();
    if (screenName === 'story') this.renderCampaignScreen();
    if (screenName === 'shop') this.renderShopScreen();
    if (screenName === 'mods') this.renderModsWorkshop();
    if (screenName === 'customize') this.renderCosmeticsScreen();
    if (screenName === 'profile') this.renderProfileScreen();
    if (screenName === 'stats') this.renderStatsScreen();
    if (screenName === 'multiplayer') this.renderMultiplayerScreen();
  }

  bindMenuEvents() {
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => this.switchScreen(btn.dataset.screen));
    });

    // === 1. JUGAR (EXACTAMENTE 3 MODOS: Partida Rápida, Vs IA, Contra el Tiempo) ===
    on('btn-play-quick-match', 'click', () => {
      if (this.user) {
        this.switchScreen('multiplayer');
        if (!this.inQueue) this.toggleMatchmaking();
      } else {
        this.battle.startClassicMatch({ difficulty: 2, label: 'Partida Rápida', minutes: 10 });
      }
    });

    document.querySelectorAll('#play-ai-diff-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.selectedAiDifficulty = parseInt(b.dataset.diff, 10);
        document.querySelectorAll('#play-ai-diff-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-play-vs-ai', 'click', () => {
      this.battle.startClassicMatch({ difficulty: this.selectedAiDifficulty, label: 'Vs IA', minutes: this.battle.selectedMinutes });
    });

    document.querySelectorAll('#play-timed-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.selectedTimedMinutes = parseInt(b.dataset.mins, 10);
        document.querySelectorAll('#play-timed-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-play-timed', 'click', () => {
      const tag = this.selectedTimedMinutes === 1 ? 'Bullet 1m' : (this.selectedTimedMinutes <= 5 ? `Blitz ${this.selectedTimedMinutes}m` : `Rápida ${this.selectedTimedMinutes}m`);
      this.battle.startClassicMatch({ difficulty: 3, label: `Contra el Tiempo (${tag})`, minutes: this.selectedTimedMinutes });
    });

    // === 2. MULTIJUGADOR ===
    document.querySelectorAll('#mp-time-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.queueTimeMinutes = parseInt(b.dataset.mins, 10);
        document.querySelectorAll('#mp-time-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-mp-find', 'click', () => this.toggleMatchmaking());
    on('btn-mp-open-auth', 'click', () => this.openAuthModal('login'));

    // === 4. PERFIL Y AUTENTICACIÓN ===
    on('btn-sidebar-auth', 'click', () => this.user ? this.switchScreen('profile') : this.openAuthModal('login'));
    on('btn-profile-open-auth', 'click', () => this.openAuthModal('login'));
    on('btn-profile-logout', 'click', () => this.logout());
    on('btn-save-username', 'click', () => this.saveUsername());
    on('btn-upload-avatar', 'click', () => document.getElementById('input-avatar-file')?.click());
    on('input-avatar-file', 'change', async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      try {
        const dataUrl = await processAvatarUpload(file);
        const res = await api.updateAvatar(dataUrl);
        this.setUser(res.user);
        showToast('Avatar actualizado y guardado permanentemente.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    on('btn-auth-close', 'click', () => document.getElementById('modal-auth')?.classList.remove('open'));
    document.querySelectorAll('.auth-tab').forEach((tab) => {
      tab.addEventListener('click', () => this.switchAuthTab(tab.dataset.tab));
    });

    // Botón ojito para ver/ocultar contraseña al iniciar o crear cuenta
    document.querySelectorAll('[data-toggle-pw]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetId = btn.dataset.togglePw;
        const input = document.getElementById(targetId);
        if (!input) return;
        const show = input.type === 'password';
        input.type = show ? 'text' : 'password';
        btn.classList.toggle('showing', show);
        btn.textContent = show ? '🙈' : '👁️';
      });
    });

    // === 3B. TIENDA & MOD VIP ===
    document.querySelectorAll('#shop-tabs-bar [data-shop-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeShopTab = btn.dataset.shopTab;
        document.querySelectorAll('#shop-tabs-bar [data-shop-tab]').forEach((b) => b.classList.toggle('active', b === btn));
        this.renderShopScreen();
      });
    });

    on('btn-vip-open-modal', 'click', () => {
      if (!this.user) {
        this.openAuthModal('login');
        showToast('Inicia sesión o crea una cuenta para vincular tu suscripción Mod VIP.', 'info');
        return;
      }
      this.syncVipBillingUI();
      document.getElementById('modal-vip-checkout')?.classList.add('open');
    });
    on('btn-close-vip-modal', 'click', () => document.getElementById('modal-vip-checkout')?.classList.remove('open'));
    on('btn-confirm-vip-sub', 'click', async () => {
      if (!this.user) return this.openAuthModal('login');
      try {
        const res = await api.startModVipCheckout();
        if (res.checkoutUrl) {
          showToast('Redirigiendo a la pasarela de cobro segura ($5 USD/mes)...', 'info');
          window.location.href = res.checkoutUrl;
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    on('btn-vip-cancel', 'click', async () => {
      if (!this.user) return;
      try {
        const res = await api.cancelModVip();
        this.setUser(res.user);
        showToast(res.message || 'Suscripción Mod VIP cancelada. Todo el inventario VIP fue retirado.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // === 2B. SALAS PRIVADAS CON MODS ===
    on('btn-private-create', 'click', () => this.createPrivateRoom());
    on('btn-private-cancel', 'click', () => {
      mpSocket.emit('private:cancel');
      this.activePrivateRoomCode = null;
      this.renderMultiplayerScreen();
    });
    on('btn-private-copy-code', 'click', () => {
      if (!this.activePrivateRoomCode) return;
      navigator.clipboard?.writeText(this.activePrivateRoomCode).catch(() => {});
      showToast(`Código ${this.activePrivateRoomCode} copiado al portapapeles.`, 'success');
    });
    on('btn-private-join', 'click', () => {
      if (!this.user) return this.openAuthModal('login');
      const code = document.getElementById('input-private-code')?.value.trim().toUpperCase();
      if (!code || code.length < 4) return showToast('Ingresa un código de Sala Privada válido.', 'error');
      mpSocket.connect();
      mpSocket.emit('private:join', { code });
    });

    // === 3C. TALLER DE MODS (CÓDIGO ABIERTO) ===
    document.querySelectorAll('[data-mod-template]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.modTemplate, 10) || 0;
        const tpl = MOD_TEMPLATES[idx] || MOD_TEMPLATES[0];
        const ed = document.getElementById('mod-code-editor');
        if (ed) ed.value = JSON.stringify(tpl, null, 2);
        showToast(`Plantilla abierta cargada: ${tpl.name}`, 'info');
      });
    });
    on('btn-mod-validate-save', 'click', () => {
      const parsed = this.parseEditorMod();
      if (!parsed) return;
      const idx = this.savedMods.findIndex((m) => m.id === parsed.id);
      if (idx >= 0) this.savedMods[idx] = parsed;
      else this.savedMods.unshift(parsed);
      this.persistSavedMods();
      this.renderModsWorkshop();
      this.renderMultiplayerScreen();
      showToast(`Mod de código abierto guardado: «${parsed.name}»`, 'success');
    });
    on('btn-mod-test-ai', 'click', () => {
      const parsed = this.parseEditorMod();
      if (!parsed) return;
      this.battle.startClassicMatch({ difficulty: 3, label: 'Sala Privada', minutes: this.battle.selectedMinutes, customMod: parsed });
    });
    on('btn-mod-host-private', 'click', () => {
      const parsed = this.parseEditorMod();
      if (!parsed) return;
      const idx = this.savedMods.findIndex((m) => m.id === parsed.id);
      if (idx >= 0) this.savedMods[idx] = parsed;
      else this.savedMods.unshift(parsed);
      this.persistSavedMods();
      this.switchScreen('multiplayer');
      const sel = document.getElementById('private-mod-select');
      if (sel) sel.value = parsed.id;
      this.createPrivateRoom(parsed);
    });
    on('btn-mod-export', 'click', () => {
      const parsed = this.parseEditorMod();
      if (!parsed) return;
      const blob = new Blob([JSON.stringify(parsed, null, 2)], { type: 'application/json' });
      const urlObj = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = urlObj;
      a.download = `${parsed.id}.chessmod.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(urlObj), 1000);
      showToast(`Mod exportado: ${parsed.id}.chessmod.json`, 'success');
    });
    on('btn-mod-import', 'click', () => document.getElementById('input-mod-file')?.click());
    on('input-mod-file', 'change', (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const res = validateAndNormalizeMod(String(reader.result || ''));
        if (!res.ok) return showToast(res.error, 'error');
        const ed = document.getElementById('mod-code-editor');
        if (ed) ed.value = JSON.stringify(res.mod, null, 2);
        const idx = this.savedMods.findIndex((m) => m.id === res.mod.id);
        if (idx >= 0) this.savedMods[idx] = res.mod;
        else this.savedMods.unshift(res.mod);
        this.persistSavedMods();
        this.renderModsWorkshop();
        this.renderMultiplayerScreen();
        showToast(`Mod importado correctamente: «${res.mod.name}»`, 'success');
      };
      reader.readAsText(file);
    });
    on('form-login', 'submit', async (e) => {
      e.preventDefault();
      try {
        const identifier = document.getElementById('login-identifier').value.trim();
        const password = document.getElementById('login-password').value;
        const res = await api.login({ identifier, password });
        this.setUser(res.user);
        mpSocket.connect();
        document.getElementById('modal-auth')?.classList.remove('open');
        showToast(`¡Bienvenido de vuelta, ${res.user.username}!`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    on('form-register', 'submit', async (e) => {
      e.preventDefault();
      try {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const res = await api.register({ username, email, password });
        this.setUser(res.user);
        mpSocket.connect();
        document.getElementById('modal-auth')?.classList.remove('open');
        showToast(`Cuenta creada y vinculada: ${res.user.username} (0 Elo · 50 XP · ${res.user.mods ?? 100} Mods)`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    on('btn-google-oauth', 'click', () => {
      if (this.googleOAuthConfigured) window.location.href = '/api/auth/google';
      else showToast('Google OAuth 2.0 listo en el servidor (configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET).', 'info');
    });

    // === 6. RANKING ===
    on('btn-refresh-ranking', 'click', () => this.loadLeaderboard());

    // === 8. CONFIGURACIÓN ===
    on('set-music-vol', 'input', (e) => { this.sound.setMusicVolume(e.target.value); this.syncSettingsUI(); });
    on('set-sfx-vol', 'input', (e) => { this.sound.setSfxVolume(e.target.value); this.syncSettingsUI(); });
    on('set-mute-all', 'change', (e) => { this.sound.setMasterMute(e.target.checked); this.syncSettingsUI(); });
    on('set-reduced-vfx', 'change', (e) => {
      this.sound.reducedVfx = e.target.checked;
      this.sound.savePrefs();
      this.vfx.setReduced(e.target.checked);
    });
    document.querySelectorAll('#settings-time-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.battle.selectedMinutes = parseInt(b.dataset.mins, 10);
        document.querySelectorAll('#settings-time-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-toggle-fullscreen', 'click', () => this.toggleFullscreen());
    on('btn-desktop-quit', 'click', () => window.chessDesktop?.quit());
    if (window.chessDesktop?.isDesktop) document.getElementById('btn-desktop-quit')?.classList.remove('hidden');
  }

  bindSocketEvents() {
    mpSocket.on('queue:status', (status) => {
      this.inQueue = Boolean(status.inQueue);
      if (this.inQueue) {
        this.queueStartedAt = Date.now();
        clearInterval(this.queueTimerInterval);
        this.queueTimerInterval = setInterval(() => this.updateQueueTimerUI(), 500);
      } else {
        clearInterval(this.queueTimerInterval);
      }
      this.renderMultiplayerScreen();
    });

    mpSocket.on('queue:error', ({ error }) => {
      this.inQueue = false;
      clearInterval(this.queueTimerInterval);
      this.renderMultiplayerScreen();
      showToast(error || 'Error en matchmaking.', 'error');
    });

    mpSocket.on('match:found', (payload) => {
      this.inQueue = false;
      this.activePrivateRoomCode = null;
      clearInterval(this.queueTimerInterval);
      this.renderMultiplayerScreen();
      this.battle.startOnlineMatch(payload);
    });

    mpSocket.on('private:created', ({ code, customMod }) => {
      this.activePrivateRoomCode = code;
      this.renderMultiplayerScreen();
      showToast(`Sala Privada creada: ${code}${customMod ? ` (Mod: ${customMod.name})` : ''}`, 'success');
    });

    mpSocket.on('private:closed', () => {
      this.activePrivateRoomCode = null;
      this.renderMultiplayerScreen();
    });

    mpSocket.on('private:error', ({ error }) => {
      showToast(error || 'Error en Sala Privada.', 'error');
    });
  }

  parseEditorMod() {
    const ed = document.getElementById('mod-code-editor');
    const msg = document.getElementById('mod-validation-msg');
    const res = validateAndNormalizeMod(ed?.value || '');
    if (!res.ok) {
      if (msg) msg.innerHTML = `<span style="color:#ffaca3;">❌ ${res.error}</span>`;
      showToast(res.error, 'error');
      return null;
    }
    if (msg) msg.innerHTML = `<span style="color:#9ce0be;">✅ Mod válido: <strong>${res.mod.name}</strong> · Poder: ${res.mod.power.icon} ${res.mod.power.name} (${res.mod.power.effect})</span>`;
    return res.mod;
  }

  createPrivateRoom(overrideMod = null) {
    if (!this.user) {
      this.openAuthModal('login');
      showToast('Inicia sesión para crear una Sala Privada online.', 'info');
      return;
    }
    let chosenMod = overrideMod;
    if (!chosenMod) {
      const selVal = document.getElementById('private-mod-select')?.value || '';
      if (selVal) chosenMod = this.savedMods.find((m) => m.id === selVal) || null;
    }
    mpSocket.connect();
    mpSocket.emit('private:create', { timeMinutes: this.queueTimeMinutes, customMod: chosenMod });
  }

  renderModsWorkshop() {
    const list = document.getElementById('saved-mods-list');
    if (!list) return;
    if (!this.savedMods.length) {
      list.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);">Aún no tienes Mods guardados.</p>';
      return;
    }
    list.innerHTML = this.savedMods.map((m) => `
      <div class="saved-mod-card">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
          <strong style="color:var(--gold-bright);font-size:0.9rem;">${m.power?.icon || '🧩'} ${m.name}</strong>
          <span class="pill muted">v${m.version || '1.0'}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);line-height:1.4;">${m.description}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap;">
          <button class="btn btn-sm" data-mod-load="${m.id}">✏️ Editar código</button>
          <button class="btn btn-sm btn-primary" data-mod-play-ai="${m.id}">🤖 Vs IA</button>
          <button class="btn btn-sm btn-gold" data-mod-host="${m.id}">🔐 Sala Privada</button>
        </div>
      </div>`).join('');

    list.querySelectorAll('[data-mod-load]').forEach((b) => {
      b.addEventListener('click', () => {
        const mod = this.savedMods.find((x) => x.id === b.dataset.modLoad);
        const ed = document.getElementById('mod-code-editor');
        if (mod && ed) {
          ed.value = JSON.stringify(mod, null, 2);
          showToast(`Código abierto de «${mod.name}» cargado en el editor.`, 'info');
        }
      });
    });
    list.querySelectorAll('[data-mod-play-ai]').forEach((b) => {
      b.addEventListener('click', () => {
        const mod = this.savedMods.find((x) => x.id === b.dataset.modPlayAi);
        if (mod) this.battle.startClassicMatch({ difficulty: 3, label: 'Sala Privada', minutes: this.battle.selectedMinutes, customMod: mod });
      });
    });
    list.querySelectorAll('[data-mod-host]').forEach((b) => {
      b.addEventListener('click', () => {
        const mod = this.savedMods.find((x) => x.id === b.dataset.modHost);
        if (!mod) return;
        this.switchScreen('multiplayer');
        this.createPrivateRoom(mod);
      });
    });
  }

  toggleMatchmaking() {
    if (!this.user) {
      this.openAuthModal('login');
      showToast('Inicia sesión para jugar Multijugador Online con Elo.', 'info');
      return;
    }
    if (this.inQueue) {
      mpSocket.emit('queue:leave');
      this.inQueue = false;
      clearInterval(this.queueTimerInterval);
      this.renderMultiplayerScreen();
    } else {
      mpSocket.connect();
      mpSocket.emit('queue:join', { timeMinutes: this.queueTimeMinutes });
    }
  }

  updateQueueTimerUI() {
    const el = document.getElementById('mp-queue-timer');
    if (!el || !this.inQueue) return;
    const sec = Math.floor((Date.now() - this.queueStartedAt) / 1000);
    const range = 100 + Math.floor(sec / 2.5) * 50;
    el.textContent = `Buscando rival real... ${sec}s · Rango Elo ±${range}`;
  }

  openAuthModal(tab = 'login') {
    this.switchAuthTab(tab);
    document.getElementById('modal-auth')?.classList.add('open');
  }

  switchAuthTab(tab) {
    document.querySelectorAll('.auth-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
    document.getElementById('form-login')?.classList.toggle('hidden', tab !== 'login');
    document.getElementById('form-register')?.classList.toggle('hidden', tab !== 'register');
  }

  async logout() {
    mpSocket.disconnect();
    await api.logout();
    this.user = null;
    this.battle.setUserProfile(null);
    this.applyEquippedBoardTheme();
    this.renderAllScreens();
    showToast('Sesión cerrada correctamente.', 'info');
  }

  async saveUsername() {
    if (!this.user) return;
    const val = document.getElementById('input-edit-username')?.value.trim();
    try {
      const res = await api.updateUsername(val);
      this.setUser(res.user);
      showToast(`Nombre actualizado a ${res.user.username}.`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async equipCosmetic(payload) {
    if (!this.user) return this.openAuthModal('login');
    try {
      const res = await api.updateCosmetics(payload);
      this.setUser(res.user);
      showToast('Personalización guardada y aplicada.', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  async toggleFullscreen() {
    if (window.chessDesktop?.toggleFullscreen) return window.chessDesktop.toggleFullscreen();
    if (!document.fullscreenElement) await document.documentElement.requestFullscreen?.().catch(() => {});
    else await document.exitFullscreen?.().catch(() => {});
  }

  syncSettingsUI() {
    const s = this.sound;
    const m = document.getElementById('set-music-vol');
    const sf = document.getElementById('set-sfx-vol');
    const mu = document.getElementById('set-mute-all');
    const vf = document.getElementById('set-reduced-vfx');
    if (m) m.value = s.musicVol;
    if (sf) sf.value = s.sfxVol;
    if (mu) mu.checked = s.muted;
    if (vf) vf.checked = s.reducedVfx;
    document.getElementById('set-music-pct').textContent = `${Math.round(s.musicVol * 100)}%`;
    document.getElementById('set-sfx-pct').textContent = `${Math.round(s.sfxVol * 100)}%`;
  }

  renderAllScreens() {
    this.renderSidebarUser();
    this.renderMultiplayerScreen();
    this.renderCampaignScreen();
    this.renderShopScreen();
    this.renderProfileScreen();
    this.renderCosmeticsScreen();
    this.renderStatsScreen();
  }

  renderSidebarUser() {
    const u = this.user;
    const avatarEl = document.getElementById('sidebar-avatar');
    const nameEl = document.getElementById('sidebar-username');
    const eloEl = document.getElementById('sidebar-elo');
    const xpEl = document.getElementById('sidebar-xp');
    const modsEl = document.getElementById('sidebar-mods');
    const barEl = document.getElementById('sidebar-xp-bar');
    const btnEl = document.getElementById('btn-sidebar-auth');

    if (u) {
      if (avatarEl) {
        avatarEl.className = `avatar-badge ${u.frameId || 'frame_stone'}${u.isVip ? ' vip-aura' : ''}`;
        avatarEl.innerHTML = renderAvatarMarkup(u.avatar);
      }
      if (nameEl) {
        nameEl.className = `sidebar-user-name${u.isVip ? ' vip-name' : ''}`;
        nameEl.textContent = u.isVip ? `👑 ${u.username}` : u.username;
      }
      if (eloEl) eloEl.textContent = `Elo ${u.elo}`;
      if (xpEl) xpEl.textContent = `Nv.${u.level} · ${u.xp} XP`;
      if (modsEl) modsEl.textContent = `🪙 ${u.mods ?? 100}`;
      if (barEl) barEl.style.width = `${u.levelProgressPct || 0}%`;
      if (btnEl) btnEl.textContent = 'Ver Perfil';
    } else {
      if (avatarEl) {
        avatarEl.className = 'avatar-badge frame_stone';
        avatarEl.innerHTML = renderAvatarMarkup('preset:obsidian_king');
      }
      if (nameEl) {
        nameEl.className = 'sidebar-user-name';
        nameEl.textContent = 'Invitado';
      }
      if (eloEl) eloEl.textContent = 'Elo 0';
      if (xpEl) xpEl.textContent = '0 XP';
      if (modsEl) modsEl.textContent = '🪙 100';
      if (barEl) barEl.style.width = '0%';
      if (btnEl) btnEl.textContent = 'Iniciar sesión / Registro';
    }
  }

  async buyShopItem(itemId) {
    if (!this.user) {
      this.openAuthModal('login');
      showToast('Inicia sesión para comprar y guardar tus objetos permanentemente.', 'info');
      return;
    }
    try {
      const res = await api.buyShopItem(itemId);
      this.sound.play('shop_buy');
      this.setUser(res.user);
      showToast(`¡Comprado y equipado: ${res.item?.name || itemId}!`, 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  renderShopScreen() {
    const u = this.user;
    const mods = u ? (u.mods ?? 0) : 100;
    const isVip = Boolean(u?.isVip);
    const level = u?.level || 1;
    const unlocked = new Set(u?.unlockedCosmetics || ['preset:obsidian_king', 'preset:jade_guardian', 'frame_stone', 'board_classic_maya', 'pieces_classic', 'power_none']);

    const balEl = document.getElementById('shop-mods-balance');
    if (balEl) balEl.textContent = String(mods);

    // Estado del banner Mod VIP
    const badge = document.getElementById('vip-status-badge');
    const expTxt = document.getElementById('vip-expires-text');
    const btnSub = document.getElementById('btn-vip-open-modal');
    const btnCancel = document.getElementById('btn-vip-cancel');
    if (badge) {
      badge.textContent = isVip ? '✓ ACTIVO' : 'Inactivo';
      badge.className = `pill ${isVip ? 'jade' : 'muted'}`;
    }
    if (expTxt) {
      if (isVip && u?.vipExpiresAt) {
        const dt = new Date(u.vipExpiresAt);
        const dateLabel = Number.isNaN(dt.getTime()) ? '' : dt.toLocaleDateString('es-PE', { day: '2-digit', month: 'short', year: 'numeric' });
        expTxt.textContent = `Mod VIP activo (${MOD_VIP_PLAN.priceLabel}) · Renovación el ${dateLabel}. Si dejas de pagar o cancelas, todo el inventario VIP se retira automáticamente.`;
      } else {
        expTxt.textContent = `${MOD_VIP_PLAN.priceLabel} · Renovable mensualmente. Si dejas de pagar o cancelas, todo el inventario VIP se retira automáticamente.`;
      }
    }
    if (btnSub) btnSub.textContent = isVip ? '👑 Renovar Mod VIP (+30 días · $5 USD)' : '👑 Suscribirse a Mod VIP ($5 USD / mes)';
    if (btnCancel) btnCancel.classList.toggle('hidden', !isVip);

    const grid = document.getElementById('shop-items-grid');
    if (!grid) return;

    const tab = this.activeShopTab || 'powers';
    let items = [];
    if (tab === 'powers') items = COSMETIC_POWERS;
    else if (tab === 'pieceSkins') items = COSMETIC_PIECE_SKINS;
    else items = COSMETIC_BOARDS;

    grid.innerHTML = items.map((item) => {
      const isOwned = item.vipOnly
        ? isVip
        : (item.bossUnlock ? unlocked.has(item.id) : (unlocked.has(item.id) || (item.minLevel && level >= item.minLevel) || item.priceMods === 0));
      const isEquipped = (tab === 'powers' && (u?.equippedPowerId || 'power_none') === item.id)
        || (tab === 'pieceSkins' && (u?.pieceSkinId || 'pieces_classic') === item.id)
        || (tab === 'boards' && (u?.boardThemeId || 'board_classic_maya') === item.id);

      let previewHtml = '';
      if (tab === 'powers') {
        previewHtml = `<div class="shop-card-icon">${item.icon || '⚡'}</div>`;
      } else if (tab === 'pieceSkins') {
        previewHtml = `<div class="shop-card-icon piece-wrap ${item.cssClass || ''}" style="width:54px;height:54px;padding:4px;">${SVGS.wN}</div>`;
      } else {
        previewHtml = `
          <div class="board-preview-mini" style="width:54px;height:54px;">
            <div style="background:${item.light}"></div><div style="background:${item.dark}"></div>
            <div style="background:${item.dark}"></div><div style="background:${item.light}"></div>
          </div>`;
      }

      const pricePill = item.vipOnly
        ? `<span class="vip-tag">👑 Mod VIP ($5/m)</span>`
        : (item.bossUnlock && !isOwned
          ? `<span class="pill crimson">⛓️ Recompensa Jefe</span>`
          : (isOwned
            ? `<span class="pill jade">✓ En inventario</span>`
            : `<span class="pill">🪙 ${item.priceMods} Mods</span>`));

      let actionBtn = '';
      if (isEquipped) {
        actionBtn = `<button class="btn btn-sm btn-gold" disabled>✓ Equipado</button>`;
      } else if (isOwned) {
        actionBtn = `<button class="btn btn-sm btn-primary" data-shop-equip="${item.id}" data-shop-cat="${tab}">Equipar</button>`;
      } else if (item.vipOnly) {
        actionBtn = `<button class="btn btn-sm btn-gold" data-open-vip="1">👑 Obtener Mod VIP ($5)</button>`;
      } else if (item.bossUnlock) {
        actionBtn = `<button class="btn btn-sm" data-goto-story="1">📜 Derrota a Free Mittens</button>`;
      } else {
        const canAfford = !u || mods >= (item.priceMods || 0);
        actionBtn = `<button class="btn btn-sm btn-gold" data-shop-buy="${item.id}" ${!canAfford ? 'title="Gana más Mods jugando partidas"' : ''}>🪙 Comprar (${item.priceMods})</button>`;
      }

      const sfxBtn = (tab === 'powers' || tab === 'pieceSkins')
        ? `<button class="btn btn-sm" data-shop-sfx="${item.id}" data-shop-cat="${tab}" title="Escuchar efecto de sonido">🔊 SFX</button>`
        : '';

      return `
        <div class="shop-card ${item.vipOnly ? 'vip-exclusive' : ''} ${isOwned ? 'owned' : ''} ${isEquipped ? 'equipped' : ''}">
          <div>
            <div class="shop-card-preview">
              ${previewHtml}
              ${pricePill}
            </div>
            <h3 style="font-family:var(--font-display);font-size:0.98rem;color:${item.vipOnly ? '#ffe27a' : 'var(--gold-bright)'};margin:10px 0 4px;">${item.name}</h3>
            <p style="font-size:0.78rem;color:var(--text-muted);line-height:1.45;">${item.description || 'Estilo exclusivo de tablero para tus partidas.'}</p>
          </div>
          <div class="shop-card-actions">
            ${actionBtn}
            ${sfxBtn}
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-shop-buy]').forEach((b) => {
      b.addEventListener('click', () => this.buyShopItem(b.dataset.shopBuy));
    });
    grid.querySelectorAll('[data-shop-equip]').forEach((b) => {
      b.addEventListener('click', () => {
        const cat = b.dataset.shopCat;
        const id = b.dataset.shopEquip;
        if (cat === 'powers') this.equipCosmetic({ equippedPowerId: id });
        else if (cat === 'pieceSkins') this.equipCosmetic({ pieceSkinId: id });
        else this.equipCosmetic({ boardThemeId: id });
      });
    });
    grid.querySelectorAll('[data-open-vip]').forEach((b) => {
      b.addEventListener('click', () => document.getElementById('btn-vip-open-modal')?.click());
    });
    grid.querySelectorAll('[data-goto-story]').forEach((b) => {
      b.addEventListener('click', () => {
        this.activeCampaignTab = 'mittens';
        this.switchScreen('story');
        showToast('Derrota a Free Mittens (Capítulo 2 Nivel 5) para desbloquear su Poder OP.', 'info');
      });
    });
    grid.querySelectorAll('[data-shop-sfx]').forEach((b) => {
      b.addEventListener('click', () => {
        const cat = b.dataset.shopCat;
        const id = b.dataset.shopSfx;
        if (cat === 'powers') {
          const pw = COSMETIC_POWERS.find((p) => p.id === id);
          this.sound.play(pw?.sfxType || 'select');
        } else {
          this.sound.playPieceAction(id, false);
          setTimeout(() => this.sound.playPieceAction(id, true), 260);
        }
      });
    });
  }

  renderMultiplayerScreen() {
    const u = this.user;
    document.getElementById('mp-auth-warning')?.classList.toggle('hidden', Boolean(u));
    document.getElementById('mp-queue-controls')?.classList.toggle('hidden', !u);
    const eloVal = document.getElementById('mp-my-elo');
    if (eloVal) eloVal.textContent = `${u ? u.elo : 0} Elo`;
    const btn = document.getElementById('btn-mp-find');
    if (btn) {
      btn.textContent = this.inQueue ? '✕ Cancelar búsqueda' : '⚔️ Buscar Partida Pública';
      btn.className = this.inQueue ? 'btn btn-danger' : 'btn btn-gold';
    }
    document.getElementById('mp-queue-status')?.classList.toggle('hidden', !this.inQueue);

    const sel = document.getElementById('private-mod-select');
    if (sel) {
      const prev = sel.value;
      sel.innerHTML = `<option value="">Sin Mod custom (usar poderes oficiales)</option>`
        + this.savedMods.map((m) => `<option value="${m.id}">${m.power?.icon || '🧩'} ${m.name} (Código Abierto)</option>`).join('');
      if (prev && this.savedMods.some((m) => m.id === prev)) sel.value = prev;
    }
    const waitBox = document.getElementById('private-room-waiting');
    const codeDisp = document.getElementById('private-room-code-display');
    if (waitBox) waitBox.classList.toggle('hidden', !this.activePrivateRoomCode);
    if (codeDisp && this.activePrivateRoomCode) codeDisp.textContent = this.activePrivateRoomCode;
  }

  renderCampaignScreen() {
    const campaignsProg = this.user?.campaigns || {};

    // Renderizar las 5 pestañas de Capítulos con estado de desbloqueo secuencial
    const tabsBox = document.getElementById('campaign-tabs-bar');
    if (tabsBox) {
      tabsBox.innerHTML = ALL_CAMPAIGNS.map((camp) => {
        const chOpen = isChapterUnlocked(camp.id, campaignsProg);
        const active = camp.id === this.activeCampaignTab;
        const doneCount = campaignsProg[camp.id]?.completedLevels?.length || 0;
        return `
          <button class="campaign-tab-btn ${active ? 'active' : ''}" data-campaign="${camp.id}">
            ${chOpen ? '' : '🔒 '}${camp.shortTitle} (${doneCount}/5)
          </button>`;
      }).join('');
      tabsBox.querySelectorAll('[data-campaign]').forEach((btn) => {
        btn.addEventListener('click', () => {
          this.activeCampaignTab = btn.dataset.campaign;
          this.renderCampaignScreen();
        });
      });
    }

    const campaign = CAMPAIGN_MAP[this.activeCampaignTab] || ALL_CAMPAIGNS[0];
    const chUnlocked = isChapterUnlocked(campaign.id, campaignsProg);
    const completed = campaignsProg[campaign.id]?.completedLevels || [];

    const headerEl = document.getElementById('campaign-banner-info');
    if (headerEl) {
      const lockBanner = !chUnlocked
        ? `<div style="margin-top:8px;padding:8px 11px;border-radius:8px;background:rgba(201,75,60,0.18);border:1px solid var(--crimson);font-size:0.79rem;color:#ffd4ce;">🔒 ${getCampaignUnlockReason(campaign.id, 1, campaignsProg)}</div>`
        : '';
      headerEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <h3 style="font-family:var(--font-display); color:var(--gold-bright); font-size:1.15rem;">${campaign.title}</h3>
            <p style="font-size:0.83rem; color:var(--text-muted); margin-top:4px;">${campaign.description}</p>
          </div>
          <span class="pill ${chUnlocked ? 'jade' : 'crimson'}">${completed.length} / 5 Completados</span>
        </div>
        ${lockBanner}`;
    }

    const listEl = document.getElementById('campaign-levels-container');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (const lvl of campaign.levels) {
      const done = completed.includes(lvl.id);
      const unlocked = isCampaignLevelUnlocked(campaign.id, lvl.id, campaignsProg);
      const lockReason = unlocked ? '' : getCampaignUnlockReason(campaign.id, lvl.id, campaignsProg);

      const card = document.createElement('div');
      card.className = `campaign-level-card ${lvl.isFinalBoss ? 'final-boss' : ''} ${done ? 'completed' : ''} ${!unlocked ? 'locked' : ''}`;
      card.innerHTML = `
        <div class="level-portrait-thumb">${getBossPortraitSVG(lvl.bossId)}</div>
        <div>
          <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:4px;">
            <strong style="font-family:var(--font-display); font-size:1rem; color:${lvl.isFinalBoss ? 'var(--gold-bright)' : 'var(--text-main)'};">
              ${lvl.isFinalBoss ? '👑 ' : ''}Nivel ${lvl.id} — ${lvl.name}
            </strong>
            <span class="pill ${lvl.isFinalBoss ? 'crimson' : 'muted'}">${lvl.difficultyLabel}</span>
            <span class="pill">${done ? '✓ Completado' : `+${lvl.xpReward} XP`}</span>
          </div>
          <p style="font-size:0.81rem; color:var(--text-muted); line-height:1.45;">${lvl.briefing}</p>
          ${lockReason ? `<div style="font-size:0.73rem;color:#ffaca3;margin-top:4px;">🔒 ${lockReason}</div>` : ''}
        </div>
        <button class="btn ${lvl.isFinalBoss ? 'btn-gold' : 'btn-primary'}" ${!unlocked ? 'disabled' : ''}>
          ${!unlocked ? '🔒 Bloqueado' : (done ? 'Rejugar' : (lvl.isFinalBoss ? '⚔️ Enfrentar Jefe' : 'Jugar'))}
        </button>
      `;

      const playBtn = card.querySelector('button');
      if (playBtn && unlocked) {
        playBtn.addEventListener('click', async () => {
          // Validación estricta en servidor si el jugador está autenticado
          if (api.getToken()) {
            try {
              await api.validateCampaignStart(campaign.id, lvl.id);
            } catch (err) {
              showToast(err.message || 'Nivel bloqueado en el servidor.', 'error');
              return;
            }
          }
          this.battle.startCampaignLevel(campaign.id, lvl, this.battle.selectedMinutes);
        });
      }
      listEl.appendChild(card);
    }
  }

  renderProfileScreen() {
    const u = this.user;
    document.getElementById('profile-guest-box')?.classList.toggle('hidden', Boolean(u));
    document.getElementById('profile-auth-box')?.classList.toggle('hidden', !u);
    if (!u) return;

    const av = document.getElementById('profile-avatar-large');
    if (av) {
      av.className = `avatar-badge ${u.frameId || 'frame_stone'}${u.isVip ? ' vip-aura' : ''}`;
      av.innerHTML = renderAvatarMarkup(u.avatar);
    }
    const nameHeading = document.getElementById('profile-name-h');
    if (nameHeading) {
      nameHeading.className = u.isVip ? 'vip-name' : '';
      nameHeading.textContent = u.title ? `${u.username} · «${u.title}»` : u.username;
    }
    document.getElementById('profile-id-txt').textContent = `ID único: ${u.id} · ${u.email}`;
    document.getElementById('profile-elo-val').textContent = String(u.elo);
    document.getElementById('profile-level-val').textContent = `Nv. ${u.level} · ${u.levelTitle}`;
    document.getElementById('profile-xp-val').textContent = u.nextLevelXp ? `${u.xp} / ${u.nextLevelXp} XP` : `${u.xp} XP (Máximo)`;
    const modsValEl = document.getElementById('profile-mods-val');
    if (modsValEl) modsValEl.textContent = String(u.mods ?? 100);
    document.getElementById('profile-vip-pill')?.classList.toggle('hidden', !u.isVip);
    document.getElementById('profile-xp-bar').style.width = `${u.levelProgressPct || 0}%`;

    const inputName = document.getElementById('input-edit-username');
    if (inputName && document.activeElement !== inputName) inputName.value = u.username;
  }

  renderCosmeticsScreen() {
    const u = this.user;
    const level = u?.level || 1;
    const isVip = Boolean(u?.isVip);
    const unlocked = new Set(u?.unlockedCosmetics || ['preset:obsidian_king', 'preset:jade_guardian', 'frame_stone', 'board_classic_maya', 'pieces_classic', 'power_none']);

    const avGrid = document.getElementById('cosmetics-avatars-grid');
    if (avGrid) {
      avGrid.innerHTML = COSMETIC_AVATARS.filter((item) => !item.hiddenUntilUnlocked || unlocked.has(item.id)).map((item) => {
        const isUnl = unlocked.has(item.id) || level >= item.minLevel;
        const isEq = u?.avatar === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="avatar-badge ${u?.frameId || 'frame_stone'}" style="width:62px;height:62px;">${renderAvatarMarkup(item.id)}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'Desbloqueado' : (item.exclusiveReason || `Requiere Nv. ${item.minLevel}`)}</span>
            <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-avatar="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
              ${isEq ? '✓ Equipado' : 'Equipar'}
            </button>
          </div>`;
      }).join('');
      avGrid.querySelectorAll('[data-equip-avatar]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ avatar: b.dataset.equipAvatar })));
    }

    const frGrid = document.getElementById('cosmetics-frames-grid');
    if (frGrid) {
      frGrid.innerHTML = COSMETIC_FRAMES.filter((item) => (!item.hiddenUntilUnlocked || unlocked.has(item.id)) && (!item.vipOnly || isVip)).map((item) => {
        const isUnl = item.vipOnly ? isVip : (unlocked.has(item.id) || level >= item.minLevel);
        const isEq = u?.frameId === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="avatar-badge ${item.id}" style="width:62px;height:62px;">${renderAvatarMarkup(u?.avatar || 'preset:obsidian_king')}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'Desbloqueado' : (item.exclusiveReason || `Requiere Nv. ${item.minLevel}`)}</span>
            <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-frame="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
              ${isEq ? '✓ Equipado' : 'Equipar'}
            </button>
          </div>`;
      }).join('');
      frGrid.querySelectorAll('[data-equip-frame]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ frameId: b.dataset.equipFrame })));
    }

    const bdGrid = document.getElementById('cosmetics-boards-grid');
    if (bdGrid) {
      bdGrid.innerHTML = COSMETIC_BOARDS.filter((item) => !item.vipOnly || isVip).map((item) => {
        const isUnl = item.vipOnly ? isVip : (unlocked.has(item.id) || level >= item.minLevel);
        const isEq = (u?.boardThemeId || 'board_classic_maya') === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="board-preview-mini">
              <div style="background:${item.light}"></div><div style="background:${item.dark}"></div>
              <div style="background:${item.dark}"></div><div style="background:${item.light}"></div>
            </div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'Desbloqueado' : (item.priceMods ? `Tienda · 🪙 ${item.priceMods}` : `Requiere Nv. ${item.minLevel}`)}</span>
            <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-board="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
              ${isEq ? '✓ Activo' : 'Aplicar'}
            </button>
          </div>`;
      }).join('');
      bdGrid.querySelectorAll('[data-equip-board]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ boardThemeId: b.dataset.equipBoard })));
    }

    const pcGrid = document.getElementById('cosmetics-pieces-grid');
    if (pcGrid) {
      pcGrid.innerHTML = COSMETIC_PIECE_SKINS.filter((item) => !item.vipOnly || isVip).map((item) => {
        const isUnl = item.vipOnly ? isVip : (unlocked.has(item.id) || item.priceMods === 0);
        const isEq = (u?.pieceSkinId || 'pieces_classic') === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="shop-card-icon piece-wrap ${item.cssClass || ''}" style="width:58px;height:58px;padding:4px;">${SVGS.wQ}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'En inventario' : `Tienda · 🪙 ${item.priceMods}`}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-pieces="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
                ${isEq ? '✓ Activo' : 'Equipar'}
              </button>
              <button class="btn btn-sm" data-preview-piece-sfx="${item.id}" title="Escuchar sonido">🔊</button>
            </div>
          </div>`;
      }).join('');
      pcGrid.querySelectorAll('[data-equip-pieces]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ pieceSkinId: b.dataset.equipPieces })));
      pcGrid.querySelectorAll('[data-preview-piece-sfx]').forEach((b) => b.addEventListener('click', () => this.sound.playPieceAction(b.dataset.previewPieceSfx, false)));
    }

    const pwGrid = document.getElementById('cosmetics-powers-grid');
    if (pwGrid) {
      pwGrid.innerHTML = COSMETIC_POWERS.filter((item) => !item.vipOnly || isVip).map((item) => {
        const isUnl = item.vipOnly ? isVip : (item.bossUnlock ? unlocked.has(item.id) : (unlocked.has(item.id) || item.priceMods === 0));
        const isEq = (u?.equippedPowerId || 'power_none') === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="shop-card-icon" style="width:52px;height:52px;">${item.icon || '⚡'}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'Disponible' : (item.exclusiveReason || `Tienda · 🪙 ${item.priceMods}`)}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-power="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
                ${isEq ? '✓ Equipado' : 'Equipar'}
              </button>
              <button class="btn btn-sm" data-preview-power-sfx="${item.sfxType || 'select'}" title="Escuchar sonido">🔊</button>
            </div>
          </div>`;
      }).join('');
      pwGrid.querySelectorAll('[data-equip-power]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ equippedPowerId: b.dataset.equipPower })));
      pwGrid.querySelectorAll('[data-preview-power-sfx]').forEach((b) => b.addEventListener('click', () => this.sound.play(b.dataset.previewPowerSfx)));
    }
  }

  async loadLeaderboard() {
    const tbody = document.getElementById('ranking-tbody');
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:20px;">Cargando ranking...</td></tr>';
    try {
      const { players } = await api.getLeaderboard();
      if (!players.length) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:var(--text-muted);padding:24px;">Aún no hay jugadores registrados. ¡Crea tu cuenta para encabezar el ranking!</td></tr>';
        return;
      }
      tbody.innerHTML = players.map((p) => {
        const isMe = this.user && p.id === this.user.id;
        const rankCls = p.rank <= 3 ? `top${p.rank}` : '';
        const vipAuraCls = p.isVip ? ' vip-aura' : '';
        const nameCls = p.isVip ? 'vip-name' : '';
        const vipBadge = p.isVip ? ' <span class="vip-tag">👑 Mod VIP</span>' : '';
        return `
          <tr class="${isMe ? 'is-me' : ''}">
            <td><span class="rank-num ${rankCls}">#${p.rank}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="avatar-badge ${p.frameId || 'frame_stone'}${vipAuraCls}" style="width:34px;height:34px;">${renderAvatarMarkup(p.avatar)}</span>
                <div>
                  <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                    <strong class="${nameCls}" style="color:${isMe ? 'var(--gold-bright)' : 'var(--text-main)'};">${p.username}${isMe ? ' (Tú)' : ''}</strong>${vipBadge}
                  </div>
                  <div style="font-size:0.7rem;color:var(--text-muted);">Nivel ${p.level}${p.title ? ` · «${p.title}»` : ''}</div>
                </div>
              </div>
            </td>
            <td><strong style="font-family:var(--font-display);font-size:1.05rem;color:var(--gold-bright);">${p.elo}</strong></td>
            <td style="color:#9ce0be;font-weight:600;">${p.wins}</td>
            <td style="color:#ffaca3;">${p.losses} <span style="color:var(--text-muted);font-size:0.75rem;">(${p.draws}E)</span></td>
          </tr>`;
      }).join('');
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ffaca3;padding:20px;">${err.message}</td></tr>`;
    }
  }

  renderStatsScreen() {
    const u = this.user;
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    if (!u) {
      set('st-games', '0'); set('st-wins', '0'); set('st-losses', '0'); set('st-winrate', '0%');
      set('st-elo', '0'); set('st-xp', '0 XP'); set('st-bases', '0'); set('st-campaigns', '0 / 25');
      const hist = document.getElementById('stats-history-list');
      if (hist) hist.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem;">Inicia sesión para registrar estadísticas y ver tu historial de partidas.</p>';
      return;
    }

    const wr = u.gamesPlayed > 0 ? Math.round((u.wins / u.gamesPlayed) * 100) : 0;
    const totalCamp = ALL_CAMPAIGNS.reduce((sum, c) => sum + (u.campaigns?.[c.id]?.completedLevels?.length || 0), 0);
    set('st-games', String(u.gamesPlayed));
    set('st-wins', String(u.wins));
    set('st-losses', String(u.losses));
    set('st-winrate', `${wr}%`);
    set('st-elo', String(u.elo));
    set('st-xp', `${u.xp} XP`);
    set('st-bases', String(u.basesDestroyed || 0));
    set('st-campaigns', `${totalCamp} / 25`);

    const hist = document.getElementById('stats-history-list');
    if (hist) {
      const list = u.recentMatches || [];
      if (!list.length) {
        hist.innerHTML = '<p style="color:var(--text-muted);font-size:0.84rem;">Aún no tienes partidas registradas en el historial.</p>';
      } else {
        hist.innerHTML = list.map((m) => {
          const pillCls = m.outcome === 'win' ? 'jade' : (m.outcome === 'draw' ? 'muted' : 'crimson');
          const lbl = m.outcome === 'win' ? 'Victoria' : (m.outcome === 'draw' ? 'Tablas' : 'Derrota');
          const eloStr = m.mode === 'online' ? ` · Elo ${m.eloDelta >= 0 ? `+${m.eloDelta}` : m.eloDelta}` : '';
          return `
            <div class="match-history-row">
              <div>
                <strong>${m.opponent}</strong>
                <div style="font-size:0.72rem;color:var(--text-muted);">${m.mode.toUpperCase()} · ${m.turns} turnos${eloStr}</div>
              </div>
              <span class="pill ${pillCls}">${lbl}</span>
            </div>`;
        }).join('');
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.chessModApp = new ChessModApp();
});
