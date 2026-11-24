import {
  ALL_CAMPAIGNS,
  CAMPAIGN_MAP,
  isChapterUnlocked,
  isCampaignLevelUnlocked,
  getCampaignUnlockReason
} from '/shared/config/campaigns.js';
import { COSMETIC_AVATARS, COSMETIC_FRAMES, COSMETIC_BOARDS } from '/shared/config/cosmetics.js';
import { SoundEngine } from './sound.js';
import { VFXEngine } from './vfx.js';
import { BattleController } from './battleController.js';
import { renderAvatarMarkup } from './svgs.js';
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
    this.checkSecretBossUrl();
    window.addEventListener('hashchange', () => this.checkSecretBossUrl());
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
    if (!api.getToken()) return;
    try {
      const res = await api.me();
      if (res.authenticated && res.user) this.setUser(res.user);
    } catch {}
  }

  setUser(user) {
    this.user = user;
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
        showToast(`Cuenta creada: ${res.user.username} (0 Elo · 50 XP)`, 'success');
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
      clearInterval(this.queueTimerInterval);
      this.renderMultiplayerScreen();
      this.battle.startOnlineMatch(payload);
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
    const barEl = document.getElementById('sidebar-xp-bar');
    const btnEl = document.getElementById('btn-sidebar-auth');

    if (u) {
      if (avatarEl) {
        avatarEl.className = `avatar-badge ${u.frameId || 'frame_stone'}`;
        avatarEl.innerHTML = renderAvatarMarkup(u.avatar);
      }
      if (nameEl) nameEl.textContent = u.username;
      if (eloEl) eloEl.textContent = `Elo ${u.elo}`;
      if (xpEl) xpEl.textContent = `Nv.${u.level} · ${u.xp} XP`;
      if (barEl) barEl.style.width = `${u.levelProgressPct || 0}%`;
      if (btnEl) btnEl.textContent = 'Ver Perfil';
    } else {
      if (avatarEl) {
        avatarEl.className = 'avatar-badge frame_stone';
        avatarEl.innerHTML = renderAvatarMarkup('preset:obsidian_king');
      }
      if (nameEl) nameEl.textContent = 'Invitado';
      if (eloEl) eloEl.textContent = 'Elo 0';
      if (xpEl) xpEl.textContent = '0 XP';
      if (barEl) barEl.style.width = '0%';
      if (btnEl) btnEl.textContent = 'Iniciar sesión / Registro';
    }
  }

  renderMultiplayerScreen() {
    const u = this.user;
    document.getElementById('mp-auth-warning')?.classList.toggle('hidden', Boolean(u));
    document.getElementById('mp-queue-controls')?.classList.toggle('hidden', !u);
    const eloVal = document.getElementById('mp-my-elo');
    if (eloVal) eloVal.textContent = `${u ? u.elo : 0} Elo`;
    const btn = document.getElementById('btn-mp-find');
    if (btn) {
      btn.textContent = this.inQueue ? '✕ Cancelar búsqueda' : '⚔️ Buscar Partida Online';
      btn.className = this.inQueue ? 'btn btn-danger' : 'btn btn-gold';
    }
    document.getElementById('mp-queue-status')?.classList.toggle('hidden', !this.inQueue);
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
      av.className = `avatar-badge ${u.frameId || 'frame_stone'}`;
      av.innerHTML = renderAvatarMarkup(u.avatar);
    }
    document.getElementById('profile-name-h').textContent = u.title ? `${u.username} · «${u.title}»` : u.username;
    document.getElementById('profile-id-txt').textContent = `ID único: ${u.id} · ${u.email}`;
    document.getElementById('profile-elo-val').textContent = String(u.elo);
    document.getElementById('profile-level-val').textContent = `Nv. ${u.level} · ${u.levelTitle}`;
    document.getElementById('profile-xp-val').textContent = u.nextLevelXp ? `${u.xp} / ${u.nextLevelXp} XP` : `${u.xp} XP (Máximo)`;
    document.getElementById('profile-xp-bar').style.width = `${u.levelProgressPct || 0}%`;

    const inputName = document.getElementById('input-edit-username');
    if (inputName && document.activeElement !== inputName) inputName.value = u.username;
  }

  renderCosmeticsScreen() {
    const u = this.user;
    const level = u?.level || 1;
    const unlocked = new Set(u?.unlockedCosmetics || ['preset:obsidian_king', 'preset:jade_guardian', 'frame_stone', 'board_classic_maya']);

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
      frGrid.innerHTML = COSMETIC_FRAMES.filter((item) => !item.hiddenUntilUnlocked || unlocked.has(item.id)).map((item) => {
        const isUnl = unlocked.has(item.id) || level >= item.minLevel;
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
      bdGrid.innerHTML = COSMETIC_BOARDS.map((item) => {
        const isUnl = unlocked.has(item.id) || level >= item.minLevel;
        const isEq = (u?.boardThemeId || 'board_classic_maya') === item.id;
        return `
          <div class="cosmetic-tile ${isEq ? 'equipped' : ''} ${!isUnl ? 'locked' : ''}">
            <div class="board-preview-mini">
              <div style="background:${item.light}"></div><div style="background:${item.dark}"></div>
              <div style="background:${item.dark}"></div><div style="background:${item.light}"></div>
            </div>
            <strong style="font-size:0.83rem;">${item.name}</strong>
            <span class="pill ${isUnl ? 'jade' : 'muted'}">${isUnl ? 'Desbloqueado' : `Requiere Nv. ${item.minLevel}`}</span>
            <button class="btn btn-sm ${isEq ? 'btn-gold' : 'btn-primary'}" data-equip-board="${item.id}" ${!isUnl || isEq ? 'disabled' : ''}>
              ${isEq ? '✓ Activo' : 'Aplicar'}
            </button>
          </div>`;
      }).join('');
      bdGrid.querySelectorAll('[data-equip-board]').forEach((b) => b.addEventListener('click', () => this.equipCosmetic({ boardThemeId: b.dataset.equipBoard })));
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
        return `
          <tr class="${isMe ? 'is-me' : ''}">
            <td><span class="rank-num ${rankCls}">#${p.rank}</span></td>
            <td>
              <div style="display:flex;align-items:center;gap:10px;">
                <span class="avatar-badge ${p.frameId || 'frame_stone'}" style="width:34px;height:34px;">${renderAvatarMarkup(p.avatar)}</span>
                <div>
                  <strong style="color:${isMe ? 'var(--gold-bright)' : 'var(--text-main)'};">${p.username}${isMe ? ' (Tú)' : ''}</strong>
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
