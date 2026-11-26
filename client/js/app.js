import {
  ALL_CAMPAIGNS,
  CAMPAIGN_MAP,
  isChapterUnlocked,
  isCampaignLevelUnlocked,
  getCampaignUnlockReason
} from '/shared/config/campaigns.js';
import {
  TRAINERS,
  SPECIAL_GAME_MODES,
  CLAN_CREATE_COST_MODS,
  CLAN_TEXT_COLORS,
  CLAN_FONT_FAMILIES,
  CLAN_PERMISSION_DEFS
} from '/shared/config/constants.js';
import { getFideCategory, BOT_ELO_BY_DIFFICULTY } from '/shared/config/elo.js';
import {
  COSMETIC_AVATARS,
  COSMETIC_FRAMES,
  COSMETIC_BOARDS,
  COSMETIC_PIECE_SKINS,
  COSMETIC_POWERS,
  MOD_VIP_PLAN,
  BATTLE_PASS_S1
} from '/shared/config/cosmetics.js';
import { MOD_TEMPLATES, validateAndNormalizeMod } from '/shared/mods/modRuntime.js';
import { SoundEngine } from './sound.js';
import { VFXEngine } from './vfx.js';
import { BattleController } from './battleController.js';
import { renderAvatarMarkup, SVGS } from './svgs.js';
import { getBossPortraitSVG } from './portraits.js';
import { api } from './api.js';
import { mpSocket } from './socket.js';
import {
  hasSavedLanguage,
  getSavedLanguage,
  saveLanguage,
  applyLanguageToDOM,
  t
} from './i18n.js';

const PREFS_STORAGE_KEY = 'chess_mod_prefs_v2';
const DEFAULT_PREFS = {
  showCoords: true,
  highlightLastMove: true,
  showLegalHints: true,
  autoQueen: false,
  showPreMatchGuide: true,
  animSpeed: 'normal',
  boardScale: 'normal',
  boardShake: true,
  eyeTracking: true,
  bgParticles: true,
  highContrast: false,
  showDialogues: true,
  lowTimeAlert: true
};

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function showToast(message, type = 'info') {
  const box = document.getElementById('toast-container');
  if (!box) return;
  const el = document.createElement('div');
  el.className = `toast-item ${type}`;
  el.textContent = message;
  box.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

async function processAvatarUpload(file) {
  if (!file) throw new Error('Selecciona una imagen de tu galería.');
  const ext = (file.name || '').toLowerCase();
  const looksLikeImage = !file.type
    || file.type.startsWith('image/')
    || /\.(png|jpe?g|jfif|webp|gif|svg|avif|bmp|ico|heic|heif|tiff?)$/.test(ext);
  if (!looksLikeImage) {
    throw new Error('El archivo seleccionado no es una imagen.');
  }
  if (file.size > 25 * 1024 * 1024) {
    throw new Error('La imagen supera el máximo de 25 MB.');
  }

  const readAsDataUrl = () => new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(new Error('No se pudo leer el archivo seleccionado.'));
    fr.readAsDataURL(file);
  });

  // Preservar GIF animado o SVG directamente si pesa < 600 KB
  if ((file.type === 'image/gif' || file.type === 'image/svg+xml' || ext.endsWith('.gif') || ext.endsWith('.svg')) && file.size <= 600 * 1024) {
    const raw = await readAsDataUrl();
    if (/^data:image\/[a-zA-Z0-9.+_-]+(;charset=[^;,]+)?;base64,/.test(raw)) return raw;
  }

  const size = 180;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // 1) createImageBitmap (rápido y soporta WebP, AVIF, PNG, JPG, BMP, etc.)
  if (typeof createImageBitmap === 'function') {
    try {
      const bmp = await createImageBitmap(file);
      const side = Math.min(bmp.width, bmp.height);
      ctx.drawImage(bmp, (bmp.width - side) / 2, (bmp.height - side) / 2, side, side, 0, 0, size, size);
      bmp.close?.();
      let out = canvas.toDataURL('image/webp', 0.84);
      if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.84);
      return out;
    } catch {}
  }

  // 2) Fallback Image() sobre ObjectURL o DataURL
  try {
    return await new Promise((resolve, reject) => {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.onerror = () => { URL.revokeObjectURL(objectUrl); reject(new Error('decode_failed')); };
      img.onload = () => {
        try {
          const side = Math.min(img.width, img.height);
          ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size);
          let out = canvas.toDataURL('image/webp', 0.84);
          if (!out.startsWith('data:image/webp')) out = canvas.toDataURL('image/jpeg', 0.84);
          resolve(out);
        } catch (e) { reject(e); } finally { URL.revokeObjectURL(objectUrl); }
      };
      img.src = objectUrl;
    });
  } catch {
    // 3) Fallback universal: subir el DataURL original de cualquier formato de imagen (< 650 KB)
    const raw = await readAsDataUrl();
    if (/^data:image\/[a-zA-Z0-9.+_-]+(;charset=[^;,]+)?;base64,/.test(raw) && raw.length < 880000) {
      return raw;
    }
    throw new Error('Este navegador no pudo convertir ese archivo pesado. Intenta con una imagen menor a 600 KB o en PNG/JPG/WebP/GIF/SVG.');
  }
}

class ChessModApp {
  constructor() {
    this.user = null;
    this.googleOAuthConfigured = false;
    this.activeScreen = 'play';
    this.activeCampaignTab = 'maya';
    this.activeShopTab = 'battlepass';
    this.activeBpRange = '1-10';
    this.activeInvTab = 'powers';
    this.activeSocialTab = 'clans';
    this.activeClanTab = 'chat';
    this.pendingCreateClanAvatar = '';
    this.pendingEditClanAvatar = null;
    this.activePublicChatClanId = null;
    this.presenceMap = new Map();
    this.notifications = [];
    this.unreadNotifs = 0;
    this.onlineCount = 0;
    this.lastBackPressAt = 0;
    this.allowingPageExit = false;
    this.vipBillingStatus = { billingConfigured: false };
    this.savedMods = this.loadSavedMods();
    this.activePrivateRoomCode = null;
    this.selectedAiDifficulty = 3;
    this.selectedTimedMinutes = 3;
    this.inQueue = false;
    this.queueTimeMinutes = 10;
    this.queueBetMods = 0;
    this.queueSpecialModeId = null;
    this.pendingLaunchMode = null;
    this.activeChatFriend = null;
    this.livePvpMatches = [];
    this.pending2FAChallengeToken = null;
    this.pendingAuthAfterLang = null;
    this.pendingTrainerId = null;
    this.lang = getSavedLanguage();
    this.prefs = this.loadAppPrefs();
    this.queueTimerInterval = null;
    this.queueStartedAt = 0;

    this.sound = new SoundEngine();
    this.vfx = new VFXEngine(this.sound);
    this.battle = new BattleController({
      sound: this.sound,
      vfx: this.vfx,
      toast: showToast,
      onUserUpdated: (u) => this.setUser(u),
      onExitToMenu: ({ returnToMainMenu = false } = {}) => {
        this.refreshCurrentUser();
        this.switchScreen(returnToMainMenu ? 'play' : this.activeScreen);
      }
    });

    this.applyAppPrefs();
    applyLanguageToDOM(this.lang);
    this.bindMenuEvents();
    this.bindSocketEvents();
    this.initBackNavigationGuard();
    this.initBrowserNotifications();
    this.syncSettingsUI();
    this.bootstrap();
  }

  loadAppPrefs() {
    try {
      const raw = localStorage.getItem(PREFS_STORAGE_KEY);
      if (raw) return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
    } catch {}
    return { ...DEFAULT_PREFS };
  }

  saveAppPrefs() {
    try { localStorage.setItem(PREFS_STORAGE_KEY, JSON.stringify(this.prefs)); } catch {}
  }

  applyAppPrefs() {
    const p = this.prefs;
    document.body.classList.toggle('hide-coords', p.showCoords === false);
    document.body.classList.toggle('hide-last-move', p.highlightLastMove === false);
    document.body.classList.toggle('hide-legal-dots', p.showLegalHints === false);
    document.body.classList.toggle('hide-bg-particles', p.bgParticles === false);
    document.body.classList.toggle('high-contrast-mode', Boolean(p.highContrast));
    document.body.classList.toggle('board-scale-compact', p.boardScale === 'compact');
    document.body.classList.toggle('board-scale-large', p.boardScale === 'large');
    this.vfx.setShakeEnabled(p.boardShake !== false);
    this.vfx.setBgParticlesEnabled(p.bgParticles !== false);
    this.battle.setPreferences(p);
  }

  async setLanguage(code, persistToServer = true) {
    this.lang = saveLanguage(code);
    applyLanguageToDOM(this.lang);
    this.syncSettingsUI();
    this.renderSidebarUser();
    this.renderTrainersGrids();
    if (persistToServer && this.user && api.getToken()) {
      try {
        const res = await api.updateLanguage(this.lang);
        if (res?.user) this.user = res.user;
      } catch {}
    }
  }

