import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const clientDir = path.join(rootDir, 'client');
const outHtmlPath = path.join(rootDir, 'CHESS_MOD_COMPLETO.html');

// 1. Codificar assets binarios en base64 (logo, mittens_ref.png, blacky_ref.jpg, glitch_texture.jpg y 7 pistas MP3)
const mittensImgPath = path.join(clientDir, 'assets', 'images', 'mittens_ref.png');
const blackyImgPath = path.join(clientDir, 'assets', 'images', 'blacky_ref.jpg');
const logoImgPath = path.join(clientDir, 'assets', 'images', 'chess_mod_logo.jpg');
const glitchTexPath = path.join(clientDir, 'assets', 'images', 'glitch_texture.jpg');
const musicPath = path.join(clientDir, 'assets', 'audio', 'Ultimate Battle.mp3');
const mayaCampMusicPath = path.join(clientDir, 'assets', 'audio', 'MayaCampaignBattle.mp3');
const mittensMusicPath = path.join(clientDir, 'assets', 'audio', 'FreeMittensBattle.mp3');
const galaxyMusicPath = path.join(clientDir, 'assets', 'audio', 'GalaxyBattle.mp3');
const glitchMusicPath = path.join(clientDir, 'assets', 'audio', 'GlitchBattle.mp3');
const chessMusicPath = path.join(clientDir, 'assets', 'audio', 'ChessBattle.mp3');
const blackyMusicPath = path.join(clientDir, 'assets', 'audio', 'BlackyBattle.mp3');

const mittensDataUri = `data:image/png;base64,${fs.readFileSync(mittensImgPath).toString('base64')}`;
const blackyDataUri = `data:image/jpeg;base64,${fs.readFileSync(blackyImgPath).toString('base64')}`;
const logoDataUri = `data:image/jpeg;base64,${fs.readFileSync(logoImgPath).toString('base64')}`;
const glitchTexDataUri = `data:image/jpeg;base64,${fs.readFileSync(glitchTexPath).toString('base64')}`;
const musicDataUri = `data:audio/mpeg;base64,${fs.readFileSync(musicPath).toString('base64')}`;
const mayaCampMusicDataUri = `data:audio/mpeg;base64,${fs.readFileSync(mayaCampMusicPath).toString('base64')}`;
const mittensMusicDataUri = `data:audio/mpeg;base64,${fs.readFileSync(mittensMusicPath).toString('base64')}`;
const galaxyMusicDataUri = `data:audio/mpeg;base64,${fs.readFileSync(galaxyMusicPath).toString('base64')}`;
const glitchMusicDataUri = `data:audio/mpeg;base64,${fs.readFileSync(glitchMusicPath).toString('base64')}`;
const chessMusicDataUri = `data:audio/mpeg;base64,${fs.readFileSync(chessMusicPath).toString('base64')}`;
const blackyMusicDataUri = `data:audio/mpeg;base64,${fs.readFileSync(blackyMusicPath).toString('base64')}`;

// 2. CSS combinado inline (todos los 4 archivos CSS)
const cssMain = fs.readFileSync(path.join(clientDir, 'css', 'main.css'), 'utf8');
const cssMenu = fs.readFileSync(path.join(clientDir, 'css', 'menu.css'), 'utf8');
const cssBoard = fs.readFileSync(path.join(clientDir, 'css', 'board.css'), 'utf8');
const cssPortraits = fs.readFileSync(path.join(clientDir, 'css', 'portraits.css'), 'utf8');
const combinedCss = `${cssMain}\n\n${cssMenu}\n\n${cssBoard}\n\n${cssPortraits}`;

