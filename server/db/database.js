import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import pg from 'pg';
import { computeLevelFromXp, INITIAL_ELO, INITIAL_MODS, HINT_XP_COST } from '../../shared/config/constants.js';
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
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS vip_expires_at TEXT"
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
        "ALTER TABLE users ADD COLUMN vip_expires_at TEXT"
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
    const isVip = this.isVipRowActive(row);
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
      isVip,
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

    return {
      ...base,
      email: row.email,
      googleLinked: Boolean(row.google_id),
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
      throw new Error('Este artículo es exclusivo de la suscripción mensual Mod VIP (S/ 15 / mes).');
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
      SELECT id, username, avatar, frame_id, title, elo, xp, level, wins, losses, draws, games_played, vip_active, vip_expires_at
      FROM users
      ORDER BY elo DESC, wins DESC, xp DESC
      LIMIT ?
    `, [limit]);

    const result = [];
    for (let idx = 0; idx < rows.length; idx++) {
      const r = await this.ensureFreshVipState(rows[idx]);
      const isVip = this.isVipRowActive(r);
      result.push({
        rank: idx + 1,
        id: r.id,
        username: r.username,
        avatar: r.avatar,
        frameId: (!isVip && VIP_EXCLUSIVE_IDS.includes(r.frame_id)) ? 'frame_stone' : r.frame_id,
        isVip,
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
}
