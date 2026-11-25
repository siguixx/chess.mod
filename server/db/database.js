import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { computeLevelFromXp, INITIAL_ELO, INITIAL_MODS, HINT_XP_COST, CLAN_CREATE_COST_MODS } from '../../shared/config/constants.js';
import { getAllCosmetics, findShopItem, isCosmeticUnlocked, VIP_EXCLUSIVE_IDS, MOD_VIP_PLAN } from '../../shared/config/cosmetics.js';
import { CHAPTER_ORDER, isChapterUnlocked, isCampaignLevelUnlocked } from '../../shared/config/campaigns.js';

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
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'es'"
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
        "ALTER TABLE users ADD COLUMN language TEXT NOT NULL DEFAULT 'es'"
      ];
      for (const sql of sqliteMigrations) {
        try { this.sqlite.exec(sql); } catch {}
      }
    }
    this.initialized = true;
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
    const isVip = this.isVipRowActive(row) || Boolean(Number(row.is_moderator));
    const isModerator = Boolean(Number(row.is_moderator));
    const isBanned = Boolean(Number(row.is_banned));
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
      isModerator,
      isBanned,
      banReason: row.ban_reason || '',
      vipExpiresAt: isVip ? row.vip_expires_at : null,
      mods: Number(row.mods ?? INITIAL_MODS) || 0,
      title: row.title || '',
      elo: Number(row.elo) || 0,
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
    const safe = ['es', 'en', 'pt', 'fr'].includes(language) ? language : 'es';
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
      const isCustom = /^data:image\/(png|jpeg|webp);base64,/.test(avatar);
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

  async recordSinglePlayerMatch(userId, { mode, opponentName, winner, resultReason, turns = 1, basesDestroyed = 0, campaignId = null, levelId = null, xpReward = 0 }) {
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

    const matchId = `mtc_${crypto.randomUUID().replace(/-/g, '').slice(0, 14)}`;
    await this.execSql(`
      INSERT INTO matches (
        id, mode, white_user_id, black_user_id, opponent_name, winner, result_reason,
        white_elo_before, white_elo_after, black_elo_before, black_elo_after, turns, created_at
      ) VALUES (?, ?, ?, NULL, ?, ?, ?, ?, ?, NULL, NULL, ?, ?)
    `, [matchId, mode, userId, opponentName || 'IA', winner, resultReason || '', row.elo, row.elo, Math.max(1, Number(turns) || 1), now]);

    await this.execSql(`
      UPDATE users
      SET games_played = games_played + 1,
          wins = wins + ?,
          losses = losses + ?,
          draws = draws + ?,
          bases_destroyed = bases_destroyed + ?,
          updated_at = ?
      WHERE id = ?
    `, [isWin ? 1 : 0, (!isWin && !isDraw) ? 1 : 0, isDraw ? 1 : 0, Math.max(0, Number(basesDestroyed) || 0), now, userId]);

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
      SELECT u.id, u.username, u.avatar, u.frame_id, u.title, u.elo, u.xp, u.level, u.wins, u.losses, u.draws, u.games_played,
             u.vip_active, u.vip_expires_at, u.is_moderator, u.is_banned, c.tag AS clan_tag
      FROM users u
      LEFT JOIN clan_members cm ON cm.user_id = u.id
      LEFT JOIN clans c ON c.id = cm.clan_id
      WHERE u.is_banned = 0
      ORDER BY u.elo DESC, u.wins DESC, u.xp DESC
      LIMIT ?
    `, [limit]);

    const result = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const r = await this.ensureFreshVipState(rows[idx]);
      const isMod = Boolean(Number(r.is_moderator));
      const isVip = this.isVipRowActive(r) || isMod;
      result.push({
        rank: idx + 1,
        id: r.id,
        username: r.username,
        avatar: r.avatar,
        frameId: (!isVip && VIP_EXCLUSIVE_IDS.includes(r.frame_id)) ? 'frame_stone' : r.frame_id,
        isVip,
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

  /* ================= MODERACIÓN SUPREMA (TODO DESBLOQUEADO + BANEO + VISIÓN TOTAL) ================= */
  async grantModeratorEverything(userId) {
    const row = await this.findUserById(userId);
    if (!row) return null;
    const now = new Date().toISOString();
    const farFuture = '2099-12-31T23:59:59.000Z';
    const nextMods = Math.max(Number(row.mods) || 0, 99999);
    await this.execSql(`
      UPDATE users
      SET is_moderator = 1,
          is_banned = 0,
          ban_reason = '',
          vip_active = 1,
          vip_expires_at = ?,
          mods = ?,
          title = CASE WHEN title = '' THEN 'Moderador CHESS.MOD' ELSE title END,
          updated_at = ?
      WHERE id = ?
    `, [farFuture, nextMods, now, userId]);

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

    // SOLO EL MODERADOR recibe los 25 niveles (5 capítulos × 5 niveles) del Modo Historia completados
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

  async banUser(moderatorId, targetUserId, reason = 'Infracción de normas / Hacks o Cheats') {
    const target = await this.findUserById(targetUserId);
    if (!target) throw new Error('Usuario a banear no encontrado.');
    if (Number(target.is_moderator)) throw new Error('No se puede banear a un Moderador.');
    const now = new Date().toISOString();
    const cleanReason = String(reason || 'Infracción de normas').trim().slice(0, 220);
    await this.execSql(
      'UPDATE users SET is_banned = 1, ban_reason = ?, banned_at = ?, updated_at = ? WHERE id = ?',
      [cleanReason, now, now, targetUserId]
    );
    return { ok: true, userId: targetUserId, username: target.username, banReason: cleanReason };
  }

  async unbanUser(targetUserId) {
    const target = await this.findUserById(targetUserId);
    if (!target) throw new Error('Usuario no encontrado.');
    const now = new Date().toISOString();
    await this.execSql(
      "UPDATE users SET is_banned = 0, ban_reason = '', banned_at = NULL, updated_at = ? WHERE id = ?",
      [now, targetUserId]
    );
    return { ok: true, userId: targetUserId, username: target.username };
  }

  async getModeratorOverview() {
    const users = await this.queryAll(`
      SELECT u.id, u.username, u.email, u.elo, u.xp, u.mods, u.level, u.wins, u.losses, u.draws, u.games_played,
             u.vip_active, u.vip_expires_at, u.is_moderator, u.is_banned, u.ban_reason, u.banned_at, u.created_at,
             c.tag AS clan_tag
      FROM users u
      LEFT JOIN clan_members cm ON cm.user_id = u.id
      LEFT JOIN clans c ON c.id = cm.clan_id
      ORDER BY u.created_at DESC
      LIMIT 200
    `);
    const reports = await this.listAllReports();
    const clans = await this.listClans();
    const recentMatches = await this.queryAll(`
      SELECT m.*, wu.username AS white_username, bu.username AS black_username
      FROM matches m
      LEFT JOIN users wu ON wu.id = m.white_user_id
      LEFT JOIN users bu ON bu.id = m.black_user_id
      ORDER BY m.created_at DESC
      LIMIT 50
    `);

    return {
      stats: {
        totalUsers: users.length,
        bannedUsers: users.filter((u) => Number(u.is_banned)).length,
        vipUsers: users.filter((u) => this.isVipRowActive(u)).length,
        pendingReports: reports.filter((r) => r.status === 'pending').length,
        totalClans: clans.length,
        dbDriver: this.driver
      },
      users: users.map((u) => ({
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
        isVip: this.isVipRowActive(u) || Boolean(Number(u.is_moderator)),
        isModerator: Boolean(Number(u.is_moderator)),
        isBanned: Boolean(Number(u.is_banned)),
        banReason: u.ban_reason || '',
        clanTag: u.clan_tag || null,
        createdAt: u.created_at
      })),
      reports,
      clans,
      recentMatches
    };
  }

  /* ================= SISTEMA DE CLANES (CUESTA MODS CREAR) ================= */
  async getUserClan(userId) {
    const row = await this.queryOne(`
      SELECT c.id, c.name, c.tag, c.description, c.leader_id, cm.role, c.created_at
      FROM clan_members cm
      JOIN clans c ON c.id = cm.clan_id
      WHERE cm.user_id = ?
    `, [userId]);
    if (!row) return null;
    const members = await this.queryAll(`
      SELECT u.id, u.username, u.elo, u.avatar, u.frame_id, u.vip_active, u.vip_expires_at, u.is_moderator, cm.role
      FROM clan_members cm
      JOIN users u ON u.id = cm.user_id
      WHERE cm.clan_id = ?
      ORDER BY u.elo DESC
    `, [row.id]);
    return {
      id: row.id,
      name: row.name,
      tag: row.tag,
      description: row.description,
      leaderId: row.leader_id,
      myRole: row.role,
      membersCount: members.length,
      members: members.map((m) => ({
        id: m.id,
        username: m.username,
        elo: Number(m.elo) || 0,
        avatar: m.avatar,
        frameId: m.frame_id,
        isVip: this.isVipRowActive(m) || Boolean(Number(m.is_moderator)),
        role: m.role
      }))
    };
  }

  async listClans() {
    const rows = await this.queryAll(`
      SELECT c.id, c.name, c.tag, c.description, c.leader_id, c.created_at,
             u.username AS leader_name,
             COUNT(cm.user_id) AS member_count,
             COALESCE(SUM(mu.elo), 0) AS total_elo
      FROM clans c
      LEFT JOIN users u ON u.id = c.leader_id
      LEFT JOIN clan_members cm ON cm.clan_id = c.id
      LEFT JOIN users mu ON mu.id = cm.user_id
      GROUP BY c.id, u.username
      ORDER BY total_elo DESC, member_count DESC, c.created_at DESC
      LIMIT 60
    `);
    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      tag: r.tag,
      description: r.description || '',
      leaderId: r.leader_id,
      leaderName: r.leader_name || 'Líder',
      memberCount: Number(r.member_count) || 0,
      totalElo: Number(r.total_elo) || 0,
      createdAt: r.created_at
    }));
  }

  async createClan(userId, { name, tag, description = '' }) {
    const profile = await this.getFullUserProfile(userId);
    if (!profile) throw new Error('Usuario no encontrado.');
    if (profile.clan) throw new Error(`Ya perteneces al clan [${profile.clan.tag}] ${profile.clan.name}. Sal primero antes de crear uno.`);

    const cleanName = String(name || '').trim().slice(0, 28);
    const cleanTag = String(tag || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5);
    const cleanDesc = String(description || '').trim().slice(0, 140);
    if (cleanName.length < 3) throw new Error('El nombre del clan debe tener al menos 3 caracteres.');
    if (cleanTag.length < 2 || cleanTag.length > 5) throw new Error('La etiqueta (TAG) del clan debe tener entre 2 y 5 letras/números.');

    if (profile.mods < CLAN_CREATE_COST_MODS) {
      const err = new Error(`Crear un Clan cuesta ${CLAN_CREATE_COST_MODS} Mods (tienes ${profile.mods} Mods).`);
      err.status = 400;
      err.code = 'INSUFFICIENT_MODS';
      throw err;
    }

    const dupName = await this.queryOne('SELECT id FROM clans WHERE name_lower = ?', [cleanName.toLowerCase()]);
    if (dupName) throw new Error('Ya existe un clan con ese nombre.');
    const dupTag = await this.queryOne('SELECT id FROM clans WHERE tag = ?', [cleanTag]);
    if (dupTag) throw new Error(`La etiqueta [${cleanTag}] ya está en uso.`);

    const clanId = `cln_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const now = new Date().toISOString();

    await this.addMods(userId, -CLAN_CREATE_COST_MODS);
    await this.execSql(
      'INSERT INTO clans (id, name, name_lower, tag, description, leader_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [clanId, cleanName, cleanName.toLowerCase(), cleanTag, cleanDesc, userId, now]
    );
    await this.execSql(
      "INSERT INTO clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, 'leader', ?)",
      [clanId, userId, now]
    );

    return { ok: true, clanId, costMods: CLAN_CREATE_COST_MODS, user: await this.getFullUserProfile(userId) };
  }

  async joinClan(userId, clanId) {
    const existing = await this.getUserClan(userId);
    if (existing) throw new Error(`Ya eres miembro de [${existing.tag}] ${existing.name}. Sal primero para unirte a otro.`);
    const clan = await this.queryOne('SELECT id, name, tag FROM clans WHERE id = ?', [clanId]);
    if (!clan) throw new Error('Clan no encontrado.');
    const now = new Date().toISOString();
    await this.execSql(
      "INSERT INTO clan_members (clan_id, user_id, role, joined_at) VALUES (?, ?, 'member', ?)",
      [clanId, userId, now]
    );
    return { ok: true, user: await this.getFullUserProfile(userId) };
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
      await this.execSql("UPDATE clan_members SET role = 'leader' WHERE clan_id = ? AND user_id = ?", [mem.clan_id, nextLeader]);
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
        elo, xp, mods, vip_active, vip_expires_at, is_moderator, is_banned, ban_reason, level,
        wins, losses, draws, games_played, bases_destroyed, hints_used, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, '', ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