// 3. Adaptador API offline en localStorage (para que registro, perfil, 5 campañas, XP, pistas 25 XP, cosméticos y ranking funcionen 100% en file://)
const standaloneApiSource = `
import { INITIAL_ELO, INITIAL_MODS, HINT_XP_COST, computeLevelFromXp } from '../../shared/config/constants.js';
const INITIAL_XP = 50;
import {
  COSMETIC_AVATARS,
  COSMETIC_FRAMES,
  COSMETIC_BOARDS,
  COSMETIC_PIECE_SKINS,
  COSMETIC_POWERS,
  MOD_VIP_PLAN,
  BATTLE_PASS_S1,
  VIP_EXCLUSIVE_IDS,
  findShopItem
} from '../../shared/config/cosmetics.js';
import { CHAPTER_ORDER, getCampaignLevel, isCampaignLevelUnlocked, getCampaignUnlockReason } from '../../shared/config/campaigns.js';

const STORE_KEY = 'chess_mod_standalone_v2';
const TOKEN_KEY = 'chess_mod_auth_token';

function defaultCampaigns() {
  const c = {};
  for (const ch of CHAPTER_ORDER) c[ch] = { completedLevels: [] };
  return c;
}

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return { user: null, matches: [] };
}

function saveStore(store) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch {}
}

function checkVipActive(u) {
  if (!u || !u.vipActive || !u.vipExpiresAt) return false;
  return Date.parse(u.vipExpiresAt) > Date.now();
}

function stripVipOffline(u) {
  if (!u) return;
  u.vipActive = false;
  u.vipExpiresAt = null;
  if (VIP_EXCLUSIVE_IDS.includes(u.frameId)) u.frameId = 'frame_stone';
  if (VIP_EXCLUSIVE_IDS.includes(u.boardThemeId)) u.boardThemeId = 'board_classic_maya';
  if (VIP_EXCLUSIVE_IDS.includes(u.pieceSkinId)) u.pieceSkinId = 'pieces_classic';
  if (VIP_EXCLUSIVE_IDS.includes(u.equippedPowerId)) u.equippedPowerId = 'power_none';
  u.unlockedCosmetics = (u.unlockedCosmetics || []).filter((id) => !VIP_EXCLUSIVE_IDS.includes(id));
}

function hydrateUser(u, matches = []) {
  if (!u) return null;
  if (u.vipActive && !checkVipActive(u)) stripVipOffline(u);
  const isVip = checkVipActive(u);
  const lvInfo = computeLevelFromXp(u.xp || 0);
  const campaigns = { ...defaultCampaigns(), ...(u.campaigns || {}) };
  const unlockedCosmetics = new Set(u.unlockedCosmetics || ['preset:obsidian_king', 'preset:jade_guardian', 'frame_stone', 'board_classic_maya', 'pieces_classic', 'power_none']);
  for (const item of [...COSMETIC_AVATARS, ...COSMETIC_FRAMES, ...COSMETIC_BOARDS, ...COSMETIC_PIECE_SKINS, ...COSMETIC_POWERS]) {
    if (item.vipOnly) {
      if (isVip) unlockedCosmetics.add(item.id);
      else unlockedCosmetics.delete(item.id);
    } else if ((item.minLevel || 1) <= lvInfo.level) {
      unlockedCosmetics.add(item.id);
    }
  }
  return {
    ...u,
    isVip,
    vipExpiresAt: isVip ? u.vipExpiresAt : null,
    mods: Number(u.mods ?? INITIAL_MODS) || 0,
    pieceSkinId: (!isVip && VIP_EXCLUSIVE_IDS.includes(u.pieceSkinId)) ? 'pieces_classic' : (u.pieceSkinId || 'pieces_classic'),
    equippedPowerId: (!isVip && VIP_EXCLUSIVE_IDS.includes(u.equippedPowerId)) ? 'power_none' : (u.equippedPowerId || 'power_none'),
    level: lvInfo.level,
    levelTitle: u.customTitle || lvInfo.title,
    title: u.customTitle || '',
    levelProgressPct: lvInfo.progressPct,
    campaigns,
    trainerId: u.trainerId || null,
    language: u.language || 'es',
    battlePassS1: { owned: Boolean(u.battlePassS1), season: 1, xp: u.xp || 0, claimedTiers: u.bpClaimed || [] },
    unlockedCosmetics: [...unlockedCosmetics],
    recentMatches: matches.slice(0, 20)
  };
}

class StandaloneApiClient {
  getToken() {
    try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
  }
  setToken(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {}
  }

  async me() {
    const store = loadStore();
    if (!store.user) {
      store.user = {
        id: 'local_player',
        username: 'Estratega',
        email: 'local@chess.mod',
        elo: INITIAL_ELO,
        xp: INITIAL_XP,
        mods: INITIAL_MODS,
        vipActive: false,
        vipExpiresAt: null,
        avatar: 'preset:obsidian_king',
        frameId: 'frame_stone',
        boardThemeId: 'board_classic_maya',
        pieceSkinId: 'pieces_classic',
        equippedPowerId: 'power_none',
        wins: 0,
        losses: 0,
        draws: 0,
        gamesPlayed: 0,
        basesDestroyed: 0,
        campaigns: defaultCampaigns(),
        unlockedCosmetics: ['preset:obsidian_king', 'preset:jade_guardian', 'frame_stone', 'board_classic_maya', 'pieces_classic', 'power_none'],
        customTitle: null
      };
      saveStore(store);
      this.setToken('standalone-local-token');
    }
    return { authenticated: true, token: 'standalone-local-token', user: hydrateUser(store.user, store.matches), googleOAuthConfigured: false };
  }

  async register({ username, email }) {
    const store = loadStore();
    store.user = {
      id: 'local_' + Date.now(),
      username: String(username || 'Estratega').trim().slice(0, 20) || 'Estratega',
      email: String(email || 'local@chess.mod').trim(),
      elo: INITIAL_ELO,
      xp: INITIAL_XP,
      mods: INITIAL_MODS,
      vipActive: false,
      vipExpiresAt: null,
      avatar: 'preset:obsidian_king',
      frameId: 'frame_stone',
      boardThemeId: 'board_classic_maya',
      pieceSkinId: 'pieces_classic',
      equippedPowerId: 'power_none',
      wins: 0,
      losses: 0,
      draws: 0,
      gamesPlayed: 0,
      basesDestroyed: 0,
      campaigns: defaultCampaigns(),
      unlockedCosmetics: ['preset:obsidian_king', 'preset:jade_guardian', 'frame_stone', 'board_classic_maya', 'pieces_classic', 'power_none'],
      customTitle: null
    };
    store.matches = [];
    saveStore(store);
    this.setToken('standalone-local-token');
    return { token: 'standalone-local-token', user: hydrateUser(store.user, store.matches) };
  }

  async login({ identifier }) {
    const store = loadStore();
    if (!store.user) return this.register({ username: identifier || 'Estratega', email: 'local@chess.mod' });
    this.setToken('standalone-local-token');
    return { token: 'standalone-local-token', user: hydrateUser(store.user, store.matches) };
  }
  async login2FA() { throw new Error('2FA solo funciona conectado al servidor online.'); }
  async getSecurityStatus() { return { totpEnabled: false, hasPin: false, backupCodesRemaining: 0, tokenVersion: 1, events: [] }; }
  async setup2FA() { throw new Error('2FA requiere conexión al servidor online.'); }
  async verify2FA() { throw new Error('2FA requiere conexión al servidor online.'); }
  async disable2FA() { throw new Error('2FA requiere conexión al servidor online.'); }
  async setSecurityPin() { throw new Error('PIN requiere conexión al servidor online.'); }
  async changePassword() { throw new Error('Cambio de contraseña requiere conexión al servidor online.'); }
  async revokeAllSessions() { throw new Error('Requiere conexión al servidor online.'); }

  async logout() {
    this.setToken('');
    return { ok: true };
  }

  async getCosmetics() {
    return { avatars: COSMETIC_AVATARS, frames: COSMETIC_FRAMES, boards: COSMETIC_BOARDS, pieceSkins: COSMETIC_PIECE_SKINS, powers: COSMETIC_POWERS, vipPlan: MOD_VIP_PLAN };
  }
  async getShop() { return this.getCosmetics(); }
  async getVipStatus() {
    return { plan: MOD_VIP_PLAN, billingConfigured: false, stripeConfigured: false, paymentLinkConfigured: false };
  }

  async buyShopItem(itemId) {
    const store = loadStore();
    if (!store.user) await this.me();
    const s = loadStore();
    const item = findShopItem(itemId);
    if (!item) throw new Error('Artículo no encontrado.');
    if (item.vipOnly) throw new Error('Exclusivo de Mod VIP ($5 USD / mes).');
    if (item.bossUnlock) throw new Error(item.exclusiveReason || 'Se desbloquea venciendo al Jefe.');
    const price = Number(item.priceMods) || 0;
    if ((s.user.mods || 0) < price) throw new Error(\`Necesitas \${price} Mods (tienes \${s.user.mods || 0} Mods).\`);
    s.user.mods = (s.user.mods || 0) - price;
    const set = new Set(s.user.unlockedCosmetics || []);
    set.add(item.id);
    s.user.unlockedCosmetics = [...set];
    if (item.category === 'board') s.user.boardThemeId = item.id;
    if (item.category === 'piece_skin') s.user.pieceSkinId = item.id;
    if (item.category === 'power') s.user.equippedPowerId = item.id;
    saveStore(s);
    return { ok: true, item, pricePaid: price, user: hydrateUser(s.user, s.matches) };
  }

  async startModVipCheckout() {
    throw new Error('Mod VIP ($5 USD/mes) requiere cobro real en la versión web online del servidor.');
  }

  async verifyModVipPayment() {
    throw new Error('La verificación de pagos reales solo funciona en la versión web online.');
  }
  async getClans() { return { clans: [], createCostMods: 150 }; }
  async createClan() { throw new Error('Los Clanes requieren conexión al servidor online.'); }
  async joinClan() { throw new Error('Los Clanes requieren conexión al servidor online.'); }
  async leaveClan() { throw new Error('Los Clanes requieren conexión al servidor online.'); }
  async getFriends() { return { friends: [], incoming: [], outgoing: [] }; }
  async sendFriendRequest() { throw new Error('El sistema de Amigos requiere conexión online.'); }
  async acceptFriend() { throw new Error('Requiere conexión online.'); }
  async rejectFriend() { throw new Error('Requiere conexión online.'); }
  async removeFriend() { throw new Error('Requiere conexión online.'); }
  async submitReport() { return { ok: true, id: 'offline_rep' }; }
  async getModOverview() { throw new Error('El Panel de Moderación solo funciona en el servidor online.'); }
  async modBanUser() { throw new Error('Requiere servidor online.'); }
  async modUnbanUser() { throw new Error('Requiere servidor online.'); }
  async modResolveReport() { throw new Error('Requiere servidor online.'); }
  async modGrantAll() { throw new Error('Requiere servidor online.'); }
  async modAdjustMods() { throw new Error('Requiere servidor online.'); }
  async buyBattlePassMods() {
    const s = loadStore();
    if (!s.user) await this.me();
    const st = loadStore();
    if ((st.user.mods || 0) < BATTLE_PASS_S1.priceMods) throw new Error('Necesitas 5,000 Mods para desbloquear el Pase de Batalla T1.');
    st.user.mods -= BATTLE_PASS_S1.priceMods;
    st.user.battlePassS1 = true;
    saveStore(st);
    return { ok: true, user: hydrateUser(st.user, st.matches) };
  }
  async startBattlePassCheckout() { throw new Error('El cobro con $10 USD requiere la versión web online.'); }
  async verifyBattlePassPayment() { throw new Error('Requiere versión web online.'); }
  async claimBattlePassTier(tier) {
    const st = loadStore();
    const tDef = BATTLE_PASS_S1.tiers.find((t) => t.tier === Number(tier));
    if (!st.user?.battlePassS1 || !tDef) throw new Error('Pase de Batalla T1 requerido.');
    st.user.bpClaimed = [...new Set([...(st.user.bpClaimed || []), tDef.tier])];
    st.user.unlockedCosmetics = [...new Set([...(st.user.unlockedCosmetics || []), tDef.rewardId])];
    if (tDef.bonusMods) st.user.mods = (st.user.mods || 0) + tDef.bonusMods;
    saveStore(st);
    return { ok: true, user: hydrateUser(st.user, st.matches) };
  }

  async cancelModVip() {
    const store = loadStore();
    if (store.user) {
      stripVipOffline(store.user);
      saveStore(store);
    }
    return { ok: true, user: hydrateUser(store.user, store.matches) };
  }

  async updateUsername(username) {
    const store = loadStore();
    if (store.user) {
      store.user.username = String(username || '').trim().slice(0, 20) || store.user.username;
      saveStore(store);
    }
    return { user: hydrateUser(store.user, store.matches) };
  }

  async updateAvatar(avatar) {
    const store = loadStore();
    if (store.user) {
      store.user.avatar = avatar;
      saveStore(store);
    }
    return { user: hydrateUser(store.user, store.matches) };
  }

  async updateCosmetics({ avatar, frameId, boardThemeId, pieceSkinId, equippedPowerId }) {
    const store = loadStore();
    if (store.user) {
      if (avatar) store.user.avatar = avatar;
      if (frameId) store.user.frameId = frameId;
      if (boardThemeId) store.user.boardThemeId = boardThemeId;
      if (pieceSkinId) store.user.pieceSkinId = pieceSkinId;
      if (equippedPowerId) store.user.equippedPowerId = equippedPowerId;
      saveStore(store);
    }
    return { user: hydrateUser(store.user, store.matches) };
  }

  async chooseTrainerOnce(trainerId) {
    const store = loadStore();
    if (!store.user) await this.me();
    const s = loadStore();
    if (s.user.trainerId) {
      const err = new Error('Ya elegiste tu entrenador permanente. Solo se puede escoger 1 vez al crear la cuenta.');
      err.status = 409;
      throw err;
    }
    s.user.trainerId = trainerId;
    saveStore(s);
    return { ok: true, user: hydrateUser(s.user, s.matches) };
  }

  async updateLanguage(language) {
    const store = loadStore();
    if (store.user) {
      store.user.language = language || 'es';
      saveStore(store);
    }
    return { ok: true, user: hydrateUser(store.user, store.matches) };
  }

  async getLeaderboard() {
    const store = loadStore();
    const u = hydrateUser(store.user, store.matches);
    const players = u ? [{
      rank: 1,
      id: u.id,
      username: u.username,
      avatar: u.avatar,
      frameId: u.frameId,
      isVip: u.isVip,
      elo: u.elo,
      level: u.level,
      wins: u.wins,
      losses: u.losses,
      draws: u.draws
    }] : [];
    return { players };
  }

  async validateCampaignStart(campaignId, levelId) {
    const store = loadStore();
    const campaigns = store.user?.campaigns || defaultCampaigns();
    if (!isCampaignLevelUnlocked(campaignId, levelId, campaigns)) {
      const err = new Error(getCampaignUnlockReason(campaignId, levelId, campaigns) || 'Nivel bloqueado.');
      err.status = 403;
      throw err;
    }
    return { ok: true, campaignId, levelId };
  }

  async spendHintXp() {
    const store = loadStore();
    if (!store.user) await this.me();
    const s = loadStore();
    if ((s.user.xp || 0) < HINT_XP_COST) {
      const err = new Error(\`Necesitas \${HINT_XP_COST} XP para usar una Pista IA (tienes \${s.user.xp || 0} XP).\`);
      err.status = 400;
      throw err;
    }
    s.user.xp -= HINT_XP_COST;
    saveStore(s);
    return { ok: true, xp: s.user.xp, profile: hydrateUser(s.user, s.matches) };
  }

  async reportMatch({ mode, opponentName, winner, resultReason, turns, basesDestroyed, campaignId, levelId }) {
    const store = loadStore();
    if (!store.user) await this.me();
    const s = loadStore();
    const u = s.user;
    u.campaigns = { ...defaultCampaigns(), ...(u.campaigns || {}) };

    let xpGained = winner === 'w' ? 65 : (winner === 'draw' ? 25 : 15);
    const modsGained = winner === 'w' ? (Number(levelId) === 5 ? 95 : 45) : (winner === 'draw' ? 20 : 12);
    if (campaignId && levelId) {
      const lvl = getCampaignLevel(campaignId, levelId);
      if (lvl) xpGained = winner === 'w' ? lvl.xpReward : 20;
      if (winner === 'w') {
        const list = new Set(u.campaigns[campaignId]?.completedLevels || []);
        list.add(Number(levelId));
        u.campaigns[campaignId] = { completedLevels: [...list].sort((a, b) => a - b) };
        if (campaignId === 'mittens' && Number(levelId) === 5) {
          const unl = new Set(u.unlockedCosmetics || []);
          unl.add('power_free_mittens');
          u.unlockedCosmetics = [...unl];
        }
        if (campaignId === 'chess' && Number(levelId) === 5) {
          u.customTitle = 'Vencedor de Chess';
          const unl = new Set(u.unlockedCosmetics || []);
          unl.add('frame_chess_victor');
          unl.add('preset:chess_origin');
          u.unlockedCosmetics = [...unl];
        }
      }
    }
    if (mode === 'blacky' && winner === 'w') {
      u.customTitle = 'Domador de Blacky (Imposible)';
      const unl = new Set(u.unlockedCosmetics || []);
      unl.add('frame_blacky_imposible');
      unl.add('preset:blacky_tamer');
      unl.add('power_blacky_claw');
      u.unlockedCosmetics = [...unl];
    }

    if (winner === 'w') u.wins = (u.wins || 0) + 1;
    else if (winner === 'b') u.losses = (u.losses || 0) + 1;
    else u.draws = (u.draws || 0) + 1;
    u.gamesPlayed = (u.gamesPlayed || 0) + 1;
    u.basesDestroyed = (u.basesDestroyed || 0) + (Number(basesDestroyed) || 0);
    u.xp = (u.xp || 0) + xpGained;
    u.mods = (u.mods || INITIAL_MODS) + modsGained;

    s.matches.unshift({
      mode,
      opponent: opponentName,
      outcome: winner === 'w' ? 'win' : (winner === 'b' ? 'loss' : 'draw'),
      reason: resultReason,
      turns,
      xpGained,
      createdAt: new Date().toISOString()
    });
    s.matches = s.matches.slice(0, 40);
    saveStore(s);
    return { ok: true, xpGained, modsGained, profile: hydrateUser(u, s.matches) };
  }
}

export const api = new StandaloneApiClient();
`;