  async bootstrap() {
    try {
      const res = await api.me();
      this.googleOAuthConfigured = Boolean(res.googleOAuthConfigured);
      if (res.authenticated && res.user) {
        if (res.user.language && !hasSavedLanguage()) {
          this.lang = saveLanguage(res.user.language);
          applyLanguageToDOM(this.lang);
        }
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
    this.renderTrainersGrids();
    this.renderSpecialModesGrid();
    const openedSecret = this.checkSecretBossUrl();
    if (!openedSecret) {
      if (!this.user && !hasSavedLanguage()) {
        // Antes de crear tu cuenta: selección obligatoria de idioma
        this.pendingAuthAfterLang = 'register';
        document.getElementById('modal-language-picker')?.classList.add('open');
      } else if (this.user && !this.user.trainerId) {
        // Después de crear cuenta (o si falta elegir entrenador): selección única y obligatoria
        this.openMandatoryTrainerModal();
      }
    }
    window.addEventListener('hashchange', () => this.checkSecretBossUrl());
  }

  async checkVipPaymentReturn() {
    const params = new URLSearchParams(window.location.search || '');
    const sessionId = params.get('vip_session_id');
    const bpSessionId = params.get('bp_session_id');
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
    if (bpSessionId && api.getToken()) {
      try {
        const res = await api.verifyBattlePassPayment(bpSessionId);
        if (res.user) {
          this.sound.play('vip_activate');
          this.setUser(res.user);
          showToast('🎖️ ¡Pago de $10 USD verificado! Pase de Batalla Temporada 1 desbloqueado.', 'success');
        }
      } catch (err) {
        showToast(err.message || 'No se pudo verificar el pago del Pase de Batalla.', 'error');
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
      return true;
    }
    return false;
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
    if (user && api.getToken()) {
      mpSocket.connect();
      mpSocket.emit('presence:request');
      this.maybePromptBrowserNotifications();
    }
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
    if (screenName === 'missions') this.loadMissionsScreen();
    if (screenName === 'shop') this.renderShopScreen();
    if (screenName === 'battlepass') this.renderBattlePassScreen();
    if (screenName === 'mods') this.renderModsWorkshop();
    if (screenName === 'social') this.loadSocialScreen();
    if (screenName === 'moderation') this.loadModerationScreen();
    if (screenName === 'customize') this.renderCosmeticsScreen();
    if (screenName === 'profile') {
      this.renderProfileScreen();
      this.loadSecurityPanel();
    }
    if (screenName === 'stats') this.renderStatsScreen();
    if (screenName === 'multiplayer') {
      this.renderMultiplayerScreen();
      if (this.user) {
        mpSocket.connect();
        mpSocket.emit('live:list');
      }
    }
  }

  bindMenuEvents() {
    const on = (id, ev, fn) => { const el = document.getElementById(id); if (el) el.addEventListener(ev, fn); };

    document.querySelectorAll('.nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.switchScreen(btn.dataset.screen);
        btn.scrollIntoView?.({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      });
    });

    // Flechas táctiles de desplazamiento horizontal del menú en celular
    on('btn-nav-left', 'click', () => {
      document.getElementById('main-nav-bar')?.scrollBy({ left: -160, behavior: 'smooth' });
    });
    on('btn-nav-right', 'click', () => {
      document.getElementById('main-nav-bar')?.scrollBy({ left: 160, behavior: 'smooth' });
    });

    // === 1. JUGAR (Partida Rápida, Vs IA, Contra el Tiempo + Selector Bot/Jugador/Sala Privada) ===
    on('btn-play-quick-match', 'click', () => {
      this.openModeLauncher({ specialCfg: null, label: 'Partida Rápida', minutes: 10 });
    });

    document.querySelectorAll('#play-ai-diff-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.selectedAiDifficulty = parseInt(b.dataset.diff, 10);
        document.querySelectorAll('#play-ai-diff-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-play-vs-ai', 'click', () => {
      const botElo = BOT_ELO_BY_DIFFICULTY[this.selectedAiDifficulty] || 1200;
      this.battle.startClassicMatch({
        difficulty: this.selectedAiDifficulty,
        label: `Vs Bot (${botElo} Elo)`,
        minutes: this.battle.selectedMinutes
      });
    });

    document.querySelectorAll('#play-timed-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.selectedTimedMinutes = parseInt(b.dataset.mins, 10);
        document.querySelectorAll('#play-timed-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-play-timed', 'click', () => {
      const tag = this.selectedTimedMinutes === 1 ? 'Bullet 1m' : (this.selectedTimedMinutes <= 5 ? `Blitz ${this.selectedTimedMinutes}m` : `Rápida ${this.selectedTimedMinutes}m`);
      this.openModeLauncher({ specialCfg: null, label: `Contra el Tiempo (${tag})`, minutes: this.selectedTimedMinutes });
    });

    // === MODAL SELECTOR DE MODO: BOT (CON NIVEL) / CONTRA JUGADOR / SALA PRIVADA ===
    on('btn-close-mode-launcher', 'click', () => {
      this.pendingLaunchMode = null;
      document.getElementById('modal-mode-launcher')?.classList.remove('open');
    });
    on('btn-ml-play-bot', 'click', () => {
      const ctx = this.pendingLaunchMode;
      if (!ctx) return;
      const diff = Math.max(1, Math.min(5, parseInt(document.getElementById('ml-bot-level-select')?.value || '3', 10) || 3));
      this.pendingLaunchMode = null;
      document.getElementById('modal-mode-launcher')?.classList.remove('open');
      if (ctx.specialCfg) {
        this.battle.startSpecialMode(ctx.specialCfg, { difficulty: diff, minutes: ctx.minutes ?? this.battle.selectedMinutes });
      } else {
        const botElo = BOT_ELO_BY_DIFFICULTY[diff] || 1200;
        this.battle.startClassicMatch({ difficulty: diff, label: `${ctx.label || 'Clásico'} (${botElo} Elo)`, minutes: ctx.minutes ?? this.battle.selectedMinutes });
      }
    });
    on('btn-ml-play-pvp', 'click', () => {
      const ctx = this.pendingLaunchMode;
      this.pendingLaunchMode = null;
      document.getElementById('modal-mode-launcher')?.classList.remove('open');
      if (!this.user) {
        this.openAuthModal('login');
        showToast('Inicia sesión para buscar emparejamiento contra jugadores reales.', 'info');
        return;
      }
      if (ctx?.minutes && [1, 3, 5, 10, 15].includes(Number(ctx.minutes))) {
        this.queueTimeMinutes = Number(ctx.minutes);
      }
      this.queueSpecialModeId = ctx?.specialCfg?.id || null;
      this.switchScreen('multiplayer');
      if (this.inQueue) mpSocket.emit('queue:leave');
      this.inQueue = false;
      this.toggleMatchmaking(this.queueSpecialModeId);
    });
    on('btn-ml-play-private', 'click', () => {
      const ctx = this.pendingLaunchMode;
      this.pendingLaunchMode = null;
      document.getElementById('modal-mode-launcher')?.classList.remove('open');
      this.switchScreen('multiplayer');
      this.renderMultiplayerScreen();
      const modeSel = document.getElementById('private-mode-select');
      if (modeSel) modeSel.value = ctx?.specialCfg?.id || '';
      const timeSel = document.getElementById('private-time-select');
      if (timeSel && ctx?.minutes !== undefined) timeSel.value = String(ctx.minutes);
      showToast('Configura tus ajustes de Sala Privada como Host y crea o únete con código.', 'info');
    });

    // === 2. MULTIJUGADOR (APUESTAS DE MODS + ESPECTEAR EN VIVO) ===
    document.querySelectorAll('#mp-time-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.queueTimeMinutes = parseInt(b.dataset.mins, 10);
        document.querySelectorAll('#mp-time-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    document.querySelectorAll('#mp-bet-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.queueBetMods = parseInt(b.dataset.bet, 10) || 0;
        document.querySelectorAll('#mp-bet-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-mp-find', 'click', () => this.toggleMatchmaking());
    on('btn-mp-open-auth', 'click', () => this.openAuthModal('login'));
    on('btn-refresh-live-matches', 'click', () => {
      if (this.user) {
        mpSocket.connect();
        mpSocket.emit('live:list');
      }
    });

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

    // === 3B-2. PASE DE BATALLA TEMPORADA 1 DENTRO DE LA TIENDA (50 NV GRATIS + PAGA $10 USD) ===
    document.querySelectorAll('#bp-range-pills [data-bp-range]').forEach((b) => {
      b.addEventListener('click', () => {
        this.activeBpRange = b.dataset.bpRange;
        document.querySelectorAll('#bp-range-pills [data-bp-range]').forEach((x) => x.classList.toggle('active', x === b));
        this.renderBattlePassScreen();
      });
    });
    on('btn-bp-buy-usd', 'click', async () => {
      if (!this.user) {
        this.openAuthModal('register');
        showToast('Inicia sesión para comprar el Pase de Batalla Premium ($10.00 USD).', 'info');
        return;
      }
      try {
        const res = await api.startBattlePassCheckout();
        if (res.checkoutUrl) {
          showToast('Redirigiendo a pago seguro con Tarjeta / Dinero ($10.00 USD)...', 'info');
          window.location.href = res.checkoutUrl;
        }
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    on('btn-bp-buy-mods', 'click', async () => {
      if (!this.user) {
        this.openAuthModal('register');
        showToast('Inicia sesión para comprar el Pase de Batalla con 5,000 Mods.', 'info');
        return;
      }
      try {
        const res = await api.buyBattlePassMods();
        this.sound.play('vip_activate');
        if (res.user) this.setUser(res.user);
        showToast('🎖️ ¡Pase de Batalla Temporada 1 comprado con 5,000 Mods!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // === MISIONES (MÁX. 30 MODS) ===
    on('btn-refresh-missions', 'click', () => this.loadMissionsScreen());
    on('btn-missions-open-auth', 'click', () => this.openAuthModal('login'));

    // === CHAT PRIVADO ENTRE AMIGOS ===
    on('btn-close-friend-chat', 'click', () => {
      this.activeChatFriend = null;
      document.getElementById('modal-friend-chat')?.classList.remove('open');
    });
    on('form-friend-chat', 'submit', async (e) => {
      e.preventDefault();
      if (!this.activeChatFriend) return;
      const inp = document.getElementById('fchat-input');
      const text = inp?.value.trim();
      if (!text) return;
      try {
        await api.sendFriendMessage(this.activeChatFriend.userId, text);
        if (inp) inp.value = '';
        await this.loadFriendChatMessages();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // === 5. INVENTARIO EQUIPABLE (TABS) ===
    document.querySelectorAll('#inventory-tabs-bar [data-inv-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeInvTab = btn.dataset.invTab;
        document.querySelectorAll('#inventory-tabs-bar [data-inv-tab]').forEach((b) => b.classList.toggle('active', b === btn));
        document.querySelectorAll('.inv-tab-panel').forEach((p) => p.classList.toggle('hidden', p.id !== `inv-panel-${this.activeInvTab}`));
      });
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

    // === 3C. TALLER DE MODS (CÓDIGO ABIERTO + CONSTRUCTOR DE MODOS DE JUEGO) ===
    document.querySelectorAll('[data-mod-template]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.modTemplate, 10) || 0;
        const tpl = MOD_TEMPLATES[idx] || MOD_TEMPLATES[0];
        const ed = document.getElementById('mod-code-editor');
        if (ed) ed.value = JSON.stringify(tpl, null, 2);
        this.syncModGameModeBuilderFromObj(tpl);
        showToast(`Plantilla abierta cargada: ${tpl.name}`, 'info');
      });
    });
    on('btn-mod-apply-gamemode', 'click', () => {
      const ed = document.getElementById('mod-code-editor');
      let obj = {};
      try { obj = JSON.parse(ed?.value || '{}'); } catch { obj = { ...MOD_TEMPLATES[0] }; }
      const boardSize = parseInt(document.getElementById('mod-gm-boardsize')?.value || '8', 10) || 8;
      const armyPreset = document.getElementById('mod-gm-army')?.value || 'standard';
      const teamMode = document.getElementById('mod-gm-team')?.value || null;
      const atomicMode = Boolean(document.getElementById('mod-gm-atomic')?.checked);
      const randomPowers = Boolean(document.getElementById('mod-gm-random')?.checked);
      const earthquakeEvery = document.getElementById('mod-gm-quake')?.checked ? 3 : 0;
      obj.gameMode = { boardSize, atomicMode, armyPreset, randomPowers, earthquakeEvery, teamMode: teamMode || null };
      if (ed) ed.value = JSON.stringify(obj, null, 2);
      showToast('⚙️ Configuración de Modo de Juego aplicada al código JSON del Mod.', 'success');
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
        if (res.requires2FA && res.challengeToken) {
          this.pending2FAChallengeToken = res.challengeToken;
          document.getElementById('form-login')?.classList.add('hidden');
          document.getElementById('form-login-2fa')?.classList.remove('hidden');
          document.getElementById('login-2fa-code')?.focus();
          showToast('🔐 Ingresa tu código 2FA (6 dígitos) o un código de respaldo.', 'info');
          return;
        }
        this.setUser(res.user);
        mpSocket.connect();
        document.getElementById('modal-auth')?.classList.remove('open');
        showToast(`¡Bienvenido de vuelta, ${res.user.username}!`, 'success');
        if (!res.user.trainerId) this.openMandatoryTrainerModal();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
    on('btn-cancel-2fa', 'click', () => {
      this.pending2FAChallengeToken = null;
      document.getElementById('form-login-2fa')?.classList.add('hidden');
      document.getElementById('form-login')?.classList.remove('hidden');
    });
    on('form-login-2fa', 'submit', async (e) => {
      e.preventDefault();
      try {
        const code = document.getElementById('login-2fa-code').value.trim();
        const res = await api.login2FA(this.pending2FAChallengeToken, code);
        this.pending2FAChallengeToken = null;
        document.getElementById('form-login-2fa')?.classList.add('hidden');
        document.getElementById('form-login')?.classList.remove('hidden');
        document.getElementById('login-2fa-code').value = '';
        this.setUser(res.user);
        mpSocket.connect();
        document.getElementById('modal-auth')?.classList.remove('open');
        showToast(`🔐 Acceso 2FA verificado. ¡Bienvenido, ${res.user.username}!`, 'success');
        if (!res.user.trainerId) this.openMandatoryTrainerModal();
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Medidor en vivo de fortaleza de contraseña al registrar
    on('reg-password', 'input', (e) => {
      const pw = e.target.value || '';
      const el = document.getElementById('reg-pw-strength');
      if (!el) return;
      const okLen = pw.length >= 8;
      const okUp = /[A-Z]/.test(pw);
      const okLo = /[a-z]/.test(pw);
      const okNum = /[0-9]/.test(pw);
      const okSym = /[^A-Za-z0-9]/.test(pw);
      if (okLen && okUp && okLo && okNum && okSym) {
        el.innerHTML = '<span style="color:#7ae0ad;">🛡️ Fortaleza: MUY ALTA (Excelente)</span>';
      } else if (okLen && okUp && okLo && okNum) {
        el.innerHTML = '<span style="color:#ffd859;">🔒 Fortaleza: SEGURA (Aprobada)</span>';
      } else {
        const missing = [];
        if (!okLen) missing.push('8+ chars');
        if (!okUp) missing.push('Mayúscula');
        if (!okLo) missing.push('minúscula');
        if (!okNum) missing.push('número');
        el.innerHTML = `<span style="color:#ffaca3;">⚠️ Falta: ${missing.join(', ')}</span>`;
      }
    });

    // === SEGURIDAD AVANZADA EN PERFIL (2FA, PIN, CONTRASEÑA, CERRAR TODAS LAS SESIONES) ===
    on('btn-sec-setup-2fa', 'click', async () => {
      try {
        const res = await api.setup2FA();
        const txt = document.getElementById('sec-2fa-secret-txt');
        if (txt) txt.textContent = res.secret;
        document.getElementById('sec-2fa-setup-box')?.classList.remove('hidden');
        showToast('Clave 2FA generada. Agrégala en Google Authenticator o Authy y confirma con el código.', 'info');
      } catch (err) { showToast(err.message, 'error'); }
    });
    on('btn-sec-copy-secret', 'click', () => {
      const txt = document.getElementById('sec-2fa-secret-txt')?.textContent?.trim();
      if (txt) {
        navigator.clipboard?.writeText(txt).catch(() => {});
        showToast('Clave secreta 2FA copiada.', 'success');
      }
    });
    on('btn-sec-verify-2fa', 'click', async () => {
      try {
        const code = document.getElementById('sec-2fa-verify-code')?.value.trim();
        const res = await api.verify2FA(code);
        this.setUser(res.user);
        document.getElementById('sec-2fa-setup-box')?.classList.add('hidden');
        const bList = document.getElementById('sec-backup-codes-list');
        if (bList && res.backupCodes) {
          bList.innerHTML = res.backupCodes.map((c) => `<div>• ${c}</div>`).join('');
          document.getElementById('sec-backup-codes-box')?.classList.remove('hidden');
        }
        this.loadSecurityPanel();
        showToast('🛡️ ¡2FA activado! Guarda tus 6 códigos de respaldo en un lugar seguro.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
    on('btn-sec-disable-2fa', 'click', async () => {
      const password = window.prompt('Ingresa tu contraseña actual para desactivar 2FA:');
      if (!password) return;
      const code = window.prompt('Ingresa un código 2FA actual (6 dígitos) o código de respaldo:');
      if (!code) return;
      try {
        const res = await api.disable2FA(password, code);
        this.setUser(res.user);
        this.loadSecurityPanel();
        showToast('2FA desactivado.', 'info');
      } catch (err) { showToast(err.message, 'error'); }
    });
    on('btn-save-sec-pin', 'click', async () => {
      try {
        const pin = document.getElementById('input-sec-pin')?.value.trim() || '';
        const res = await api.setSecurityPin(pin);
        document.getElementById('input-sec-pin').value = '';
        this.setUser(res.user);
        this.loadSecurityPanel();
        showToast(res.hasPin ? '🔑 PIN de seguridad guardado.' : 'PIN de seguridad eliminado.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
    on('form-change-password', 'submit', async (e) => {
      e.preventDefault();
      try {
        const cur = document.getElementById('input-cur-pw').value;
        const nw = document.getElementById('input-new-pw').value;
        const res = await api.changePassword(cur, nw);
        e.target.reset();
        this.setUser(res.user);
        this.loadSecurityPanel();
        showToast('🔒 Contraseña actualizada y sesiones antiguas cerradas.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
    on('btn-revoke-sessions', 'click', async () => {
      try {
        const res = await api.revokeAllSessions();
        this.setUser(res.user);
        mpSocket.disconnect();
        mpSocket.connect();
        this.loadSecurityPanel();
        showToast('🔒 Todas las sesiones en otros dispositivos han sido cerradas.', 'success');
      } catch (err) { showToast(err.message, 'error'); }
    });
    on('form-register', 'submit', async (e) => {
      e.preventDefault();
      try {
        const username = document.getElementById('reg-username').value.trim();
        const email = document.getElementById('reg-email').value.trim();
        const password = document.getElementById('reg-password').value;
        const res = await api.register({ username, email, password });
        this.setUser(res.user);
        if (this.lang && this.lang !== 'es') {
          api.updateLanguage(this.lang).then((r) => { if (r?.user) this.user = r.user; }).catch(() => {});
        }
        mpSocket.connect();
        document.getElementById('modal-auth')?.classList.remove('open');
        showToast(`Cuenta creada y vinculada: ${res.user.username} (0 Elo · 50 XP · ${res.user.mods ?? 100} Mods)`, 'success');
        // Elección de entrenador 1 sola vez, obligatoria y sin poder saltar después de crear la cuenta
        if (!res.user.trainerId) {
          this.openMandatoryTrainerModal();
        }
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

    // === SELECTOR OBLIGATORIO DE IDIOMA PREVIO A CREAR CUENTA ===
    document.querySelectorAll('#language-gate-grid [data-pick-lang]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const chosen = btn.dataset.pickLang || 'es';
        this.setLanguage(chosen, true);
        document.getElementById('modal-language-picker')?.classList.remove('open');
        const nextTab = this.pendingAuthAfterLang;
        this.pendingAuthAfterLang = null;
        if (!this.user && nextTab) {
          this.switchAuthTab(nextTab);
          document.getElementById('modal-auth')?.classList.add('open');
        }
      });
    });

    // === ENTRENADORES (ELECCIÓN ÚNICA Y OBLIGATORIA — NO SE PUEDE SALTAR) ===
    on('btn-confirm-permanent-trainer', 'click', async () => {
      if (!this.pendingTrainerId) {
        showToast('Debes elegir un entrenador para continuar.', 'error');
        return;
      }
      if (!this.user) {
        this.openAuthModal('register');
        return;
      }
      const btn = document.getElementById('btn-confirm-permanent-trainer');
      if (btn) btn.disabled = true;
      try {
        const res = await api.chooseTrainerOnce(this.pendingTrainerId);
        this.pendingTrainerId = null;
        this.setUser(res.user);
        document.getElementById('modal-trainer-picker')?.classList.remove('open');
        this.renderTrainersGrids();
        const chosen = TRAINERS.find((x) => x.id === res.user.trainerId);
        showToast(`🔒 Entrenador permanente asignado: ${chosen?.name || res.user.trainerId}. ¡Ya puedes entrenar con él!`, 'success');
      } catch (err) {
        if (btn) btn.disabled = false;
        showToast(err.message || 'No se pudo asignar tu entrenador.', 'error');
      }
    });

    // Bloquear tecla Escape cuando hay un modal obligatorio abierto (idioma o entrenador único)
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        const langOpen = document.getElementById('modal-language-picker')?.classList.contains('open');
        const trOpen = document.getElementById('modal-trainer-picker')?.classList.contains('open');
        if (langOpen || trOpen) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    });

    // === SOCIAL (CLANES, AMIGOS, REPORTES) ===
    document.querySelectorAll('#social-tabs-bar [data-social-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeSocialTab = btn.dataset.socialTab;
        document.querySelectorAll('#social-tabs-bar [data-social-tab]').forEach((b) => b.classList.toggle('active', b === btn));
        document.getElementById('social-panel-clans')?.classList.toggle('hidden', this.activeSocialTab !== 'clans');
        document.getElementById('social-panel-friends')?.classList.toggle('hidden', this.activeSocialTab !== 'friends');
        document.getElementById('social-panel-report')?.classList.toggle('hidden', this.activeSocialTab !== 'report');
        this.loadSocialScreen();
      });
    });

    on('btn-refresh-clans', 'click', () => this.loadClans());
    on('btn-close-clan-public-chat', 'click', () => {
      document.getElementById('modal-clan-public-chat')?.classList.remove('open');
      this.activePublicChatClanId = null;
    });
    on('btn-clan-pick-avatar', 'click', () => document.getElementById('clan-avatar-file')?.click());
    on('btn-clan-clear-avatar', 'click', () => {
      this.pendingCreateClanAvatar = '';
      const prev = document.getElementById('clan-create-avatar-preview');
      if (prev) prev.innerHTML = '🏰';
      document.getElementById('btn-clan-clear-avatar')?.classList.add('hidden');
    });
    on('clan-avatar-file', 'change', async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        const dataUrl = await processAvatarUpload(file);
        this.pendingCreateClanAvatar = dataUrl;
        const prev = document.getElementById('clan-create-avatar-preview');
        if (prev) prev.innerHTML = `<img src="${dataUrl}" alt="Clan" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
        document.getElementById('btn-clan-clear-avatar')?.classList.remove('hidden');
        showToast('Imagen del clan lista.', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      } finally {
        e.target.value = '';
      }
    });
    const updateClanCreatePreview = () => {
      const name = document.getElementById('clan-name-input')?.value.trim() || 'Legión de Obsidiana';
      const tag = (document.getElementById('clan-tag-input')?.value.trim() || 'OBS').toUpperCase();
      const colorVal = document.getElementById('clan-text-color')?.value || '#efd083';
      const fontId = document.getElementById('clan-font-family')?.value || 'cinzel';
      const fontDef = CLAN_FONT_FAMILIES.find((f) => f.id === fontId) || CLAN_FONT_FAMILIES[0];
      const txt = document.getElementById('clan-style-preview-txt');
      if (txt) {
        txt.textContent = `[${tag}] ${name}`;
        txt.style.color = colorVal;
        txt.style.fontFamily = fontDef.css;
      }
      const policy = document.getElementById('clan-join-policy')?.value;
      const pubChk = document.getElementById('clan-public-chat');
      if (pubChk && policy === 'private_readonly') pubChk.checked = true;
    };
    ['clan-name-input', 'clan-tag-input', 'clan-text-color', 'clan-font-family', 'clan-join-policy'].forEach((id) => {
      on(id, 'input', updateClanCreatePreview);
      on(id, 'change', updateClanCreatePreview);
    });
    this.syncClanCreateSelectors();
    updateClanCreatePreview();

    on('form-create-clan', 'submit', async (e) => {
      e.preventDefault();
      if (!this.user) return this.openAuthModal('login');
      try {
        const name = document.getElementById('clan-name-input').value.trim();
        const tag = document.getElementById('clan-tag-input').value.trim().toUpperCase();
        const description = document.getElementById('clan-desc-input').value.trim();
        const joinPolicy = document.getElementById('clan-join-policy')?.value || 'open';
        const publicReadChat = Boolean(document.getElementById('clan-public-chat')?.checked) || joinPolicy === 'private_readonly';
        const textColor = document.getElementById('clan-text-color')?.value || '#efd083';
        const fontFamily = document.getElementById('clan-font-family')?.value || 'cinzel';
        const res = await api.createClan({
          name,
          tag,
          description,
          avatar: this.pendingCreateClanAvatar || '',
          joinPolicy,
          publicReadChat,
          textColor,
          fontFamily
        });
        this.sound.play('shop_buy');
        this.pendingCreateClanAvatar = '';
        const prev = document.getElementById('clan-create-avatar-preview');
        if (prev) prev.innerHTML = '🏰';
        document.getElementById('btn-clan-clear-avatar')?.classList.add('hidden');
        this.setUser(res.user);
        e.target.reset();
        this.syncClanCreateSelectors();
        this.activeClanTab = 'chat';
        this.loadClans();
        showToast(`🏰 Clan [${tag}] ${name} creado (-${CLAN_CREATE_COST_MODS.toLocaleString('es-PE')} Mods).`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    on('btn-friend-add', 'click', async () => {
      if (!this.user) return this.openAuthModal('login');
      const input = document.getElementById('input-friend-username');
      const username = input?.value.trim();
      if (!username) return;
      try {
        const res = await api.sendFriendRequest(username);
        if (input) input.value = '';
        this.renderFriends(res.summary);
        showToast(res.autoAccepted ? `¡Ahora eres amigo de ${username}!` : `Solicitud enviada a ${username}.`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    on('form-report-player', 'submit', async (e) => {
      e.preventDefault();
      if (!this.user) return this.openAuthModal('login');
      try {
        const reportedUsername = document.getElementById('report-username').value.trim();
        const category = document.getElementById('report-category').value;
        const description = document.getElementById('report-description').value.trim();
        await api.submitReport({ reportedUsername, category, description });
        e.target.reset();
        showToast(`🚨 Reporte contra ${reportedUsername} enviado a Moderación.`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // Modal rápido de reporte (desde Ranking u Online)
    on('btn-close-report-modal', 'click', () => document.getElementById('modal-report-quick')?.classList.remove('open'));
    on('btn-online-report', 'click', () => {
      const oppName = this.battle.onlineMeta?.opponent?.username || '';
      this.openQuickReportModal(oppName);
    });
    on('form-report-quick', 'submit', async (e) => {
      e.preventDefault();
      if (!this.user) return this.openAuthModal('login');
      try {
        const reportedUsername = document.getElementById('qreport-username').value.trim();
        const category = document.getElementById('qreport-category').value;
        const description = document.getElementById('qreport-description').value.trim();
        await api.submitReport({ reportedUsername, category, description, matchId: this.battle.onlineMeta?.matchId || null });
        document.getElementById('modal-report-quick')?.classList.remove('open');
        e.target.reset();
        showToast(`🚨 Reporte contra ${reportedUsername} enviado a Moderación.`, 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // === MODERACIÓN ===
    on('btn-mod-refresh', 'click', () => this.loadModerationScreen());
    on('btn-mod-grant-all', 'click', async () => {
      try {
        const res = await api.modGrantAll();
        this.sound.play('vip_activate');
        this.setUser(res.user);
        showToast('👑 ¡Todo el inventario, poderes, skins y Mods de Moderador desbloqueados!', 'success');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    // === NOTIFICACIONES EN TIEMPO REAL ===
    on('btn-notifications-bell', 'click', () => {
      this.unreadNotifs = 0;
      this.updateNotifBadge();
      this.syncOsNotifPermissionUI();
      this.renderNotificationsModal();
      document.getElementById('modal-notifications')?.classList.add('open');
    });
    on('btn-close-notifications', 'click', () => {
      document.getElementById('modal-notifications')?.classList.remove('open');
    });
    on('btn-clear-notifications', 'click', () => {
      this.notifications = [];
      this.unreadNotifs = 0;
      this.updateNotifBadge();
      this.renderNotificationsModal();
    });
    on('btn-modal-enable-os-notif', 'click', () => this.requestBrowserNotificationPermission());
    on('btn-settings-enable-os-notif', 'click', () => this.requestBrowserNotificationPermission());

    // === 8. CONFIGURACIÓN COMPLETA ===
    document.querySelectorAll('#settings-lang-pills [data-set-lang]').forEach((b) => {
      b.addEventListener('click', () => {
        this.setLanguage(b.dataset.setLang, true);
        showToast(`🌐 Idioma cambiado a ${b.textContent.trim()}.`, 'success');
      });
    });
    on('set-music-vol', 'input', (e) => { this.sound.setMusicVolume(e.target.value); this.syncSettingsUI(); });
    on('set-sfx-vol', 'input', (e) => { this.sound.setSfxVolume(e.target.value); this.syncSettingsUI(); });
    on('set-mute-all', 'change', (e) => { this.sound.setMasterMute(e.target.checked); this.syncSettingsUI(); });
    on('set-reduced-vfx', 'change', (e) => {
      this.sound.reducedVfx = e.target.checked;
      this.sound.savePrefs();
      this.vfx.setReduced(e.target.checked);
    });

    const bindPrefCheckbox = (id, key) => {
      on(id, 'change', (e) => {
        this.prefs[key] = Boolean(e.target.checked);
        this.saveAppPrefs();
        this.applyAppPrefs();
      });
    };
    bindPrefCheckbox('set-show-dialogues', 'showDialogues');
    bindPrefCheckbox('set-low-time-alert', 'lowTimeAlert');
    bindPrefCheckbox('set-show-coords', 'showCoords');
    bindPrefCheckbox('set-highlight-last', 'highlightLastMove');
    bindPrefCheckbox('set-show-legal', 'showLegalHints');
    bindPrefCheckbox('set-auto-queen', 'autoQueen');
    bindPrefCheckbox('set-prematch-guide', 'showPreMatchGuide');
    bindPrefCheckbox('set-board-shake', 'boardShake');
    bindPrefCheckbox('set-eye-tracking', 'eyeTracking');
    bindPrefCheckbox('set-bg-particles', 'bgParticles');
    bindPrefCheckbox('set-high-contrast', 'highContrast');

    document.querySelectorAll('#settings-anim-pills [data-anim-speed]').forEach((b) => {
      b.addEventListener('click', () => {
        this.prefs.animSpeed = b.dataset.animSpeed;
        this.saveAppPrefs();
        this.applyAppPrefs();
        this.syncSettingsUI();
      });
    });
    document.querySelectorAll('#settings-scale-pills [data-board-scale]').forEach((b) => {
      b.addEventListener('click', () => {
        this.prefs.boardScale = b.dataset.boardScale;
        this.saveAppPrefs();
        this.applyAppPrefs();
        this.syncSettingsUI();
      });
    });
    document.querySelectorAll('#settings-time-pills .time-opt').forEach((b) => {
      b.addEventListener('click', () => {
        this.battle.selectedMinutes = parseInt(b.dataset.mins, 10);
        document.querySelectorAll('#settings-time-pills .time-opt').forEach((x) => x.classList.toggle('active', x === b));
      });
    });
    on('btn-reset-settings', 'click', () => {
      this.prefs = { ...DEFAULT_PREFS };
      this.saveAppPrefs();
      this.sound.setMusicVolume(0.65);
      this.sound.setSfxVolume(0.72);
      this.sound.setMasterMute(false);
      this.sound.reducedVfx = false;
      this.sound.savePrefs();
      this.vfx.setReduced(false);
      this.battle.selectedMinutes = 10;
      this.applyAppPrefs();
      this.syncSettingsUI();
      document.querySelectorAll('#settings-time-pills .time-opt').forEach((x) => x.classList.toggle('active', x.dataset.mins === '10'));
      showToast('↺ Ajustes restablecidos a los valores por defecto.', 'info');
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

    mpSocket.on('live:matches', ({ matches }) => {
      this.livePvpMatches = Array.isArray(matches) ? matches : [];
      this.renderLiveMatchesList();
    });

    mpSocket.on('match:spectate_start', (payload) => {
      this.battle.startSpectatorMode(payload);
    });

    mpSocket.on('spectate:error', ({ error }) => {
      showToast(error || 'No se pudo espectear la partida.', 'error');
    });

    mpSocket.on('friend:message', (msg) => {
      if (this.activeChatFriend && (msg.senderId === this.activeChatFriend.userId || msg.receiverId === this.activeChatFriend.userId)) {
        this.loadFriendChatMessages();
      } else {
        showToast(`💬 Nuevo mensaje de ${msg.senderUsername}: ${msg.content.slice(0, 60)}`, 'info');
      }
    });

    mpSocket.on('clan:message', (msg) => {
      if (this.user?.clan && msg.clanId === this.user.clan.id) {
        if (this.activeScreen === 'social' && this.activeSocialTab === 'clans' && (this.activeClanTab || 'chat') === 'chat') {
          this.loadMyClanChat(msg.clanId);
        }
      }
    });

    mpSocket.on('presence:snapshot', ({ users = {}, onlineCount = 0 } = {}) => {
      this.presenceMap.clear();
      for (const [uid, info] of Object.entries(users)) {
        this.presenceMap.set(uid, { online: Boolean(info?.online), status: info?.status || 'online' });
      }
      this.onlineCount = Number(onlineCount) || this.presenceMap.size;
      this.updatePresenceDOM();
    });

    mpSocket.on('presence:update', ({ userId, online, status, onlineCount } = {}) => {
      if (userId) {
        if (online) this.presenceMap.set(userId, { online: true, status: status || 'online' });
        else this.presenceMap.delete(userId);
      }
      if (onlineCount !== undefined) this.onlineCount = Number(onlineCount) || 0;
      else this.onlineCount = this.presenceMap.size;
      this.updatePresenceDOM(userId || null);
    });

    mpSocket.on('notify:event', (notif) => {
      this.handleIncomingNotification(notif);
    });

    mpSocket.on('friends:updated', () => {
      if (this.activeScreen === 'social' && this.activeSocialTab === 'friends') {
        this.loadFriends();
      }
    });

    mpSocket.on('clan:updated', async () => {
      await this.refreshCurrentUser();
      if (this.activeScreen === 'social' && this.activeSocialTab === 'clans') {
        this.loadClans();
      }
    });
  }

  /* ================= SISTEMA DE BOTÓN ATRÁS / TRIÁNGULO / RETROCESO ================= */
  initBackNavigationGuard() {
    try {
      if (!window.history?.state?.chessModGuard) {
        window.history.replaceState({ chessModGuard: true, root: true }, '');
        window.history.pushState({ chessModGuard: true, sentinel: true }, '');
      }
    } catch {}

    window.addEventListener('popstate', () => {
      if (this.allowingPageExit) return;
      const shouldExitPage = this.handleSystemBackNavigation();
      if (shouldExitPage) {
        this.allowingPageExit = true;
        try { window.history.back(); } catch {}
        setTimeout(() => { this.allowingPageExit = false; }, 1000);
        return;
      }
      try {
        window.history.pushState({ chessModGuard: true, sentinel: true }, '');
      } catch {}
    });
  }

  /**
   * Gestiona el botón Atrás / Triángulo / Retroceso del teléfono o navegador:
   * - Si hay modal abierto (no obligatorio) -> lo cierra (1 clic).
   * - Si está dentro de una partida -> abre la confirmación de salida (Multijugador -75 XP vs Bot).
   * - Si está en cualquier subventana (Tienda, Social, Historia, etc.) -> regresa al menú principal (1 clic).
   * - Si ya está en el menú principal ('play') -> requiere 2 clics seguidos (< 2.5s) para salir de la página.
   */
  handleSystemBackNavigation() {
    // No permitir saltar modales obligatorios ni la secuencia final secreta
    if (document.getElementById('blacky-ending-overlay')?.classList.contains('active')
      || document.getElementById('modal-language-picker')?.classList.contains('open')
      || document.getElementById('modal-trainer-picker')?.classList.contains('open')) {
      return false;
    }

    // 1. Si hay un modal cerrable abierto, cerrarlo primero
    const closableModals = [
      'modal-confirm-exit',
      'modal-notifications',
      'modal-friend-chat',
      'modal-clan-public-chat',
      'modal-mode-launcher',
      'modal-report-quick',
      'modal-vip-payment',
      'modal-bp-payment',
      'modal-chess-power',
      'modal-auth'
    ];
    for (const id of closableModals) {
      const m = document.getElementById(id);
      if (m && m.classList.contains('open')) {
        m.classList.remove('open');
        return false;
      }
    }

    // 2. Si está dentro de una partida -> pedir confirmación según Multijugador vs Bot
    if (this.battle.isBattleScreenOpen()) {
      this.battle.requestExitBattle();
      return false;
    }

    // 3. Si está en cualquier ventana secundaria (Tienda, Inventario, Social, Historia, Ranking, Perfil, Ajustes, etc.) -> 1 clic regresa al menú principal
    if (this.activeScreen !== 'play') {
      this.switchScreen('play');
      return false;
    }

    // 4. Ya en el menú principal: exigir 2 presiones de Atrás en < 2.5s para salir de la página
    const now = Date.now();
    if (now - this.lastBackPressAt <= 2500) {
      return true;
    }
    this.lastBackPressAt = now;
    showToast('⬅️ Presiona atrás otra vez para salir de CHESS.MOD', 'info');
    return false;
  }

  /* ================= PRESENCIA EN TIEMPO REAL (ACTIVO / EN PARTIDA / DESCONECTADO) ================= */
  getPresenceInfo(userId) {
    if (!userId) return { online: false, status: 'offline' };
    if (this.user && userId === this.user.id && mpSocket.socket?.connected) {
      return this.presenceMap.get(userId) || { online: true, status: 'online' };
    }
    return this.presenceMap.get(userId) || { online: false, status: 'offline' };
  }

  formatPresenceInner(userId) {
    const info = this.getPresenceInfo(userId);
    if (info.status === 'in_match') {
      return { text: '⚔️ En partida', color: '#ffd859', border: 'rgba(255,216,89,0.55)', bg: 'rgba(255,216,89,0.14)' };
    }
    if (info.online) {
      return { text: '🟢 Activo', color: '#86efac', border: 'rgba(134,239,172,0.5)', bg: 'rgba(34,197,94,0.14)' };
    }
    return { text: '⚫ Desconectado', color: '#9ca3af', border: 'rgba(156,163,175,0.28)', bg: 'rgba(156,163,175,0.08)' };
  }

  renderPresencePill(userId) {
    if (!userId) return '';
    const st = this.formatPresenceInner(userId);
    return `<span class="live-presence-pill" data-presence-uid="${escapeHtml(userId)}" style="display:inline-flex;align-items:center;gap:3px;font-size:0.62rem;padding:1px 6px;border-radius:999px;border:1px solid ${st.border};background:${st.bg};color:${st.color};white-space:nowrap;">${st.text}</span>`;
  }

  updatePresenceDOM(onlyUserId = null) {
    const countPill = document.getElementById('live-online-count-pill');
    if (countPill) {
      const cnt = Math.max(this.onlineCount, this.presenceMap.size);
      countPill.textContent = `🟢 ${cnt}`;
      countPill.title = `${cnt} jugador(es) activos en CHESS.MOD ahora mismo`;
    }
    const selector = onlyUserId
      ? `[data-presence-uid="${CSS.escape(onlyUserId)}"]`
      : '[data-presence-uid]';
    document.querySelectorAll(selector).forEach((el) => {
      const uid = el.dataset.presenceUid;
      const st = this.formatPresenceInner(uid);
      el.textContent = st.text;
      el.style.color = st.color;
      el.style.borderColor = st.border;
      el.style.background = st.bg;
    });
  }

  /* ================= NOTIFICACIONES NATIVAS FUERA DE LA PÁGINA (WEB NOTIFICATIONS + SW) ================= */
  initBrowserNotifications() {
    this.swRegistration = null;
    if ('serviceWorker' in navigator && window.location.protocol !== 'file:') {
      navigator.serviceWorker.register('/sw.js').then((reg) => {
        this.swRegistration = reg;
      }).catch(() => {});
    }
    this.syncOsNotifPermissionUI();
  }

  syncOsNotifPermissionUI() {
    const supported = typeof window !== 'undefined' && 'Notification' in window;
    const perm = supported ? Notification.permission : 'unsupported';
    const setStatus = document.getElementById('settings-os-notif-status');
    const setBtn = document.getElementById('btn-settings-enable-os-notif');
    const modalLbl = document.getElementById('modal-os-notif-label');
    const modalBtn = document.getElementById('btn-modal-enable-os-notif');

    if (perm === 'granted') {
      if (setStatus) { setStatus.textContent = 'Activas ✅'; setStatus.className = 'pill jade'; }
      if (setBtn) { setBtn.textContent = '🔔 Probar Notificación'; }
      if (modalLbl) modalLbl.textContent = '✅ Notificaciones fuera de la página activas.';
      if (modalBtn) { modalBtn.textContent = '🔔 Probar'; }
    } else if (perm === 'denied') {
      if (setStatus) { setStatus.textContent = 'Bloqueadas'; setStatus.className = 'pill crimson'; }
      if (setBtn) { setBtn.textContent = '🔒 Bloqueado en navegador'; }
      if (modalLbl) modalLbl.textContent = '🔒 Bloqueadas en ajustes de tu navegador. Actívalas en el candado de la URL.';
      if (modalBtn) { modalBtn.classList.add('hidden'); }
    } else if (perm === 'default') {
      if (setStatus) { setStatus.textContent = 'Sin activar'; setStatus.className = 'pill muted'; }
      if (setBtn) { setBtn.textContent = '🔔 Activar Notificaciones'; }
      if (modalLbl) modalLbl.textContent = '🔔 Activa notificaciones para recibir avisos aunque estés fuera de la página.';
      if (modalBtn) { modalBtn.classList.remove('hidden'); modalBtn.textContent = '🔔 Permitir'; }
    } else {
      if (setStatus) { setStatus.textContent = 'No compatible'; setStatus.className = 'pill muted'; }
      if (setBtn) setBtn.classList.add('hidden');
      document.getElementById('os-notif-permission-bar')?.classList.add('hidden');
    }
  }

  maybePromptBrowserNotifications() {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'default') return;
    if (this._osNotifPromptShown) return;
    try {
      if (localStorage.getItem('chess_mod_os_notif_dismissed') === '1') return;
    } catch {}
    this._osNotifPromptShown = true;

    const stack = document.getElementById('live-notif-stack');
    if (!stack) return;
    const card = document.createElement('div');
    card.id = 'os-notif-ask-banner';
    card.style.cssText = 'pointer-events:auto;background:rgba(20,18,15,0.97);border:1px solid var(--border-gold);border-left:4px solid #38bdf8;border-radius:10px;padding:10px 12px;box-shadow:0 12px 28px rgba(0,0,0,0.55);color:#f3ead8;font-size:0.78rem;';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
        <strong style="color:#7dd3fc;font-size:0.8rem;">🔔 Notificaciones de CHESS.MOD</strong>
        <button type="button" class="btn btn-sm btn-icon" data-dismiss-os="1" style="padding:1px 6px;font-size:0.68rem;">✕</button>
      </div>
      <div style="line-height:1.4;margin-bottom:8px;">¿Quieres recibir notificaciones fuera de la página cuando te reten a match, soliciten unirse a tu clan o te escriban?</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button type="button" class="btn btn-sm btn-gold" data-allow-os="1">🔔 Permitir notificaciones</button>
        <button type="button" class="btn btn-sm" data-dismiss-os="1">Ahora no</button>
      </div>`;
    stack.prepend(card);

    card.querySelector('[data-allow-os]')?.addEventListener('click', async () => {
      card.remove();
      await this.requestBrowserNotificationPermission();
    });
    card.querySelectorAll('[data-dismiss-os]').forEach((b) => {
      b.addEventListener('click', () => {
        try { localStorage.setItem('chess_mod_os_notif_dismissed', '1'); } catch {}
        card.remove();
      });
    });
  }

  async requestBrowserNotificationPermission() {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      showToast('Este navegador no soporta notificaciones externas.', 'info');
      return 'unsupported';
    }
    if (Notification.permission === 'granted') {
      this.syncOsNotifPermissionUI();
      this.sendBrowserOSNotification({
        id: `test_${Date.now()}`,
        title: '🔔 CHESS.MOD · Notificaciones Activas',
        message: 'Recibirás avisos aquí aunque estés fuera de la página.'
      });
      showToast('🔔 Notificación de prueba enviada.', 'success');
      return 'granted';
    }
    try {
      const perm = await Notification.requestPermission();
      this.syncOsNotifPermissionUI();
      if (perm === 'granted') {
        try { localStorage.removeItem('chess_mod_os_notif_dismissed'); } catch {}
        this.sendBrowserOSNotification({
          id: `welcome_${Date.now()}`,
          title: '🔔 CHESS.MOD · ¡Notificaciones Activadas!',
          message: 'Ahora te avisaremos fuera de la página cuando recibas mensajes, solicitudes de clan o retos de match.'
        });
        showToast('✅ ¡Notificaciones fuera de la página activadas!', 'success');
      } else if (perm === 'denied') {
        showToast('Bloqueaste las notificaciones en tu navegador. Puedes activarlas desde los ajustes del sitio.', 'info');
      }
      return perm;
    } catch {
      return 'denied';
    }
  }

  sendBrowserOSNotification(notif) {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const title = String(notif?.title || 'CHESS.MOD');
    const options = {
      body: String(notif?.message || ''),
      icon: '/assets/images/chess_mod_logo.jpg',
      badge: '/assets/images/chess_mod_logo.jpg',
      tag: notif?.id || `chessmod_${Date.now()}`,
      renotify: true
    };
    try {
      if (this.swRegistration && typeof this.swRegistration.showNotification === 'function') {
        this.swRegistration.showNotification(title, options).catch(() => {
          try { new Notification(title, options); } catch {}
        });
      } else {
        const n = new Notification(title, options);
        n.onclick = () => {
          try { window.focus(); } catch {}
          n.close();
        };
      }
    } catch {}
  }

  /* ================= NOTIFICACIONES INTERACTIVAS EN TIEMPO REAL ================= */
  updateNotifBadge() {
    const badge = document.getElementById('notif-unread-badge');
    if (!badge) return;
    badge.classList.toggle('hidden', this.unreadNotifs <= 0);
    badge.textContent = this.unreadNotifs > 99 ? '99+' : String(this.unreadNotifs);
  }

  getNotifButtonsHtml(n) {
    if (n.resolvedLabel) {
      return `<span class="pill jade" style="font-size:0.64rem;">${escapeHtml(n.resolvedLabel)}</span>`;
    }
    if (n.type === 'clan_join_request') {
      return `
        <button type="button" class="btn btn-sm btn-primary" data-ntf-act="clan_accept" data-ntf-id="${n.id}">✅ Aceptar</button>
        <button type="button" class="btn btn-sm btn-danger" data-ntf-act="clan_reject" data-ntf-id="${n.id}">✕ Rechazar</button>`;
    }
    if (n.type === 'friend_request') {
      return `
        <button type="button" class="btn btn-sm btn-primary" data-ntf-act="friend_accept" data-ntf-id="${n.id}">✅ Aceptar</button>
        <button type="button" class="btn btn-sm btn-danger" data-ntf-act="friend_reject" data-ntf-id="${n.id}">✕ Rechazar</button>`;
    }
    if (n.type === 'match_invite') {
      return `
        <button type="button" class="btn btn-sm btn-gold" data-ntf-act="match_join" data-ntf-id="${n.id}">⚔️ Unirse</button>
        <button type="button" class="btn btn-sm btn-danger" data-ntf-act="match_reject" data-ntf-id="${n.id}">✕ Rechazar</button>`;
    }
    if (n.type === 'friend_message') {
      return `<button type="button" class="btn btn-sm btn-primary" data-ntf-act="open_friend_chat" data-ntf-id="${n.id}">💬 Responder</button>`;
    }
    if (n.type === 'clan_message' || n.type === 'clan_request_result' || n.type === 'clan_event') {
      return `<button type="button" class="btn btn-sm btn-primary" data-ntf-act="open_clan" data-ntf-id="${n.id}">🏰 Ver Clan</button>`;
    }
    return '';
  }

  handleIncomingNotification(notif) {
    if (!notif || !notif.id) return;
    // Evitar spam visual si el usuario ya tiene abierto ese mismo chat
    if (notif.type === 'friend_message' && this.activeChatFriend && notif.data?.friendId === this.activeChatFriend.userId
      && document.getElementById('modal-friend-chat')?.classList.contains('open')) {
      return;
    }
    if (notif.type === 'clan_message' && this.activeScreen === 'social' && this.activeSocialTab === 'clans'
      && (this.activeClanTab || 'chat') === 'chat' && !this.battle.isBattleScreenOpen()) {
      return;
    }

    this.notifications.unshift({ ...notif, resolvedLabel: null });
    if (this.notifications.length > 40) this.notifications.length = 40;
    this.unreadNotifs += 1;
    this.updateNotifBadge();
    try { this.sound.play('select'); } catch {}

    if (document.getElementById('modal-notifications')?.classList.contains('open')) {
      this.renderNotificationsModal();
    }
    this.showInteractiveNotifBanner(this.notifications[0]);
    this.sendBrowserOSNotification(this.notifications[0]);
  }

  showInteractiveNotifBanner(n) {
    const stack = document.getElementById('live-notif-stack');
    if (!stack) return;
    const card = document.createElement('div');
    card.dataset.liveNotifCard = n.id;
    card.style.cssText = 'pointer-events:auto;background:rgba(20,18,15,0.96);border:1px solid var(--border-gold);border-left:4px solid var(--gold-bright);border-radius:10px;padding:10px 12px;box-shadow:0 12px 28px rgba(0,0,0,0.55);color:#f3ead8;font-size:0.78rem;';
    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
        <strong style="color:var(--gold-bright);font-size:0.8rem;">${escapeHtml(n.title || 'CHESS.MOD')}</strong>
        <button type="button" class="btn btn-sm btn-icon" data-dismiss-banner="1" style="padding:1px 6px;font-size:0.68rem;">✕</button>
      </div>
      <div style="line-height:1.4;margin-bottom:7px;">${escapeHtml(n.message || '')}</div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">${this.getNotifButtonsHtml(n)}</div>`;
    stack.prepend(card);

    card.querySelector('[data-dismiss-banner]')?.addEventListener('click', () => card.remove());
    card.querySelectorAll('[data-ntf-act]').forEach((b) => {
      b.addEventListener('click', async () => {
        await this.handleNotificationAction(b.dataset.ntfId, b.dataset.ntfAct);
        card.remove();
      });
    });

    setTimeout(() => { if (card.isConnected) card.remove(); }, 10000);
  }

  renderNotificationsModal() {
    const box = document.getElementById('notifications-list-box');
    if (!box) return;
    if (!this.notifications.length) {
      box.innerHTML = '<div style="text-align:center;padding:28px 12px;color:var(--text-muted);font-size:0.82rem;">🔔 No tienes notificaciones nuevas. Aquí aparecerán solicitudes de clan, retos de match, amistad y mensajes en tiempo real.</div>';
      return;
    }
    box.innerHTML = this.notifications.map((n) => {
      const timeStr = n.createdAt ? new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      return `
        <div class="social-row-card" style="padding:9px 11px;flex-direction:column;align-items:stretch;gap:6px;">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <strong style="color:var(--gold-bright);font-size:0.82rem;">${escapeHtml(n.title || 'CHESS.MOD')}</strong>
            <span style="font-size:0.66rem;color:var(--text-muted);">${timeStr}</span>
          </div>
          <div style="font-size:0.8rem;color:#ebe3d5;">${escapeHtml(n.message || '')}</div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">${this.getNotifButtonsHtml(n)}</div>
        </div>`;
    }).join('');

    box.querySelectorAll('[data-ntf-act]').forEach((b) => {
      b.addEventListener('click', () => this.handleNotificationAction(b.dataset.ntfId, b.dataset.ntfAct));
    });
  }

  async handleNotificationAction(notifId, action) {
    const n = this.notifications.find((x) => x.id === notifId);
    if (!n) return;
    try {
      if (action === 'clan_accept' || action === 'clan_reject') {
        const accept = action === 'clan_accept';
        const res = await api.respondClanRequest(n.data.clanId, n.data.requestId, accept);
        n.resolvedLabel = accept ? '✅ Aceptado en el clan' : '✕ Rechazado';
        if (res.user) this.setUser(res.user);
        if (this.activeScreen === 'social' && this.activeSocialTab === 'clans') this.loadClans();
        showToast(accept ? '✅ Usuario aceptado en tu clan.' : 'Solicitud de clan rechazada.', accept ? 'success' : 'info');
      } else if (action === 'friend_accept' || action === 'friend_reject') {
        const accept = action === 'friend_accept';
        const res = accept
          ? await api.acceptFriend(n.data.friendshipId)
          : await api.rejectFriend(n.data.friendshipId);
        n.resolvedLabel = accept ? '🤝 Amigo agregado' : '✕ Rechazado';
        if (this.activeScreen === 'social' && this.activeSocialTab === 'friends') this.renderFriends(res.summary);
        showToast(accept ? '🤝 ¡Solicitud de amistad aceptada!' : 'Solicitud rechazada.', accept ? 'success' : 'info');
      } else if (action === 'match_join') {
        n.resolvedLabel = '⚔️ Uniéndose al match...';
        document.getElementById('modal-notifications')?.classList.remove('open');
        mpSocket.connect();
        mpSocket.emit('private:join', { code: n.data.code });
        showToast(`⚔️ Uniéndote al match contra ${n.data.hostUsername || 'tu rival'}...`, 'success');
      } else if (action === 'match_reject') {
        n.resolvedLabel = '✕ Match rechazado';
        mpSocket.emit('match:invite_respond', { code: n.data.code, accept: false });
        showToast('Rechazaste la solicitud de match.', 'info');
      } else if (action === 'open_friend_chat') {
        document.getElementById('modal-notifications')?.classList.remove('open');
        this.openFriendChat({ userId: n.data.friendId, username: n.data.friendUsername || n.fromUsername });
      } else if (action === 'open_clan') {
        document.getElementById('modal-notifications')?.classList.remove('open');
        this.activeSocialTab = 'clans';
        this.activeClanTab = 'chat';
        this.switchScreen('social');
        document.querySelector('#social-tabs-bar [data-social-tab="clans"]')?.click();
      }
      this.renderNotificationsModal();
    } catch (err) {
      showToast(err.message || 'No se pudo completar la acción.', 'error');
    }
  }

  sendDirectMatchInvite(targetUserId, targetUsername) {
    if (!this.user) return this.openAuthModal('login');
    mpSocket.connect();
    mpSocket.emit('match:invite', {
      targetUserId,
      timeMinutes: this.battle.selectedMinutes || 10
    });
    showToast(`⚔️ Solicitud de match enviada a ${targetUsername}. Esperando respuesta...`, 'success');
  }

  syncModGameModeBuilderFromObj(mod) {
    const gm = mod?.gameMode || {};
    const bs = document.getElementById('mod-gm-boardsize');
    const ar = document.getElementById('mod-gm-army');
    const tm = document.getElementById('mod-gm-team');
    const at = document.getElementById('mod-gm-atomic');
    const rp = document.getElementById('mod-gm-random');
    const eq = document.getElementById('mod-gm-quake');
    if (bs) bs.value = String(gm.boardSize || 8);
    if (ar) ar.value = gm.armyPreset || 'standard';
    if (tm) tm.value = gm.teamMode || '';
    if (at) at.checked = Boolean(gm.atomicMode);
    if (rp) rp.checked = Boolean(gm.randomPowers);
    if (eq) eq.checked = Number(gm.earthquakeEvery) > 0;
  }

  async loadMissionsScreen() {
    const guestBox = document.getElementById('missions-guest-box');
    const grid = document.getElementById('missions-list-grid');
    if (guestBox) guestBox.classList.toggle('hidden', Boolean(this.user));
    if (grid) grid.classList.toggle('hidden', !this.user);
    if (!this.user || !grid) return;
    try {
      const { missions } = await api.getMissions();
      grid.innerHTML = (missions || []).map((m) => `
        <div class="shop-card ${m.claimed ? 'owned' : (m.canClaim ? 'equipped' : '')}">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;margin-bottom:6px;">
              <span class="pill ${m.badgeClass || 'muted'}">${m.difficulty}</span>
              <span class="pill" style="border-color:var(--gold);color:#ffe27a;">🪙 +${m.rewardMods} Mods</span>
            </div>
            <h3 style="font-family:var(--font-display);font-size:0.98rem;color:var(--gold-bright);margin-bottom:4px;">🎯 ${m.title}</h3>
            <p style="font-size:0.78rem;color:var(--text-muted);line-height:1.45;margin-bottom:8px;">${m.description}</p>
            <div class="xp-mini-track" style="height:7px;"><div class="xp-mini-fill" style="width:${m.pct}%;"></div></div>
            <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">Progreso: <strong>${m.progress} / ${m.target}</strong> (${m.pct}%)</div>
          </div>
          <div class="shop-card-actions">
            ${m.claimed
              ? `<button class="btn btn-sm" disabled style="width:100%;">✓ Reclamada</button>`
              : (m.canClaim
                ? `<button class="btn btn-sm btn-gold" data-claim-mission="${m.id}" style="width:100%;">🎁 Reclamar +${m.rewardMods} Mods</button>`
                : `<button class="btn btn-sm" disabled style="width:100%;">En progreso (${m.progress}/${m.target})</button>`)}
          </div>
        </div>`).join('');

      grid.querySelectorAll('[data-claim-mission]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.claimMission(b.dataset.claimMission);
            this.sound.play('shop_buy');
            if (res.user) this.setUser(res.user);
            showToast(`🎯 ¡Misión completada! Recibiste +${res.rewardMods} Mods.`, 'success');
            this.loadMissionsScreen();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      grid.innerHTML = `<p style="color:#ffaca3;font-size:0.82rem;">${err.message}</p>`;
    }
  }

  async openFriendChat(friend) {
    if (!friend?.userId) return;
    this.activeChatFriend = friend;
    const title = document.getElementById('fchat-friend-name');
    if (title) title.textContent = `💬 ${friend.username}`;
    document.getElementById('modal-friend-chat')?.classList.add('open');
    await this.loadFriendChatMessages();
    document.getElementById('fchat-input')?.focus();
  }

  async loadFriendChatMessages() {
    if (!this.activeChatFriend) return;
    const box = document.getElementById('fchat-messages-box');
    if (!box) return;
    try {
      const { messages } = await api.getFriendMessages(this.activeChatFriend.userId);
      if (!messages?.length) {
        box.innerHTML = '<p style="font-size:0.78rem;color:var(--text-muted);text-align:center;margin:auto;">Aún no hay mensajes. ¡Saluda a tu amigo!</p>';
        return;
      }
      const myId = this.user?.id;
      box.innerHTML = messages.map((m) => {
        const mine = m.senderId === myId;
        return `
          <div style="align-self:${mine ? 'flex-end' : 'flex-start'};max-width:82%;padding:7px 10px;border-radius:10px;background:${mine ? 'rgba(207,166,76,0.22)' : 'rgba(38,84,61,0.34)'};border:1px solid ${mine ? 'rgba(207,166,76,0.45)' : 'rgba(81,150,116,0.45)'};">
            <div style="font-size:0.66rem;color:var(--gold);margin-bottom:2px;">${mine ? 'Tú' : m.senderUsername}</div>
            <div style="font-size:0.8rem;color:#f4efe6;word-break:break-word;">${m.content}</div>
          </div>`;
      }).join('');
      box.scrollTop = box.scrollHeight;
    } catch (err) {
      box.innerHTML = `<p style="color:#ffaca3;font-size:0.78rem;">${err.message}</p>`;
    }
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

  openModeLauncher({ specialCfg = null, label = 'Ajedrez Clásico', minutes = this.battle.selectedMinutes } = {}) {
    this.pendingLaunchMode = { specialCfg, label, minutes };
    const badge = document.getElementById('ml-badge');
    const title = document.getElementById('ml-title');
    const desc = document.getElementById('ml-desc');
    if (badge) badge.textContent = specialCfg ? `MODO CAÓTICO · ${specialCfg.badge}` : 'MODO COMPETITIVO · ELO FIDE';
    if (title) title.textContent = specialCfg ? `${specialCfg.icon} ${specialCfg.name}` : `♟️ ${label}`;
    if (desc) {
      desc.textContent = specialCfg
        ? `${specialCfg.description} Elige jugar contra Bot (nivel FIDE), buscar emparejamiento online o crear una Sala Privada con código.`
        : 'Elige si deseas enfrentar a un Bot (nivel FIDE), buscar emparejamiento contra un jugador real o crear una Sala Privada con código.';
    }
    const lvlSel = document.getElementById('ml-bot-level-select');
    if (lvlSel) lvlSel.value = String(this.selectedAiDifficulty || 3);
    document.getElementById('modal-mode-launcher')?.classList.add('open');
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
    const specialModeId = document.getElementById('private-mode-select')?.value || null;
    const timeMinutes = parseInt(document.getElementById('private-time-select')?.value ?? String(this.queueTimeMinutes), 10);
    const betMods = parseInt(document.getElementById('private-bet-select')?.value || '0', 10) || 0;
    const allowPowers = document.getElementById('private-allow-powers')?.checked !== false;
    const allowHints = Boolean(document.getElementById('private-allow-hints')?.checked);
    const allowUndo = Boolean(document.getElementById('private-allow-undo')?.checked);
    const roomSettings = {
      specialModeId: specialModeId || null,
      timeMinutes: Number.isFinite(timeMinutes) ? timeMinutes : 10,
      betMods,
      allowPowers,
      allowHints,
      allowUndo
    };
    mpSocket.connect();
    mpSocket.emit('private:create', {
      timeMinutes: roomSettings.timeMinutes,
      betMods,
      specialModeId: roomSettings.specialModeId,
      roomSettings,
      customMod: chosenMod
    });
  }

  async loadSecurityPanel() {
    if (!this.user) return;
    try {
      const st = await api.getSecurityStatus();
      const b2 = document.getElementById('sec-2fa-badge');
      const bp = document.getElementById('sec-pin-badge');
      if (b2) {
        b2.textContent = st.totpEnabled ? `2FA: ACTIVO (${st.backupCodesRemaining} resp.)` : '2FA: Desactivado';
        b2.className = `pill ${st.totpEnabled ? 'jade' : 'muted'}`;
      }
      if (bp) {
        bp.textContent = st.hasPin ? 'PIN: Activo' : 'PIN: Sin PIN';
        bp.className = `pill ${st.hasPin ? 'jade' : 'muted'}`;
      }
      document.getElementById('btn-sec-setup-2fa')?.classList.toggle('hidden', Boolean(st.totpEnabled));
      document.getElementById('btn-sec-disable-2fa')?.classList.toggle('hidden', !st.totpEnabled);

      const evBox = document.getElementById('sec-events-list');
      if (evBox) {
        evBox.innerHTML = st.events?.length
          ? st.events.map((ev) => `<div style="padding:5px 8px;border-radius:6px;background:rgba(12,11,9,0.7);border-left:2px solid var(--gold);"><strong>${ev.type}</strong> · ${ev.details} <span style="color:var(--text-muted);font-size:0.68rem;">(${new Date(ev.createdAt).toLocaleString('es-PE')})</span></div>`).join('')
          : '<span style="color:var(--text-muted);">Sin eventos registrados aún.</span>';
      }
    } catch {}
  }

  renderLiveMatchesList() {
    const card = document.getElementById('mp-live-spectate-card');
    const list = document.getElementById('mp-live-matches-list');
    if (card) card.classList.toggle('hidden', !this.user);
    if (!list) return;
    if (!this.livePvpMatches.length) {
      list.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);">No hay partidas PvP en curso en este instante. Cuando dos jugadores se enfrenten aparecerán aquí para espectear.</p>';
      return;
    }
    list.innerHTML = this.livePvpMatches.map((m) => `
      <div class="social-row-card">
        <div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
            <strong>${m.white.username} (${m.white.elo})</strong>
            <span style="color:var(--gold);">vs</span>
            <strong>${m.black.username} (${m.black.elo})</strong>
            ${m.betPot > 0 ? `<span class="pill">🪙 Bote ${m.betPot}</span>` : ''}
            ${m.customModName ? `<span class="pill muted">🧩 ${m.customModName}</span>` : ''}
          </div>
          <div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Turno ${m.turnNumber} · 👁️ ${m.spectatorsCount} espectando</div>
        </div>
        <button class="btn btn-sm btn-gold" data-spectate-match="${m.matchId}">👁️ Espectear</button>
      </div>`).join('');

    list.querySelectorAll('[data-spectate-match]').forEach((btn) => {
      btn.addEventListener('click', () => {
        mpSocket.connect();
        mpSocket.emit('match:spectate', { matchId: btn.dataset.spectateMatch });
      });
    });
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

  toggleMatchmaking(specialModeIdOverride = undefined) {
    if (!this.user) {
      this.openAuthModal('login');
      showToast('Inicia sesión para jugar Multijugador Online con Elo.', 'info');
      return;
    }
    if (this.inQueue) {
      mpSocket.emit('queue:leave');
      this.inQueue = false;
      this.queueSpecialModeId = null;
      clearInterval(this.queueTimerInterval);
      this.renderMultiplayerScreen();
    } else {
      if (specialModeIdOverride !== undefined) this.queueSpecialModeId = specialModeIdOverride;
      mpSocket.connect();
      mpSocket.emit('queue:join', {
        timeMinutes: this.queueTimeMinutes,
        betMods: this.queueBetMods || 0,
        specialModeId: this.queueSpecialModeId || null
      });
    }
  }

  updateQueueTimerUI() {
    const el = document.getElementById('mp-queue-timer');
    if (!el || !this.inQueue) return;
    const sec = Math.floor((Date.now() - this.queueStartedAt) / 1000);
    const range = 100 + Math.floor(sec / 2.5) * 50;
    const sp = this.queueSpecialModeId ? SPECIAL_GAME_MODES.find((m) => m.id === this.queueSpecialModeId) : null;
    const modePrefix = sp ? `[${sp.icon} ${sp.name}] ` : '';
    el.textContent = `${modePrefix}Buscando rival real... ${sec}s · Rango Elo FIDE ±${range}`;
  }

  openAuthModal(tab = 'login') {
    if (!hasSavedLanguage()) {
      this.pendingAuthAfterLang = tab;
      document.getElementById('modal-language-picker')?.classList.add('open');
      return;
    }
    this.switchAuthTab(tab);
    document.getElementById('modal-auth')?.classList.add('open');
  }

  openMandatoryTrainerModal() {
    if (!this.user || this.user.trainerId) return;
    this.pendingTrainerId = null;
    const confirmBtn = document.getElementById('btn-confirm-permanent-trainer');
    if (confirmBtn) confirmBtn.disabled = true;
    const lbl = document.getElementById('trainer-pending-label');
    if (lbl) lbl.textContent = 'Selecciona una tarjeta de entrenador arriba para continuar.';
    this.renderTrainersGrids();
    document.getElementById('modal-trainer-picker')?.classList.add('open');
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
    const p = this.prefs;
    const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = Boolean(val); };
    const m = document.getElementById('set-music-vol');
    const sf = document.getElementById('set-sfx-vol');
    if (m) m.value = s.musicVol;
    if (sf) sf.value = s.sfxVol;
    setChecked('set-mute-all', s.muted);
    setChecked('set-reduced-vfx', s.reducedVfx);
    setChecked('set-show-dialogues', p.showDialogues !== false);
    setChecked('set-low-time-alert', p.lowTimeAlert !== false);
    setChecked('set-show-coords', p.showCoords !== false);
    setChecked('set-highlight-last', p.highlightLastMove !== false);
    setChecked('set-show-legal', p.showLegalHints !== false);
    setChecked('set-auto-queen', Boolean(p.autoQueen));
    setChecked('set-prematch-guide', p.showPreMatchGuide !== false);
    setChecked('set-board-shake', p.boardShake !== false);
    setChecked('set-eye-tracking', p.eyeTracking !== false);
    setChecked('set-bg-particles', p.bgParticles !== false);
    setChecked('set-high-contrast', Boolean(p.highContrast));

    const mp = document.getElementById('set-music-pct');
    const sp = document.getElementById('set-sfx-pct');
    if (mp) mp.textContent = `${Math.round(s.musicVol * 100)}%`;
    if (sp) sp.textContent = `${Math.round(s.sfxVol * 100)}%`;

    document.querySelectorAll('#settings-lang-pills [data-set-lang]').forEach((b) => {
      b.classList.toggle('active', b.dataset.setLang === this.lang);
    });
    document.querySelectorAll('#settings-anim-pills [data-anim-speed]').forEach((b) => {
      b.classList.toggle('active', b.dataset.animSpeed === (p.animSpeed || 'normal'));
    });
    document.querySelectorAll('#settings-scale-pills [data-board-scale]').forEach((b) => {
      b.classList.toggle('active', b.dataset.boardScale === (p.boardScale || 'normal'));
    });
  }

  renderAllScreens() {
    this.renderSidebarUser();
    this.syncClanCreateSelectors();
    this.renderTrainersGrids();
    this.renderMultiplayerScreen();
    this.renderCampaignScreen();
    this.renderShopScreen();
    this.renderBattlePassScreen();
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

    const navMod = document.getElementById('nav-btn-mod');
    if (navMod) {
      navMod.classList.toggle('hidden', !u?.isModerator);
      const navLabel = navMod.querySelector('[data-i18n="nav_moderation"]');
      const navIco = navMod.querySelector('.nav-ico');
      if (navLabel) navLabel.textContent = u?.isOwner ? 'Owner' : t('nav_moderation', this.lang);
      if (navIco) navIco.textContent = u?.isOwner ? '👑' : '🛡️';
    }

    if (u) {
      if (avatarEl) {
        avatarEl.className = `avatar-badge ${u.frameId || 'frame_stone'}${u.isVip ? ' vip-aura' : ''}`;
        avatarEl.innerHTML = renderAvatarMarkup(u.avatar);
      }
      if (nameEl) {
        nameEl.className = `sidebar-user-name${u.isVip ? ' vip-name' : ''}`;
        const tagPrefix = u.clan?.tag ? `[${u.clan.tag}] ` : '';
        const rolePrefix = u.isOwner ? '👑 ' : (u.isModerator ? '🛡️ ' : (u.isVip ? '👑 ' : ''));
        nameEl.textContent = `${rolePrefix}${tagPrefix}${u.username}`;
      }
      if (eloEl) eloEl.textContent = `Elo ${u.elo}`;
      if (xpEl) xpEl.textContent = `Nv.${u.level} · ${u.xp} XP`;
      if (modsEl) modsEl.textContent = `🪙 ${u.mods ?? 100}`;
      if (barEl) barEl.style.width = `${u.levelProgressPct || 0}%`;
      if (btnEl) btnEl.textContent = t('sidebar_profile_btn', this.lang);
    } else {
      if (avatarEl) {
        avatarEl.className = 'avatar-badge frame_stone';
        avatarEl.innerHTML = renderAvatarMarkup('preset:obsidian_king');
      }
      if (nameEl) {
        nameEl.className = 'sidebar-user-name';
        nameEl.textContent = t('sidebar_guest', this.lang);
      }
      if (eloEl) eloEl.textContent = 'Elo 0';
      if (xpEl) xpEl.textContent = '0 XP';
      if (modsEl) modsEl.textContent = '🪙 100';
      if (barEl) barEl.style.width = '0%';
      if (btnEl) btnEl.textContent = t('sidebar_login_btn', this.lang);
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

    const bpPanel = document.getElementById('shop-battlepass-panel');
    const grid = document.getElementById('shop-items-grid');
    if (!grid) return;

    const tab = this.activeShopTab || 'battlepass';
    if (bpPanel) bpPanel.classList.toggle('hidden', tab !== 'battlepass');
    grid.classList.toggle('hidden', tab === 'battlepass');
    if (tab === 'battlepass') {
      this.renderBattlePassScreen();
      return;
    }

    // En la Tienda SOLO aparecen artículos a la venta (Mods o Mod VIP), NO artículos exclusivos de Jefes/Pase/Gratis
    let items = [];
    if (tab === 'powers') {
      items = COSMETIC_POWERS.filter((it) => !it.bossUnlock && !it.battlePassSeason && (it.priceMods > 0 || it.vipOnly));
    } else if (tab === 'pieceSkins') {
      items = COSMETIC_PIECE_SKINS.filter((it) => !it.battlePassSeason && (it.priceMods > 0 || it.vipOnly));
    } else {
      items = COSMETIC_BOARDS.filter((it) => !it.battlePassSeason && (it.priceMods > 0 || it.vipOnly));
    }

    grid.innerHTML = items.map((item) => {
      const isOwned = item.vipOnly ? isVip : unlocked.has(item.id);
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
        : (isOwned
          ? `<span class="pill jade">✓ En tu Inventario</span>`
          : `<span class="pill">🪙 ${(item.priceMods || 0).toLocaleString('es-PE')} Mods</span>`);

      let actionBtn = '';
      if (isEquipped) {
        actionBtn = `<button class="btn btn-sm btn-gold" data-goto-inv="${tab}">🎒 Equipado (Ver Inventario)</button>`;
      } else if (isOwned) {
        actionBtn = `<button class="btn btn-sm btn-primary" data-goto-inv="${tab}">🎒 Equipar en Inventario</button>`;
      } else if (item.vipOnly) {
        actionBtn = `<button class="btn btn-sm btn-gold" data-open-vip="1">👑 Obtener Mod VIP ($5)</button>`;
      } else {
        const canAfford = !u || mods >= (item.priceMods || 0);
        actionBtn = `<button class="btn btn-sm btn-gold" data-shop-buy="${item.id}" ${!canAfford ? 'title="Gana más Mods jugando partidas"' : ''}>🪙 Comprar (${(item.priceMods || 0).toLocaleString('es-PE')})</button>`;
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
    grid.querySelectorAll('[data-goto-inv]').forEach((b) => {
      b.addEventListener('click', () => {
        this.activeInvTab = b.dataset.gotoInv || 'powers';
        this.switchScreen('customize');
        document.querySelector(`#inventory-tabs-bar [data-inv-tab="${this.activeInvTab}"]`)?.click();
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

  renderBattlePassScreen() {
    const u = this.user;
    const bp = u?.battlePassS1 || { owned: false, xp: 0, claimedTiers: [] };
    const ownedPaid = Boolean(bp.owned || u?.isOwner);
    const xp = Number(u?.xp || 0);
    const maxXp = BATTLE_PASS_S1.tiers[BATTLE_PASS_S1.tiers.length - 1]?.xpRequired || 3920;
    const pct = Math.min(100, Math.round((xp / maxXp) * 100));
    const claimedSet = new Set(bp.claimedTiers || []);

    const badge = document.getElementById('bp-owned-badge');
    if (badge) {
      badge.textContent = ownedPaid ? '✓ PASE PREMIUM ACTIVO + GRATIS' : '🆓 Carril Gratis · Premium $10 USD';
      badge.className = `pill ${ownedPaid ? 'jade' : 'muted'}`;
    }
    const bar = document.getElementById('bp-xp-bar');
    if (bar) bar.style.width = `${u?.isOwner ? 100 : pct}%`;
    const lbl = document.getElementById('bp-xp-label');
    if (lbl) lbl.textContent = u?.isOwner
      ? '👑 Owner: TODOS los 50 niveles (Gratis + Premium) desbloqueados'
      : `${xp.toLocaleString('es-PE')} / ${maxXp.toLocaleString('es-PE')} XP · Nivel actual: ${Math.min(50, Math.floor(xp / 80) + 1)} / 50`;

    const buyBox = document.getElementById('bp-buy-actions');
    if (buyBox) buyBox.classList.toggle('hidden', ownedPaid);

    const grid = document.getElementById('bp-tiers-grid');
    if (!grid) return;

    const range = this.activeBpRange || '1-10';
    let list = BATTLE_PASS_S1.tiers;
    if (range !== 'all') {
      const [lo, hi] = range.split('-').map((n) => parseInt(n, 10));
      list = list.filter((t) => t.tier >= lo && t.tier <= hi);
    }

    const renderCell = (tier, track, data) => {
      const isPaid = track === 'paid';
      const isClaimed = claimedSet.has(`${track}:${tier.tier}`) || Boolean(u?.isOwner);
      const canClaim = Boolean(u) && !isClaimed && (xp >= tier.xpRequired) && (!isPaid || ownedPaid);
      const cls = isClaimed ? 'claimed' : (canClaim ? 'unlocked' : 'locked');
      let btnHtml = '';
      if (isClaimed) {
        btnHtml = data.rewardId
          ? `<button class="btn btn-sm btn-primary" data-bp-goto-inv="1">✓ En Inventario</button>`
          : `<button class="btn btn-sm" disabled>✓ Reclamado</button>`;
      } else if (canClaim) {
        btnHtml = `<button class="btn btn-sm btn-gold" data-bp-claim="${tier.tier}" data-bp-track="${track}">🎁 Reclamar</button>`;
      } else if (isPaid && !ownedPaid) {
        btnHtml = `<button class="btn btn-sm" disabled>🔒 Solo Pase de Paga ($10)</button>`;
      } else if (!u) {
        btnHtml = `<button class="btn btn-sm" disabled>Inicia sesión</button>`;
      } else {
        btnHtml = `<button class="btn btn-sm" disabled>Requiere ${tier.xpRequired} XP</button>`;
      }
      return `
        <div class="bp-track-cell ${track} ${cls}">
          <div>
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;margin-bottom:4px;">
              <span class="pill ${isPaid ? '' : 'muted'}" style="font-size:0.62rem;${isPaid ? 'border-color:#f472b6;color:#fbcfe8;' : ''}">${isPaid ? '👑 PREMIUM ($10)' : '🆓 GRATIS'}</span>
              <span style="font-size:1.1rem;">${data.icon}</span>
            </div>
            <strong style="font-size:0.82rem;color:${isPaid ? '#fff4c2' : '#d6d1c7'};display:block;">${data.title}</strong>
          </div>
          ${btnHtml}
        </div>`;
    };

    grid.innerHTML = list.map((tier) => `
      <div class="bp-tier-row">
        <div class="bp-tier-num-col">
          <strong style="font-family:var(--font-display);color:var(--gold-bright);font-size:0.95rem;">Nv. ${tier.tier}</strong>
          <span style="font-size:0.68rem;color:var(--text-muted);">${tier.xpRequired} XP</span>
        </div>
        ${renderCell(tier, 'free', tier.free)}
        ${renderCell(tier, 'paid', tier.paid)}
      </div>`).join('');

    grid.querySelectorAll('[data-bp-claim]').forEach((b) => {
      b.addEventListener('click', async () => {
        try {
          const tierNum = Number(b.dataset.bpClaim);
          const track = b.dataset.bpTrack || 'free';
          const res = await api.claimBattlePassTier(tierNum, track);
          this.sound.play('shop_buy');
          this.setUser(res.user);
          showToast(`🎖️ ¡Recompensa Nivel ${tierNum} (${track === 'paid' ? 'Premium' : 'Gratis'}) enviada a tu Inventario!`, 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    });
    grid.querySelectorAll('[data-bp-goto-inv]').forEach((b) => {
      b.addEventListener('click', () => this.switchScreen('customize'));
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

    const modeSel = document.getElementById('private-mode-select');
    if (modeSel) {
      const prevMode = modeSel.value;
      modeSel.innerHTML = `<option value="">♟️ Clásico Oficial (8×8)</option>`
        + SPECIAL_GAME_MODES.map((m) => `<option value="${m.id}">${m.icon} ${m.name} (${m.badge})</option>`).join('');
      if (prevMode && SPECIAL_GAME_MODES.some((m) => m.id === prevMode)) modeSel.value = prevMode;
    }

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
    this.renderLiveMatchesList();
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
      const loreBox = campaign.loreSummary
        ? `<div class="story-lore-box" style="margin-top:10px;padding:10px 12px;border-radius:9px;background:rgba(12,11,9,0.78);border:1px solid rgba(207,166,76,0.34);border-left:3px solid var(--gold-bright);">
            <div style="font-size:0.68rem;letter-spacing:0.14em;color:var(--gold);font-family:var(--font-display);margin-bottom:4px;">📜 ${escapeHtml(campaign.loreAct || 'CRÓNICA DEL MODO HISTORIA')}</div>
            <div style="font-size:0.81rem;color:#ebe3d5;line-height:1.5;">${escapeHtml(campaign.loreSummary)}</div>
          </div>`
        : '';
      headerEl.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
          <div>
            <h3 style="font-family:var(--font-display); color:var(--gold-bright); font-size:1.15rem;">${campaign.title}</h3>
            <p style="font-size:0.83rem; color:var(--text-muted); margin-top:4px;">${campaign.description}</p>
          </div>
          <span class="pill ${chUnlocked ? 'jade' : 'crimson'}">${completed.length} / 5 Completados</span>
        </div>
        ${loreBox}
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
    const fideCatEl = document.getElementById('profile-fide-cat');
    if (fideCatEl) {
      const cat = u.fideCategory || getFideCategory(u.elo);
      fideCatEl.textContent = `♟️ ${cat.title} (${cat.code})`;
      fideCatEl.style.color = cat.color || 'var(--gold-bright)';
    }
    document.getElementById('profile-level-val').textContent = `Nv. ${u.level} · ${u.levelTitle}`;
    document.getElementById('profile-xp-val').textContent = u.nextLevelXp ? `${u.xp} / ${u.nextLevelXp} XP` : `${u.xp} XP (Máximo)`;
    const modsValEl = document.getElementById('profile-mods-val');
    if (modsValEl) modsValEl.textContent = String(u.mods ?? 100);
    document.getElementById('profile-owner-pill')?.classList.toggle('hidden', !u.isOwner);
    document.getElementById('profile-mod-pill')?.classList.toggle('hidden', !(u.isModerator && !u.isOwner));
    document.getElementById('profile-vip-pill')?.classList.toggle('hidden', !u.isVip);
    const trPill = document.getElementById('profile-trainer-pill');
    if (trPill) {
      const tr = TRAINERS.find((x) => x.id === u.trainerId);
      trPill.classList.toggle('hidden', !tr);
      if (tr) trPill.textContent = `🎓 Mentor: ${tr.name}`;
    }
    document.getElementById('profile-xp-bar').style.width = `${u.levelProgressPct || 0}%`;

    const inputName = document.getElementById('input-edit-username');
    if (inputName && document.activeElement !== inputName) inputName.value = u.username;
  }

  renderCosmeticsScreen() {
    const u = this.user;
    const level = u?.level || 1;
    const isVip = Boolean(u?.isVip);
    const unlocked = new Set(u?.unlockedCosmetics || ['preset:obsidian_king', 'preset:jade_guardian', 'frame_stone', 'board_classic_maya', 'pieces_classic', 'power_none']);

    // Resumen rápido de equipamiento activo en la parte superior del Inventario
    const loadSum = document.getElementById('inventory-loadout-summary');
    if (loadSum) {
      const eqPow = COSMETIC_POWERS.find((x) => x.id === (u?.equippedPowerId || 'power_none')) || COSMETIC_POWERS[0];
      const eqSkin = COSMETIC_PIECE_SKINS.find((x) => x.id === (u?.pieceSkinId || 'pieces_classic')) || COSMETIC_PIECE_SKINS[0];
      const eqBoard = COSMETIC_BOARDS.find((x) => x.id === (u?.boardThemeId || 'board_classic_maya')) || COSMETIC_BOARDS[0];
      loadSum.innerHTML = `
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;">
          <span class="pill jade">⚡ Poder: <strong>${eqPow.icon} ${eqPow.name}</strong></span>
          <span class="pill">♟️ Fichas: <strong>${eqSkin.name}</strong></span>
          <span class="pill">🗺️ Tablero: <strong>${eqBoard.name}</strong></span>
        </div>
        <span style="font-size:0.74rem;color:var(--text-muted);">🎒 Solo muestras lo equipable aquí (para comprar más ve a 🛒 Tienda)</span>`;
    }

    // Mostrar en el Inventario TODOS los artículos que el jugador posee/desbloqueó (y los básicos), ordenando poseídos primero
    const sortOwnedFirst = (arr, isUnlFn) => [...arr].sort((a, b) => Number(isUnlFn(b)) - Number(isUnlFn(a)));

    const avGrid = document.getElementById('cosmetics-avatars-grid');
    if (avGrid) {
      const avItems = sortOwnedFirst(
        COSMETIC_AVATARS.filter((item) => !item.hiddenUntilUnlocked || unlocked.has(item.id)),
        (it) => unlocked.has(it.id) || (!it.battlePassSeason && !it.bossUnlock && level >= it.minLevel)
      );
      avGrid.innerHTML = avItems.map((item) => {
        const isUnl = unlocked.has(item.id) || (!item.battlePassSeason && !item.bossUnlock && level >= item.minLevel);
        const isEq = u?.avatar === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="avatar-badge ${u?.frameId || 'frame_stone'}" style="width:62px;height:62px;">${renderAvatarMarkup(item.id)}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'En Inventario' : (item.exclusiveReason || `Requiere Nv. ${item.minLevel}`)}</span>
            <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-avatar="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
              ${isEq ? '✓ Equipado' : 'Equipar'}
            </button>
          </div>`;
      }).join('');
      avGrid.querySelectorAll('[data-equip-avatar]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ avatar: b.dataset.equipAvatar })));
    }

    const frGrid = document.getElementById('cosmetics-frames-grid');
    if (frGrid) {
      const frItems = sortOwnedFirst(
        COSMETIC_FRAMES.filter((item) => (!item.hiddenUntilUnlocked || unlocked.has(item.id)) && (!item.vipOnly || isVip)),
        (it) => it.vipOnly ? isVip : (unlocked.has(it.id) || (!it.battlePassSeason && !it.bossUnlock && level >= it.minLevel))
      );
      frGrid.innerHTML = frItems.map((item) => {
        const isUnl = item.vipOnly ? isVip : (unlocked.has(item.id) || (!item.battlePassSeason && !item.bossUnlock && level >= item.minLevel));
        const isEq = u?.frameId === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="avatar-badge ${item.id}" style="width:62px;height:62px;">${renderAvatarMarkup(u?.avatar || 'preset:obsidian_king')}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'En Inventario' : (item.exclusiveReason || `Requiere Nv. ${item.minLevel}`)}</span>
            <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-frame="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
              ${isEq ? '✓ Equipado' : 'Equipar'}
            </button>
          </div>`;
      }).join('');
      frGrid.querySelectorAll('[data-equip-frame]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ frameId: b.dataset.equipFrame })));
    }

    const bdGrid = document.getElementById('cosmetics-boards-grid');
    if (bdGrid) {
      const bdItems = sortOwnedFirst(
        COSMETIC_BOARDS.filter((item) => !item.vipOnly || isVip),
        (it) => it.vipOnly ? isVip : (unlocked.has(it.id) || (!it.battlePassSeason && level >= (it.minLevel || 99)) || it.priceMods === 0)
      );
      bdGrid.innerHTML = bdItems.map((item) => {
        const isUnl = item.vipOnly ? isVip : (unlocked.has(item.id) || (!item.battlePassSeason && level >= (item.minLevel || 99)) || item.priceMods === 0);
        const isEq = (u?.boardThemeId || 'board_classic_maya') === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="board-preview-mini">
              <div style="background:${item.light}"></div><div style="background:${item.dark}"></div>
              <div style="background:${item.dark}"></div><div style="background:${item.light}"></div>
            </div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'En Inventario' : (item.exclusiveReason || (item.priceMods ? `Tienda · 🪙 ${item.priceMods}` : `Requiere Nv. ${item.minLevel}`))}</span>
            <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-board="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
              ${isEq ? '✓ Equipado' : 'Equipar'}
            </button>
          </div>`;
      }).join('');
      bdGrid.querySelectorAll('[data-equip-board]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ boardThemeId: b.dataset.equipBoard })));
    }

    const pcGrid = document.getElementById('cosmetics-pieces-grid');
    if (pcGrid) {
      const pcItems = sortOwnedFirst(
        COSMETIC_PIECE_SKINS.filter((item) => !item.vipOnly || isVip),
        (it) => it.vipOnly ? isVip : (unlocked.has(it.id) || (!it.battlePassSeason && it.priceMods === 0))
      );
      pcGrid.innerHTML = pcItems.map((item) => {
        const isUnl = item.vipOnly ? isVip : (unlocked.has(item.id) || (!item.battlePassSeason && item.priceMods === 0));
        const isEq = (u?.pieceSkinId || 'pieces_classic') === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="shop-card-icon piece-wrap ${item.cssClass || ''}" style="width:58px;height:58px;padding:4px;">${SVGS.wQ}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'En Inventario' : (item.exclusiveReason || `Tienda · 🪙 ${item.priceMods}`)}</span>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-pieces="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
                ${isEq ? '✓ Equipado' : 'Equipar'}
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
      const pwItems = sortOwnedFirst(
        COSMETIC_POWERS.filter((item) => (!item.vipOnly || isVip) && (!item.hiddenUntilUnlocked || unlocked.has(item.id) || u?.isOwner)),
        (it) => it.vipOnly ? isVip : ((it.bossUnlock || it.battlePassSeason) ? unlocked.has(it.id) : (unlocked.has(it.id) || it.priceMods === 0))
      );
      pwGrid.innerHTML = pwItems.map((item) => {
        const isUnl = item.vipOnly ? isVip : ((item.bossUnlock || item.battlePassSeason) ? unlocked.has(item.id) : (unlocked.has(item.id) || item.priceMods === 0));
        const isEq = (u?.equippedPowerId || 'power_none') === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="shop-card-icon" style="width:52px;height:52px;">${item.icon || '⚡'}</div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'En Inventario' : (item.exclusiveReason || `Tienda · 🪙 ${(item.priceMods || 0).toLocaleString('es-PE')}`)}</span>
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
        const roleBadge = p.isOwner
          ? ' <span class="pill" style="font-size:0.62rem;border-color:#ffd700;background:rgba(255,215,0,0.22);color:#fff2a6;font-weight:700;">👑 OWNER</span>'
          : (p.isModerator ? ' <span class="mod-badge-pill">🛡️ MOD</span>' : '');
        const clanTag = p.clanTag ? ` <span class="clan-tag-pill">[${p.clanTag}]</span>` : '';
        const repBtn = !isMe && this.user
          ? ` <button class="btn btn-sm" style="padding:2px 6px;font-size:0.66rem;" data-quick-report="${p.username}" title="Reportar Hacks/Cheats">🚨</button>`
          : '';
        return `
          <tr class="${isMe ? 'is-me' : ''}">
            <td><span class="rank-num ${rankCls}">#${p.rank}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="avatar-badge ${p.frameId || 'frame_stone'}${vipAuraCls}" style="width:34px;height:34px;">${renderAvatarMarkup(p.avatar)}</span>
                <div>
                  <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                    ${clanTag}<strong class="${nameCls}" style="color:${isMe ? 'var(--gold-bright)' : 'var(--text-main)'};">${p.username}${isMe ? ' (Tú)' : ''}</strong>${roleBadge}${vipBadge}${this.renderPresencePill(p.id)}${repBtn}
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
      tbody.querySelectorAll('[data-quick-report]').forEach((btn) => {
        btn.addEventListener('click', () => this.openQuickReportModal(btn.dataset.quickReport));
      });
    } catch (err) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ffaca3;padding:20px;">${err.message}</td></tr>`;
    }
  }

  openQuickReportModal(username = '') {
    if (!this.user) return this.openAuthModal('login');
    const inp = document.getElementById('qreport-username');
    if (inp) inp.value = username;
    document.getElementById('modal-report-quick')?.classList.add('open');
  }

  renderTrainersGrids() {
    const chosenId = this.user?.trainerId || null;

    // 1. Grilla de la pantalla Jugar (refleja elección permanente o invita a crear cuenta)
    const playBox = document.getElementById('play-trainers-grid');
    const badge = document.getElementById('play-trainer-lock-badge');
    if (badge) {
      if (chosenId) {
        const chosenTr = TRAINERS.find((x) => x.id === chosenId);
        badge.textContent = `🔒 Mentor Permanente: ${chosenTr?.name || chosenId}`;
        badge.className = 'pill jade';
      } else {
        badge.textContent = '🔒 Elección única al crear cuenta';
        badge.className = 'pill muted';
      }
    }
    if (playBox) {
      playBox.innerHTML = TRAINERS.map((tr) => {
        const isMine = chosenId === tr.id;
        const isLockedOut = Boolean(chosenId) && !isMine;
        return `
        <div class="trainer-card ${tr.isHardest ? 'hardest' : ''} ${isMine ? 'selected-choice' : ''} ${isLockedOut ? 'locked-other' : ''}">
          <div>
            <div class="trainer-head">
              <div class="trainer-portrait">${getBossPortraitSVG(tr.bossId)}</div>
              <div style="min-width:0;">
                <span class="pill ${isMine ? 'jade' : (tr.isHardest ? 'crimson' : (tr.isStarter ? 'jade' : 'muted'))}" style="margin-bottom:4px;font-size:0.62rem;">
                  ${isMine ? '✓ TU MENTOR PERMANENTE' : tr.badge}
                </span>
                <h4 style="font-family:var(--font-display);color:${tr.isHardest ? '#ff9494' : 'var(--gold-bright)'};font-size:0.94rem;">${tr.name}</h4>
                <div style="font-size:0.72rem;font-weight:700;color:#ffe27a;">🎓 Mentor · ${tr.elo} Elo</div>
              </div>
            </div>
            <div style="margin-top:8px;padding:5px 8px;border-radius:7px;background:rgba(207,166,76,0.12);border:1px solid rgba(207,166,76,0.3);font-size:0.72rem;color:#ffe799;">
              <strong>Enseña:</strong> ${tr.taughtPowerLabel}
            </div>
            <p style="font-size:0.74rem;color:var(--text-muted);line-height:1.4;margin-top:6px;">${tr.description}</p>
          </div>
          ${isLockedOut
            ? `<button class="btn btn-sm" disabled style="width:100%;">🔒 Bloqueado (Ya elegiste tu entrenador)</button>`
            : `<button class="btn btn-sm ${tr.isHardest ? 'btn-danger' : 'btn-gold'}" data-start-trainer="${tr.id}" style="width:100%;">
                ${chosenId ? (tr.isStarter ? '🐱 Entrenar con Yam' : `🎓 Entrenar con ${tr.name.split(' ')[0]}`) : '🔒 Crear cuenta para elegir'}
              </button>`}
        </div>`;
      }).join('');

      playBox.querySelectorAll('[data-start-trainer]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (!this.user) {
            this.openAuthModal('register');
            showToast('Crea tu cuenta primero para elegir tu Entrenador Permanente (1 sola vez).', 'info');
            return;
          }
          if (!this.user.trainerId) {
            this.openMandatoryTrainerModal();
            return;
          }
          const trainer = TRAINERS.find((x) => x.id === this.user.trainerId);
          if (trainer) this.battle.startTrainerMatch(trainer, { minutes: this.battle.selectedMinutes });
        });
      });
    }

    // 2. Grilla del Modal Obligatorio de Elección Única (post-registro, imposible de saltar)
    const modalBox = document.getElementById('modal-trainers-grid');
    if (modalBox) {
      modalBox.innerHTML = TRAINERS.map((tr) => {
        const isPending = this.pendingTrainerId === tr.id;
        return `
        <div class="trainer-card ${tr.isHardest ? 'hardest' : ''} ${isPending ? 'selected-choice' : ''}" data-pick-trainer-card="${tr.id}" style="cursor:pointer;">
          <div>
            <div class="trainer-head">
              <div class="trainer-portrait">${getBossPortraitSVG(tr.bossId)}</div>
              <div style="min-width:0;">
                <span class="pill ${isPending ? 'jade' : (tr.isHardest ? 'crimson' : (tr.isStarter ? 'jade' : 'muted'))}" style="margin-bottom:4px;font-size:0.62rem;">
                  ${isPending ? '✓ SELECCIONADO' : tr.badge}
                </span>
                <h4 style="font-family:var(--font-display);color:${tr.isHardest ? '#ff9494' : 'var(--gold-bright)'};font-size:0.94rem;">${tr.name}</h4>
                <div style="font-size:0.72rem;font-weight:700;color:#ffe27a;">🎓 Mentor · ${tr.elo} Elo</div>
              </div>
            </div>
            <div style="margin-top:8px;padding:5px 8px;border-radius:7px;background:rgba(207,166,76,0.12);border:1px solid rgba(207,166,76,0.3);font-size:0.72rem;color:#ffe799;">
              <strong>Enseña:</strong> ${tr.taughtPowerLabel}
            </div>
            <p style="font-size:0.74rem;color:var(--text-muted);line-height:1.4;margin-top:6px;">${tr.description}</p>
          </div>
          <button type="button" class="btn btn-sm ${isPending ? 'btn-gold' : 'btn-primary'}" style="width:100%;">
            ${isPending ? '✓ Elegido (haz clic abajo para confirmar)' : `Seleccionar a ${tr.name.split(' ')[0]}`}
          </button>
        </div>`;
      }).join('');

      modalBox.querySelectorAll('[data-pick-trainer-card]').forEach((card) => {
        card.addEventListener('click', () => {
          this.pendingTrainerId = card.dataset.pickTrainerCard;
          const tr = TRAINERS.find((x) => x.id === this.pendingTrainerId);
          const lbl = document.getElementById('trainer-pending-label');
          if (lbl && tr) lbl.innerHTML = `Seleccionado: <strong style="color:var(--gold-bright);">${tr.name}</strong> (elección permanente, no se podrá cambiar).`;
          const confirmBtn = document.getElementById('btn-confirm-permanent-trainer');
          if (confirmBtn) confirmBtn.disabled = false;
          this.renderTrainersGrids();
        });
      });
    }
  }

  renderSpecialModesGrid() {
    const box = document.getElementById('special-modes-grid');
    if (!box) return;
    box.innerHTML = SPECIAL_GAME_MODES.map((m) => `
      <div class="trainer-card">
        <div>
          <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:6px;">
            <span style="font-size:1.75rem;">${m.icon}</span>
            <span class="pill">${m.badge}</span>
          </div>
          <h4 style="font-family:var(--font-display);color:var(--gold-bright);font-size:0.98rem;margin-bottom:5px;">${m.name}</h4>
          <p style="font-size:0.76rem;color:var(--text-muted);line-height:1.45;">${m.description}</p>
        </div>
        <button class="btn btn-sm btn-primary" data-start-special="${m.id}" style="width:100%;">🎲 Jugar ${m.name}</button>
      </div>`).join('');

    box.querySelectorAll('[data-start-special]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const cfg = SPECIAL_GAME_MODES.find((x) => x.id === btn.dataset.startSpecial);
        if (cfg) this.openModeLauncher({ specialCfg: cfg, minutes: this.battle.selectedMinutes });
      });
    });
  }

  async loadSocialScreen() {
    if (this.activeSocialTab === 'clans') await this.loadClans();
    if (this.activeSocialTab === 'friends') await this.loadFriends();
  }

  syncClanCreateSelectors() {
    const isVip = Boolean(this.user?.isVip || this.user?.isOwner);
    const colorSel = document.getElementById('clan-text-color');
    if (colorSel) {
      const prev = colorSel.value;
      colorSel.innerHTML = CLAN_TEXT_COLORS.map((c) => {
        const locked = c.vipOnly && !isVip;
        return `<option value="${c.hex}" ${locked ? 'disabled' : ''}>${c.name}${locked ? ' 🔒' : ''}</option>`;
      }).join('');
      if (prev && [...colorSel.options].some((o) => o.value === prev && !o.disabled)) colorSel.value = prev;
    }
    const fontSel = document.getElementById('clan-font-family');
    if (fontSel && !fontSel.options.length) {
      fontSel.innerHTML = CLAN_FONT_FAMILIES.map((f) => `<option value="${f.id}">${f.name}</option>`).join('');
    }
  }

  formatClanAvatarHtml(avatar, size = 44) {
    if (avatar && /^data:image\//.test(avatar)) {
      return `<img src="${avatar}" alt="Clan" style="width:${size}px;height:${size}px;object-fit:cover;border-radius:10px;border:1px solid var(--border-gold);flex-shrink:0;">`;
    }
    return `<div style="width:${size}px;height:${size}px;border-radius:10px;border:1px solid var(--border-stone);background:rgba(207,166,76,0.12);display:flex;align-items:center;justify-content:center;font-size:${Math.round(size * 0.52)}px;flex-shrink:0;">🏰</div>`;
  }

  formatJoinPolicyLabel(policy, publicReadChat) {
    if (policy === 'private_readonly') return '🔒 Privado · 👁️ Chat Público';
    if (policy === 'approval') return publicReadChat ? '📋 Aprobación · 👁️ Chat Público' : '📋 Requiere Aprobación';
    return publicReadChat ? '🚪 Directo · 👁️ Chat Público' : '🚪 Entrada Directa';
  }

  async loadClans() {
    this.syncClanCreateSelectors();
    const myBox = document.getElementById('my-clan-content');
    const createCard = document.getElementById('create-clan-card');
    const topGrid = document.getElementById('clan-top-grid');
    const u = this.user;

    if (topGrid) {
      topGrid.style.gridTemplateColumns = u?.clan ? '1fr' : '';
    }
    if (createCard) createCard.classList.toggle('hidden', Boolean(u?.clan));

    if (myBox) {
      if (u?.clan) {
        this.renderMyClanHub(u.clan);
      } else {
        myBox.innerHTML = u
          ? `Aún no perteneces a ningún clan. Únete a uno abajo o crea el tuyo por <strong>🪙 ${CLAN_CREATE_COST_MODS.toLocaleString('es-PE')} Mods</strong> (máx. 1 clan por persona).`
          : 'Inicia sesión para crear o unirte a un Clan.';
      }
    }

    const listEl = document.getElementById('clans-list-container');
    if (!listEl) return;
    try {
      const { clans } = await api.getClans();
      if (!clans.length) {
        listEl.innerHTML = '<p style="font-size:0.82rem;color:var(--text-muted);">Aún no hay clanes creados. ¡Sé el primero en fundar uno!</p>';
        return;
      }
      listEl.innerHTML = clans.map((c) => {
        const leaderRank = c.leaderIsOwner
          ? '<span class="pill" style="font-size:0.62rem;border-color:#ffd700;background:rgba(255,215,0,0.22);color:#fff2a6;font-weight:700;">👑 OWNER</span>'
          : (c.leaderIsModerator ? '<span class="mod-badge-pill">🛡️ MOD</span>' : '');
        const policyBadge = `<span class="pill muted" style="font-size:0.64rem;">${this.formatJoinPolicyLabel(c.joinPolicy, c.publicReadChat)}</span>`;
        const canReadPublic = Boolean(c.publicReadChat || c.joinPolicy === 'private_readonly');
        const joinLabel = c.joinPolicy === 'open' ? 'Unirse' : 'Solicitar Ingreso';
        return `
        <div class="social-row-card" style="gap:10px;align-items:center;">
          <div style="display:flex;align-items:center;gap:10px;flex:1;min-width:210px;">
            ${this.formatClanAvatarHtml(c.avatar, 44)}
            <div style="min-width:0;">
              <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
                <span class="clan-tag-pill" style="color:${escapeHtml(c.textColor || '#efd083')};font-family:${c.fontCss || 'inherit'};">[${escapeHtml(c.tag)}]</span>
                <strong style="color:${escapeHtml(c.textColor || '#efd083')};font-family:${c.fontCss || 'inherit'};font-size:0.96rem;">${escapeHtml(c.name)}</strong>
                ${leaderRank}
                ${policyBadge}
              </div>
              <div style="font-size:0.74rem;color:var(--text-muted);margin-top:3px;">
                Líder: <strong>${escapeHtml(c.leaderName)}</strong> · ${c.memberCount} miembros · ${c.totalElo} Elo total${c.description ? ` · ${escapeHtml(c.description)}` : ''}
              </div>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${canReadPublic ? `<button class="btn btn-sm" data-read-clan-chat="${c.id}">👁️ Leer Chat</button>` : ''}
            ${u && !u.clan ? `<button class="btn btn-sm btn-primary" data-join-clan="${c.id}" data-join-policy="${c.joinPolicy}">${joinLabel}</button>` : ''}
          </div>
        </div>`;
      }).join('');

      listEl.querySelectorAll('[data-read-clan-chat]').forEach((b) => {
        b.addEventListener('click', () => this.openClanPublicChat(b.dataset.readClanChat));
      });
      listEl.querySelectorAll('[data-join-clan]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            let msg = '';
            if (b.dataset.joinPolicy !== 'open') {
              const promptMsg = window.prompt('Mensaje opcional para el Owner del clan (ej. tu Elo o por qué quieres entrar):', '');
              if (promptMsg === null) return;
              msg = promptMsg;
            }
            const res = await api.joinClan(b.dataset.joinClan, msg);
            if (res.pendingApproval) {
              showToast(`📨 ${res.message || 'Solicitud enviada al Owner del clan.'}`, 'success');
            } else {
              this.setUser(res.user);
              this.activeClanTab = 'chat';
              this.loadClans();
              showToast('¡Te uniste al clan!', 'success');
            }
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      listEl.innerHTML = `<p style="color:#ffaca3;font-size:0.8rem;">${escapeHtml(err.message)}</p>`;
    }
  }

  renderMyClanHub(clan) {
    const myBox = document.getElementById('my-clan-content');
    if (!myBox || !clan) return;
    const perms = clan.myPermissions || {};
    const tab = this.activeClanTab || 'chat';
    const isVip = Boolean(this.user?.isVip || this.user?.isOwner);
    const pendingCount = (clan.pendingRequests || []).length;
    const bansCount = (clan.bans || []).length;

    const canManageRoles = Boolean(perms.isLeader || perms.manage_roles);
    const canKick = Boolean(perms.isLeader || perms.kick_members);
    const canBan = Boolean(perms.isLeader || perms.ban_members);
    const canAccept = Boolean(perms.isLeader || perms.accept_members);
    const canEdit = Boolean(perms.isLeader || perms.edit_clan);

    const tabsHtml = `
      <div class="shop-tabs" id="clan-hub-tabs" style="margin:10px 0 12px;">
        <button class="shop-tab-btn ${tab === 'chat' ? 'active' : ''}" data-clan-tab="chat">💬 Chat del Clan</button>
        <button class="shop-tab-btn ${tab === 'members' ? 'active' : ''}" data-clan-tab="members">👥 Miembros (${clan.membersCount})</button>
        <button class="shop-tab-btn ${tab === 'roles' ? 'active' : ''}" data-clan-tab="roles">🏷️ Roles (${(clan.roles || []).length})</button>
        ${(canAccept || canBan) ? `<button class="shop-tab-btn ${tab === 'requests' ? 'active' : ''}" data-clan-tab="requests">📨 Solicitudes${pendingCount ? ` (${pendingCount})` : ''} / Bans (${bansCount})</button>` : ''}
        ${canEdit ? `<button class="shop-tab-btn ${tab === 'settings' ? 'active' : ''}" data-clan-tab="settings">⚙️ Ajustes del Clan</button>` : ''}
      </div>`;

    let bodyHtml = '';

    if (tab === 'chat') {
      bodyHtml = `
        <div id="my-clan-chat-messages" style="height:260px;overflow-y:auto;display:flex;flex-direction:column;gap:7px;padding:10px;border-radius:9px;background:rgba(10,9,8,0.85);border:1px solid var(--border-subtle);margin-bottom:10px;">
          <div style="font-size:0.78rem;color:var(--text-muted);">Cargando chat del clan...</div>
        </div>
        <form id="form-clan-chat" style="display:flex;gap:8px;flex-wrap:wrap;">
          <input id="clan-chat-input" class="input-field" type="text" maxlength="500" required placeholder="Escribe a los integrantes del clan..." style="flex:1;min-width:180px;">
          <button type="submit" class="btn btn-gold">Enviar</button>
        </form>`;
    } else if (tab === 'members') {
      const rolesOpts = (clan.roles || []).map((r) => `<option value="${r.id}">${escapeHtml(r.name)}</option>`).join('');
      const modRole = (clan.roles || []).find((r) => r.permissions?.is_clan_mod);
      bodyHtml = `
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;">Jerarquía: 👑 Owner CHESS.MOD → 🛡️ Moderadores → 👑 Owner del Clan → Roles de Clan → Elo</div>
        <div style="display:flex;flex-direction:column;gap:7px;">
          ${(clan.members || []).map((m) => {
            const isMe = this.user && m.id === this.user.id;
            const globalBadge = m.isOwner
              ? '<span class="pill" style="font-size:0.62rem;border-color:#ffd700;background:rgba(255,215,0,0.22);color:#fff2a6;font-weight:700;">👑 OWNER</span>'
              : (m.isModerator ? '<span class="mod-badge-pill">🛡️ MOD</span>' : '');
            const clanRoleBadge = m.isClanLeader
              ? '<span class="pill" style="font-size:0.62rem;border-color:#ffd700;color:#ffe27a;">👑 Owner del Clan</span>'
              : (m.customRoleName
                ? `<span class="pill" style="font-size:0.62rem;border-color:${escapeHtml(m.customRoleColor || '#7dd3fc')};color:${escapeHtml(m.customRoleColor || '#7dd3fc')};">${escapeHtml(m.customRoleName)}</span>`
                : '<span class="pill muted" style="font-size:0.62rem;">Miembro</span>');
            const canActOn = !isMe && !m.isClanLeader;
            return `
              <div class="social-row-card" style="padding:8px 10px;gap:8px;">
                <div style="display:flex;align-items:center;gap:8px;flex:1;min-width:170px;">
                  <span class="avatar-badge ${m.frameId || 'frame_stone'}${m.isVip ? ' vip-aura' : ''}" style="width:32px;height:32px;">${renderAvatarMarkup(m.avatar)}</span>
                  <div style="min-width:0;">
                    <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
                      <strong style="color:${escapeHtml(clan.textColor || '#efd083')};font-family:${clan.fontCss || 'inherit'};">${escapeHtml(m.username)}${isMe ? ' (Tú)' : ''}</strong>
                      ${globalBadge}${clanRoleBadge}${this.renderPresencePill(m.id)}
                    </div>
                    <div style="font-size:0.7rem;color:var(--text-muted);">${m.elo} Elo${m.isVip ? ' · 👑 Mod VIP' : ''}</div>
                  </div>
                </div>
                <div style="display:flex;gap:5px;flex-wrap:wrap;align-items:center;">
                  ${!isMe ? `<button class="btn btn-sm btn-gold" data-clan-invite-match="${m.id}" data-clan-uname="${escapeHtml(m.username)}">⚔️ Retar</button>` : ''}
                  ${canActOn && canManageRoles ? `
                    <select class="input-field" data-clan-assign-role="${m.id}" style="padding:4px 6px;font-size:0.72rem;width:auto;">
                      <option value="">Miembro</option>
                      ${rolesOpts.replace(`value="${m.customRoleId}"`, `value="${m.customRoleId}" selected`)}
                    </select>` : ''}
                  ${canActOn && canManageRoles && modRole && m.customRoleId !== modRole.id ? `<button class="btn btn-sm btn-primary" data-clan-make-mod="${m.id}" data-clan-mod-role="${modRole.id}">🛡️ Hacer Mod</button>` : ''}
                  ${canActOn && canKick ? `<button class="btn btn-sm" data-clan-kick="${m.id}" data-clan-uname="${escapeHtml(m.username)}">🚪 Expulsar</button>` : ''}
                  ${canActOn && canBan ? `<button class="btn btn-sm btn-danger" data-clan-ban="${m.id}" data-clan-uname="${escapeHtml(m.username)}">🔨 Banear</button>` : ''}
                </div>
              </div>`;
          }).join('')}
        </div>`;
    } else if (tab === 'roles') {
      const rolesListHtml = (clan.roles || []).length
        ? (clan.roles || []).map((r) => {
          const activePerms = CLAN_PERMISSION_DEFS.filter((d) => r.permissions?.[d.key]).map((d) => d.label);
          return `
            <div class="social-row-card" style="padding:8px 10px;">
              <div style="flex:1;min-width:180px;">
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <strong style="color:${escapeHtml(r.color || '#7dd3fc')};">${escapeHtml(r.name)}</strong>
                  <span class="pill muted" style="font-size:0.62rem;">Jerarquía ${r.priority}</span>
                </div>
                <div style="font-size:0.71rem;color:var(--text-muted);margin-top:3px;">${activePerms.length ? activePerms.join(' · ') : 'Sin permisos especiales (solo título)'}</div>
              </div>
              ${canManageRoles ? `<button class="btn btn-sm btn-danger" data-clan-del-role="${r.id}">🗑️</button>` : ''}
            </div>`;
        }).join('')
        : '<p style="font-size:0.78rem;color:var(--text-muted);">Aún no hay roles personalizados en este clan.</p>';

      const createRoleForm = canManageRoles
        ? `
          <form id="form-clan-create-role" style="margin-top:12px;padding:10px;border-radius:9px;background:rgba(12,11,9,0.75);border:1px solid var(--border-subtle);display:flex;flex-direction:column;gap:8px;">
            <strong style="color:var(--gold-bright);font-size:0.86rem;">➕ Crear Nuevo Rol (Permisos SOLO dentro de este clan)</strong>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px;">
              <input id="crole-name" class="input-field" type="text" required minlength="2" maxlength="24" placeholder="Ej: Co-Líder / Moderador">
              <input id="crole-color" class="input-field" type="color" value="#38bdf8" style="height:38px;padding:3px;">
              <input id="crole-priority" class="input-field" type="number" min="1" max="90" value="40" placeholder="Jerarquía (1-90)">
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:5px;font-size:0.75rem;">
              ${CLAN_PERMISSION_DEFS.map((d) => `<label class="host-toggle-label"><input type="checkbox" data-crole-perm="${d.key}"> ${d.label}</label>`).join('')}
            </div>
            <button type="submit" class="btn btn-sm btn-gold" style="align-self:flex-start;">🏷️ Crear Rol en el Clan</button>
          </form>`
        : '<p style="font-size:0.76rem;color:var(--text-muted);margin-top:8px;">Solo el Owner del clan o roles con permiso de gestión pueden crear roles.</p>';

      bodyHtml = `<div style="display:flex;flex-direction:column;gap:7px;">${rolesListHtml}</div>${createRoleForm}`;
    } else if (tab === 'requests') {
      const reqHtml = (clan.pendingRequests || []).length
        ? clan.pendingRequests.map((r) => `
          <div class="social-row-card" style="padding:8px 10px;">
            <div style="flex:1;min-width:170px;">
              <strong>${escapeHtml(r.username)}</strong> <span style="font-size:0.72rem;color:var(--text-muted);">(${r.elo} Elo)</span>
              ${r.message ? `<div style="font-size:0.73rem;color:#ebe3d5;margin-top:2px;">«${escapeHtml(r.message)}»</div>` : ''}
            </div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-primary" data-clan-req-accept="${r.id}">✅ Aceptar</button>
              <button class="btn btn-sm btn-danger" data-clan-req-reject="${r.id}">✕ Rechazar</button>
            </div>
          </div>`).join('')
        : '<p style="font-size:0.78rem;color:var(--text-muted);">No hay solicitudes pendientes.</p>';

      const banHtml = (clan.bans || []).length
        ? clan.bans.map((b) => `
          <div class="social-row-card" style="padding:8px 10px;">
            <div style="flex:1;min-width:170px;">
              <strong style="color:#ff9b90;">${escapeHtml(b.username)}</strong>
              <div style="font-size:0.72rem;color:var(--text-muted);">Por ${escapeHtml(b.bannedByName)}${b.reason ? ` · ${escapeHtml(b.reason)}` : ''}</div>
            </div>
            <button class="btn btn-sm btn-primary" data-clan-unban="${b.userId}">🔓 Desbanear</button>
          </div>`).join('')
        : '<p style="font-size:0.78rem;color:var(--text-muted);">No hay usuarios baneados en este clan.</p>';

      bodyHtml = `
        <strong style="color:var(--gold-bright);font-size:0.84rem;display:block;margin-bottom:6px;">📨 Solicitudes de Ingreso</strong>
        <div style="display:flex;flex-direction:column;gap:6px;margin-bottom:12px;">${reqHtml}</div>
        <strong style="color:#ff9b90;font-size:0.84rem;display:block;margin-bottom:6px;">🔨 Usuarios Baneados del Clan</strong>
        <div style="display:flex;flex-direction:column;gap:6px;">${banHtml}</div>`;
    } else if (tab === 'settings' && canEdit) {
      const colorOpts = CLAN_TEXT_COLORS.map((c) => {
        const locked = c.vipOnly && !isVip;
        const selected = c.hex.toLowerCase() === (clan.textColor || '#efd083').toLowerCase();
        return `<option value="${c.hex}" ${selected ? 'selected' : ''} ${locked ? 'disabled' : ''}>${c.name}${locked ? ' 🔒' : ''}</option>`;
      }).join('');
      const fontOpts = CLAN_FONT_FAMILIES.map((f) => `<option value="${f.id}" ${f.id === (clan.fontFamily || 'cinzel') ? 'selected' : ''}>${f.name}</option>`).join('');
      bodyHtml = `
        <form id="form-clan-edit-settings" style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <div id="clan-edit-avatar-preview">${this.formatClanAvatarHtml(this.pendingEditClanAvatar !== null ? this.pendingEditClanAvatar : clan.avatar, 56)}</div>
            <input id="clan-edit-avatar-file" type="file" accept="image/*,.heic,.heif,.avif,.webp,.svg,.bmp,.ico,.gif,.png,.jpg,.jpeg" class="hidden">
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button id="btn-clan-edit-avatar" type="button" class="btn btn-sm">📷 Cambiar Imagen del Clan</button>
              <button id="btn-clan-edit-clear-avatar" type="button" class="btn btn-sm">✕ Quitar Imagen</button>
            </div>
          </div>
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted);display:block;margin-bottom:4px;">Descripción del Clan</label>
            <input id="clan-edit-desc" class="input-field" type="text" maxlength="160" value="${escapeHtml(clan.description || '')}">
          </div>
          <div>
            <label style="font-size:0.74rem;color:var(--text-muted);display:block;margin-bottom:4px;">🔐 Acceso y Privacidad del Clan</label>
            <select id="clan-edit-policy" class="input-field">
              <option value="open" ${clan.joinPolicy === 'open' ? 'selected' : ''}>🚪 Entrada Directa (pasan de frente y se unen)</option>
              <option value="approval" ${clan.joinPolicy === 'approval' ? 'selected' : ''}>📋 Revisar Solicitudes (aceptar/rechazar)</option>
              <option value="private_readonly" ${clan.joinPolicy === 'private_readonly' ? 'selected' : ''}>🔒 Clan Privado con Chat Público Solo Lectura</option>
            </select>
          </div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:8px;">
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted);display:block;margin-bottom:4px;">🎨 Color de Letra</label>
              <select id="clan-edit-color" class="input-field">${colorOpts}</select>
            </div>
            <div>
              <label style="font-size:0.74rem;color:var(--text-muted);display:block;margin-bottom:4px;">🔤 Fuente de Letra</label>
              <select id="clan-edit-font" class="input-field">${fontOpts}</select>
            </div>
          </div>
          <label class="host-toggle-label" style="font-size:0.78rem;">
            <input type="checkbox" id="clan-edit-public-chat" ${clan.publicReadChat ? 'checked' : ''}>
            👁️ Chat público en modo solo lectura (todos pueden ver lo que chatean)
          </label>
          <button type="submit" class="btn btn-gold" style="align-self:flex-start;">💾 Guardar Ajustes del Clan</button>
        </form>`;
    }

    myBox.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding-bottom:10px;border-bottom:1px solid var(--border-subtle);">
        <div style="display:flex;align-items:center;gap:12px;min-width:200px;">
          ${this.formatClanAvatarHtml(clan.avatar, 54)}
          <div style="min-width:0;">
            <div style="display:flex;align-items:center;gap:7px;flex-wrap:wrap;">
              <span class="clan-tag-pill" style="color:${escapeHtml(clan.textColor || '#efd083')};font-family:${clan.fontCss || 'inherit'};">[${escapeHtml(clan.tag)}]</span>
              <strong style="font-size:1.18rem;color:${escapeHtml(clan.textColor || '#efd083')};font-family:${clan.fontCss || 'inherit'};">${escapeHtml(clan.name)}</strong>
              <span class="pill jade" style="font-size:0.65rem;">${this.formatJoinPolicyLabel(clan.joinPolicy, clan.publicReadChat)}</span>
            </div>
            <div style="font-size:0.78rem;color:var(--text-muted);margin-top:3px;">${escapeHtml(clan.description || 'Clan oficial de CHESS.MOD')}</div>
          </div>
        </div>
        <button id="btn-leave-clan" class="btn btn-sm btn-danger">Salir del Clan</button>
      </div>
      ${tabsHtml}
      <div id="clan-hub-body">${bodyHtml}</div>`;

    document.getElementById('btn-leave-clan')?.addEventListener('click', async () => {
      try {
        const res = await api.leaveClan();
        this.pendingEditClanAvatar = null;
        this.setUser(res.user);
        this.loadClans();
        showToast('Saliste del clan.', 'info');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });

    myBox.querySelectorAll('[data-clan-tab]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this.activeClanTab = btn.dataset.clanTab;
        this.pendingEditClanAvatar = null;
        this.renderMyClanHub(this.user.clan);
      });
    });

    if (tab === 'chat') {
      this.loadMyClanChat(clan.id);
      document.getElementById('form-clan-chat')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const inp = document.getElementById('clan-chat-input');
        const content = inp?.value.trim();
        if (!content) return;
        try {
          await api.sendClanMessage(clan.id, content);
          if (inp) inp.value = '';
          this.loadMyClanChat(clan.id);
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } else if (tab === 'members') {
      myBox.querySelectorAll('[data-clan-invite-match]').forEach((b) => {
        b.addEventListener('click', () => this.sendDirectMatchInvite(b.dataset.clanInviteMatch, b.dataset.clanUname));
      });
      myBox.querySelectorAll('[data-clan-assign-role]').forEach((sel) => {
        sel.addEventListener('change', async () => {
          try {
            const res = await api.assignClanMemberRole(clan.id, sel.dataset.clanAssignRole, sel.value || null);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast('Rol del miembro actualizado.', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
      myBox.querySelectorAll('[data-clan-make-mod]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.assignClanMemberRole(clan.id, b.dataset.clanMakeMod, b.dataset.clanModRole);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast('🛡️ Miembro ascendido a Moderador del Clan.', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
      myBox.querySelectorAll('[data-clan-kick]').forEach((b) => {
        b.addEventListener('click', async () => {
          if (!window.confirm(`¿Expulsar a ${b.dataset.clanUname} del clan?`)) return;
          try {
            const res = await api.kickClanMember(clan.id, b.dataset.clanKick);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast(`🚪 ${b.dataset.clanUname} fue expulsado del clan.`, 'info');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
      myBox.querySelectorAll('[data-clan-ban]').forEach((b) => {
        b.addEventListener('click', async () => {
          const reason = window.prompt(`Motivo para banear a ${b.dataset.clanUname} de tu clan:`, 'Incumplimiento de reglas del clan');
          if (reason === null) return;
          try {
            const res = await api.banClanMember(clan.id, b.dataset.clanBan, reason);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast(`🔨 ${b.dataset.clanUname} fue baneado del clan.`, 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } else if (tab === 'roles') {
      myBox.querySelectorAll('[data-clan-del-role]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.deleteClanRole(clan.id, b.dataset.clanDelRole);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast('Rol eliminado del clan.', 'info');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
      document.getElementById('form-clan-create-role')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const name = document.getElementById('crole-name').value.trim();
          const color = document.getElementById('crole-color').value || '#38bdf8';
          const priority = Number(document.getElementById('crole-priority').value) || 30;
          const permissions = {};
          e.target.querySelectorAll('[data-crole-perm]').forEach((chk) => {
            permissions[chk.dataset.crolePerm] = Boolean(chk.checked);
          });
          const res = await api.createClanRole(clan.id, { name, color, priority, permissions });
          this.setUser(res.user);
          this.renderMyClanHub(res.user.clan);
          showToast(`🏷️ Rol "${name}" creado dentro del clan.`, 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    } else if (tab === 'requests') {
      myBox.querySelectorAll('[data-clan-req-accept]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.respondClanRequest(clan.id, b.dataset.clanReqAccept, true);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast('✅ Solicitud aceptada.', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
      myBox.querySelectorAll('[data-clan-req-reject]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.respondClanRequest(clan.id, b.dataset.clanReqReject, false);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast('Solicitud rechazada.', 'info');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
      myBox.querySelectorAll('[data-clan-unban]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.unbanClanMember(clan.id, b.dataset.clanUnban);
            this.setUser(res.user);
            this.renderMyClanHub(res.user.clan);
            showToast('🔓 Usuario desbaneado del clan.', 'success');
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } else if (tab === 'settings' && canEdit) {
      document.getElementById('btn-clan-edit-avatar')?.addEventListener('click', () => document.getElementById('clan-edit-avatar-file')?.click());
      document.getElementById('btn-clan-edit-clear-avatar')?.addEventListener('click', () => {
        this.pendingEditClanAvatar = '';
        const prev = document.getElementById('clan-edit-avatar-preview');
        if (prev) prev.innerHTML = this.formatClanAvatarHtml('', 56);
      });
      document.getElementById('clan-edit-avatar-file')?.addEventListener('change', async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
          const dataUrl = await processAvatarUpload(file);
          this.pendingEditClanAvatar = dataUrl;
          const prev = document.getElementById('clan-edit-avatar-preview');
          if (prev) prev.innerHTML = this.formatClanAvatarHtml(dataUrl, 56);
          showToast('Nueva imagen lista. Pulsa Guardar Ajustes.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          e.target.value = '';
        }
      });
      document.getElementById('form-clan-edit-settings')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          const description = document.getElementById('clan-edit-desc').value.trim();
          const joinPolicy = document.getElementById('clan-edit-policy').value;
          const publicReadChat = Boolean(document.getElementById('clan-edit-public-chat').checked) || joinPolicy === 'private_readonly';
          const textColor = document.getElementById('clan-edit-color').value;
          const fontFamily = document.getElementById('clan-edit-font').value;
          const payload = { description, joinPolicy, publicReadChat, textColor, fontFamily };
          if (this.pendingEditClanAvatar !== null) payload.avatar = this.pendingEditClanAvatar;
          const res = await api.updateClanSettings(clan.id, payload);
          this.pendingEditClanAvatar = null;
          this.setUser(res.user);
          this.loadClans();
          showToast('💾 Ajustes y estilo del clan guardados.', 'success');
        } catch (err) {
          showToast(err.message, 'error');
        }
      });
    }
  }

  renderClanMessagesList(container, data, allowDelete = false) {
    if (!container) return;
    const msgs = data?.messages || [];
    const clanStyle = data?.clan || {};
    if (!msgs.length) {
      container.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);text-align:center;padding:24px 8px;">Aún no hay mensajes en este clan. ¡Saluda a tu equipo!</div>';
      return;
    }
    container.innerHTML = msgs.map((m) => {
      const isMe = this.user && m.senderId === this.user.id;
      const gBadge = m.senderIsOwner
        ? '<span class="pill" style="font-size:0.58rem;border-color:#ffd700;background:rgba(255,215,0,0.22);color:#fff2a6;">👑 OWNER</span>'
        : (m.senderIsModerator ? '<span class="mod-badge-pill" style="font-size:0.58rem;">🛡️ MOD</span>' : '');
      const cBadge = m.senderClanRoleName
        ? `<span style="font-size:0.62rem;padding:1px 5px;border-radius:4px;border:1px solid ${escapeHtml(m.senderClanRoleColor || '#7dd3fc')};color:${escapeHtml(m.senderClanRoleColor || '#7dd3fc')};">${escapeHtml(m.senderClanRoleName)}</span>`
        : '';
      const timeStr = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
      const canDel = allowDelete && (isMe || data.canDelete);
      return `
        <div style="padding:7px 10px;border-radius:8px;background:${isMe ? 'rgba(207,166,76,0.12)' : 'rgba(255,255,255,0.04)'};border:1px solid rgba(255,255,255,0.06);">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:6px;flex-wrap:wrap;margin-bottom:3px;">
            <div style="display:flex;align-items:center;gap:5px;flex-wrap:wrap;">
              <strong style="font-size:0.78rem;color:${escapeHtml(clanStyle.textColor || '#efd083')};font-family:${clanStyle.fontCss || 'inherit'};">${escapeHtml(m.senderUsername)}</strong>
              ${gBadge}${cBadge}
            </div>
            <div style="display:flex;align-items:center;gap:6px;">
              <span style="font-size:0.65rem;color:var(--text-muted);">${timeStr}</span>
              ${canDel ? `<button type="button" class="btn btn-sm" style="padding:1px 5px;font-size:0.62rem;" data-del-cmsg="${m.id}" title="Borrar mensaje">🗑️</button>` : ''}
            </div>
          </div>
          <div style="font-size:0.81rem;color:#ebe3d5;font-family:${clanStyle.fontCss || 'inherit'};word-break:break-word;">${escapeHtml(m.content)}</div>
        </div>`;
    }).join('');
    container.scrollTop = container.scrollHeight;
  }

  async loadMyClanChat(clanId) {
    const box = document.getElementById('my-clan-chat-messages');
    if (!box) return;
    try {
      const data = await api.getClanMessages(clanId);
      this.renderClanMessagesList(box, data, true);
      box.querySelectorAll('[data-del-cmsg]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api.deleteClanMessage(clanId, b.dataset.delCmsg);
            this.loadMyClanChat(clanId);
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });
    } catch (err) {
      box.innerHTML = `<div style="color:#ffaca3;font-size:0.78rem;">${escapeHtml(err.message)}</div>`;
    }
  }

  async openClanPublicChat(clanId) {
    this.activePublicChatClanId = clanId;
    const modal = document.getElementById('modal-clan-public-chat');
    const title = document.getElementById('cpublic-clan-name');
    const av = document.getElementById('cpublic-avatar');
    const box = document.getElementById('cpublic-messages-box');
    if (box) box.innerHTML = '<div style="font-size:0.78rem;color:var(--text-muted);">Cargando chat público del clan...</div>';
    modal?.classList.add('open');
    try {
      const data = await api.getClanMessages(clanId);
      if (title) {
        title.textContent = `[${data.clan.tag}] ${data.clan.name}`;
        title.style.color = data.clan.textColor || '#efd083';
        title.style.fontFamily = data.clan.fontCss || 'inherit';
      }
      if (av) {
        av.innerHTML = data.clan.avatar
          ? `<img src="${data.clan.avatar}" alt="Clan" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`
          : '🏰';
      }
      this.renderClanMessagesList(box, data, false);
    } catch (err) {
      if (box) box.innerHTML = `<div style="color:#ffaca3;font-size:0.8rem;">${escapeHtml(err.message)}</div>`;
    }
  }

  async loadFriends() {
    if (!this.user) {
      const inc = document.getElementById('friends-incoming-list');
      const acc = document.getElementById('friends-accepted-list');
      if (inc) inc.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);">Inicia sesión para gestionar amigos.</p>';
      if (acc) acc.innerHTML = '<p style="font-size:0.8rem;color:var(--text-muted);">Inicia sesión para ver tu lista de amigos.</p>';
      return;
    }
    try {
      const summary = await api.getFriends();
      this.renderFriends(summary);
    } catch (err) {
      showToast(err.message, 'error');
    }
  }

  renderFriends(summary) {
    const inc = document.getElementById('friends-incoming-list');
    const acc = document.getElementById('friends-accepted-list');
    if (inc) {
      inc.innerHTML = summary.incoming?.length
        ? summary.incoming.map((f) => `
          <div class="social-row-card">
            <div><strong class="${f.isVip ? 'vip-name' : ''}">${f.username}</strong> <span style="font-size:0.74rem;color:var(--text-muted);">(${f.elo} Elo)</span></div>
            <div style="display:flex;gap:6px;">
              <button class="btn btn-sm btn-primary" data-friend-accept="${f.friendshipId}">✓ Aceptar</button>
              <button class="btn btn-sm btn-danger" data-friend-reject="${f.friendshipId}">✕</button>
            </div>
          </div>`).join('')
        : '<p style="font-size:0.8rem;color:var(--text-muted);">No tienes solicitudes pendientes.</p>';
      inc.querySelectorAll('[data-friend-accept]').forEach((b) => b.addEventListener('click', async () => {
        const res = await api.acceptFriend(b.dataset.friendAccept);
        this.renderFriends(res.summary);
        showToast('¡Solicitud aceptada!', 'success');
      }));
      inc.querySelectorAll('[data-friend-reject]').forEach((b) => b.addEventListener('click', async () => {
        const res = await api.rejectFriend(b.dataset.friendReject);
        this.renderFriends(res.summary);
      }));
    }
    if (acc) {
      acc.innerHTML = summary.friends?.length
        ? summary.friends.map((f) => `
          <div class="social-row-card">
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="avatar-badge ${f.frameId || 'frame_stone'}${f.isVip ? ' vip-aura' : ''}" style="width:30px;height:30px;">${renderAvatarMarkup(f.avatar)}</span>
              <div>
                <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap;">
                  <strong class="${f.isVip ? 'vip-name' : ''}">${f.username}</strong>
                  ${this.renderPresencePill(f.userId)}
                </div>
                <div style="font-size:0.7rem;color:var(--text-muted);">${f.elo} Elo</div>
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;">
              <button class="btn btn-sm btn-primary" data-friend-chat="${f.userId}" data-friend-name="${f.username}">💬 Mensaje</button>
              <button class="btn btn-sm btn-gold" data-friend-challenge="${f.userId}" data-friend-name="${f.username}">⚔️ Retar Match</button>
              <button class="btn btn-sm btn-danger" data-friend-remove="${f.friendshipId}">✕</button>
            </div>
          </div>`).join('')
        : '<p style="font-size:0.8rem;color:var(--text-muted);">Aún no tienes amigos agregados.</p>';
      acc.querySelectorAll('[data-friend-chat]').forEach((b) => b.addEventListener('click', () => {
        this.openFriendChat({ userId: b.dataset.friendChat, username: b.dataset.friendName });
      }));
      acc.querySelectorAll('[data-friend-challenge]').forEach((b) => b.addEventListener('click', () => {
        this.sendDirectMatchInvite(b.dataset.friendChallenge, b.dataset.friendName);
      }));
      acc.querySelectorAll('[data-friend-remove]').forEach((b) => b.addEventListener('click', async () => {
        const res = await api.removeFriend(b.dataset.friendRemove);
        this.renderFriends(res.summary);
        showToast('Amigo eliminado.', 'info');
      }));
    }
  }

  async loadModerationScreen() {
    if (!this.user?.isModerator) return;
    const amOwner = Boolean(this.user?.isOwner);
    const titleEl = document.getElementById('mod-panel-title');
    if (titleEl) titleEl.textContent = amOwner ? '👑 PANEL OWNER · CHESS.MOD' : '🛡️ PANEL DE MODERACIÓN · CHESS.MOD';
    document.getElementById('btn-mod-grant-all')?.classList.toggle('hidden', !amOwner);

    try {
      const ov = await api.getModOverview();
      const sg = document.getElementById('mod-stats-grid');
      if (sg) {
        sg.innerHTML = `
          <div class="stat-box"><div class="val">${ov.stats.totalUsers}</div><div class="lbl">Usuarios</div></div>
          <div class="stat-box"><div class="val" style="color:#ffd859;">${ov.stats.openAntiCheatFlags || 0}</div><div class="lbl">Anti-Cheat</div></div>
          <div class="stat-box"><div class="val" style="color:#ff9b90;">${ov.stats.pendingReports}</div><div class="lbl">Reportes Pend.</div></div>
          <div class="stat-box"><div class="val" style="color:#ff6b6b;">${ov.stats.bannedUsers}</div><div class="lbl">Baneados</div></div>`;
      }

      const acList = document.getElementById('mod-anticheat-list');
      if (acList) {
        const flags = ov.antiCheatFlags || [];
        acList.innerHTML = flags.length
          ? flags.map((f) => `
            <div class="social-row-card" style="border-left:3px solid ${f.status === 'open' ? '#f59e0b' : '#519674'};">
              <div style="flex:1;min-width:200px;">
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:3px;">
                  <span class="pill ${f.status === 'open' ? 'crimson' : 'jade'}">${f.category.toUpperCase()}</span>
                  <span class="pill muted">Riesgo +${f.score}</span>
                  <strong>${escapeHtml(f.username)}</strong>
                </div>
                <div style="font-size:0.78rem;color:#ebe3d5;">${escapeHtml(f.details)}</div>
              </div>
              <div class="mod-action-group">
                <button class="btn btn-sm btn-gold" data-mod-tempban-uid="${f.userId}" data-mod-uname="${escapeHtml(f.username)}">⏳ Expulsar</button>
                <button class="btn btn-sm btn-danger" data-mod-ban-uid="${f.userId}" data-mod-ban-reason="[Anti-Cheat] ${escapeHtml(f.details.slice(0, 80))}">🔨 Ban</button>
                ${f.status === 'open' ? `<button class="btn btn-sm btn-primary" data-mod-dismiss-ac="${f.id}">✓ Revisado</button>` : ''}
              </div>
            </div>`).join('')
          : '<p style="font-size:0.8rem;color:var(--text-muted);">🛡️ Sin alertas Anti-Cheat pendientes. El escudo anti-bots y anti-hacks de Mods está vigilando.</p>';
      }

      const repList = document.getElementById('mod-reports-list');
      if (repList) {
        repList.innerHTML = ov.reports.length
          ? ov.reports.map((r) => `
            <div class="social-row-card" style="border-left:3px solid ${r.status === 'pending' ? '#ff5e57' : '#519674'};">
              <div style="flex:1;min-width:200px;">
                <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-bottom:3px;">
                  <span class="pill ${r.status === 'pending' ? 'crimson' : 'jade'}">${r.status.toUpperCase()}</span>
                  <span class="pill muted">${r.category.toUpperCase()}</span>
                  <strong>Reportado: ${escapeHtml(r.reportedUsername)}</strong>
                  <span style="font-size:0.72rem;color:var(--text-muted);">por ${escapeHtml(r.reporterUsername)}</span>
                </div>
                <div style="font-size:0.8rem;color:#ebe3d5;">${escapeHtml(r.description)}</div>
              </div>
              <div style="display:flex;gap:6px;flex-wrap:wrap;">
                ${r.reportedUserId ? `<button class="btn btn-sm btn-danger" data-mod-ban-uid="${r.reportedUserId}" data-mod-ban-reason="Reporte ${r.category}: ${escapeHtml(r.description.slice(0, 80))}">🔨 Banear</button>` : ''}
                ${r.status === 'pending' ? `<button class="btn btn-sm btn-primary" data-mod-res-rep="${r.id}" data-mod-res-st="resolved">✅ Resolver</button>` : ''}
                ${r.status === 'pending' ? `<button class="btn btn-sm" data-mod-res-rep="${r.id}" data-mod-res-st="dismissed">✕ Descartar</button>` : ''}
              </div>
            </div>`).join('')
          : '<p style="font-size:0.82rem;color:var(--text-muted);">No hay reportes registrados.</p>';
      }

      const tbody = document.getElementById('mod-users-tbody');
      if (tbody) {
        tbody.innerHTML = ov.users.map((u) => {
          const untilTxt = u.bannedUntil ? ` hasta ${new Date(u.bannedUntil).toLocaleDateString('es-PE')}` : ' (Permanente)';
          const rankBadge = u.isOwner
            ? '<span class="pill" style="font-size:0.62rem;border-color:#ffd700;background:rgba(255,215,0,0.22);color:#fff2a6;font-weight:700;">👑 OWNER</span>'
            : (u.isModerator ? '<span class="mod-badge-pill">🛡️ MOD</span>' : '');
          const canSanction = !u.isOwner && (amOwner || !u.isModerator);
          const ownerModControls = (amOwner && !u.isOwner)
            ? (u.isModerator
              ? `<button class="btn btn-sm btn-danger" data-owner-set-mod="${u.id}" data-owner-mod-val="0" data-owner-grant-all="0" data-mod-uname="${escapeHtml(u.username)}">✕ Quitar Mod</button>
                 <button class="btn btn-sm btn-gold" data-owner-set-mod="${u.id}" data-owner-mod-val="1" data-owner-grant-all="1" data-mod-uname="${escapeHtml(u.username)}">👑 Dar Todo</button>`
              : `<button class="btn btn-sm btn-primary" data-owner-set-mod="${u.id}" data-owner-mod-val="1" data-owner-grant-all="0" data-mod-uname="${escapeHtml(u.username)}">🛡️ Dar Mod</button>
                 <button class="btn btn-sm btn-gold" data-owner-set-mod="${u.id}" data-owner-mod-val="1" data-owner-grant-all="1" data-mod-uname="${escapeHtml(u.username)}">👑 Mod + Todo</button>`)
            : '';
          return `
          <tr>
            <td><strong>${u.clanTag ? `[${escapeHtml(u.clanTag)}] ` : ''}${escapeHtml(u.username)}</strong> ${rankBadge} ${u.isVip ? '<span class="vip-tag">VIP</span>' : ''} ${u.hasBattlePassS1 ? '<span class="pill" style="font-size:0.62rem;border-color:#38bdf8;color:#7dd3fc;">🎖️ T1</span>' : ''} ${this.renderPresencePill(u.id)}</td>
            <td style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(u.email)}</td>
            <td>${u.elo} Elo · 🪙 ${u.mods}</td>
            <td>${u.isBanned ? `<span class="pill crimson">${u.bannedUntil ? 'EXPULSADO' : 'BANEADO'}</span><div style="font-size:0.68rem;color:#ffaca3;">${escapeHtml(u.banReason)}${untilTxt}</div>` : '<span class="pill jade">Activo</span>'}</td>
            <td>
              ${canSanction
                ? `<div class="mod-action-group">
                    ${ownerModControls}
                    ${u.isBanned
                      ? `<button class="btn btn-sm btn-primary" data-mod-unban-uid="${u.id}">🔓 Desbanear</button>`
                      : `<button class="btn btn-sm btn-gold" data-mod-tempban-uid="${u.id}" data-mod-uname="${escapeHtml(u.username)}">⏳ Expulsar días</button>
                         <button class="btn btn-sm btn-danger" data-mod-ban-uid="${u.id}" data-mod-ban-reason="Baneado permanentemente por moderación">🔨 Ban</button>`}
                    <button class="btn btn-sm" data-mod-deduct-mods="${u.id}" data-mod-uname="${escapeHtml(u.username)}">🪙 -Mods</button>
                    <button class="btn btn-sm" data-mod-add-mods="${u.id}" data-mod-uname="${escapeHtml(u.username)}">➕ +Mods</button>
                  </div>`
                : '<span style="font-size:0.72rem;color:#ffe27a;font-weight:700;">👑 Owner Protegido</span>'}
            </td>
          </tr>`;
        }).join('');
      }

      const cBox = document.getElementById('mod-clans-list');
      if (cBox) {
        cBox.innerHTML = ov.clans.length
          ? ov.clans.map((c) => `<div><span class="clan-tag-pill" style="color:${escapeHtml(c.textColor || '#efd083')};">[${escapeHtml(c.tag)}]</span> <strong style="color:${escapeHtml(c.textColor || '#efd083')};font-family:${c.fontCss || 'inherit'};">${escapeHtml(c.name)}</strong> — Líder: ${escapeHtml(c.leaderName)} (${c.memberCount} miembros · ${this.formatJoinPolicyLabel(c.joinPolicy, c.publicReadChat)})</div>`).join('')
          : '<span style="color:var(--text-muted);">Sin clanes aún.</span>';
      }
      const mBox = document.getElementById('mod-matches-list');
      if (mBox) {
        mBox.innerHTML = ov.recentMatches.length
          ? ov.recentMatches.map((m) => `<div><strong>${m.mode.toUpperCase()}</strong>: ${escapeHtml(m.white_username || 'Jugador')} vs ${escapeHtml(m.black_username || m.opponent_name)} · Ganó: ${m.winner} (${m.turns}t)</div>`).join('')
          : '<span style="color:var(--text-muted);">Sin partidas registradas.</span>';
      }

      document.querySelectorAll('[data-owner-set-mod]').forEach((b) => {
        b.addEventListener('click', async () => {
          const isMod = b.dataset.ownerModVal === '1';
          const grantAll = b.dataset.ownerGrantAll === '1';
          const uname = b.dataset.modUname;
          const label = !isMod
            ? `quitar el rango de Moderador a ${uname}`
            : (grantAll ? `nombrar Moderador a ${uname} CON TODO DESBLOQUEADO` : `nombrar Moderador a ${uname} (SIN todo desbloqueado)`);
          if (!window.confirm(`¿Confirmas ${label}?`)) return;
          try {
            await api.modSetModerator(b.dataset.ownerSetMod, isMod, grantAll);
            showToast(`✅ Rango actualizado para ${uname}.`, 'success');
            this.loadModerationScreen();
          } catch (err) {
            showToast(err.message, 'error');
          }
        });
      });

      document.querySelectorAll('[data-mod-ban-uid]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.modBanUser(b.dataset.modBanUid, b.dataset.modBanReason, null);
            showToast(`🔨 Usuario ${res.username} baneado permanentemente.`, 'success');
            this.loadModerationScreen();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
      document.querySelectorAll('[data-mod-tempban-uid]').forEach((b) => {
        b.addEventListener('click', async () => {
          const daysRaw = window.prompt(`¿Por cuántos DÍAS deseas expulsar a ${b.dataset.modUname}? (Ej: 1, 3, 7, 30)`, '3');
          if (!daysRaw) return;
          const days = Number(daysRaw);
          if (!Number.isFinite(days) || days <= 0) return showToast('Ingresa un número válido de días.', 'error');
          const reason = window.prompt(`Motivo de expulsión (${days} día(s)):`, `Expulsión temporal de ${days} día(s)`) || `Expulsión de ${days} día(s)`;
          try {
            const res = await api.modBanUser(b.dataset.modTempbanUid, reason, days);
            showToast(`⏳ ${res.username} expulsado por ${days} día(s).`, 'success');
            this.loadModerationScreen();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
      document.querySelectorAll('[data-mod-deduct-mods]').forEach((b) => {
        b.addEventListener('click', async () => {
          const amtRaw = window.prompt(`¿Cuántos Mods deseas DESCONTAR a ${b.dataset.modUname}?`, '100');
          if (!amtRaw) return;
          const amt = Math.abs(Math.round(Number(amtRaw)));
          if (!amt) return showToast('Ingresa una cantidad válida de Mods.', 'error');
          const reason = window.prompt('Motivo del descuento:', 'Sanción de moderación') || 'Sanción de moderación';
          try {
            const res = await api.modAdjustMods(b.dataset.modDeductMods, -amt, reason);
            showToast(`🪙 Descontados ${amt} Mods a ${res.username} (Saldo: ${res.mods} Mods).`, 'success');
            this.loadModerationScreen();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
      document.querySelectorAll('[data-mod-add-mods]').forEach((b) => {
        b.addEventListener('click', async () => {
          const amtRaw = window.prompt(`¿Cuántos Mods deseas SUMAR a ${b.dataset.modUname}?`, '200');
          if (!amtRaw) return;
          const amt = Math.abs(Math.round(Number(amtRaw)));
          if (!amt) return showToast('Ingresa una cantidad válida de Mods.', 'error');
          const reason = window.prompt('Motivo:', 'Bonificación de moderación') || 'Bonificación de moderación';
          try {
            const res = await api.modAdjustMods(b.dataset.modAddMods, amt, reason);
            showToast(`🪙 Sumados +${amt} Mods a ${res.username} (Saldo: ${res.mods} Mods).`, 'success');
            this.loadModerationScreen();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
      document.querySelectorAll('[data-mod-unban-uid]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            const res = await api.modUnbanUser(b.dataset.modUnbanUid);
            showToast(`🔓 Usuario ${res.username} desbaneado.`, 'success');
            this.loadModerationScreen();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
      document.querySelectorAll('[data-mod-res-rep]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api.modResolveReport(b.dataset.modResRep, b.dataset.modResSt, 'Revisado por Moderador');
            showToast('Reporte actualizado.', 'success');
            this.loadModerationScreen();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
      document.querySelectorAll('[data-mod-dismiss-ac]').forEach((b) => {
        b.addEventListener('click', async () => {
          try {
            await api.modDismissAntiCheatFlag(b.dataset.modDismissAc);
            showToast('Alerta Anti-Cheat marcada como revisada.', 'success');
            this.loadModerationScreen();
          } catch (err) { showToast(err.message, 'error'); }
        });
      });
    } catch (err) {
      showToast(err.message, 'error');
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
