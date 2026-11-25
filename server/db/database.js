import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import {
  computeLevelFromXp,
  INITIAL_ELO,
  INITIAL_MODS,
  HINT_XP_COST,
  CLAN_CREATE_COST_MODS,
  CLAN_TEXT_COLORS,
  CLAN_FONT_FAMILIES,
  CLAN_PERMISSION_DEFS
} from '../../shared/config/constants.js';
import { calculateEloUpdate, getFideCategory, BOT_ELO_BY_DIFFICULTY } from '../../shared/config/elo.js';
import { getAllCosmetics, findShopItem, isCosmeticUnlocked, VIP_EXCLUSIVE_IDS, MOD_VIP_PLAN, BATTLE_PASS_S1, BATTLE_PASS_S1_IDS } from '../../shared/config/cosmetics.js';
import { MISSIONS, MAX_MISSION_REWARD_MODS, computeUserMissions } from '../../shared/config/missions.js';
import { CHAPTER_ORDER, isChapterUnlocked, isCampaignLevelUnlocked } from '../../shared/config/campaigns.js';
import { MODERATOR_EXACT_EMAIL, MODERATOR_EXACT_PASSWORD, hashPassword } from '../auth/authService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Capa de persistencia dual de CHESS.MOD:
 * - Si existe `process.env.DATABASE_URL`, conecta automáticamente a PostgreSQL (Neon / Supabase / Render).
 * - Si no existe `DATABASE_URL`, usa SQLite persistente local (`server/data/chess_mod.sqlite`).
 */