const resolveSharedPlugin = {
  name: 'resolve-shared-root',
  setup(build) {
    build.onResolve({ filter: /^\/shared\// }, (args) => ({
      path: path.join(rootDir, args.path.slice(1))
    }));
  }
};

// 4. Empaquetar el Web Worker de Súper IA como string autocontenido
const workerBuild = await esbuild.build({
  entryPoints: [path.join(clientDir, 'js', 'superAiWorker.js')],
  bundle: true,
  format: 'iife',
  minify: true,
  write: false,
  plugins: [resolveSharedPlugin]
});
const workerCode = workerBuild.outputFiles[0].text;

// 5. Empaquetar toda la app del cliente en un único IIFE (reemplazando api.js por el adaptador offline y mittens_ref.png por data URI)
const appBuild = await esbuild.build({
  entryPoints: [path.join(clientDir, 'js', 'app.js')],
  bundle: true,
  format: 'iife',
  minify: false,
  write: false,
  plugins: [
    resolveSharedPlugin,
    {
      name: 'standalone-offline-adapter',
      setup(build) {
        build.onResolve({ filter: /^\.\/api\.js$/ }, () => ({
          path: path.join(clientDir, 'js', 'api.js'),
          namespace: 'standalone-api'
        }));
        build.onLoad({ filter: /.*/, namespace: 'standalone-api' }, () => ({
          contents: standaloneApiSource,
          resolveDir: path.join(clientDir, 'js'),
          loader: 'js'
        }));
        build.onLoad({ filter: /(portraits|svgs)\.js$/ }, (args) => {
          let src = fs.readFileSync(args.path, 'utf8');
          src = src.replaceAll('/assets/images/mittens_ref.png', mittensDataUri);
          src = src.replaceAll('/assets/images/blacky_ref.jpg', blackyDataUri);
          src = src.replaceAll('/assets/images/glitch_texture.jpg', glitchTexDataUri);
          return { contents: src, loader: 'js' };
        });
        build.onLoad({ filter: /battleController\.js$/ }, (args) => {
          let src = fs.readFileSync(args.path, 'utf8');
          // Usar Blob URL para el Worker de Súper IA en archivo HTML descargable
          src = src.replace(
            "new Worker('/js/superAiWorker.js', { type: 'module' })",
            "new Worker(URL.createObjectURL(new Blob([window.__CHESS_SUPER_AI_WORKER_CODE__ || ''], { type: 'application/javascript' })))"
          );
          return { contents: src, loader: 'js' };
        });
      }
    }
  ]
});

