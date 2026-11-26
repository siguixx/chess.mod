import crypto from 'node:crypto';
import { ClassicChessEngine } from '../../shared/rules/classicEngine.js';
import { LargeBoardChessEngine } from '../../shared/rules/largeBoardEngine.js';
import { SPECIAL_GAME_MODES } from '../../shared/config/constants.js';
import { calculateEloUpdate } from '../../shared/config/elo.js';
import { verifyToken, extractTokenFromCookieHeader } from '../auth/authService.js';
import {
  validateAndNormalizeMod,
  applyCustomModSetupToEngine,
  createInitialPowerState,
  resolvePowerDef,
  executeBattlePowerAction,
  applyMittensAssimilationIfActive,
  tickPowerStateForSide,
  isPieceFrozen,
  isSquareBlockedByModState
} from '../../shared/mods/modRuntime.js';

export const ALLOWED_BET_AMOUNTS = [0, 25, 50, 100, 250];
const VALID_SPECIAL_IDS = new Set(SPECIAL_GAME_MODES.map((m) => m.id));

function sanitizeSpecialModeId(val) {
  const s = String(val || '').trim();
  return VALID_SPECIAL_IDS.has(s) ? s : null;
}

function sanitizeRoomSettings(raw = {}, fallbackTime = 10, fallbackBet = 0) {
  const mins = [0, 1, 3, 5, 10, 15].includes(Number(raw.timeMinutes))
    ? Number(raw.timeMinutes)
    : ([0, 1, 3, 5, 10, 15].includes(Number(fallbackTime)) ? Number(fallbackTime) : 10);
  return {
    specialModeId: sanitizeSpecialModeId(raw.specialModeId),
    timeMinutes: mins,
    allowPowers: raw.allowPowers !== false,
    allowHints: Boolean(raw.allowHints),
    allowUndo: Boolean(raw.allowUndo),
    betMods: sanitizeBetAmount(raw.betMods ?? fallbackBet)
  };
}

function createEngineForMode(specialModeId, timeMinutes) {
  let engine;
  if (specialModeId === 'special_colossal_12x12') {
    engine = new LargeBoardChessEngine(12, timeMinutes);
  } else if (specialModeId === 'special_mega_10x10_chaos') {
    engine = new LargeBoardChessEngine(10, timeMinutes);
  } else if (specialModeId === 'special_atomic_boom') {
    engine = new LargeBoardChessEngine(8, timeMinutes, { atomicMode: true });
  } else {
    engine = new ClassicChessEngine(timeMinutes);
  }

  if (specialModeId === 'special_6x6') {
    engine.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const row6 = ['R', 'N', 'Q', 'K', 'B', 'R'];
    for (let i = 0; i < 6; i++) {
      const c = i + 1;
      engine.board[1][c] = { id: `m6b_${i}`, color: 'b', type: row6[i], hasMoved: true };
      engine.board[2][c] = { id: `m6bp_${i}`, color: 'b', type: 'P', hasMoved: true };
      engine.board[5][c] = { id: `m6wp_${i}`, color: 'w', type: 'P', hasMoved: true };
      engine.board[6][c] = { id: `m6w_${i}`, color: 'w', type: row6[i], hasMoved: true };
    }
  } else if (specialModeId === 'special_all_queens') {
    for (let c = 0; c < 8; c++) {
      if (c !== 4 && c !== 0 && c !== 7) {
        engine.board[0][c].type = 'Q';
        engine.board[7][c].type = 'Q';
      }
      engine.board[1][c].type = 'Q';
      engine.board[6][c].type = 'Q';
    }
  } else if (specialModeId === 'special_cavalry_swarm') {
    for (let c = 0; c < 8; c++) {
      if (engine.board[0][c]?.type !== 'K') engine.board[0][c].type = 'N';
      if (engine.board[7][c]?.type !== 'K') engine.board[7][c].type = 'N';
      engine.board[1][c].type = 'N';
      engine.board[6][c].type = 'N';
    }
  }
  return engine;
}