export class ChessDatabase {
  constructor(dbPath) {
    this.databaseUrl = process.env.DATABASE_URL || '';
    this.driver = this.databaseUrl ? 'postgres' : 'sqlite';
    this.dbPath = dbPath || process.env.CHESS_MOD_DB_PATH || path.join(__dirname, '..', 'data', 'chess_mod.sqlite');
    this.pgPool = null;
    this.sqlite = null;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;
    const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');

    if (this.driver === 'postgres') {
      const needsSsl = !this.databaseUrl.includes('localhost') && !this.databaseUrl.includes('127.0.0.1');
      this.pgPool = new pg.Pool({
        connectionString: this.databaseUrl,
        ssl: needsSsl ? { rejectUnauthorized: false } : false
      });
      await this.pgPool.query(schemaSql);
      // Migraciones suaves para bases existentes sin perder ninguna cuenta vinculada
      const pgMigrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS title TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mods INTEGER NOT NULL DEFAULT 100",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS piece_skin_id TEXT NOT NULL DEFAULT 'pieces_classic'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_power_id TEXT NOT NULL DEFAULT 'power_none'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_active INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_expires_at TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_moderator INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_banned INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS ban_reason TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_at TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_enabled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_secret TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS totp_pending_secret TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS backup_codes_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS security_pin_hash TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS trainer_id TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS banned_until TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS battle_pass_s1 INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS battle_pass_s1_at TEXT",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS battle_pass_claimed_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_owner INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE clans ADD COLUMN IF NOT EXISTS avatar TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE clans ADD COLUMN IF NOT EXISTS join_policy TEXT NOT NULL DEFAULT 'open'",
        "ALTER TABLE clans ADD COLUMN IF NOT EXISTS public_read_chat INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE clans ADD COLUMN IF NOT EXISTS text_color TEXT NOT NULL DEFAULT '#efd083'",
        "ALTER TABLE clans ADD COLUMN IF NOT EXISTS font_family TEXT NOT NULL DEFAULT 'cinzel'",
        "ALTER TABLE clan_members ADD COLUMN IF NOT EXISTS custom_role_id TEXT"
      ];
      for (const sql of pgMigrations) {
        await this.pgPool.query(sql).catch(() => {});
      }
    } else {
      if (this.dbPath !== ':memory:') {
        fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      }
      this.sqlite = new DatabaseSync(this.dbPath);
      this.sqlite.exec('PRAGMA foreign_keys = ON;');
      this.sqlite.exec('PRAGMA journal_mode = WAL;');
      this.sqlite.exec(schemaSql);
      const sqliteMigrations = [
        "ALTER TABLE users ADD COLUMN title TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users ADD COLUMN mods INTEGER NOT NULL DEFAULT 100",
        "ALTER TABLE users ADD COLUMN piece_skin_id TEXT NOT NULL DEFAULT 'pieces_classic'",
        "ALTER TABLE users ADD COLUMN equipped_power_id TEXT NOT NULL DEFAULT 'power_none'",
        "ALTER TABLE users ADD COLUMN vip_active INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN vip_expires_at TEXT",
        "ALTER TABLE users ADD COLUMN is_moderator INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN is_banned INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN ban_reason TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE users ADD COLUMN banned_at TEXT",
        "ALTER TABLE users ADD COLUMN totp_enabled INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN totp_secret TEXT",
        "ALTER TABLE users ADD COLUMN totp_pending_secret TEXT",
        "ALTER TABLE users ADD COLUMN backup_codes_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE users ADD COLUMN security_pin_hash TEXT",
        "ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 1",
        "ALTER TABLE users ADD COLUMN trainer_id TEXT",
        "ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'es'",
        "ALTER TABLE users ADD COLUMN banned_until TEXT",
        "ALTER TABLE users ADD COLUMN battle_pass_s1 INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE users ADD COLUMN battle_pass_s1_at TEXT",
        "ALTER TABLE users ADD COLUMN battle_pass_claimed_json TEXT NOT NULL DEFAULT '[]'",
        "ALTER TABLE users ADD COLUMN is_owner INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE clans ADD COLUMN avatar TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE clans ADD COLUMN join_policy TEXT NOT NULL DEFAULT 'open'",
        "ALTER TABLE clans ADD COLUMN public_read_chat INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE clans ADD COLUMN text_color TEXT NOT NULL DEFAULT '#efd083'",
        "ALTER TABLE clans ADD COLUMN font_family TEXT NOT NULL DEFAULT 'cinzel'",
        "ALTER TABLE clan_members ADD COLUMN custom_role_id TEXT"
      ];
      for (const sql of sqliteMigrations) {
        try { this.sqlite.exec(sql); } catch {}
      }
    }
    this.initialized = true;
    await this.ensureSeedModeratorAccount();
  }

  /**
   * Si la cuenta dueña/moderadora (sebasstianrf27@gmail.com) ya existe en BD,
   * garantiza sin borrar progreso que tenga los 25 niveles de Modo Historia,
   * Pase de Batalla Temporada 1 y permisos completos de Moderador.
   */
  async ensureSeedModeratorAccount() {
    try {
      const row = await this.findUserByEmail(MODERATOR_EXACT_EMAIL);
      if (row) {
        await this.grantModeratorEverything(row.id);
      }
    } catch {}
  }

  async isUserCurrentlyBanned(row) {
    if (!row || !Number(row.is_banned)) return { banned: false, permanent: false, until: null, daysLeft: 0 };
    if (row.banned_until) {
      const exp = Date.parse(row.banned_until);
      if (Number.isFinite(exp) && exp <= Date.now()) {
        // Expulsión temporal cumplida: levantar automáticamente
        await this.unbanUser(row.id);
        return { banned: false, permanent: false, until: null, daysLeft: 0 };
      }
      const daysLeft = Math.max(1, Math.ceil((exp - Date.now()) / (24 * 60 * 60 * 1000)));
      return { banned: true, permanent: false, until: row.banned_until, daysLeft, reason: row.ban_reason || '' };
    }
    return { banned: true, permanent: true, until: null, daysLeft: 0, reason: row.ban_reason || '' };
  }

  toPgSql(sql) {
    let idx = 0;
    return sql.replace(/\?/g, () => `$${++idx}`);
  }

  async queryOne(sql, params = []) {
    if (this.driver === 'postgres') {
      const res = await this.pgPool.query(this.toPgSql(sql), params);
      return res.rows[0] || null;
    }
    return this.sqlite.prepare(sql).get(...params) || null;
  }

  async queryAll(sql, params = []) {
    if (this.driver === 'postgres') {
      const res = await this.pgPool.query(this.toPgSql(sql), params);
      return res.rows;
    }
    return this.sqlite.prepare(sql).all(...params);
  }

  async execSql(sql, params = []) {
    if (this.driver === 'postgres') {
      return await this.pgPool.query(this.toPgSql(sql), params);
    }
    return this.sqlite.prepare(sql).run(...params);
  }

  async close() {
    if (this.pgPool) await this.pgPool.end();
    if (this.sqlite) this.sqlite.close();
  }

  isVipRowActive(row) {
    if (!row || !Number(row.vip_active)) return false;
    if (!row.vip_expires_at) return false;
    const exp = Date.parse(row.vip_expires_at);
    return Number.isFinite(exp) && exp > Date.now();
  }

  /**
   * Si la suscripción Mod VIP venció o fue cancelada, quita TODOS los artículos VIP
   * del inventario y revierte cualquier ítem VIP equipado a valores estándar.
   */
  async stripVipItemsFromUser(userId, row = null) {
    const u = row || (await this.findUserById(userId));
    if (!u) return null;
    const now = new Date().toISOString();
    const nextFrame = VIP_EXCLUSIVE_IDS.includes(u.frame_id) ? 'frame_stone' : u.frame_id;
    const nextBoard = VIP_EXCLUSIVE_IDS.includes(u.board_theme_id) ? 'board_classic_maya' : u.board_theme_id;
    const nextPieces = VIP_EXCLUSIVE_IDS.includes(u.piece_skin_id) ? 'pieces_classic' : (u.piece_skin_id || 'pieces_classic');
    const nextPower = VIP_EXCLUSIVE_IDS.includes(u.equipped_power_id) ? 'power_none' : (u.equipped_power_id || 'power_none');

    await this.execSql(`
      UPDATE users
      SET vip_active = 0,
          vip_expires_at = NULL,
          frame_id = ?,
          board_theme_id = ?,
          piece_skin_id = ?,
          equipped_power_id = ?,
          updated_at = ?
      WHERE id = ?
    `, [nextFrame, nextBoard, nextPieces, nextPower, now, userId]);

    for (const vipId of VIP_EXCLUSIVE_IDS) {
      await this.execSql('DELETE FROM user_unlocks WHERE user_id = ? AND cosmetic_id = ?', [userId, vipId]);
    }
    return this.findUserById(userId);
  }

  async ensureFreshVipState(row) {
    if (!row) return null;
    if (Number(row.vip_active) && !this.isVipRowActive(row)) {
      return this.stripVipItemsFromUser(row.id, row);
    }
    return row;
  }

  formatPublicUser(row) {
    if (!row) return null;
    const lvlInfo = computeLevelFromXp(row.xp);
    const isOwner = Boolean(Number(row.is_owner)) || String(row.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    const isModerator = Boolean(Number(row.is_moderator)) || isOwner;
    const isVip = this.isVipRowActive(row) || isOwner;
    const isBanned = Boolean(Number(row.is_banned)) && (!row.banned_until || Date.parse(row.banned_until) > Date.now());
    const hasBattlePassS1 = Boolean(Number(row.battle_pass_s1)) || isOwner;
    let bpClaimed = [];
    try { bpClaimed = JSON.parse(row.battle_pass_claimed_json || '[]'); } catch { bpClaimed = []; }
    if (!Array.isArray(bpClaimed)) bpClaimed = [];
    if (isOwner && bpClaimed.length < BATTLE_PASS_S1.tiers.length * 2) {
      bpClaimed = BATTLE_PASS_S1.tiers.flatMap((t) => [`free:${t.tier}`, `paid:${t.tier}`]);
    }
    const frameId = (!isVip && VIP_EXCLUSIVE_IDS.includes(row.frame_id)) ? 'frame_stone' : (row.frame_id || 'frame_stone');
    const boardThemeId = (!isVip && VIP_EXCLUSIVE_IDS.includes(row.board_theme_id)) ? 'board_classic_maya' : (row.board_theme_id || 'board_classic_maya');
    const pieceSkinId = (!isVip && VIP_EXCLUSIVE_IDS.includes(row.piece_skin_id)) ? 'pieces_classic' : (row.piece_skin_id || 'pieces_classic');
    const equippedPowerId = (!isVip && VIP_EXCLUSIVE_IDS.includes(row.equipped_power_id)) ? 'power_none' : (row.equipped_power_id || 'power_none');
    return {
      id: row.id,
      username: row.username,
      avatar: row.avatar,
      frameId,
      boardThemeId,
      pieceSkinId,
      equippedPowerId,
      trainerId: row.trainer_id || null,
      language: row.language || 'es',
      isVip,
      isOwner,
      isModerator,
      isBanned,
      banReason: row.ban_reason || '',
      bannedUntil: row.banned_until || null,
      battlePassS1: {
        owned: hasBattlePassS1,
        season: 1,
        acquiredAt: row.battle_pass_s1_at || null,
        xp: Number(row.xp) || 0,
        claimedTiers: bpClaimed
      },
      vipExpiresAt: isVip ? row.vip_expires_at : null,
      mods: Number(row.mods ?? INITIAL_MODS) || 0,
      title: row.title || '',
      elo: Number(row.elo) || 0,
      fideCategory: getFideCategory(Number(row.elo) || 0),
      xp: Number(row.xp) || 0,
      level: lvlInfo.level,
      levelTitle: row.title || lvlInfo.title,
      levelProgressPct: lvlInfo.progressPct,
      nextLevelXp: lvlInfo.next ? lvlInfo.next.minXp : null,
      wins: Number(row.wins) || 0,
      losses: Number(row.losses) || 0,
      draws: Number(row.draws) || 0,
      gamesPlayed: Number(row.games_played) || 0,
      basesDestroyed: Number(row.bases_destroyed) || 0,
      hintsUsed: Number(row.hints_used) || 0,
      createdAt: row.created_at
    };
  }

  async getCampaignsProgress(userId) {
    const campaignRows = await this.queryAll(
      'SELECT campaign_id, level_id, best_turns, completions, completed_at FROM campaign_progress WHERE user_id = ? ORDER BY campaign_id, level_id',
      [userId]
    );

    const campaigns = {};
    for (const cid of CHAPTER_ORDER) {
      campaigns[cid] = { completedLevels: [], unlockedLevel: 0, chapterUnlocked: false, history: [] };
    }

    for (const r of campaignRows) {
      if (!campaigns[r.campaign_id]) continue;
      campaigns[r.campaign_id].completedLevels.push(Number(r.level_id));
      campaigns[r.campaign_id].history.push({
        levelId: Number(r.level_id),
        bestTurns: Number(r.best_turns),
        completions: Number(r.completions),
        completedAt: r.completed_at
      });
    }

    for (const cid of CHAPTER_ORDER) {
      const chOpen = isChapterUnlocked(cid, campaigns);
      campaigns[cid].chapterUnlocked = chOpen;
      if (!chOpen) {
        campaigns[cid].unlockedLevel = 0;
      } else {
        // Desbloqueo estrictamente secuencial: no se puede saltar ningún nivel
        let maxUnlocked = 1;
        for (let lv = 2; lv <= 5; lv++) {
          if (isCampaignLevelUnlocked(cid, lv, campaigns)) maxUnlocked = lv;
          else break;
        }
        campaigns[cid].unlockedLevel = maxUnlocked;
      }
    }
    return campaigns;
  }

  async getFullUserProfile(userId) {
    const rawRow = await this.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
    if (!rawRow) return null;
    const row = await this.ensureFreshVipState(rawRow);

    const base = this.formatPublicUser(row);
    const campaigns = await this.getCampaignsProgress(userId);

    const explicitUnlocks = (await this.queryAll('SELECT cosmetic_id FROM user_unlocks WHERE user_id = ?', [userId]))
      .map((r) => r.cosmetic_id);

    const allCosmetics = getAllCosmetics();
    const unlockedCosmetics = [
      ...allCosmetics.avatars,
      ...allCosmetics.frames,
      ...allCosmetics.boards,
      ...allCosmetics.pieceSkins,
      ...allCosmetics.powers
    ]
      .filter((c) => isCosmeticUnlocked(c.id, base.level, explicitUnlocks, base.isVip))
      .map((c) => c.id);

    const recentMatches = await this.getUserMatches(userId, 20);
    const clan = await this.getUserClan(userId);

    return {
      ...base,
      email: row.email,
      googleLinked: Boolean(row.google_id),
      security: {
        totpEnabled: Boolean(Number(row.totp_enabled)),
        hasPin: Boolean(row.security_pin_hash),
        tokenVersion: Number(row.token_version) || 1
      },
      clan,
      campaigns,
      unlockedCosmetics,
      recentMatches
    };
  }

  async createUser({ username, email, passwordHash, passwordSalt, googleId = null, avatar = 'preset:obsidian_king' }) {
    const now = new Date().toISOString();
    const id = `usr_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
    const initialXp = 50;
    const lvl = computeLevelFromXp(initialXp).level;

    await this.execSql(`
      INSERT INTO users (
        id, username, username_lower, email, password_hash, password_salt, google_id,
        avatar, frame_id, board_theme_id, piece_skin_id, equipped_power_id, title,
        elo, xp, mods, vip_active, vip_expires_at, level,
        wins, losses, draws, games_played, bases_destroyed, hints_used, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'frame_stone', 'board_classic_maya', 'pieces_classic', 'power_none', '', ?, ?, ?, 0, NULL, ?, 0, 0, 0, 0, 0, 0, ?, ?)
    `, [id, username, username.toLowerCase(), email.toLowerCase(), passwordHash, passwordSalt, googleId, avatar, INITIAL_ELO, initialXp, INITIAL_MODS, lvl, now, now]);

    return this.getFullUserProfile(id);
  }

  async setUserTrainerOnce(userId, trainerId) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    if (row.trainer_id) {
      const err = new Error('Ya elegiste tu entrenador permanente al crear tu cuenta. No se puede cambiar.');
      err.status = 409;
      err.code = 'TRAINER_ALREADY_CHOSEN';
      err.trainerId = row.trainer_id;
      throw err;
    }
    const now = new Date().toISOString();
    await this.execSql('UPDATE users SET trainer_id = ?, updated_at = ? WHERE id = ?', [trainerId, now, userId]);
    return this.getFullUserProfile(userId);
  }

  async updateUserLanguage(userId, language) {
    const safe = ['es', 'en', 'pt', 'fr', 'de', 'it', 'ja', 'ko', 'ru', 'zh'].includes(language) ? language : 'es';
    const now = new Date().toISOString();
    await this.execSql('UPDATE users SET language = ?, updated_at = ? WHERE id = ?', [safe, now, userId]);
    return this.getFullUserProfile(userId);
  }

  async findUserByEmail(email) {
    return this.queryOne('SELECT * FROM users WHERE email = ?', [String(email || '').trim().toLowerCase()]);
  }

  async findUserByUsername(username) {
    return this.queryOne('SELECT * FROM users WHERE username_lower = ?', [String(username || '').trim().toLowerCase()]);
  }

  async findUserById(userId) {
    return this.queryOne('SELECT * FROM users WHERE id = ?', [userId]);
  }

  async updateUsername(userId, newUsername) {
    const existing = await this.findUserByUsername(newUsername);
    if (existing && existing.id !== userId) {
      throw new Error('Ese nombre de usuario ya está en uso.');
    }
    const now = new Date().toISOString();
    await this.execSql('UPDATE users SET username = ?, username_lower = ?, updated_at = ? WHERE id = ?', [newUsername, newUsername.toLowerCase(), now, userId]);
    return this.getFullUserProfile(userId);
  }

  async updateAvatar(userId, avatar) {
    const now = new Date().toISOString();
    await this.execSql('UPDATE users SET avatar = ?, updated_at = ? WHERE id = ?', [avatar, now, userId]);
    return this.getFullUserProfile(userId);
  }

  async updateCosmetics(userId, { avatar, frameId, boardThemeId, pieceSkinId, equippedPowerId }) {
    const profile = await this.getFullUserProfile(userId);
    if (!profile) throw new Error('Usuario no encontrado.');

    if (avatar !== undefined) {
      const isCustom = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(avatar);
      if (!isCustom && !profile.unlockedCosmetics.includes(avatar)) {
        throw new Error('Avatar bloqueado: sube de nivel o completa el logro requerido.');
      }
    }
    if (frameId !== undefined && !profile.unlockedCosmetics.includes(frameId)) {
      throw new Error('Marco bloqueado: requiere nivel, logro o Mod VIP.');
    }
    if (boardThemeId !== undefined && !profile.unlockedCosmetics.includes(boardThemeId)) {
      throw new Error('Tablero bloqueado: cómpralo en la Tienda con Mods o activa Mod VIP.');
    }
    if (pieceSkinId !== undefined && !profile.unlockedCosmetics.includes(pieceSkinId)) {
      throw new Error('Skin de fichas bloqueada: cómprala en la Tienda con Mods o activa Mod VIP.');
    }
    if (equippedPowerId !== undefined && !profile.unlockedCosmetics.includes(equippedPowerId)) {
      throw new Error('Poder bloqueado: cómpralo en la Tienda con Mods o activa Mod VIP.');
    }

    const now = new Date().toISOString();
    await this.execSql(`
      UPDATE users
      SET avatar = COALESCE(?, avatar),
          frame_id = COALESCE(?, frame_id),
          board_theme_id = COALESCE(?, board_theme_id),
          piece_skin_id = COALESCE(?, piece_skin_id),
          equipped_power_id = COALESCE(?, equipped_power_id),
          updated_at = ?
      WHERE id = ?
    `, [avatar ?? null, frameId ?? null, boardThemeId ?? null, pieceSkinId ?? null, equippedPowerId ?? null, now, userId]);

    return this.getFullUserProfile(userId);
  }

  async addMods(userId, delta) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    const nextMods = Math.max(0, (Number(row.mods) || 0) + Math.round(delta));
    const now = new Date().toISOString();
    await this.execSql('UPDATE users SET mods = ?, updated_at = ? WHERE id = ?', [nextMods, now, userId]);
    return nextMods;
  }

  async buyShopItem(userId, itemId) {
    const profile = await this.getFullUserProfile(userId);
    if (!profile) throw new Error('Usuario no encontrado.');
    const item = findShopItem(itemId);
    if (!item) throw new Error('Artículo no encontrado en la tienda.');
    if (item.vipOnly) {
      throw new Error('Este artículo es exclusivo de la suscripción mensual Mod VIP ($5 USD / mes).');
    }
    if (item.bossUnlock) {
      throw new Error(`Este poder no se compra con Mods: ${item.exclusiveReason || 'desbloquéalo venciendo al Jefe correspondiente'}.`);
    }
    if (item.battlePassSeason) {
      throw new Error(`Este artículo es exclusivo del Pase de Batalla Temporada ${item.battlePassSeason} ($10 USD o 5,000 Mods).`);
    }
    if (profile.unlockedCosmetics.includes(item.id)) {
      throw new Error('Ya tienes este artículo en tu inventario.');
    }
    const price = Number(item.priceMods) || 0;
    if (price <= 0) throw new Error('Este artículo no está a la venta por Mods.');
    if (profile.mods < price) {
      const err = new Error(`Necesitas ${price} Mods (tienes ${profile.mods} Mods). Juega partidas para ganar más Mods.`);
      err.status = 400;
      err.code = 'INSUFFICIENT_MODS';
      throw err;
    }

    await this.addMods(userId, -price);
    await this.grantExclusiveUnlock(userId, item.id);

    // Equipar automáticamente al comprar
    const patch = {};
    if (item.category === 'board') patch.boardThemeId = item.id;
    if (item.category === 'piece_skin') patch.pieceSkinId = item.id;
    if (item.category === 'power') patch.equippedPowerId = item.id;
    const updated = Object.keys(patch).length
      ? await this.updateCosmetics(userId, patch)
      : await this.getFullUserProfile(userId);

    return { ok: true, item, pricePaid: price, user: updated };
  }

  async activateModVip(userId, { durationDays = MOD_VIP_PLAN.durationDays } = {}) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    const nowMs = Date.now();
    const baseMs = this.isVipRowActive(row) ? Date.parse(row.vip_expires_at) : nowMs;
    const expiresAt = new Date(baseMs + Math.max(1, Number(durationDays) || 30) * 24 * 60 * 60 * 1000).toISOString();
    const now = new Date().toISOString();

    await this.execSql(`
      UPDATE users
      SET vip_active = 1,
          vip_expires_at = ?,
          frame_id = 'frame_vip_gold',
          board_theme_id = 'board_vip_gold_black',
          piece_skin_id = 'pieces_vip_gold',
          equipped_power_id = 'power_vip_golden_freeze',
          updated_at = ?
      WHERE id = ?
    `, [expiresAt, now, userId]);

    for (const vipId of VIP_EXCLUSIVE_IDS) {
      await this.grantExclusiveUnlock(userId, vipId);
    }

    return { ok: true, vipExpiresAt: expiresAt, user: await this.getFullUserProfile(userId) };
  }

  async cancelModVip(userId) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    await this.stripVipItemsFromUser(userId, row);
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  /* ================= PASE DE BATALLA TEMPORADA 1 (GRATIS 50 NV + PREMIUM $10 USD O 5,000 MODS) ================= */
  async purchaseBattlePassWithMods(userId) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    if (Number(row.battle_pass_s1) || Number(row.is_moderator)) {
      return { ok: true, alreadyOwned: true, user: await this.getFullUserProfile(userId) };
    }
    const cost = Number(BATTLE_PASS_S1.priceMods) || 5000;
    const currentMods = Number(row.mods) || 0;
    if (currentMods < cost) {
      const err = new Error(`Necesitas ${cost.toLocaleString('es-PE')} Mods para comprar el Pase de Batalla T1 con Mods (tienes ${currentMods.toLocaleString('es-PE')} Mods). También puedes comprarlo con Tarjeta / Dinero ($10.00 USD).`);
      err.status = 400;
      err.code = 'INSUFFICIENT_MODS';
      throw err;
    }
    await this.addMods(userId, -cost);
    return this.activateBattlePassS1(userId);
  }

  async activateBattlePassS1(userId) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    const now = new Date().toISOString();
    await this.execSql(
      'UPDATE users SET battle_pass_s1 = 1, battle_pass_s1_at = COALESCE(battle_pass_s1_at, ?), updated_at = ? WHERE id = ?',
      [now, now, userId]
    );
    const currentXp = Number(row.xp) || 0;
    for (const tier of BATTLE_PASS_S1.tiers) {
      if (currentXp >= tier.xpRequired) {
        await this.claimBattlePassTier(userId, tier.tier, 'paid').catch(() => {});
      }
    }
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  async claimBattlePassTier(userId, tierNumber, track = 'free') {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    const safeTrack = track === 'paid' ? 'paid' : 'free';
    const isMod = Boolean(Number(row.is_moderator));
    if (safeTrack === 'paid' && !Number(row.battle_pass_s1) && !isMod) {
      const err = new Error('El carril Premium del Pase de Batalla Temporada 1 es solo de paga ($10.00 USD).');
      err.status = 402;
      err.code = 'PAYMENT_REQUIRED';
      throw err;
    }
    const tierDef = BATTLE_PASS_S1.tiers.find((t) => t.tier === Number(tierNumber));
    if (!tierDef) throw new Error('Nivel del Pase de Batalla no válido (1–50).');
    const reward = safeTrack === 'paid' ? tierDef.paid : tierDef.free;
    const userXp = Number(row.xp) || 0;
    if (!isMod && userXp < tierDef.xpRequired) {
      const err = new Error(`Necesitas ${tierDef.xpRequired} XP para reclamar el Nivel ${tierDef.tier} (tienes ${userXp} XP).`);
      err.status = 400;
      err.code = 'INSUFFICIENT_XP';
      throw err;
    }
    let claimed = [];
    try { claimed = JSON.parse(row.battle_pass_claimed_json || '[]'); } catch { claimed = []; }
    if (!Array.isArray(claimed)) claimed = [];
    const claimKey = `${safeTrack}:${tierDef.tier}`;
    if (claimed.includes(claimKey)) {
      return { ok: true, alreadyClaimed: true, user: await this.getFullUserProfile(userId) };
    }
    claimed.push(claimKey);

    if (reward?.rewardId) {
      await this.grantExclusiveUnlock(userId, reward.rewardId);
    }
    if (reward?.bonusMods > 0) {
      await this.addMods(userId, reward.bonusMods);
    }
    await this.execSql(
      'UPDATE users SET battle_pass_claimed_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(claimed), new Date().toISOString(), userId]
    );
    return { ok: true, tier: tierDef.tier, track: safeTrack, reward, user: await this.getFullUserProfile(userId) };
  }

  /* ================= REGISTRO ANTI-CHEAT EN BD ================= */
  async recordAntiCheatFlag(userId, { username = 'Jugador', category = 'cheat_exploit', severity = 'medium', score = 25, details = '' } = {}) {
    const id = `ac_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    await this.execSql(`
      INSERT INTO anticheat_flags (id, user_id, username, category, severity, score, details, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?)
    `, [id, userId, String(username).slice(0, 32), String(category).slice(0, 32), String(severity).slice(0, 16), Math.round(Number(score) || 25), String(details).slice(0, 320), now]);
    return { ok: true, id };
  }

  async listAntiCheatFlags(limit = 100) {
    const rows = await this.queryAll(`
      SELECT * FROM anticheat_flags
      ORDER BY CASE WHEN status = 'open' THEN 0 ELSE 1 END, created_at DESC
      LIMIT ?
    `, [limit]);
    return rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      username: r.username,
      category: r.category,
      severity: r.severity,
      score: Number(r.score) || 0,
      details: r.details,
      status: r.status,
      createdAt: r.created_at
    }));
  }

  async dismissAntiCheatFlag(flagId) {
    await this.execSql("UPDATE anticheat_flags SET status = 'reviewed' WHERE id = ?", [flagId]);
    return { ok: true, flagId };
  }

  /* ================= MENSAJES PRIVADOS ENTRE AMIGOS ================= */
  async areUsersFriends(userA, userB) {
    if (!userA || !userB || userA === userB) return false;
    const row = await this.queryOne(`
      SELECT id FROM friendships
      WHERE status = 'accepted'
        AND ((requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?))
    `, [userA, userB, userB, userA]);
    return Boolean(row);
  }

  async getFriendMessages(userId, friendId, limit = 80) {
    const isFriend = await this.areUsersFriends(userId, friendId);
    if (!isFriend) {
      const err = new Error('Solo puedes ver mensajes con jugadores que sean tus amigos.');
      err.status = 403;
      throw err;
    }
    const rows = await this.queryAll(`
      SELECT fm.*, u.username AS sender_username
      FROM friend_messages fm
      JOIN users u ON u.id = fm.sender_id
      WHERE (fm.sender_id = ? AND fm.receiver_id = ?) OR (fm.sender_id = ? AND fm.receiver_id = ?)
      ORDER BY fm.created_at ASC
      LIMIT ?
    `, [userId, friendId, friendId, userId, Math.max(1, Math.min(200, Number(limit) || 80))]);
    return rows.map((r) => ({
      id: r.id,
      senderId: r.sender_id,
      senderUsername: r.sender_username,
      receiverId: r.receiver_id,
      content: r.content,
      createdAt: r.created_at
    }));
  }

  async sendFriendMessage(senderId, receiverId, rawContent) {
    const isFriend = await this.areUsersFriends(senderId, receiverId);
    if (!isFriend) {
      const err = new Error('Debes ser amigo de este jugador para enviarle mensajes.');
      err.status = 403;
      throw err;
    }
    const content = String(rawContent || '').replace(/[<>]/g, '').trim().slice(0, 400);
    if (!content) {
      const err = new Error('Escribe un mensaje antes de enviar.');
      err.status = 400;
      throw err;
    }
    const sender = await this.findUserById(senderId);
    const id = `fmsg_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const now = new Date().toISOString();
    await this.execSql(
      'INSERT INTO friend_messages (id, sender_id, receiver_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, senderId, receiverId, content, now]
    );
    return {
      id,
      senderId,
      senderUsername: sender?.username || 'Jugador',
      receiverId,
      content,
      createdAt: now
    };
  }

  /* ================= SISTEMA DE MISIONES (MÁXIMO 30 MODS) ================= */
  async getUserMissionsStatus(userId) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    const campRows = await this.queryAll('SELECT level_id FROM campaign_progress WHERE user_id = ?', [userId]);
    const claimedRows = await this.queryAll('SELECT mission_id FROM user_missions WHERE user_id = ?', [userId]);
    const claimedIds = claimedRows.map((r) => r.mission_id);
    const missions = computeUserMissions(row, campRows.length, claimedIds);
    return { missions, maxRewardMods: MAX_MISSION_REWARD_MODS };
  }

  async claimMissionReward(userId, missionId) {
    const status = await this.getUserMissionsStatus(userId);
    const m = status.missions.find((x) => x.id === missionId);
    if (!m) {
      const err = new Error('Misión no encontrada.');
      err.status = 404;
      throw err;
    }
    if (m.claimed) {
      const err = new Error('Ya reclamaste la recompensa de esta misión.');
      err.status = 409;
      throw err;
    }
    if (!m.completed) {
      const err = new Error(`Aún no completas esta misión (${m.progress}/${m.target}).`);
      err.status = 400;
      throw err;
    }
    const reward = Math.min(MAX_MISSION_REWARD_MODS, Math.max(1, Number(m.rewardMods) || 10));
    await this.execSql(
      'INSERT INTO user_missions (user_id, mission_id, claimed_at) VALUES (?, ?, ?)',
      [userId, m.id, new Date().toISOString()]
    );
    await this.addMods(userId, reward);
    return {
      ok: true,
      missionId: m.id,
      rewardMods: reward,
      ...(await this.getUserMissionsStatus(userId)),
      user: await this.getFullUserProfile(userId)
    };
  }

  async grantExclusiveUnlock(userId, cosmeticId) {
    const now = new Date().toISOString();
    const existing = await this.queryOne(
      'SELECT cosmetic_id FROM user_unlocks WHERE user_id = ? AND cosmetic_id = ?',
      [userId, cosmeticId]
    );
    if (!existing) {
      await this.execSql('INSERT INTO user_unlocks (user_id, cosmetic_id, unlocked_at) VALUES (?, ?, ?)', [userId, cosmeticId, now]);
    }
  }

  async addXp(userId, delta, reason) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');
    const nextXp = Math.max(0, Number(row.xp) + Math.round(delta));
    const nextLevel = computeLevelFromXp(nextXp).level;
    const now = new Date().toISOString();

    await this.execSql('UPDATE users SET xp = ?, level = ?, updated_at = ? WHERE id = ?', [nextXp, nextLevel, now, userId]);
    await this.execSql(
      'INSERT INTO xp_transactions (id, user_id, delta, reason, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [`xpt_${crypto.randomUUID().slice(0, 12)}`, userId, Math.round(delta), reason, nextXp, now]
    );

    return {
      previousXp: Number(row.xp),
      xp: nextXp,
      previousLevel: Number(row.level),
      level: nextLevel,
      leveledUp: nextLevel > Number(row.level)
    };
  }

  async spendXpForHint(userId, cost = HINT_XP_COST) {
    const row = await this.findUserById(userId);
    if (!row) return { ok: false, code: 'USER_NOT_FOUND', error: 'Usuario no encontrado.' };
    if (Number(row.xp) < cost) {
      return {
        ok: false,
        code: 'INSUFFICIENT_XP',
        error: `Necesitas ${cost} XP para usar una pista (tienes ${row.xp} XP). Juega partidas o derrota jefes para ganar XP.`,
        currentXp: Number(row.xp),
        requiredXp: cost
      };
    }

    const nextXp = Number(row.xp) - cost;
    const nextLevel = computeLevelFromXp(nextXp).level;
    const now = new Date().toISOString();

    await this.execSql(
      'UPDATE users SET xp = ?, level = ?, hints_used = hints_used + 1, updated_at = ? WHERE id = ?',
      [nextXp, nextLevel, now, userId]
    );
    await this.execSql(
      'INSERT INTO xp_transactions (id, user_id, delta, reason, balance_after, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [`xpt_${crypto.randomUUID().slice(0, 12)}`, userId, -cost, 'Pista táctica (IA)', nextXp, now]
    );

    return {
      ok: true,
      cost,
      previousXp: Number(row.xp),
      xp: nextXp,
      level: nextLevel,
      profile: await this.getFullUserProfile(userId)
    };
  }

  async recordSinglePlayerMatch(userId, { mode, opponentName, winner, resultReason, turns = 1, basesDestroyed = 0, campaignId = null, levelId = null, xpReward = 0, rankedVsBot = false, aiDifficulty = 3 }) {
    const row = await this.findUserById(userId);
    if (!row) throw new Error('Usuario no encontrado.');

    // Validación estricta de desbloqueo de historia en servidor
    if (campaignId && levelId) {
      const campaigns = await this.getCampaignsProgress(userId);
      if (!isCampaignLevelUnlocked(campaignId, Number(levelId), campaigns)) {
        const err = new Error('Nivel bloqueado: no puedes registrar ni saltar niveles sin completar los anteriores.');
        err.status = 403;
        err.code = 'LEVEL_LOCKED';
        throw err;
      }
    }

    const now = new Date().toISOString();
    const isWin = winner === 'w';
    const isDraw = winner === 'draw';

    // Sistema FIDE Elo real en partidas competitivas contra Bot (clásico / especial), JAMÁS en Modo Historia
    let eloBefore = Number(row.elo) || 0;
    let eloAfter = eloBefore;
    let eloDelta = 0;
    let botElo = null;
    let expectedWinProb = null;
    if (!campaignId && rankedVsBot && ['classic', 'special'].includes(mode)) {
      const diffKey = Math.max(1, Math.min(5, Math.round(Number(aiDifficulty) || 3)));
      botElo = BOT_ELO_BY_DIFFICULTY[diffKey] || 1200;
      const calc = calculateEloUpdate(eloBefore, botElo, winner, { whiteGames: Number(row.games_played) || 0 });
      eloBefore = calc.whiteBefore;
      eloAfter = calc.whiteAfter;
      eloDelta = calc.whiteDelta;
      expectedWinProb = Math.round(calc.expectedWhite * 100);
    }

    const matchId = `mtc_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    await this.execSql(`
      INSERT INTO matches (
        id, mode, white_user_id, black_user_id, opponent_name, winner, result_reason,
        white_elo_before, white_elo_after, black_elo_before, black_elo_after, turns, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [matchId, mode, userId, opponentName || 'IA', winner, resultReason || '', eloBefore, eloAfter, botElo, botElo, Math.max(1, Number(turns) || 1), now]);

    await this.execSql(`
      UPDATE users
      SET elo = ?,
          games_played = games_played + 1,
          wins = wins + ?,
          losses = losses + ?,
          draws = draws + ?,
          bases_destroyed = bases_destroyed + ?,
          updated_at = ?
      WHERE id = ?
    `, [eloAfter, isWin ? 1 : 0, (!isWin && !isDraw) ? 1 : 0, isDraw ? 1 : 0, Math.max(0, Number(basesDestroyed) || 0), now, userId]);

    let firstTimeClear = false;
    let unlockedExclusive = null;
    if (isWin && campaignId && levelId) {
      const lv = Number(levelId);
      const existing = await this.queryOne(
        'SELECT * FROM campaign_progress WHERE user_id = ? AND campaign_id = ? AND level_id = ?',
        [userId, campaignId, lv]
      );

      if (!existing) {
        firstTimeClear = true;
        await this.execSql(
          'INSERT INTO campaign_progress (user_id, campaign_id, level_id, best_turns, completions, completed_at) VALUES (?, ?, ?, ?, 1, ?)',
          [userId, campaignId, lv, Math.max(1, Number(turns) || 1), now]
        );
      } else {
        const bestTurns = Number(existing.best_turns) > 0 ? Math.min(Number(existing.best_turns), Math.max(1, Number(turns) || 1)) : Math.max(1, Number(turns) || 1);
        await this.execSql(
          'UPDATE campaign_progress SET best_turns = ?, completions = completions + 1, completed_at = ? WHERE user_id = ? AND campaign_id = ? AND level_id = ?',
          [bestTurns, now, userId, campaignId, lv]
        );
      }

      // Recompensa exclusiva por derrotar a Free Mittens (Capítulo 02 Nivel 5)
      if (campaignId === 'mittens' && lv === 5) {
        await this.grantExclusiveUnlock(userId, 'power_free_mittens');
        unlockedExclusive = 'Poder de Free Mittens';
      }

      // Recompensa exclusiva por derrotar a CHESS (Capítulo 05 Nivel 5)
      if (campaignId === 'chess' && lv === 5) {
        await this.grantExclusiveUnlock(userId, 'frame_chess_victor');
        await this.grantExclusiveUnlock(userId, 'preset:chess_origin');
        await this.execSql("UPDATE users SET title = 'Vencedor de Chess', updated_at = ? WHERE id = ?", [now, userId]);
        unlockedExclusive = 'Vencedor de Chess';
      }
    }

    // Recompensa secreta exclusiva por derrotar al Boss Secreto BLACKY (Imposible)
    let blackyBonusXp = 0;
    if (isWin && mode === 'blacky') {
      await this.grantExclusiveUnlock(userId, 'frame_blacky_imposible');
      await this.grantExclusiveUnlock(userId, 'preset:blacky_tamer');
      await this.grantExclusiveUnlock(userId, 'power_blacky_claw');
      await this.execSql("UPDATE users SET title = 'Domador de Blacky (Imposible)', updated_at = ? WHERE id = ?", [now, userId]);
      unlockedExclusive = 'Domador de Blacky (Imposible)';
      blackyBonusXp = 1500;
    }

    const baseXp = blackyBonusXp > 0
      ? blackyBonusXp
      : (isWin ? (firstTimeClear && xpReward > 0 ? xpReward : Math.max(45, Math.round(xpReward * 0.35))) : (isDraw ? 25 : 20));
    const xpResult = await this.addXp(userId, baseXp, `${mode}: ${isWin ? 'Victoria' : (isDraw ? 'Tablas' : 'Participación')} vs ${opponentName || 'IA'}`);
    const modsGained = isWin
      ? (mode === 'blacky' ? 300 : (firstTimeClear && Number(levelId) === 5 ? 95 : 45))
      : (isDraw ? 20 : 12);
    await this.addMods(userId, modsGained);

    return {
      matchId,
      xpGained: baseXp,
      modsGained,
      eloBefore,
      eloAfter,
      eloDelta,
      botElo,
      expectedWinProb,
      firstTimeClear,
      unlockedExclusive,
      leveledUp: xpResult.leveledUp,
      profile: await this.getFullUserProfile(userId)
    };
  }

  async recordOnlineMatch({ whiteUserId, blackUserId, winner, resultReason, eloResult, turns = 1 }) {
    const wRow = await this.findUserById(whiteUserId);
    const bRow = await this.findUserById(blackUserId);
    if (!wRow || !bRow) throw new Error('Jugadores no encontrados.');
    const now = new Date().toISOString();
    const matchId = `onl_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;

    await this.execSql(`
      INSERT INTO matches (
        id, mode, white_user_id, black_user_id, opponent_name, winner, result_reason,
        white_elo_before, white_elo_after, black_elo_before, black_elo_after, turns, created_at
      ) VALUES (?, 'online', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      matchId,
      whiteUserId,
      blackUserId,
      `${wRow.username} vs ${bRow.username}`,
      winner,
      resultReason || '',
      eloResult.whiteBefore,
      eloResult.whiteAfter,
      eloResult.blackBefore,
      eloResult.blackAfter,
      Math.max(1, Number(turns) || 1),
      now
    ]);

    const wWin = winner === 'w' ? 1 : 0;
    const bWin = winner === 'b' ? 1 : 0;
    const isDraw = winner === 'draw' ? 1 : 0;

    await this.execSql(`
      UPDATE users
      SET elo = ?, games_played = games_played + 1, wins = wins + ?, losses = losses + ?, draws = draws + ?, updated_at = ?
      WHERE id = ?
    `, [eloResult.whiteAfter, wWin, bWin, isDraw, now, whiteUserId]);

    await this.execSql(`
      UPDATE users
      SET elo = ?, games_played = games_played + 1, wins = wins + ?, losses = losses + ?, draws = draws + ?, updated_at = ?
      WHERE id = ?
    `, [eloResult.blackAfter, bWin, wWin, isDraw, now, blackUserId]);

    const wXp = wWin ? 75 : (isDraw ? 40 : 25);
    const bXp = bWin ? 75 : (isDraw ? 40 : 25);
    const wMods = wWin ? 75 : (isDraw ? 30 : 15);
    const bMods = bWin ? 75 : (isDraw ? 30 : 15);
    await this.addXp(whiteUserId, wXp, `Online vs ${bRow.username}`);
    await this.addXp(blackUserId, bXp, `Online vs ${wRow.username}`);
    await this.addMods(whiteUserId, wMods);
    await this.addMods(blackUserId, bMods);

    return {
      matchId,
      whiteProfile: await this.getFullUserProfile(whiteUserId),
      blackProfile: await this.getFullUserProfile(blackUserId),
      whiteXpGained: wXp,
      blackXpGained: bXp,
      whiteModsGained: wMods,
      blackModsGained: bMods
    };
  }

  async getUserMatches(userId, limit = 25) {
    const rows = await this.queryAll(`
      SELECT m.*, wu.username AS white_username, bu.username AS black_username
      FROM matches m
      LEFT JOIN users wu ON wu.id = m.white_user_id
      LEFT JOIN users bu ON bu.id = m.black_user_id
      WHERE m.white_user_id = ? OR m.black_user_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [userId, userId, limit]);

    return rows.map((r) => {
      const asWhite = r.white_user_id === userId;
      const outcome = r.winner === 'draw'
        ? 'draw'
        : ((asWhite && r.winner === 'w') || (!asWhite && r.winner === 'b') ? 'win' : 'loss');
      const eloBefore = asWhite ? r.white_elo_before : r.black_elo_before;
      const eloAfter = asWhite ? r.white_elo_after : r.black_elo_after;
      const opponent = r.mode === 'online'
        ? (asWhite ? (r.black_username || 'Rival') : (r.white_username || 'Rival'))
        : r.opponent_name;
      return {
        id: r.id,
        mode: r.mode,
        opponent,
        outcome,
        reason: r.result_reason,
        eloDelta: (eloBefore != null && eloAfter != null) ? (Number(eloAfter) - Number(eloBefore)) : 0,
        turns: Number(r.turns),
        createdAt: r.created_at
      };
    });
  }

  async getLeaderboard(limit = 50) {
    const rows = await this.queryAll(`
      SELECT u.id, u.username, u.email, u.avatar, u.frame_id, u.title, u.elo, u.xp, u.level, u.wins, u.losses, u.draws, u.games_played,
             u.vip_active, u.vip_expires_at, u.is_owner, u.is_moderator, u.is_banned, c.tag AS clan_tag
      FROM users u
      LEFT JOIN clan_members cm ON cm.user_id = u.id
      LEFT JOIN clans c ON c.id = cm.clan_id
      WHERE u.is_banned = 0
      ORDER BY u.is_owner DESC, u.is_moderator DESC, u.elo DESC, u.wins DESC, u.xp DESC
      LIMIT ?
    `, [limit]);

    const result = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const r = await this.ensureFreshVipState(rows[idx]);
      const isOwner = Boolean(Number(r.is_owner)) || String(r.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
      const isMod = Boolean(Number(r.is_moderator)) || isOwner;
      const isVip = this.isVipRowActive(r) || isOwner;
      result.push({
        rank: idx + 1,
        id: r.id,
        username: r.username,
        avatar: r.avatar,
        frameId: (!isVip && VIP_EXCLUSIVE_IDS.includes(r.frame_id)) ? 'frame_stone' : r.frame_id,
        isVip,
        isOwner,
        isModerator: isMod,
        clanTag: r.clan_tag || null,
        title: r.title || '',
        elo: Number(r.elo) || 0,
        level: computeLevelFromXp(r.xp).level,
        xp: Number(r.xp) || 0,
        wins: Number(r.wins) || 0,
        losses: Number(r.losses) || 0,
        draws: Number(r.draws) || 0,
        gamesPlayed: Number(r.games_played) || 0
      });
    }
    return result;
  }

  /* ================= OWNER & MODERACIÓN SUPREMA (JERARQUÍA CHESS.MOD) ================= */
  async grantModeratorEverything(userId, { makeOwner = false } = {}) {
    const row = await this.findUserById(userId);
    if (!row) return null;
    const now = new Date().toISOString();
    const farFuture = '2099-12-31T23:59:59.000Z';
    const nextMods = Math.max(Number(row.mods) || 0, 99999);
    const allTierNums = JSON.stringify(BATTLE_PASS_S1.tiers.flatMap((t) => [`free:${t.tier}`, `paid:${t.tier}`]));
    const shouldBeOwner = Boolean(makeOwner) || String(row.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    const nextOwnerFlag = shouldBeOwner ? 1 : (Number(row.is_owner) ? 1 : 0);
    const nextTitle = shouldBeOwner
      ? ((!row.title || row.title === 'Moderador CHESS.MOD') ? 'Owner CHESS.MOD' : row.title)
      : (row.title || 'Moderador CHESS.MOD');

    await this.execSql(`
      UPDATE users
      SET is_owner = ?,
          is_moderator = 1,
          is_banned = 0,
          ban_reason = '',
          banned_until = NULL,
          vip_active = 1,
          vip_expires_at = ?,
          battle_pass_s1 = 1,
          battle_pass_s1_at = COALESCE(battle_pass_s1_at, ?),
          battle_pass_claimed_json = ?,
          mods = ?,
          title = ?,
          updated_at = ?
      WHERE id = ?
    `, [nextOwnerFlag, farFuture, now, allTierNums, nextMods, nextTitle, now, userId]);

    const all = getAllCosmetics();
    const everyId = [
      ...all.avatars,
      ...all.frames,
      ...all.boards,
      ...all.pieceSkins,
      ...all.powers
    ].map((x) => x.id);
    for (const cid of everyId) {
      await this.grantExclusiveUnlock(userId, cid);
    }

    for (const campId of CHAPTER_ORDER) {
      for (let lv = 1; lv <= 5; lv++) {
        const exists = await this.queryOne(
          'SELECT level_id FROM campaign_progress WHERE user_id = ? AND campaign_id = ? AND level_id = ?',
          [userId, campId, lv]
        );
        if (!exists) {
          await this.execSql(
            'INSERT INTO campaign_progress (user_id, campaign_id, level_id, best_turns, completions, completed_at) VALUES (?, ?, ?, 10, 1, ?)',
            [userId, campId, lv, now]
          );
        }
      }
    }
    return this.getFullUserProfile(userId);
  }

  /**
   * Exclusivo del OWNER: otorgar o quitar rol de Moderador a otra persona.
   * Si grantAll === false, recibe permisos de Moderador SIN todo desbloqueado.
   * Si grantAll === true, también recibe todo desbloqueado (VIP, Pase, Cosméticos, Historia).
   */
  async setUserModeratorStatus(ownerId, targetUserId, { isModerator = true, grantAll = false } = {}) {
    const owner = await this.findUserById(ownerId);
    const actorIsOwner = Boolean(Number(owner?.is_owner)) || String(owner?.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    if (!actorIsOwner) {
      const err = new Error('Solo el Owner de CHESS.MOD puede nombrar o revocar Moderadores.');
      err.status = 403;
      throw err;
    }
    const target = await this.findUserById(targetUserId);
    if (!target) {
      const err = new Error('Usuario objetivo no encontrado.');
      err.status = 404;
      throw err;
    }
    const targetIsOwner = Boolean(Number(target.is_owner)) || String(target.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    if (targetIsOwner) {
      const err = new Error('No se puede modificar el rango del Owner.');
      err.status = 400;
      throw err;
    }
    const now = new Date().toISOString();
    if (isModerator) {
      if (grantAll) {
        const updated = await this.grantModeratorEverything(targetUserId, { makeOwner: false });
        await this.recordSecurityEvent(targetUserId, 'mod_promoted_full', {
          details: `Nombrado Moderador (con todo desbloqueado) por Owner ${owner?.username || 'Owner'}`
        });
        return { ok: true, isModerator: true, grantAll: true, user: updated };
      }
      await this.execSql(
        "UPDATE users SET is_moderator = 1, title = CASE WHEN title = '' THEN 'Moderador CHESS.MOD' ELSE title END, updated_at = ? WHERE id = ?",
        [now, targetUserId]
      );
      await this.recordSecurityEvent(targetUserId, 'mod_promoted', {
        details: `Nombrado Moderador (progreso normal) por Owner ${owner?.username || 'Owner'}`
      });
      return { ok: true, isModerator: true, grantAll: false, user: await this.getFullUserProfile(targetUserId) };
    }
    await this.execSql(
      "UPDATE users SET is_moderator = 0, title = CASE WHEN title = 'Moderador CHESS.MOD' THEN '' ELSE title END, updated_at = ? WHERE id = ?",
      [now, targetUserId]
    );
    await this.recordSecurityEvent(targetUserId, 'mod_revoked', {
      details: `Rol de Moderador revocado por Owner ${owner?.username || 'Owner'}`
    });
    return { ok: true, isModerator: false, grantAll: false, user: await this.getFullUserProfile(targetUserId) };
  }

  /* ================= SEGURIDAD AVANZADA DE CUENTAS (2FA TOTP, BACKUP, PIN, SESIONES, LOG) ================= */
  async recordSecurityEvent(userId, eventType, { ip = '', userAgent = '', details = '' } = {}) {
    if (!userId) return;
    const id = `sec_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    await this.execSql(
      'INSERT INTO security_events (id, user_id, event_type, ip, user_agent, details, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, userId, String(eventType).slice(0, 40), String(ip).slice(0, 64), String(userAgent).slice(0, 140), String(details).slice(0, 200), now]
    ).catch(() => {});
  }

  async getSecurityEvents(userId, limit = 15) {
    const rows = await this.queryAll(
      'SELECT id, event_type, ip, user_agent, details, created_at FROM security_events WHERE user_id = ? ORDER BY created_at DESC LIMIT ?',
      [userId, limit]
    );
    return rows.map((r) => ({
      id: r.id,
      type: r.event_type,
      ip: r.ip,
      userAgent: r.user_agent,
      details: r.details,
      createdAt: r.created_at
    }));
  }

  async savePendingTotpSecret(userId, secret) {
    await this.execSql(
      'UPDATE users SET totp_pending_secret = ?, updated_at = ? WHERE id = ?',
      [secret, new Date().toISOString(), userId]
    );
  }

  async enableTotp(userId, secret, hashedBackupCodes) {
    await this.execSql(
      'UPDATE users SET totp_enabled = 1, totp_secret = ?, totp_pending_secret = NULL, backup_codes_json = ?, updated_at = ? WHERE id = ?',
      [secret, JSON.stringify(hashedBackupCodes || []), new Date().toISOString(), userId]
    );
  }

  async disableTotp(userId) {
    await this.execSql(
      "UPDATE users SET totp_enabled = 0, totp_secret = NULL, totp_pending_secret = NULL, backup_codes_json = '[]', updated_at = ? WHERE id = ?",
      [new Date().toISOString(), userId]
    );
  }

  async consumeBackupCode(userId, hashedCode) {
    const row = await this.findUserById(userId);
    if (!row) return false;
    let codes = [];
    try { codes = JSON.parse(row.backup_codes_json || '[]'); } catch { codes = []; }
    const idx = codes.indexOf(hashedCode);
    if (idx === -1) return false;
    codes.splice(idx, 1);
    await this.execSql(
      'UPDATE users SET backup_codes_json = ?, updated_at = ? WHERE id = ?',
      [JSON.stringify(codes), new Date().toISOString(), userId]
    );
    return true;
  }

  async setSecurityPinHash(userId, pinHash) {
    await this.execSql(
      'UPDATE users SET security_pin_hash = ?, updated_at = ? WHERE id = ?',
      [pinHash || null, new Date().toISOString(), userId]
    );
  }

  async updatePasswordAndRevoke(userId, passwordHash, passwordSalt) {
    const row = await this.findUserById(userId);
    const nextVer = (Number(row?.token_version) || 1) + 1;
    await this.execSql(
      'UPDATE users SET password_hash = ?, password_salt = ?, token_version = ?, updated_at = ? WHERE id = ?',
      [passwordHash, passwordSalt, nextVer, new Date().toISOString(), userId]
    );
    return nextVer;
  }

  async revokeAllSessions(userId) {
    const row = await this.findUserById(userId);
    const nextVer = (Number(row?.token_version) || 1) + 1;
    await this.execSql(
      'UPDATE users SET token_version = ?, updated_at = ? WHERE id = ?',
      [nextVer, new Date().toISOString(), userId]
    );
    return nextVer;
  }

  async banUser(moderatorId, targetUserId, reason = 'Infracción de normas / Hacks o Cheats', durationDays = null) {
    const actor = await this.findUserById(moderatorId);
    const actorIsOwner = Boolean(Number(actor?.is_owner)) || String(actor?.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    const target = await this.findUserById(targetUserId);
    if (!target) throw new Error('Usuario a banear no encontrado.');
    const targetIsOwner = Boolean(Number(target.is_owner)) || String(target.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    if (targetIsOwner) throw new Error('No se puede banear al Owner de CHESS.MOD.');
    if (Number(target.is_moderator) && !actorIsOwner) throw new Error('Solo el Owner puede sancionar a un Moderador.');
    const now = new Date().toISOString();
    const days = Number(durationDays);
    const bannedUntil = Number.isFinite(days) && days > 0
      ? new Date(Date.now() + Math.min(3650, days) * 24 * 60 * 60 * 1000).toISOString()
      : null;
    const cleanReason = String(reason || (bannedUntil ? `Expulsado por ${days} día(s)` : 'Infracción de normas')).trim().slice(0, 220);
    await this.execSql(
      'UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = ?, banned_until = ?, updated_at = ? WHERE id = ?',
      [cleanReason, now, bannedUntil, now, targetUserId]
    );
    await this.recordSecurityEvent(targetUserId, bannedUntil ? 'temp_ban' : 'perm_ban', {
      details: `${bannedUntil ? `Expulsado ${days} día(s)` : 'Baneo permanente'}: ${cleanReason}`
    });
    return { ok: true, userId: targetUserId, username: target.username, banReason: cleanReason, bannedUntil, durationDays: bannedUntil ? days : null };
  }

  async unbanUser(targetUserId) {
    const target = await this.findUserById(targetUserId);
    if (!target) throw new Error('Usuario no encontrado.');
    const now = new Date().toISOString();
    await this.execSql(
      "UPDATE users SET is_banned = 0, ban_reason = '', banned_at = NULL, banned_until = NULL, updated_at = ? WHERE id = ?",
      [now, targetUserId]
    );
    return { ok: true, userId: targetUserId, username: target.username };
  }

  async adjustUserMods(moderatorId, targetUserId, deltaMods, reason = 'Ajuste de moderación') {
    const target = await this.findUserById(targetUserId);
    if (!target) throw new Error('Usuario no encontrado.');
    const delta = Math.round(Number(deltaMods));
    if (!Number.isFinite(delta) || delta === 0) throw new Error('Indica una cantidad válida de Mods distinta de 0.');
    const prev = Number(target.mods) || 0;
    const nextMods = await this.addMods(targetUserId, delta);
    const cleanReason = String(reason || 'Ajuste de moderación').trim().slice(0, 180);
    await this.recordSecurityEvent(targetUserId, 'mod_adjust_mods', {
      details: `${delta > 0 ? `+${delta}` : delta} Mods (${prev} → ${nextMods}). Motivo: ${cleanReason}`
    });
    return { ok: true, userId: targetUserId, username: target.username, previousMods: prev, mods: nextMods, delta };
  }

  async getModeratorOverview() {
    const users = await this.queryAll(`
      SELECT u.id, u.username, u.email, u.elo, u.xp, u.mods, u.level, u.wins, u.losses, u.draws, u.games_played,
             u.vip_active, u.vip_expires_at, u.battle_pass_s1, u.is_owner, u.is_moderator, u.is_banned, u.ban_reason, u.banned_at, u.banned_until, u.created_at,
             c.tag AS clan_tag
      FROM users u
      LEFT JOIN clan_members cm ON cm.user_id = u.id
      LEFT JOIN clans c ON c.id = cm.clan_id
      ORDER BY u.is_owner DESC, u.is_moderator DESC, u.vip_active DESC, u.elo DESC, u.created_at DESC
      LIMIT 200
    `);
    const reports = await this.listAllReports();
    const antiCheatFlags = await this.listAntiCheatFlags(100);
    const clans = await this.listClans();
    const recentMatches = await this.queryAll(`
      SELECT m.*, wu.username AS white_username, bu.username AS black_username
      FROM matches m
      LEFT JOIN users wu ON wu.id = m.white_user_id
      LEFT JOIN users bu ON bu.id = m.black_user_id
      ORDER BY m.created_at DESC
      LIMIT 50
    `);

    const mappedUsers = users.map((u) => {
      const activeBan = Boolean(Number(u.is_banned)) && (!u.banned_until || Date.parse(u.banned_until) > Date.now());
      const isOwner = Boolean(Number(u.is_owner)) || String(u.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
      const isMod = Boolean(Number(u.is_moderator)) || isOwner;
      return {
        id: u.id,
        username: u.username,
        email: u.email,
        elo: Number(u.elo) || 0,
        xp: Number(u.xp) || 0,
        mods: Number(u.mods) || 0,
        level: computeLevelFromXp(u.xp).level,
        gamesPlayed: Number(u.games_played) || 0,
        wins: Number(u.wins) || 0,
        losses: Number(u.losses) || 0,
        isVip: this.isVipRowActive(u) || isOwner,
        hasBattlePassS1: Boolean(Number(u.battle_pass_s1)) || isOwner,
        isOwner,
        isModerator: isMod,
        isBanned: activeBan,
        banReason: u.ban_reason || '',
        bannedUntil: activeBan ? (u.banned_until || null) : null,
        clanTag: u.clan_tag || null,
        createdAt: u.created_at
      };
    });

    return {
      stats: {
        totalUsers: mappedUsers.length,
        bannedUsers: mappedUsers.filter((u) => u.isBanned).length,
        vipUsers: mappedUsers.filter((u) => u.isVip).length,
        moderatorsCount: mappedUsers.filter((u) => u.isModerator).length,
        pendingReports: reports.filter((r) => r.status === 'pending').length,
        openAntiCheatFlags: antiCheatFlags.filter((f) => f.status === 'open').length,
        totalClans: clans.length,
        dbDriver: this.driver
      },
      users: mappedUsers,
      reports,
      antiCheatFlags,
      clans,
      recentMatches
    };
  }

  /* ================= SISTEMA DE CLANES (15,000 MODS · 1 CLAN/PERSONA · CHAT · ROLES · BANS · ESTILOS) ================= */
  resolveClanFontCss(fontId) {
    const found = CLAN_FONT_FAMILIES.find((f) => f.id === fontId);
    return found ? found.css : CLAN_FONT_FAMILIES[0].css;
  }

  sanitizeClanStyle(actorRow, { textColor, fontFamily, avatar, joinPolicy, publicReadChat } = {}, existingClan = null) {
    const actorIsOwner = Boolean(Number(actorRow?.is_owner)) || String(actorRow?.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    const actorIsVip = this.isVipRowActive(actorRow) || actorIsOwner;

    let cleanColor = existingClan ? (existingClan.text_color || '#efd083') : '#efd083';
    if (textColor !== undefined && textColor !== null && String(textColor).trim() !== '') {
      const raw = String(textColor).trim();
      const matched = CLAN_TEXT_COLORS.find((c) => c.id === raw || c.hex.toLowerCase() === raw.toLowerCase());
      if (matched) {
        if (matched.vipOnly && !actorIsVip) {
          const err = new Error(`El color "${matched.name}" es exclusivo de Mod VIP.`);
          err.status = 403;
          throw err;
        }
        cleanColor = matched.hex;
      } else if (/^#[0-9a-fA-F]{6}$/.test(raw)) {
        if (!actorIsVip) {
          const err = new Error('Los colores personalizados hexadecimales son exclusivos de Mod VIP.');
          err.status = 403;
          throw err;
        }
        cleanColor = raw;
      }
    }

    let cleanFont = existingClan ? (existingClan.font_family || 'cinzel') : 'cinzel';
    if (fontFamily !== undefined && fontFamily !== null) {
      const f = CLAN_FONT_FAMILIES.find((x) => x.id === String(fontFamily));
      if (f) cleanFont = f.id;
    }

    let cleanJoinPolicy = existingClan ? (existingClan.join_policy || 'open') : 'open';
    if (joinPolicy !== undefined && ['open', 'approval', 'private_readonly'].includes(String(joinPolicy))) {
      cleanJoinPolicy = String(joinPolicy);
    }

    let cleanPublicRead = existingClan ? (Number(existingClan.public_read_chat) ? 1 : 0) : 0;
    if (publicReadChat !== undefined) {
      cleanPublicRead = publicReadChat ? 1 : 0;
    }
    if (cleanJoinPolicy === 'private_readonly') {
      cleanPublicRead = 1;
    }

    let cleanAvatar = existingClan ? (existingClan.avatar || '') : '';
    if (avatar !== undefined) {
      const rawAv = String(avatar || '').trim();
      if (!rawAv) {
        cleanAvatar = '';
      } else if (/^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(rawAv) && rawAv.length <= 500000) {
        cleanAvatar = rawAv;
      } else {
        const err = new Error('La imagen del clan debe ser una imagen válida (máx. 350 KB optimizada).');
        err.status = 400;
        throw err;
      }
    }

    return {
      textColor: cleanColor,
      fontFamily: cleanFont,
      joinPolicy: cleanJoinPolicy,
      publicReadChat: cleanPublicRead,
      avatar: cleanAvatar
    };
  }

  async getClanMemberContext(clanId, userId) {
    const clan = await this.queryOne('SELECT * FROM clans WHERE id = ?', [clanId]);
    if (!clan) return { clan: null, member: null, isLeader: false, priority: -1, perms: {} };
    const member = userId
      ? await this.queryOne(
        `SELECT cm.clan_id, cm.user_id, cm.role, cm.custom_role_id, cr.name AS custom_role_name, cr.color AS custom_role_color, cr.priority AS custom_role_priority, cr.permissions_json
         FROM clan_members cm
         LEFT JOIN clan_roles cr ON cr.id = cm.custom_role_id
         WHERE cm.clan_id = ? AND cm.user_id = ?`,
        [clanId, userId]
      )
      : null;
    const isLeader = Boolean(member && (clan.leader_id === userId || member.role === 'leader'));
    const perms = {};
    for (const def of CLAN_PERMISSION_DEFS) perms[def.key] = isLeader;
    if (member && !isLeader && member.permissions_json) {
      try {
        const parsed = JSON.parse(member.permissions_json);
        for (const def of CLAN_PERMISSION_DEFS) {
          if (parsed[def.key]) perms[def.key] = true;
        }
      } catch {}
    }
    const priority = isLeader ? 1000 : (member ? (Number(member.custom_role_priority) || 0) : -1);
    return { clan, member, isLeader, priority, perms };
  }

  async getUserClan(userId) {
    const row = await this.queryOne(`
      SELECT c.*, cm.role, cm.custom_role_id
      FROM clan_members cm
      JOIN clans c ON c.id = cm.clan_id
      WHERE cm.user_id = ?
    `, [userId]);
    if (!row) return null;

    const ctx = await this.getClanMemberContext(row.id, userId);

    const rolesRows = await this.queryAll(
      'SELECT id, clan_id, name, color, priority, permissions_json, created_at FROM clan_roles WHERE clan_id = ? ORDER BY priority DESC, created_at ASC',
      [row.id]
    );
    const roles = rolesRows.map((r) => {
      let permissions = {};
      try { permissions = JSON.parse(r.permissions_json || '{}'); } catch { permissions = {}; }
      return {
        id: r.id,
        name: r.name,
        color: r.color || '#7dd3fc',
        priority: Number(r.priority) || 10,
        permissions
      };
    });

    const membersRows = await this.queryAll(`
      SELECT u.id, u.username, u.email, u.elo, u.avatar, u.frame_id, u.vip_active, u.vip_expires_at,
             u.is_owner, u.is_moderator, cm.role, cm.custom_role_id, cm.joined_at,
             cr.name AS custom_role_name, cr.color AS custom_role_color, cr.priority AS custom_role_priority, cr.permissions_json
      FROM clan_members cm
      JOIN users u ON u.id = cm.user_id
      LEFT JOIN clan_roles cr ON cr.id = cm.custom_role_id
      WHERE cm.clan_id = ?
    `, [row.id]);

    const members = membersRows.map((m) => {
      const isGlobalOwner = Boolean(Number(m.is_owner)) || String(m.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
      const isGlobalMod = Boolean(Number(m.is_moderator)) || isGlobalOwner;
      const isVip = this.isVipRowActive(m) || isGlobalOwner;
      let rolePerms = {};
      try { rolePerms = JSON.parse(m.permissions_json || '{}'); } catch {}
      const isClanLeader = m.role === 'leader' || m.id === row.leader_id;
      const isClanMod = isClanLeader || Boolean(rolePerms.is_clan_mod);
      return {
        id: m.id,
        username: m.username,
        elo: Number(m.elo) || 0,
        avatar: m.avatar,
        frameId: m.frame_id,
        isVip,
        isOwner: isGlobalOwner,
        isModerator: isGlobalMod,
        role: isClanLeader ? 'leader' : 'member',
        isClanLeader,
        isClanMod,
        customRoleId: m.custom_role_id || null,
        customRoleName: isClanLeader ? 'Owner del Clan' : (m.custom_role_name || null),
        customRoleColor: isClanLeader ? '#ffd700' : (m.custom_role_color || null),
        customRolePriority: isClanLeader ? 1000 : (Number(m.custom_role_priority) || 0),
        joinedAt: m.joined_at
      };
    });

    // Jerarquía CHESS.MOD primero (Owner -> Moderadores -> Owner del Clan -> Roles del Clan -> VIP -> Elo)
    members.sort((a, b) => {
      if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
      if (a.isModerator !== b.isModerator) return a.isModerator ? -1 : 1;
      if (a.isClanLeader !== b.isClanLeader) return a.isClanLeader ? -1 : 1;
      if (a.customRolePriority !== b.customRolePriority) return b.customRolePriority - a.customRolePriority;
      if (a.isVip !== b.isVip) return a.isVip ? -1 : 1;
      return b.elo - a.elo;
    });

    let pendingRequests = [];
    if (ctx.isLeader || ctx.perms.accept_members) {
      const reqRows = await this.queryAll(`
        SELECT r.id, r.user_id, r.message, r.created_at, u.username, u.elo, u.avatar, u.is_owner, u.is_moderator
        FROM clan_join_requests r
        JOIN users u ON u.id = r.user_id
        WHERE r.clan_id = ? AND r.status = 'pending'
        ORDER BY u.is_owner DESC, u.is_moderator DESC, r.created_at ASC
      `, [row.id]);
      pendingRequests = reqRows.map((r) => ({
        id: r.id,
        userId: r.user_id,
        username: r.username,
        elo: Number(r.elo) || 0,
        avatar: r.avatar,
        isOwner: Boolean(Number(r.is_owner)),
        isModerator: Boolean(Number(r.is_moderator)),
        message: r.message || '',
        createdAt: r.created_at
      }));
    }

    let bans = [];
    if (ctx.isLeader || ctx.perms.ban_members) {
      const banRows = await this.queryAll(`
        SELECT b.user_id, b.reason, b.created_at, u.username, bby.username AS banned_by_name
        FROM clan_bans b
        JOIN users u ON u.id = b.user_id
        LEFT JOIN users bby ON bby.id = b.banned_by
        WHERE b.clan_id = ?
        ORDER BY b.created_at DESC
      `, [row.id]);
      bans = banRows.map((b) => ({
        userId: b.user_id,
        username: b.username,
        reason: b.reason || '',
        bannedByName: b.banned_by_name || 'Moderador',
        createdAt: b.created_at
      }));
    }

    return {
      id: row.id,
      name: row.name,
      tag: row.tag,
      description: row.description || '',
      avatar: row.avatar || '',
      joinPolicy: row.join_policy || 'open',
      publicReadChat: Boolean(Number(row.public_read_chat)) || row.join_policy === 'private_readonly',
      textColor: row.text_color || '#efd083',
      fontFamily: row.font_family || 'cinzel',
      fontCss: this.resolveClanFontCss(row.font_family || 'cinzel'),
      leaderId: row.leader_id,
      myRole: ctx.isLeader ? 'leader' : 'member',
      myCustomRoleId: row.custom_role_id || null,
      myPermissions: { ...ctx.perms, isLeader: ctx.isLeader },
      membersCount: members.length,
      members,
      roles,
      pendingRequests,
      bans
    };
  }

  async listClans() {
    const rows = await this.queryAll(`
      SELECT c.id, c.name, c.tag, c.description, c.avatar, c.join_policy, c.public_read_chat,
             c.text_color, c.font_family, c.leader_id, c.created_at,
             u.username AS leader_name, u.is_owner AS leader_is_owner, u.is_moderator AS leader_is_mod, u.email AS leader_email,
             COUNT(cm.user_id) AS member_count,
             COALESCE(SUM(mu.elo), 0) AS total_elo
      FROM clans c
      LEFT JOIN users u ON u.id = c.leader_id
      LEFT JOIN clan_members cm ON cm.clan_id = c.id
      LEFT JOIN users mu ON mu.id = cm.user_id
      GROUP BY c.id, u.username, u.is_owner, u.is_moderator, u.email
      ORDER BY u.is_owner DESC, u.is_moderator DESC, total_elo DESC, member_count DESC, c.created_at DESC
      LIMIT 60
    `);
    return rows.map((r) => {
      const leaderIsOwner = Boolean(Number(r.leader_is_owner)) || String(r.leader_email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
      const leaderIsModerator = Boolean(Number(r.leader_is_mod)) || leaderIsOwner;
      return {
        id: r.id,
        name: r.name,
        tag: r.tag,
        description: r.description || '',
        avatar: r.avatar || '',
        joinPolicy: r.join_policy || 'open',
        publicReadChat: Boolean(Number(r.public_read_chat)) || r.join_policy === 'private_readonly',
        textColor: r.text_color || '#efd083',
        fontFamily: r.font_family || 'cinzel',
        fontCss: this.resolveClanFontCss(r.font_family || 'cinzel'),
        leaderId: r.leader_id,
        leaderName: r.leader_name || 'Líder',
        leaderIsOwner,
        leaderIsModerator,
        memberCount: Number(r.member_count) || 0,
        totalElo: Number(r.total_elo) || 0,
        createdAt: r.created_at
      };
    });
  }

  async createClan(userId, { name, tag, description = '', avatar = '', joinPolicy = 'open', publicReadChat = false, textColor = '#efd083', fontFamily = 'cinzel' }) {
    const rawUser = await this.findUserById(userId);
    const profile = await this.getFullUserProfile(userId);
    if (!profile || !rawUser) throw new Error('Usuario no encontrado.');
    if (profile.clan) throw new Error(`Solo puedes estar en 1 clan a la vez. Ya perteneces a [${profile.clan.tag}] ${profile.clan.name}. Sal primero antes de crear uno.`);

    const cleanName = String(name || '').trim().slice(0, 28);
    const cleanTag = String(tag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const cleanDesc = String(description || '').trim().slice(0, 160);
    if (cleanName.length < 3) throw new Error('El nombre del clan debe tener al menos 3 caracteres.');
    if (cleanTag.length < 2 || cleanTag.length > 5) throw new Error('La etiqueta (TAG) del clan debe tener entre 2 y 5 letras/números.');

    if (profile.mods < CLAN_CREATE_COST_MODS) {
      const err = new Error(`Crear un Clan cuesta ${CLAN_CREATE_COST_MODS.toLocaleString()} Mods (tienes ${profile.mods} Mods).`);
      err.status = 400;
      err.code = 'INSUFFICIENT_MODS';
      throw err;
    }

    const style = this.sanitizeClanStyle(rawUser, { textColor, fontFamily, avatar, joinPolicy, publicReadChat });

    const dupName = await this.queryOne('SELECT id FROM clans WHERE name_lower = ?', [cleanName.toLowerCase()]);
    if (dupName) throw new Error('Ya existe un clan con ese nombre.');
    const dupTag = await this.queryOne('SELECT id FROM clans WHERE tag = ?', [cleanTag]);
    if (dupTag) throw new Error(`La etiqueta [${cleanTag}] ya está en uso.`);

    const clanId = `cln_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    await this.addMods(userId, -CLAN_CREATE_COST_MODS);
    await this.execSql(
      `INSERT INTO clans (id, name, name_lower, tag, description, avatar, join_policy, public_read_chat, text_color, font_family, leader_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [clanId, cleanName, cleanName.toLowerCase(), cleanTag, cleanDesc, style.avatar, style.joinPolicy, style.publicReadChat, style.textColor, style.fontFamily, userId, now]
    );
    await this.execSql(
      "INSERT INTO clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, 'leader', ?)",
      [clanId, userId, now]
    );

    // Crear rol predeterminado "Moderador de Clan" listo para asignar si el Owner del clan quiere
    const modRoleId = `crl_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    await this.execSql(
      'INSERT INTO clan_roles (id, clan_id, name, color, priority, permissions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        modRoleId,
        clanId,
        'Moderador de Clan',
        '#38bdf8',
        50,
        JSON.stringify({ is_clan_mod: true, accept_members: true, kick_members: true, ban_members: true, delete_messages: true }),
        now
      ]
    );

    return { ok: true, clanId, costMods: CLAN_CREATE_COST_MODS, user: await this.getFullUserProfile(userId) };
  }

  async updateClanSettings(userId, clanId, { description, avatar, joinPolicy, publicReadChat, textColor, fontFamily } = {}) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.clan || !ctx.member) {
      const err = new Error('No perteneces a este clan.');
      err.status = 403;
      throw err;
    }
    if (!ctx.isLeader && !ctx.perms.edit_clan) {
      const err = new Error('Solo el Owner del clan o un rol con permiso de edición puede cambiar los ajustes del clan.');
      err.status = 403;
      throw err;
    }
    const actorRow = await this.findUserById(userId);
    const style = this.sanitizeClanStyle(actorRow, { textColor, fontFamily, avatar, joinPolicy, publicReadChat }, ctx.clan);
    const cleanDesc = description !== undefined ? String(description || '').trim().slice(0, 160) : (ctx.clan.description || '');

    await this.execSql(
      `UPDATE clans
       SET description = ?, avatar = ?, join_policy = ?, public_read_chat = ?, text_color = ?, font_family = ?
       WHERE id = ?`,
      [cleanDesc, style.avatar, style.joinPolicy, style.publicReadChat, style.textColor, style.fontFamily, clanId]
    );
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  async joinClan(userId, clanId, message = '') {
    const existing = await this.getUserClan(userId);
    if (existing) throw new Error(`Solo 1 clan por persona. Ya eres miembro de [${existing.tag}] ${existing.name}. Sal primero para unirte a otro.`);
    const clan = await this.queryOne('SELECT id, name, tag, join_policy FROM clans WHERE id = ?', [clanId]);
    if (!clan) throw new Error('Clan no encontrado.');

    const banned = await this.queryOne('SELECT reason FROM clan_bans WHERE clan_id = ? AND user_id = ?', [clanId, userId]);
    if (banned) {
      const err = new Error(`Fuiste baneado de este clan.${banned.reason ? ` Motivo: ${banned.reason}` : ''}`);
      err.status = 403;
      throw err;
    }

    const now = new Date().toISOString();
    const policy = clan.join_policy || 'open';

    if (policy === 'open') {
      await this.execSql('DELETE FROM clan_join_requests WHERE clan_id = ? AND user_id = ?', [clanId, userId]);
      await this.execSql(
        "INSERT INTO clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
        [clanId, userId, now]
      );
      return { ok: true, joined: true, pendingApproval: false, user: await this.getFullUserProfile(userId) };
    }

    const existingReq = await this.queryOne(
      "SELECT id FROM clan_join_requests WHERE clan_id = ? AND user_id = ? AND status = 'pending'",
      [clanId, userId]
    );
    if (existingReq) {
      const err = new Error('Ya enviaste una solicitud pendiente a este clan. Espera a que el Owner o un Moderador del clan la revise.');
      err.status = 409;
      throw err;
    }

    await this.execSql('DELETE FROM clan_join_requests WHERE clan_id = ? AND user_id = ?', [clanId, userId]);
    const reqId = `crq_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const cleanMsg = String(message || '').trim().slice(0, 140);
    await this.execSql(
      "INSERT INTO clan_join_requests (id, clan_id, user_id, message, status, created_at) VALUES (?, ?, ?, ?, 'pending', ?)",
      [reqId, clanId, userId, cleanMsg, now]
    );
    return {
      ok: true,
      joined: false,
      pendingApproval: true,
      requestId: reqId,
      message: policy === 'private_readonly'
        ? 'Clan privado: tu solicitud fue enviada al Owner del clan para revisión.'
        : 'Solicitud enviada: el Owner y moderadores del clan la revisarán.'
    };
  }

  async respondClanJoinRequest(userId, clanId, reqId, accept) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.member || (!ctx.isLeader && !ctx.perms.accept_members)) {
      const err = new Error('No tienes permiso para aceptar o rechazar solicitudes en este clan.');
      err.status = 403;
      throw err;
    }
    const req = await this.queryOne('SELECT * FROM clan_join_requests WHERE id = ? AND clan_id = ?', [reqId, clanId]);
    if (!req) throw new Error('Solicitud de ingreso no encontrada.');

    if (accept) {
      const alreadyInClan = await this.queryOne('SELECT clan_id FROM clan_members WHERE user_id = ?', [req.user_id]);
      if (alreadyInClan) {
        await this.execSql('DELETE FROM clan_join_requests WHERE id = ?', [reqId]);
        throw new Error('Ese usuario ya pertenece a otro clan (máx. 1 clan por persona).');
      }
      const banned = await this.queryOne('SELECT user_id FROM clan_bans WHERE clan_id = ? AND user_id = ?', [clanId, req.user_id]);
      if (banned) {
        await this.execSql('DELETE FROM clan_join_requests WHERE id = ?', [reqId]);
        throw new Error('Ese usuario está baneado del clan.');
      }
      const now = new Date().toISOString();
      await this.execSql(
        "INSERT INTO clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
        [clanId, req.user_id, now]
      );
      await this.execSql('DELETE FROM clan_join_requests WHERE user_id = ?', [req.user_id]);
    } else {
      await this.execSql('DELETE FROM clan_join_requests WHERE id = ?', [reqId]);
    }
    return { ok: true, accepted: Boolean(accept), user: await this.getFullUserProfile(userId) };
  }

  async createClanRole(userId, clanId, { name, color = '#7dd3fc', priority = 20, permissions = {} } = {}) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.member || (!ctx.isLeader && !ctx.perms.manage_roles)) {
      const err = new Error('No tienes permiso para crear roles en este clan.');
      err.status = 403;
      throw err;
    }
    const existingRoles = await this.queryAll('SELECT id FROM clan_roles WHERE clan_id = ?', [clanId]);
    if (existingRoles.length >= 15) throw new Error('Máximo 15 roles personalizados por clan.');

    const cleanName = String(name || '').trim().slice(0, 24);
    if (cleanName.length < 2) throw new Error('El nombre del rol debe tener al menos 2 caracteres.');
    const cleanColor = /^#[0-9a-fA-F]{6}$/.test(String(color || '')) ? String(color) : '#7dd3fc';
    const cleanPrio = Math.max(1, Math.min(90, Math.round(Number(priority) || 20)));
    const safePerms = {};
    for (const def of CLAN_PERMISSION_DEFS) {
      safePerms[def.key] = Boolean(permissions && permissions[def.key]);
    }

    const roleId = `crl_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`;
    const now = new Date().toISOString();
    await this.execSql(
      'INSERT INTO clan_roles (id, clan_id, name, color, priority, permissions_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [roleId, clanId, cleanName, cleanColor, cleanPrio, JSON.stringify(safePerms), now]
    );
    return { ok: true, roleId, user: await this.getFullUserProfile(userId) };
  }

  async deleteClanRole(userId, clanId, roleId) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.member || (!ctx.isLeader && !ctx.perms.manage_roles)) {
      const err = new Error('No tienes permiso para eliminar roles en este clan.');
      err.status = 403;
      throw err;
    }
    await this.execSql('UPDATE clan_members SET custom_role_id = NULL WHERE clan_id = ? AND custom_role_id = ?', [clanId, roleId]);
    await this.execSql('DELETE FROM clan_roles WHERE id = ? AND clan_id = ?', [roleId, clanId]);
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  async assignClanMemberRole(userId, clanId, targetMemberId, roleId = null) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.member || (!ctx.isLeader && !ctx.perms.manage_roles)) {
      const err = new Error('No tienes permiso para asignar roles en este clan.');
      err.status = 403;
      throw err;
    }
    if (ctx.clan.leader_id === targetMemberId) throw new Error('No se puede cambiar el rol del Owner del clan.');
    const targetMem = await this.queryOne('SELECT user_id FROM clan_members WHERE clan_id = ? AND user_id = ?', [clanId, targetMemberId]);
    if (!targetMem) throw new Error('Miembro no encontrado en el clan.');

    let nextRoleId = null;
    if (roleId) {
      const roleRow = await this.queryOne('SELECT id FROM clan_roles WHERE id = ? AND clan_id = ?', [roleId, clanId]);
      if (!roleRow) throw new Error('Rol de clan no encontrado.');
      nextRoleId = roleRow.id;
    }
    await this.execSql('UPDATE clan_members SET custom_role_id = ? WHERE clan_id = ? AND user_id = ?', [nextRoleId, clanId, targetMemberId]);
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  async kickClanMember(userId, clanId, targetMemberId) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.member || (!ctx.isLeader && !ctx.perms.kick_members)) {
      const err = new Error('No tienes permiso para expulsar miembros de este clan.');
      err.status = 403;
      throw err;
    }
    if (targetMemberId === userId) throw new Error('No puedes expulsarte a ti mismo; usa Salir del Clan.');
    if (ctx.clan.leader_id === targetMemberId) throw new Error('No puedes expulsar al Owner del clan.');
    const targetCtx = await this.getClanMemberContext(clanId, targetMemberId);
    if (!targetCtx.member) throw new Error('El jugador no está en este clan.');
    if (!ctx.isLeader && targetCtx.priority >= ctx.priority) {
      const err = new Error('No puedes expulsar a un miembro con igual o mayor jerarquía dentro del clan.');
      err.status = 403;
      throw err;
    }
    await this.execSql('DELETE FROM clan_members WHERE clan_id = ? AND user_id = ?', [clanId, targetMemberId]);
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  async banClanMember(userId, clanId, targetMemberId, reason = '') {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.member || (!ctx.isLeader && !ctx.perms.ban_members)) {
      const err = new Error('No tienes permiso para banear usuarios de este clan.');
      err.status = 403;
      throw err;
    }
    if (targetMemberId === userId) throw new Error('No puedes banearte a ti mismo.');
    if (ctx.clan.leader_id === targetMemberId) throw new Error('No puedes banear al Owner del clan.');
    const targetCtx = await this.getClanMemberContext(clanId, targetMemberId);
    if (targetCtx.member && !ctx.isLeader && targetCtx.priority >= ctx.priority) {
      const err = new Error('No puedes banear a un miembro con igual o mayor jerarquía dentro del clan.');
      err.status = 403;
      throw err;
    }
    const cleanReason = String(reason || 'Baneado del clan').trim().slice(0, 160);
    const now = new Date().toISOString();
    await this.execSql('DELETE FROM clan_members WHERE clan_id = ? AND user_id = ?', [clanId, targetMemberId]);
    await this.execSql('DELETE FROM clan_join_requests WHERE clan_id = ? AND user_id = ?', [clanId, targetMemberId]);
    await this.execSql('DELETE FROM clan_bans WHERE clan_id = ? AND user_id = ?', [clanId, targetMemberId]);
    await this.execSql(
      'INSERT INTO clan_bans (clan_id, user_id, banned_by, reason, created_at) VALUES (?, ?, ?, ?, ?)',
      [clanId, targetMemberId, userId, cleanReason, now]
    );
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  async unbanClanMember(userId, clanId, bannedUserId) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.member || (!ctx.isLeader && !ctx.perms.ban_members)) {
      const err = new Error('No tienes permiso para desbanear usuarios de este clan.');
      err.status = 403;
      throw err;
    }
    await this.execSql('DELETE FROM clan_bans WHERE clan_id = ? AND user_id = ?', [clanId, bannedUserId]);
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  async getClanMessages(userId, clanId, limit = 80) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.clan) {
      const err = new Error('Clan no encontrado.');
      err.status = 404;
      throw err;
    }
    const isPublicRead = Boolean(Number(ctx.clan.public_read_chat)) || ctx.clan.join_policy === 'private_readonly';
    if (!ctx.member && !isPublicRead) {
      const err = new Error('El chat de este clan es privado solo para sus miembros.');
      err.status = 403;
      throw err;
    }

    const rows = await this.queryAll(`
      SELECT m.id, m.clan_id, m.sender_id, m.content, m.created_at,
             u.username, u.email, u.avatar, u.is_owner, u.is_moderator,
             cm.role AS clan_role, cr.name AS custom_role_name, cr.color AS custom_role_color
      FROM clan_messages m
      JOIN users u ON u.id = m.sender_id
      LEFT JOIN clan_members cm ON cm.clan_id = m.clan_id AND cm.user_id = m.sender_id
      LEFT JOIN clan_roles cr ON cr.id = cm.custom_role_id
      WHERE m.clan_id = ?
      ORDER BY m.created_at DESC
      LIMIT ?
    `, [clanId, limit]);

    const messages = rows.reverse().map((r) => {
      const isGlobalOwner = Boolean(Number(r.is_owner)) || String(r.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
      const isGlobalMod = Boolean(Number(r.is_moderator)) || isGlobalOwner;
      const isClanLeader = r.sender_id === ctx.clan.leader_id || r.clan_role === 'leader';
      return {
        id: r.id,
        clanId: r.clan_id,
        senderId: r.sender_id,
        senderUsername: r.username,
        senderAvatar: r.avatar,
        senderIsOwner: isGlobalOwner,
        senderIsModerator: isGlobalMod,
        senderIsClanLeader: isClanLeader,
        senderClanRoleName: isClanLeader ? 'Owner del Clan' : (r.custom_role_name || null),
        senderClanRoleColor: isClanLeader ? '#ffd700' : (r.custom_role_color || null),
        content: r.content,
        createdAt: r.created_at
      };
    });

    return {
      clan: {
        id: ctx.clan.id,
        name: ctx.clan.name,
        tag: ctx.clan.tag,
        avatar: ctx.clan.avatar || '',
        joinPolicy: ctx.clan.join_policy || 'open',
        publicReadChat: isPublicRead,
        textColor: ctx.clan.text_color || '#efd083',
        fontFamily: ctx.clan.font_family || 'cinzel',
        fontCss: this.resolveClanFontCss(ctx.clan.font_family || 'cinzel')
      },
      canWrite: Boolean(ctx.member),
      canDelete: Boolean(ctx.isLeader || ctx.perms.delete_messages),
      messages
    };
  }

  async sendClanMessage(userId, clanId, content) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    if (!ctx.clan || !ctx.member) {
      const err = new Error('Solo los integrantes del clan pueden escribir en su chat.');
      err.status = 403;
      throw err;
    }
    const clean = String(content || '').trim().slice(0, 500);
    if (!clean) throw new Error('Escribe un mensaje para enviar al clan.');

    const sender = await this.findUserById(userId);
    const id = `cmsg_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    const now = new Date().toISOString();
    await this.execSql(
      'INSERT INTO clan_messages (id, clan_id, sender_id, content, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, clanId, userId, clean, now]
    );

    const memberRows = await this.queryAll('SELECT user_id FROM clan_members WHERE clan_id = ?', [clanId]);
    const isGlobalOwner = Boolean(Number(sender?.is_owner)) || String(sender?.email || '').toLowerCase() === MODERATOR_EXACT_EMAIL;
    const isGlobalMod = Boolean(Number(sender?.is_moderator)) || isGlobalOwner;

    return {
      memberIds: memberRows.map((m) => m.user_id),
      message: {
        id,
        clanId,
        senderId: userId,
        senderUsername: sender?.username || 'Jugador',
        senderAvatar: sender?.avatar || 'preset:obsidian_king',
        senderIsOwner: isGlobalOwner,
        senderIsModerator: isGlobalMod,
        senderIsClanLeader: ctx.isLeader,
        senderClanRoleName: ctx.isLeader ? 'Owner del Clan' : (ctx.member.custom_role_name || null),
        senderClanRoleColor: ctx.isLeader ? '#ffd700' : (ctx.member.custom_role_color || null),
        content: clean,
        createdAt: now
      }
    };
  }

  async deleteClanMessage(userId, clanId, msgId) {
    const ctx = await this.getClanMemberContext(clanId, userId);
    const msg = await this.queryOne('SELECT id, sender_id FROM clan_messages WHERE id = ? AND clan_id = ?', [msgId, clanId]);
    if (!msg) throw new Error('Mensaje no encontrado.');
    if (msg.sender_id !== userId && !ctx.isLeader && !ctx.perms.delete_messages) {
      const err = new Error('No tienes permiso para borrar mensajes de este clan.');
      err.status = 403;
      throw err;
    }
    await this.execSql('DELETE FROM clan_messages WHERE id = ?', [msgId]);
    return { ok: true };
  }

  async leaveClan(userId) {
    const mem = await this.queryOne('SELECT clan_id, role FROM clan_members WHERE user_id = ?', [userId]);
    if (!mem) throw new Error('No perteneces a ningún clan.');
    await this.execSql('DELETE FROM clan_members WHERE user_id = ?', [userId]);
    const remaining = await this.queryAll('SELECT user_id FROM clan_members WHERE clan_id = ? ORDER BY joined_at ASC', [mem.clan_id]);
    if (remaining.length === 0) {
      await this.execSql('DELETE FROM clans WHERE id = ?', [mem.clan_id]);
    } else if (mem.role === 'leader') {
      const nextLeader = remaining[0].user_id;
      await this.execSql("UPDATE clan_members SET role = 'leader', custom_role_id = NULL WHERE clan_id = ? AND user_id = ?", [mem.clan_id, nextLeader]);
      await this.execSql('UPDATE clans SET leader_id = ? WHERE id = ?', [nextLeader, mem.clan_id]);
    }
    return { ok: true, user: await this.getFullUserProfile(userId) };
  }

  /* ================= SISTEMA DE AMIGOS ================= */
  async getFriendsSummary(userId) {
    const rows = await this.queryAll(`
      SELECT f.id, f.requester_id, f.addressee_id, f.status, f.created_at,
             u1.username AS req_username, u1.elo AS req_elo, u1.avatar AS req_avatar, u1.frame_id AS req_frame, u1.vip_active AS req_vip, u1.vip_expires_at AS req_vip_exp, u1.is_moderator AS req_mod,
             u2.username AS addr_username, u2.elo AS addr_elo, u2.avatar AS addr_avatar, u2.frame_id AS addr_frame, u2.vip_active AS addr_vip, u2.vip_expires_at AS addr_vip_exp, u2.is_moderator AS addr_mod
      FROM friendships f
      JOIN users u1 ON u1.id = f.requester_id
      JOIN users u2 ON u2.id = f.addressee_id
      WHERE f.requester_id = ? OR f.addressee_id = ?
      ORDER BY f.updated_at DESC
    `, [userId, userId]);

    const friends = [];
    const incoming = [];
    const outgoing = [];

    for (const r of rows) {
      const iAmRequester = r.requester_id === userId;
      const other = iAmRequester
        ? {
          friendshipId: r.id,
          userId: r.addressee_id,
          username: r.addr_username,
          elo: Number(r.addr_elo) || 0,
          avatar: r.addr_avatar,
          frameId: r.addr_frame,
          isVip: this.isVipRowActive({ vip_active: r.addr_vip, vip_expires_at: r.addr_vip_exp }) || Boolean(Number(r.addr_mod))
        }
        : {
          friendshipId: r.id,
          userId: r.requester_id,
          username: r.req_username,
          elo: Number(r.req_elo) || 0,
          avatar: r.req_avatar,
          frameId: r.req_frame,
          isVip: this.isVipRowActive({ vip_active: r.req_vip, vip_expires_at: r.req_vip_exp }) || Boolean(Number(r.req_mod))
        };

      if (r.status === 'accepted') friends.push(other);
      else if (iAmRequester) outgoing.push(other);
      else incoming.push(other);
    }

    return { friends, incoming, outgoing };
  }

  async sendFriendRequest(userId, targetUsername) {
    const clean = String(targetUsername || '').trim();
    if (!clean) throw new Error('Ingresa el nombre de usuario de tu amigo.');
    const target = await this.findUserByUsername(clean);
    if (!target) throw new Error(`No se encontró ningún jugador llamado "${clean}".`);
    if (target.id === userId) throw new Error('No puedes agregarte a ti mismo como amigo.');

    const existing = await this.queryOne(
      'SELECT * FROM friendships WHERE (requester_id = ? AND addressee_id = ?) OR (requester_id = ? AND addressee_id = ?)',
      [userId, target.id, target.id, userId]
    );
    if (existing) {
      if (existing.status === 'accepted') throw new Error(`${target.username} ya está en tu lista de amigos.`);
      // Si el otro ya nos había enviado solicitud, aceptarla automáticamente
      if (existing.requester_id === target.id) {
        const now = new Date().toISOString();
        await this.execSql("UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?", [now, existing.id]);
        return { ok: true, autoAccepted: true, summary: await this.getFriendsSummary(userId) };
      }
      throw new Error(`Ya enviaste una solicitud pendiente a ${target.username}.`);
    }

    const id = `frd_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    await this.execSql(
      "INSERT INTO friendships (id, requester_id, addressee_id, status, created_at, updated_at) VALUES (?, ?, ?, 'pending', ?, ?)",
      [id, userId, target.id, now, now]
    );
    return { ok: true, id, summary: await this.getFriendsSummary(userId) };
  }

  async respondFriendRequest(userId, friendshipId, accept) {
    const row = await this.queryOne('SELECT * FROM friendships WHERE id = ?', [friendshipId]);
    if (!row) throw new Error('Solicitud no encontrada.');
    if (row.addressee_id !== userId) throw new Error('No puedes responder a esta solicitud.');
    if (accept) {
      await this.execSql("UPDATE friendships SET status = 'accepted', updated_at = ? WHERE id = ?", [new Date().toISOString(), friendshipId]);
    } else {
      await this.execSql('DELETE FROM friendships WHERE id = ?', [friendshipId]);
    }
    return { ok: true, summary: await this.getFriendsSummary(userId) };
  }

  async removeFriendship(userId, friendshipId) {
    const row = await this.queryOne('SELECT * FROM friendships WHERE id = ?', [friendshipId]);
    if (!row || (row.requester_id !== userId && row.addressee_id !== userId)) {
      throw new Error('Relación de amistad no encontrada.');
    }
    await this.execSql('DELETE FROM friendships WHERE id = ?', [friendshipId]);
    return { ok: true, summary: await this.getFriendsSummary(userId) };
  }

  /* ================= SISTEMA DE REPORTES DE HACKS Y CHEATS ================= */
  async createReport(reporterId, { reportedUsername, category = 'hacks', description, matchId = null }) {
    const cleanTarget = String(reportedUsername || '').trim();
    const cleanDesc = String(description || '').trim().slice(0, 500);
    const allowedCats = ['hacks', 'cheats', 'toxicity', 'other'];
    const cat = allowedCats.includes(category) ? category : 'hacks';
    if (cleanTarget.length < 2) throw new Error('Indica el nombre de usuario del jugador reportado.');
    if (cleanDesc.length < 6) throw new Error('Describe brevemente el hack o trampa (mín. 6 caracteres).');

    const target = await this.findUserByUsername(cleanTarget);
    const id = `rep_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();
    await this.execSql(`
      INSERT INTO reports (id, reporter_id, reported_user_id, reported_username, category, description, match_id, status, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?)
    `, [id, reporterId, target?.id || null, target?.username || cleanTarget, cat, cleanDesc, matchId, now]);
    return { ok: true, id };
  }

  async listAllReports() {
    const rows = await this.queryAll(`
      SELECT r.*, rep.username AS reporter_username, mod_u.username AS resolver_username
      FROM reports r
      LEFT JOIN users rep ON rep.id = r.reporter_id
      LEFT JOIN users mod_u ON mod_u.id = r.resolved_by
      ORDER BY CASE WHEN r.status = 'pending' THEN 0 ELSE 1 END, r.created_at DESC
      LIMIT 150
    `);
    return rows.map((r) => ({
      id: r.id,
      reporterId: r.reporter_id,
      reporterUsername: r.reporter_username || 'Jugador',
      reportedUserId: r.reported_user_id,
      reportedUsername: r.reported_username,
      category: r.category,
      description: r.description,
      matchId: r.match_id,
      status: r.status,
      resolvedBy: r.resolver_username || null,
      resolutionNote: r.resolution_note || '',
      createdAt: r.created_at,
      resolvedAt: r.resolved_at
    }));
  }

  async resolveReport(moderatorId, reportId, { status = 'resolved', resolutionNote = '' }) {
    const st = ['resolved', 'dismissed'].includes(status) ? status : 'resolved';
    const note = String(resolutionNote || '').trim().slice(0, 260);
    await this.execSql(
      'UPDATE reports SET status = ?, resolved_by = ?, resolution_note = ?, resolved_at = ? WHERE id = ?',
      [st, moderatorId, note, new Date().toISOString(), reportId]
    );
    return { ok: true, reportId, status: st };
  }

  /* ================= SNAPSHOT AUTENTICADO ANTI-PÉRDIDA DE DATOS EN ACTUALIZACIONES ================= */
  async exportAccountSnapshotData(userId) {
    const row = await this.findUserById(userId);
    if (!row) return null;
    const campaigns = await this.queryAll(
      'SELECT campaign_id, level_id, best_turns, completions, completed_at FROM campaign_progress WHERE user_id = ?',
      [userId]
    );
    const unlocks = await this.queryAll(
      'SELECT cosmetic_id, unlocked_at FROM user_unlocks WHERE user_id = ?',
      [userId]
    );
    return {
      v: 1,
      user: {
        id: row.id,
        username: row.username,
        email: row.email,
        password_hash: row.password_hash,
        password_salt: row.password_salt,
        avatar: row.avatar,
        frame_id: row.frame_id,
        board_theme_id: row.board_theme_id,
        piece_skin_id: row.piece_skin_id,
        equipped_power_id: row.equipped_power_id,
        trainer_id: row.trainer_id || null,
        language: row.language || 'es',
        title: row.title || '',
        elo: Number(row.elo) || 0,
        xp: Number(row.xp) || 50,
        mods: Number(row.mods ?? INITIAL_MODS) || 0,
        vip_active: Number(row.vip_active) || 0,
        vip_expires_at: row.vip_expires_at || null,
        battle_pass_s1: Number(row.battle_pass_s1) || 0,
        battle_pass_s1_at: row.battle_pass_s1_at || null,
        battle_pass_claimed_json: row.battle_pass_claimed_json || '[]',
        is_moderator: Number(row.is_moderator) || 0,
        wins: Number(row.wins) || 0,
        losses: Number(row.losses) || 0,
        draws: Number(row.draws) || 0,
        games_played: Number(row.games_played) || 0,
        bases_destroyed: Number(row.bases_destroyed) || 0,
        hints_used: Number(row.hints_used) || 0,
        created_at: row.created_at
      },
      campaigns,
      unlocks
    };
  }

  async restoreAccountFromSnapshot(snap) {
    if (!snap || !snap.user || !snap.user.id || !snap.user.email) return null;
    const u = snap.user;
    // Si ya existe en BD (por ejemplo en PostgreSQL), jamás sobrescribir con datos viejos
    const existingById = await this.findUserById(u.id);
    if (existingById) return this.getFullUserProfile(existingById.id);
    const existingByEmail = await this.findUserByEmail(u.email);
    if (existingByEmail) return this.getFullUserProfile(existingByEmail.id);

    const now = new Date().toISOString();
    let finalUsername = u.username;
    const dupName = await this.findUserByUsername(finalUsername);
    if (dupName) finalUsername = `${u.username.slice(0, 15)}_${u.id.slice(-4)}`;

    const lvl = computeLevelFromXp(u.xp).level;
    await this.execSql(`
      INSERT INTO users (
        id, username, username_lower, email, password_hash, password_salt,
        avatar, frame_id, board_theme_id, piece_skin_id, equipped_power_id, trainer_id, language, title,
        elo, xp, mods, vip_active, vip_expires_at, battle_pass_s1, battle_pass_s1_at, battle_pass_claimed_json, is_moderator, is_banned, ban_reason, level,
        wins, losses, draws, games_played, bases_destroyed, hints_used, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      u.id,
      finalUsername,
      finalUsername.toLowerCase(),
      String(u.email).toLowerCase(),
      u.password_hash,
      u.password_salt,
      u.avatar || 'preset:obsidian_king',
      u.frame_id || 'frame_stone',
      u.board_theme_id || 'board_classic_maya',
      u.piece_skin_id || 'pieces_classic',
      u.equipped_power_id || 'power_none',
      u.trainer_id || null,
      u.language || 'es',
      u.title || '',
      Number(u.elo) || 0,
      Number(u.xp) || 50,
      Number(u.mods ?? INITIAL_MODS) || 0,
      Number(u.vip_active) || 0,
      u.vip_expires_at || null,
      Number(u.battle_pass_s1) || 0,
      u.battle_pass_s1_at || null,
      u.battle_pass_claimed_json || '[]',
      Number(u.is_moderator) || 0,
      lvl,
      Number(u.wins) || 0,
      Number(u.losses) || 0,
      Number(u.draws) || 0,
      Number(u.games_played) || 0,
      Number(u.bases_destroyed) || 0,
      Number(u.hints_used) || 0,
      u.created_at || now,
      now
    ]);

    for (const c of (snap.campaigns || [])) {
      await this.execSql(
        'INSERT INTO campaign_progress (user_id, campaign_id, level_id, best_turns, completions, completed_at) VALUES (?, ?, ?, ?, ?, ?)',
        [u.id, c.campaign_id, Number(c.level_id), Number(c.best_turns) || 1, Number(c.completions) || 1, c.completed_at || now]
      ).catch(() => {});
    }
    for (const unl of (snap.unlocks || [])) {
      await this.grantExclusiveUnlock(u.id, unl.cosmetic_id).catch(() => {});
    }
    return this.getFullUserProfile(u.id);
  }
}