const appJs = appBuild.outputFiles[0].text;

// 6. Construir el archivo HTML final autocontenido a partir de client/index.html
let html = fs.readFileSync(path.join(clientDir, 'index.html'), 'utf8');

// Reemplazar los 4 CSS externos por un único <style> inline
html = html.replace(
  /<link rel="stylesheet" href="\/css\/main\.css">\s*<link rel="stylesheet" href="\/css\/menu\.css">\s*<link rel="stylesheet" href="\/css\/board\.css">\s*<link rel="stylesheet" href="\/css\/portraits\.css">/,
  `<style>\n${combinedCss}\n</style>`
);

// Reemplazar el logo oficial, retrato de Blacky y las 7 pistas de batallas/jefes por Data URIs embebidos
html = html.replaceAll('/assets/images/chess_mod_logo.jpg', logoDataUri);
html = html.replaceAll('/assets/images/blacky_ref.jpg', blackyDataUri);
html = html.replaceAll('/assets/audio/Ultimate%20Battle.mp3', musicDataUri);
html = html.replaceAll('/assets/audio/MayaCampaignBattle.mp3', mayaCampMusicDataUri);
html = html.replaceAll('/assets/audio/FreeMittensBattle.mp3', mittensMusicDataUri);
html = html.replaceAll('/assets/audio/GalaxyBattle.mp3', galaxyMusicDataUri);
html = html.replaceAll('/assets/audio/GlitchBattle.mp3', glitchMusicDataUri);
html = html.replaceAll('/assets/audio/ChessBattle.mp3', chessMusicDataUri);
html = html.replaceAll('/assets/audio/BlackyBattle.mp3', blackyMusicDataUri);

// Quitar socket.io externo (no aplica en modo archivo descargable offline) y reemplazar el <script type="module"> por nuestro bundle inline
html = html.replace(
  /<script src="\/socket\.io\/socket\.io\.js"><\/script>\s*<script type="module" src="\/js\/app\.js"><\/script>/,
  `<script>window.__CHESS_SUPER_AI_WORKER_CODE__ = ${JSON.stringify(workerCode)};</script>\n  <script>\n${appJs.replace(/<\/script>/gi, '<\\/script>')}\n</script>`
);

fs.writeFileSync(outHtmlPath, html, 'utf8');
const sizeMb = (fs.statSync(outHtmlPath).size / (1024 * 1024)).toFixed(2);
console.log(`✅ Generado HTML descargable autocontenido: ${outHtmlPath} (${sizeMb} MB)`);