function sanitizeBetAmount(val) {
  const n = Math.max(0, Math.round(Number(val) || 0));
  return ALLOWED_BET_AMOUNTS.includes(n) ? n : 0;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export class MultiplayerManager {
  constructor(io, db, antiCheat = null) {
    this.io = io;
    this.db = db;
    this.antiCheat = antiCheat;
    this.queue = [];
    this.matches = new Map();
    this.socketToMatch = new Map();
    this.socketToSpectate = new Map(); // socketId -> matchId
    this.privateRooms = new Map();
    this.onlineUsers = new Map(); // userId -> { userId, username, sockets: Set<socketId> }

    this.setupSocketAuth();
    this.setupHandlers();

    this.matchmakingTimer = setInterval(() => this.processQueue().catch(() => {}), 1000);
    this.clockTimer = setInterval(() => this.tickClocks(), 1000);
  }

  destroy() {
    clearInterval(this.matchmakingTimer);
    clearInterval(this.clockTimer);
  }

  disconnectUserById(userId) {
    for (const sock of this.io.sockets.sockets.values()) {
      if (sock.userId === userId) {
        sock.emit('match:error', { error: 'Tu cuenta ha sido baneada por moderación.' });
        sock.disconnect(true);
      }
    }
  }

  notifyUser(userId, event, payload) {
    for (const sock of this.io.sockets.sockets.values()) {
      if (sock.userId === userId) {
        sock.emit(event, payload);
      }
    }
  }

  pushNotification(userId, { type = 'info', title = 'CHESS.MOD', message = '', fromUserId = null, fromUsername = '', data = {} } = {}) {
    if (!userId) return null;
    const notif = {
      id: `ntf_${crypto.randomUUID().replace(/-/g, '').slice(0, 10)}`,
      type,
      title,
      message,
      fromUserId,
      fromUsername,
      data,
      createdAt: new Date().toISOString()
    };
    this.notifyUser(userId, 'notify:event', notif);
    return notif;
  }

  getUserPresenceStatus(userId) {
    const entry = this.onlineUsers.get(userId);
    if (!entry || entry.sockets.size === 0) return { online: false, status: 'offline' };
    for (const sid of entry.sockets) {
      if (this.socketToMatch.has(sid)) return { online: true, status: 'in_match' };
    }
    return { online: true, status: 'online' };
  }

  getPresenceSnapshot() {
    const users = {};
    for (const [uid, entry] of this.onlineUsers.entries()) {
      if (entry.sockets.size === 0) continue;
      const st = this.getUserPresenceStatus(uid);
      users[uid] = { online: true, status: st.status, username: entry.username };
    }
    return { users, onlineCount: Object.keys(users).length };
  }

  broadcastPresenceUpdate(userId) {
    if (!userId) return;
    const st = this.getUserPresenceStatus(userId);
    const entry = this.onlineUsers.get(userId);
    this.io.emit('presence:update', {
      userId,
      username: entry?.username || '',
      online: st.online,
      status: st.status,
      onlineCount: this.onlineUsers.size
    });
  }

  getLiveMatchesSummary() {
    const list = [];
    for (const room of this.matches.values()) {
      if (room.finished) continue;
      list.push({
        matchId: room.id,
        isPrivate: Boolean(room.isPrivate),
        roomCode: room.roomCode || null,
        customModName: room.customMod?.name || null,
        betMods: room.betMods || 0,
        betPot: room.betPot || 0,
        turnNumber: room.engine.turnNumber,
        spectatorsCount: room.spectators.size,
        white: {
          username: room.white.profile.username,
          elo: room.white.profile.elo,
          isVip: room.white.profile.isVip,
          avatar: room.white.profile.avatar,
          frameId: room.white.profile.frameId
        },
        black: {
          username: room.black.profile.username,
          elo: room.black.profile.elo,
          isVip: room.black.profile.isVip,
          avatar: room.black.profile.avatar,
          frameId: room.black.profile.frameId
        }
      });
    }
    return list;
  }

  broadcastLiveMatches() {
    this.io.emit('live:matches', { matches: this.getLiveMatchesSummary() });
  }

  setupSocketAuth() {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth?.token
          || extractTokenFromCookieHeader(socket.handshake.headers?.cookie || '');
        const decoded = verifyToken(token);
        if (!decoded?.uid) return next(new Error('AUTH_REQUIRED'));
        const userRow = await this.db.findUserById(decoded.uid);
        if (!userRow) return next(new Error('USER_NOT_FOUND'));
        if ((Number(decoded.tv) || 1) !== (Number(userRow.token_version) || 1)) {
          return next(new Error('SESSION_REVOKED'));
        }
        if (Number(userRow.is_banned)) return next(new Error('ACCOUNT_BANNED'));
        socket.userId = userRow.id;
        socket.username = userRow.username;
        next();
      } catch (err) {
        next(err);
      }
    });
  }

  setupHandlers() {
    this.io.on('connection', (socket) => {
      // Registrar presencia en tiempo real del usuario
      if (!this.onlineUsers.has(socket.userId)) {
        this.onlineUsers.set(socket.userId, { userId: socket.userId, username: socket.username, sockets: new Set() });
      }
      const pEntry = this.onlineUsers.get(socket.userId);
      pEntry.username = socket.username;
      pEntry.sockets.add(socket.id);

      socket.emit('presence:snapshot', this.getPresenceSnapshot());
      this.broadcastPresenceUpdate(socket.userId);

      socket.emit('online:stats', {
        onlineCount: this.onlineUsers.size,
        queueCount: this.queue.length
      });
      socket.emit('live:matches', { matches: this.getLiveMatchesSummary() });

      socket.on('presence:request', () => {
        socket.emit('presence:snapshot', this.getPresenceSnapshot());
      });

      // === INVITACIÓN / SOLICITUD DIRECTA DE MATCH EN TIEMPO REAL ===
      socket.on('match:invite', async ({ targetUserId, timeMinutes = 10, specialModeId = null, betMods = 0 } = {}) => {
        if (!targetUserId || targetUserId === socket.userId) {
          return socket.emit('private:error', { error: 'Selecciona a otro jugador para enviar solicitud de match.' });
        }
        if (this.socketToMatch.has(socket.id)) {
          return socket.emit('private:error', { error: 'Ya estás en una partida activa.' });
        }
        const targetPresence = this.getUserPresenceStatus(targetUserId);
        if (!targetPresence.online) {
          return socket.emit('private:error', { error: 'Ese jugador está desconectado en este momento.' });
        }
        if (targetPresence.status === 'in_match') {
          return socket.emit('private:error', { error: 'Ese jugador está actualmente en una partida.' });
        }
        const row = await this.db.ensureFreshVipState(await this.db.findUserById(socket.userId));
        if (!row) return;
        const targetRow = await this.db.findUserById(targetUserId);
        if (!targetRow) return socket.emit('private:error', { error: 'Jugador no encontrado.' });

        const settings = sanitizeRoomSettings({ timeMinutes, specialModeId, betMods }, timeMinutes, betMods);
        if (settings.betMods > 0 && (Number(row.mods) || 0) < settings.betMods) {
          return socket.emit('private:error', { error: `No tienes ${settings.betMods} Mods para esa apuesta.` });
        }

        this.leaveSpectate(socket);
        this.removeFromQueue(socket.id);
        this.removePrivateRoomBySocket(socket.id);

        let code = generateRoomCode();
        while (this.privateRooms.has(code)) code = generateRoomCode();

        const entry = {
          code,
          hostSocketId: socket.id,
          hostUserId: row.id,
          hostProfile: this.db.formatPublicUser(row),
          invitedUserId: targetUserId,
          timeMinutes: settings.timeMinutes,
          betMods: settings.betMods,
          specialModeId: settings.specialModeId,
          roomSettings: settings,
          customMod: null,
          createdAt: Date.now()
        };
        this.privateRooms.set(code, entry);

        socket.emit('private:created', {
          code,
          timeMinutes: settings.timeMinutes,
          betMods: settings.betMods,
          specialModeId: settings.specialModeId,
          roomSettings: settings,
          customMod: null,
          invitedUsername: targetRow.username
        });

        const spDef = SPECIAL_GAME_MODES.find((m) => m.id === settings.specialModeId);
        const modeTxt = spDef ? `${spDef.icon} ${spDef.name}` : '♟️ Ajedrez Clásico';
        this.pushNotification(targetUserId, {
          type: 'match_invite',
          title: '⚔️ Solicitud de Match',
          message: `${row.username} te envió solicitud de match (${modeTxt} · ${settings.timeMinutes || '∞'} min).`,
          fromUserId: row.id,
          fromUsername: row.username,
          data: { code, hostUserId: row.id, hostUsername: row.username, timeMinutes: settings.timeMinutes, specialModeId: settings.specialModeId }
        });
      });

      socket.on('match:invite_respond', ({ code = '', accept = false } = {}) => {
        const cleanCode = String(code || '').trim().toUpperCase();
        const waiting = this.privateRooms.get(cleanCode);
        if (!waiting) return;
        if (!accept) {
          this.privateRooms.delete(cleanCode);
          this.notifyUser(waiting.hostUserId, 'private:closed', { ok: true, declinedBy: socket.username });
          this.pushNotification(waiting.hostUserId, {
            type: 'match_invite_declined',
            title: '⚔️ Match Rechazado',
            message: `${socket.username} rechazó tu solicitud de match.`,
            fromUserId: socket.userId,
            fromUsername: socket.username,
            data: { code: cleanCode }
          });
        }
      });

      socket.on('live:list', () => {
        socket.emit('live:matches', { matches: this.getLiveMatchesSummary() });
      });

      // === MODO ESPECTADOR EN VIVO (SOLO PARTIDAS ENTRE JUGADORES REALES) ===
      socket.on('match:spectate', ({ matchId } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) {
          socket.emit('spectate:error', { error: 'La partida ya finalizó o no existe.' });
          return;
        }
        if (this.socketToMatch.has(socket.id)) {
          socket.emit('spectate:error', { error: 'No puedes espectear mientras estás jugando una partida.' });
          return;
        }
        this.leaveSpectate(socket);
        socket.join(room.id);
        room.spectators.add(socket.id);
        this.socketToSpectate.set(socket.id, room.id);

        socket.emit('match:spectate_start', {
          matchId: room.id,
          isPrivate: Boolean(room.isPrivate),
          roomCode: room.roomCode || null,
          specialModeId: room.specialModeId || null,
          roomSettings: room.roomSettings || null,
          customMod: room.customMod || null,
          betMods: room.betMods || 0,
          betPot: room.betPot || 0,
          timeMinutes: room.timeMinutes || 10,
          white: room.white.profile,
          black: room.black.profile,
          state: room.engine.cloneState(),
          powerState: room.powerState,
          spectatorsCount: room.spectators.size
        });

        this.io.to(room.id).emit('match:spectators', { matchId: room.id, count: room.spectators.size });
        this.broadcastLiveMatches();
      });

      socket.on('match:leave_spectate', () => {
        this.leaveSpectate(socket);
      });

      // === COLA PÚBLICA (SOLO PODERES OFICIALES + APUESTA DE MODS + MODO ESPECIAL OPCIONAL) ===
      socket.on('queue:join', async ({ timeMinutes = 10, betMods = 0, specialModeId = null, customMod = null } = {}) => {
        if (customMod) {
          socket.emit('queue:error', { error: 'Los Mods personalizados con código solo están permitidos en Salas Privadas. En públicas se usan solo los poderes oficiales del juego.' });
          return;
        }
        if (this.socketToMatch.has(socket.id)) {
          socket.emit('queue:error', { error: 'Ya estás en una partida activa.' });
          return;
        }
        const user = await this.db.findUserById(socket.userId);
        if (!user) return;

        const cleanBet = sanitizeBetAmount(betMods);
        if (cleanBet > 0 && (Number(user.mods) || 0) < cleanBet) {
          socket.emit('queue:error', { error: `No tienes suficientes Mods para apostar ${cleanBet} Mods (tienes ${Number(user.mods) || 0}).` });
          return;
        }

        const cleanSpecial = sanitizeSpecialModeId(specialModeId);

        this.leaveSpectate(socket);
        this.removePrivateRoomBySocket(socket.id);
        this.removeFromQueueByUserId(user.id);
        const allowedMins = [1, 3, 5, 10, 15].includes(Number(timeMinutes)) ? Number(timeMinutes) : 10;
        this.queue.push({
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          elo: Number(user.elo) || 0,
          timeMinutes: allowedMins,
          betMods: cleanBet,
          specialModeId: cleanSpecial,
          joinedAt: Date.now()
        });

        socket.emit('queue:status', {
          inQueue: true,
          elo: Number(user.elo) || 0,
          timeMinutes: allowedMins,
          betMods: cleanBet,
          specialModeId: cleanSpecial,
          queueSize: this.queue.length
        });

        await this.processQueue();
      });

      socket.on('queue:leave', () => {
        this.removeFromQueue(socket.id);
        socket.emit('queue:status', { inQueue: false, queueSize: this.queue.length });
      });

      // === SALAS PRIVADAS (AJUSTES COMPLETOS DEL HOST + MODS DE CÓDIGO ABIERTO + APUESTA DE MODS) ===
      socket.on('private:create', async ({ timeMinutes = 10, betMods = 0, customMod = null, roomSettings = null, specialModeId = null } = {}) => {
        if (this.socketToMatch.has(socket.id)) {
          socket.emit('private:error', { error: 'Ya estás en una partida activa.' });
          return;
        }
        let normalizedMod = null;
        if (customMod) {
          const check = validateAndNormalizeMod(customMod);
          if (!check.ok) {
            socket.emit('private:error', { error: check.error });
            return;
          }
          normalizedMod = check.mod;
        }

        const row = await this.db.ensureFreshVipState(await this.db.findUserById(socket.userId));
        if (!row) return;

        const settings = sanitizeRoomSettings(
          { ...(roomSettings || {}), specialModeId: roomSettings?.specialModeId ?? specialModeId, timeMinutes: roomSettings?.timeMinutes ?? timeMinutes, betMods: roomSettings?.betMods ?? betMods },
          timeMinutes,
          betMods
        );
        const cleanBet = settings.betMods;
        if (cleanBet > 0 && (Number(row.mods) || 0) < cleanBet) {
          socket.emit('private:error', { error: `No tienes ${cleanBet} Mods para crear la sala con esa apuesta.` });
          return;
        }

        this.leaveSpectate(socket);
        this.removeFromQueue(socket.id);
        this.removePrivateRoomBySocket(socket.id);

        let code = generateRoomCode();
        while (this.privateRooms.has(code)) code = generateRoomCode();

        const entry = {
          code,
          hostSocketId: socket.id,
          hostUserId: row.id,
          hostProfile: this.db.formatPublicUser(row),
          timeMinutes: settings.timeMinutes,
          betMods: cleanBet,
          specialModeId: settings.specialModeId,
          roomSettings: settings,
          customMod: normalizedMod,
          createdAt: Date.now()
        };
        this.privateRooms.set(code, entry);

        socket.emit('private:created', {
          code,
          timeMinutes: settings.timeMinutes,
          betMods: cleanBet,
          specialModeId: settings.specialModeId,
          roomSettings: settings,
          customMod: normalizedMod
        });
      });

      socket.on('private:cancel', () => {
        this.removePrivateRoomBySocket(socket.id);
        socket.emit('private:closed', { ok: true });
      });

      socket.on('private:join', async ({ code = '' } = {}) => {
        if (this.socketToMatch.has(socket.id)) {
          socket.emit('private:error', { error: 'Ya estás en una partida activa.' });
          return;
        }
        const cleanCode = String(code || '').trim().toUpperCase();
        const waiting = this.privateRooms.get(cleanCode);
        if (!waiting) {
          socket.emit('private:error', { error: `No existe ninguna Sala Privada activa con código "${cleanCode}".` });
          return;
        }
        if (waiting.hostUserId === socket.userId) {
          socket.emit('private:error', { error: 'No puedes unirte a tu propia sala con la misma cuenta.' });
          return;
        }
        const guestRow = await this.db.findUserById(socket.userId);
        if (waiting.betMods > 0 && (Number(guestRow?.mods) || 0) < waiting.betMods) {
          socket.emit('private:error', {
            error: `Esta Sala Privada tiene apuesta de ${waiting.betMods} Mods (tienes ${Number(guestRow?.mods) || 0} Mods).`
          });
          return;
        }
        const hostSock = this.io.sockets.sockets.get(waiting.hostSocketId);
        if (!hostSock) {
          this.privateRooms.delete(cleanCode);
          socket.emit('private:error', { error: 'El anfitrión cerró la sala privada.' });
          return;
        }

        this.privateRooms.delete(cleanCode);
        this.leaveSpectate(socket);
        this.removeFromQueue(socket.id);

        await this.createMatch(
          { socketId: waiting.hostSocketId, userId: waiting.hostUserId, timeMinutes: waiting.timeMinutes, betMods: waiting.betMods },
          { socketId: socket.id, userId: socket.userId, timeMinutes: waiting.timeMinutes, betMods: waiting.betMods },
          {
            isPrivate: true,
            roomCode: cleanCode,
            customMod: waiting.customMod,
            betMods: waiting.betMods,
            specialModeId: waiting.specialModeId,
            roomSettings: waiting.roomSettings
          }
        );
      });

      // === MOVIMIENTO EN PARTIDA ===
      socket.on('match:move', ({ matchId, fr, fc, tr, tc, promoType = 'Q' } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) {
          socket.emit('match:error', { error: 'Partida no encontrada o ya finalizada.' });
          return;
        }

        const expectedColor = room.white.socketId === socket.id ? 'w'
          : (room.black.socketId === socket.id ? 'b' : null);

        if (!expectedColor) return socket.emit('match:error', { error: 'Solo los jugadores de la partida pueden mover piezas (modo espectador es solo lectura).' });
        if (room.engine.turn !== expectedColor) return socket.emit('match:error', { error: 'No es tu turno.' });

        const mover = room.engine.board[fr]?.[fc];
        if (isPieceFrozen(room.powerState, mover)) {
          return socket.emit('match:error', { error: '❄️ Esa pieza está congelada en dorado y no puede moverse.' });
        }
        if (isSquareBlockedByModState(room.powerState, tr, tc, expectedColor)) {
          return socket.emit('match:error', { error: 'Esa casilla está bloqueada por una Grieta o Ficha Grande 2×2.' });
        }

        const capturedBefore = room.engine.board[tr]?.[tc] ? { ...room.engine.board[tr][tc] } : null;
        const result = room.engine.validateAndExecuteMove(fr, fc, tr, tc, promoType, true);
        if (!result.ok) {
          if (this.antiCheat) {
            const spam = this.antiCheat.recordIllegalAction(room.id, socket.userId, result.error);
            if (spam) this.antiCheat.flagUser(socket.userId, socket.username, spam).catch(() => {});
          }
          return socket.emit('match:error', { error: result.error });
        }

        // Anti-Cheat en tiempo real: detectar velocidad inhumana o cadencia robótica de bots
        if (this.antiCheat) {
          const botFinding = this.antiCheat.recordOnlineMoveTiming(room.id, socket.userId);
          if (botFinding) {
            this.antiCheat.flagUser(socket.userId, socket.username, botFinding).then((acRes) => {
              if (acRes.autoSuspended) {
                this.disconnectUserById(socket.userId);
              }
            }).catch(() => {});
          }
        }

        if (capturedBefore) {
          applyMittensAssimilationIfActive(room.engine, room.powerState, expectedColor, fr, fc, capturedBefore);
        }

        tickPowerStateForSide(room.powerState, expectedColor);
        room.lastMoveAt = Date.now();
        this.io.to(room.id).emit('match:state', {
          matchId: room.id,
          state: room.engine.cloneState(),
          powerState: room.powerState,
          lastMove: { fr, fc, tr, tc, promoType, by: expectedColor },
          events: result.events
        });

        if (room.engine.winner) {
          this.finishMatch(room, room.engine.winner, room.engine.winReason);
        }
      });

      // === PODERES OFICIALES (PÚBLICAS) O MODS CUSTOM (SALAS PRIVADAS) ===
      socket.on('match:use_power', ({ matchId, fr, fc, tr, tc } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) {
          socket.emit('match:error', { error: 'Partida no encontrada o ya finalizada.' });
          return;
        }
        if (room.isPrivate && room.roomSettings && room.roomSettings.allowPowers === false) {
          return socket.emit('match:error', { error: 'El anfitrión desactivó los poderes en esta Sala Privada.' });
        }
        const expectedColor = room.white.socketId === socket.id ? 'w'
          : (room.black.socketId === socket.id ? 'b' : null);
        if (!expectedColor) return socket.emit('match:error', { error: 'No perteneces a esta partida.' });
        if (room.engine.turn !== expectedColor) return socket.emit('match:error', { error: 'No es tu turno.' });

        const playerObj = expectedColor === 'w' ? room.white : room.black;
        const powerDef = room.isPrivate && room.customMod?.power
          ? room.customMod.power
          : resolvePowerDef(playerObj.profile.equippedPowerId, null);

        if (!powerDef) {
          return socket.emit('match:error', { error: 'No tienes ningún poder equipado para esta partida.' });
        }
        if (powerDef.vipOnly && !playerObj.profile.isVip) {
          return socket.emit('match:error', { error: 'Este poder requiere suscripción Mod VIP activa.' });
        }

        const res = executeBattlePowerAction(room.engine, room.powerState, expectedColor, powerDef, { fr, fc, tr, tc });
        if (!res.ok) return socket.emit('match:error', { error: res.error });

        room.lastMoveAt = Date.now();
        this.io.to(room.id).emit('match:state', {
          matchId: room.id,
          state: room.engine.cloneState(),
          powerState: room.powerState,
          powerEvent: { ...res.events, by: expectedColor, sfx: res.sfx, logText: res.logText }
        });

        if (room.engine.winner) {
          this.finishMatch(room, room.engine.winner, room.engine.winReason);
        }
      });

      // === DESHACER EN SALA PRIVADA (SOLO SI EL ANFITRIÓN LO ACTIVÓ) ===
      socket.on('match:undo_private', ({ matchId } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) return;
        if (!room.isPrivate || !room.roomSettings?.allowUndo) {
          return socket.emit('match:error', { error: 'Deshacer solo está permitido en Salas Privadas cuando el host lo activa.' });
        }
        const expectedColor = room.white.socketId === socket.id ? 'w'
          : (room.black.socketId === socket.id ? 'b' : null);
        if (!expectedColor) return;
        if (typeof room.engine.undo !== 'function' || !room.engine.undo()) {
          return socket.emit('match:error', { error: 'No hay jugadas para deshacer.' });
        }
        room.lastMoveAt = Date.now();
        this.io.to(room.id).emit('match:state', {
          matchId: room.id,
          state: room.engine.cloneState(),
          powerState: room.powerState,
          events: { undoBy: expectedColor }
        });
      });

      socket.on('match:resign', ({ matchId } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) return;
        if (room.white.socketId === socket.id) {
          this.finishMatch(room, 'b', `${room.white.profile.username} se rindió.`);
        } else if (room.black.socketId === socket.id) {
          this.finishMatch(room, 'w', `${room.black.profile.username} se rindió.`);
        }
      });

      // Abandono voluntario en plena partida multijugador: -75 XP reales + registro para posible baneo
      socket.on('match:abandon', async ({ matchId } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) return;
        let winner = null;
        let quitterName = '';
        if (room.white.socketId === socket.id) {
          winner = 'b';
          quitterName = room.white.profile.username;
        } else if (room.black.socketId === socket.id) {
          winner = 'w';
          quitterName = room.black.profile.username;
        }
        if (!winner) return;
        const penalty = await this.db.penalizeMatchAbandon(socket.userId, room.id).catch(() => null);
        if (penalty) {
          socket.emit('match:abandon_applied', penalty);
        }
        await this.finishMatch(room, winner, `${quitterName} abandonó la partida multijugador (-75 XP).`);
      });

      socket.on('match:offer_draw', ({ matchId } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) return;
        const fromColor = room.white.socketId === socket.id ? 'w'
          : (room.black.socketId === socket.id ? 'b' : null);
        if (!fromColor) return;
        room.drawOfferBy = fromColor;
        const targetSocket = fromColor === 'w' ? room.black.socketId : room.white.socketId;
        this.io.to(targetSocket).emit('match:draw_offered', { matchId, by: fromColor });
      });

      socket.on('match:respond_draw', ({ matchId, accept } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished || !room.drawOfferBy) return;
        const responderColor = room.white.socketId === socket.id ? 'w'
          : (room.black.socketId === socket.id ? 'b' : null);
        if (!responderColor || responderColor === room.drawOfferBy) return;
        room.drawOfferBy = null;
        if (accept) this.finishMatch(room, 'draw', 'Tablas por mutuo acuerdo.');
        else this.io.to(room.id).emit('match:draw_declined', { matchId });
      });

      socket.on('disconnect', () => {
        const pEntry = this.onlineUsers.get(socket.userId);
        if (pEntry) {
          pEntry.sockets.delete(socket.id);
          if (pEntry.sockets.size === 0) this.onlineUsers.delete(socket.userId);
        }
        this.removeFromQueue(socket.id);
        this.removePrivateRoomBySocket(socket.id);
        this.leaveSpectate(socket);
        const matchId = this.socketToMatch.get(socket.id);
        if (matchId) {
          const room = this.matches.get(matchId);
          if (room && !room.finished) {
            const winner = room.white.socketId === socket.id ? 'b' : 'w';
            const quitter = room.white.socketId === socket.id ? room.white.profile.username : room.black.profile.username;
            this.finishMatch(room, winner, `${quitter} se desconectó de la partida.`);
          }
        }
        this.broadcastPresenceUpdate(socket.userId);
      });
    });
  }

  leaveSpectate(socket) {
    const prevMatchId = this.socketToSpectate.get(socket.id);
    if (!prevMatchId) return;
    this.socketToSpectate.delete(socket.id);
    socket.leave(prevMatchId);
    const room = this.matches.get(prevMatchId);
    if (room) {
      room.spectators.delete(socket.id);
      this.io.to(room.id).emit('match:spectators', { matchId: room.id, count: room.spectators.size });
      this.broadcastLiveMatches();
    }
  }

  removePrivateRoomBySocket(socketId) {
    for (const [code, entry] of this.privateRooms.entries()) {
      if (entry.hostSocketId === socketId) this.privateRooms.delete(code);
    }
  }

  removeFromQueue(socketId) {
    this.queue = this.queue.filter((q) => q.socketId !== socketId);
  }

  removeFromQueueByUserId(userId) {
    this.queue = this.queue.filter((q) => q.userId !== userId);
  }

  async processQueue() {
    if (this.queue.length < 2) return;
    const now = Date.now();
    const matchedIndices = new Set();
    const pairs = [];

    for (let i = 0; i < this.queue.length; i++) {
      if (matchedIndices.has(i)) continue;
      const a = this.queue[i];
      const waitSecA = (now - a.joinedAt) / 1000;
      const rangeA = 100 + Math.floor(waitSecA / 2.5) * 50;

      let bestIdx = -1;
      let bestDiff = Infinity;

      for (let j = i + 1; j < this.queue.length; j++) {
        if (matchedIndices.has(j)) continue;
        const b = this.queue[j];
        if (a.userId === b.userId) continue;
        if (a.timeMinutes !== b.timeMinutes) continue;
        if ((a.betMods || 0) !== (b.betMods || 0)) continue;
        if ((a.specialModeId || null) !== (b.specialModeId || null)) continue;

        const waitSecB = (now - b.joinedAt) / 1000;
        const rangeB = 100 + Math.floor(waitSecB / 2.5) * 50;
        const allowedDiff = Math.max(rangeA, rangeB);
        const diff = Math.abs(a.elo - b.elo);

        if (diff <= allowedDiff && diff < bestDiff) {
          bestDiff = diff;
          bestIdx = j;
        }
      }

      if (bestIdx !== -1) {
        matchedIndices.add(i);
        matchedIndices.add(bestIdx);
        pairs.push([a, this.queue[bestIdx]]);
      }
    }

    if (matchedIndices.size > 0) {
      this.queue = this.queue.filter((_, idx) => !matchedIndices.has(idx));
      for (const [entryA, entryB] of pairs) {
        await this.createMatch(entryA, entryB, {
          isPrivate: false,
          betMods: entryA.betMods || 0,
          specialModeId: entryA.specialModeId || null
        });
      }
    }
  }

  async createMatch(entryA, entryB, { isPrivate = false, roomCode = null, customMod = null, betMods = 0, specialModeId = null, roomSettings = null } = {}) {
    const sockA = this.io.sockets.sockets.get(entryA.socketId);
    const sockB = this.io.sockets.sockets.get(entryB.socketId);
    if (!sockA || !sockB) return;

    const flip = isPrivate ? false : (Math.random() < 0.5);
    const whiteEntry = flip ? entryB : entryA;
    const blackEntry = flip ? entryA : entryB;
    const whiteSock = flip ? sockB : sockA;
    const blackSock = flip ? sockA : sockB;

    const whiteRow = await this.db.ensureFreshVipState(await this.db.findUserById(whiteEntry.userId));
    const blackRow = await this.db.ensureFreshVipState(await this.db.findUserById(blackEntry.userId));
    if (!whiteRow || !blackRow) return;

    // Retener apuesta (escrow) de ambos jugadores si betMods > 0
    let activeBet = sanitizeBetAmount(betMods);
    if (activeBet > 0) {
      if ((Number(whiteRow.mods) || 0) < activeBet || (Number(blackRow.mods) || 0) < activeBet) {
        whiteSock.emit('queue:error', { error: 'Uno de los jugadores ya no tiene suficientes Mods para cubrir la apuesta.' });
        blackSock.emit('queue:error', { error: 'Uno de los jugadores ya no tiene suficientes Mods para cubrir la apuesta.' });
        return;
      }
      await this.db.addMods(whiteEntry.userId, -activeBet);
      await this.db.addMods(blackEntry.userId, -activeBet);
    }
    const betPot = activeBet * 2;

    const freshWhite = await this.db.findUserById(whiteEntry.userId);
    const freshBlack = await this.db.findUserById(blackEntry.userId);
    const whiteProfile = this.db.formatPublicUser(freshWhite);
    const blackProfile = this.db.formatPublicUser(freshBlack);

    const effectiveSpecialId = sanitizeSpecialModeId(roomSettings?.specialModeId ?? specialModeId);
    const effectiveSettings = isPrivate
      ? sanitizeRoomSettings(roomSettings || { specialModeId: effectiveSpecialId, timeMinutes: whiteEntry.timeMinutes, betMods: activeBet }, whiteEntry.timeMinutes, activeBet)
      : { specialModeId: effectiveSpecialId, timeMinutes: whiteEntry.timeMinutes, allowPowers: true, allowHints: false, allowUndo: false, betMods: activeBet };

    const matchId = `${isPrivate ? 'priv' : 'room'}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    let engine;
    if (isPrivate && customMod?.gameMode && !effectiveSpecialId) {
      const gm = customMod.gameMode;
      engine = (gm.boardSize === 12 || gm.boardSize === 10 || gm.atomicMode)
        ? new LargeBoardChessEngine(gm.boardSize || 8, effectiveSettings.timeMinutes, { atomicMode: Boolean(gm.atomicMode) })
        : new ClassicChessEngine(effectiveSettings.timeMinutes);
      applyCustomModSetupToEngine(engine, customMod);
    } else {
      engine = createEngineForMode(effectiveSpecialId, effectiveSettings.timeMinutes);
      if (isPrivate && customMod && !effectiveSpecialId) {
        applyCustomModSetupToEngine(engine, customMod);
      }
    }

    const powerState = createInitialPowerState();
    const specialDef = SPECIAL_GAME_MODES.find((m) => m.id === effectiveSpecialId);
    const modeTag = specialDef ? ` · ${specialDef.icon} ${specialDef.name}` : '';
    const betStr = activeBet > 0 ? ` · 🪙 Bote en juego: ${betPot} Mods` : '';
    engine.logs = [{
      turn: 0,
      type: 'special',
      text: isPrivate
        ? `Sala Privada ${roomCode || ''} iniciada${modeTag}${customMod ? ` · Mod «${customMod.name}»` : ''}: ${whiteProfile.username} vs ${blackProfile.username}${betStr}.`
        : `Partida Pública Oficial iniciada${modeTag}: ${whiteProfile.username} (${whiteProfile.elo} Elo) vs ${blackProfile.username} (${blackProfile.elo} Elo)${betStr}.`
    }];

    const room = {
      id: matchId,
      isPrivate,
      roomCode,
      specialModeId: effectiveSpecialId,
      roomSettings: effectiveSettings,
      customMod: isPrivate ? customMod : null,
      timeMinutes: effectiveSettings.timeMinutes,
      betMods: activeBet,
      betPot,
      spectators: new Set(),
      engine,
      powerState,
      white: { socketId: whiteSock.id, userId: whiteEntry.userId, profile: whiteProfile },
      black: { socketId: blackSock.id, userId: blackEntry.userId, profile: blackProfile },
      createdAt: Date.now(),
      lastMoveAt: Date.now(),
      drawOfferBy: null,
      finished: false
    };

    this.matches.set(matchId, room);
    this.socketToMatch.set(whiteSock.id, matchId);
    this.socketToMatch.set(blackSock.id, matchId);

    whiteSock.join(matchId);
    blackSock.join(matchId);

    const basePayload = {
      matchId,
      isPrivate,
      roomCode,
      specialModeId: effectiveSpecialId,
      roomSettings: effectiveSettings,
      customMod: room.customMod,
      betMods: activeBet,
      betPot,
      timeMinutes: effectiveSettings.timeMinutes,
      white: whiteProfile,
      black: blackProfile,
      state: engine.cloneState(),
      powerState
    };

    whiteSock.emit('match:found', { ...basePayload, yourColor: 'w', opponent: blackProfile });
    blackSock.emit('match:found', { ...basePayload, yourColor: 'b', opponent: whiteProfile });
    this.broadcastPresenceUpdate(whiteEntry.userId);
    this.broadcastPresenceUpdate(blackEntry.userId);
    this.broadcastLiveMatches();
  }

  tickClocks() {
    for (const room of this.matches.values()) {
      if (room.finished || room.engine.winner) continue;
      const side = room.engine.turn;
      if (room.engine.clocks[side] === null) continue;
      room.engine.clocks[side] = Math.max(0, room.engine.clocks[side] - 1);
      this.io.to(room.id).emit('match:clock', {
        matchId: room.id,
        clocks: room.engine.clocks,
        turn: room.engine.turn
      });
      if (room.engine.clocks[side] <= 0) {
        const winner = side === 'w' ? 'b' : 'w';
        const loserName = side === 'w' ? room.white.profile.username : room.black.profile.username;
        this.finishMatch(room, winner, `Se agotó el tiempo de ${loserName}.`);
      }
    }
  }

  async finishMatch(room, winner, reason) {
    if (room.finished) return;
    room.finished = true;
    room.engine.winner = winner;
    room.engine.winReason = reason;

    try {
      // Liquidación de Apuesta de Mods (escrow): ganador se lleva todo el bote; tablas reembolsa a ambos
      let whiteBetNet = 0;
      let blackBetNet = 0;
      if (room.betMods > 0) {
        if (winner === 'w') {
          await this.db.addMods(room.white.userId, room.betPot);
          whiteBetNet = room.betMods;
          blackBetNet = -room.betMods;
        } else if (winner === 'b') {
          await this.db.addMods(room.black.userId, room.betPot);
          whiteBetNet = -room.betMods;
          blackBetNet = room.betMods;
        } else {
          await this.db.addMods(room.white.userId, room.betMods);
          await this.db.addMods(room.black.userId, room.betMods);
        }
      }

      const wRow = await this.db.findUserById(room.white.userId);
      const bRow = await this.db.findUserById(room.black.userId);

      const eloUpdate = room.isPrivate
        ? {
          whiteBefore: Number(wRow.elo) || 0,
          whiteAfter: Number(wRow.elo) || 0,
          whiteDelta: 0,
          blackBefore: Number(bRow.elo) || 0,
          blackAfter: Number(bRow.elo) || 0,
          blackDelta: 0
        }
        : calculateEloUpdate(wRow.elo, bRow.elo, winner, {
          whiteGames: Number(wRow.games_played) || 0,
          blackGames: Number(bRow.games_played) || 0
        });

      const saved = await this.db.recordOnlineMatch({
        whiteUserId: room.white.userId,
        blackUserId: room.black.userId,
        winner,
        resultReason: room.isPrivate ? `[Sala Privada] ${reason}` : reason,
        eloResult: eloUpdate,
        turns: room.engine.turnNumber
      });

      this.io.to(room.id).emit('match:ended', {
        matchId: room.id,
        isPrivate: room.isPrivate,
        betMods: room.betMods || 0,
        betPot: room.betPot || 0,
        whiteBetNet,
        blackBetNet,
        winner,
        reason,
        eloUpdate,
        whiteProfile: saved.whiteProfile,
        blackProfile: saved.blackProfile,
        whiteXpGained: saved.whiteXpGained,
        blackXpGained: saved.blackXpGained,
        whiteModsGained: saved.whiteModsGained,
        blackModsGained: saved.blackModsGained,
        state: room.engine.cloneState(),
        powerState: room.powerState
      });
    } finally {
      for (const specSockId of room.spectators) {
        this.socketToSpectate.delete(specSockId);
        const s = this.io.sockets.sockets.get(specSockId);
        if (s) s.leave(room.id);
      }
      this.socketToMatch.delete(room.white.socketId);
      this.socketToMatch.delete(room.black.socketId);
      this.matches.delete(room.id);
      this.broadcastPresenceUpdate(room.white.userId);
      this.broadcastPresenceUpdate(room.black.userId);
      this.broadcastLiveMatches();
    }
  }
}
