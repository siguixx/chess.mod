import crypto from 'node:crypto';
import { ClassicChessEngine } from '../../shared/rules/classicEngine.js';
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

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

export class MultiplayerManager {
  constructor(io, db) {
    this.io = io;
    this.db = db;
    this.queue = [];
    this.matches = new Map();
    this.socketToMatch = new Map();
    this.privateRooms = new Map(); // code -> { code, hostSocketId, hostUserId, hostProfile, timeMinutes, customMod, createdAt }

    this.setupSocketAuth();
    this.setupHandlers();

    this.matchmakingTimer = setInterval(() => this.processQueue().catch(() => {}), 1000);
    this.clockTimer = setInterval(() => this.tickClocks(), 1000);
  }

  destroy() {
    clearInterval(this.matchmakingTimer);
    clearInterval(this.clockTimer);
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
      socket.emit('online:stats', {
        onlineCount: this.io.sockets.sockets.size,
        queueCount: this.queue.length
      });

      // === COLA PÚBLICA (SOLO PODERES OFICIALES DEL JUEGO — NUNCA MODS CUSTOM) ===
      socket.on('queue:join', async ({ timeMinutes = 10, customMod = null } = {}) => {
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

        this.removePrivateRoomBySocket(socket.id);
        this.removeFromQueueByUserId(user.id);
        const allowedMins = [1, 3, 5, 10, 15].includes(Number(timeMinutes)) ? Number(timeMinutes) : 10;
        this.queue.push({
          socketId: socket.id,
          userId: user.id,
          username: user.username,
          elo: Number(user.elo) || 0,
          timeMinutes: allowedMins,
          joinedAt: Date.now()
        });

        socket.emit('queue:status', {
          inQueue: true,
          elo: Number(user.elo) || 0,
          timeMinutes: allowedMins,
          queueSize: this.queue.length
        });

        await this.processQueue();
      });

      socket.on('queue:leave', () => {
        this.removeFromQueue(socket.id);
        socket.emit('queue:status', { inQueue: false, queueSize: this.queue.length });
      });

      // === SALAS PRIVADAS (PERMITEN MODS DE CÓDIGO ABIERTO CREADOS O IMPORTADOS) ===
      socket.on('private:create', async ({ timeMinutes = 10, customMod = null } = {}) => {
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

        this.removeFromQueue(socket.id);
        this.removePrivateRoomBySocket(socket.id);

        const row = await this.db.ensureFreshVipState(await this.db.findUserById(socket.userId));
        if (!row) return;
        const allowedMins = [1, 3, 5, 10, 15].includes(Number(timeMinutes)) ? Number(timeMinutes) : 10;

        let code = generateRoomCode();
        while (this.privateRooms.has(code)) code = generateRoomCode();

        const entry = {
          code,
          hostSocketId: socket.id,
          hostUserId: row.id,
          hostProfile: this.db.formatPublicUser(row),
          timeMinutes: allowedMins,
          customMod: normalizedMod,
          createdAt: Date.now()
        };
        this.privateRooms.set(code, entry);

        socket.emit('private:created', {
          code,
          timeMinutes: allowedMins,
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
        const hostSock = this.io.sockets.sockets.get(waiting.hostSocketId);
        if (!hostSock) {
          this.privateRooms.delete(cleanCode);
          socket.emit('private:error', { error: 'El anfitrión cerró la sala privada.' });
          return;
        }

        this.privateRooms.delete(cleanCode);
        this.removeFromQueue(socket.id);

        await this.createMatch(
          { socketId: waiting.hostSocketId, userId: waiting.hostUserId, timeMinutes: waiting.timeMinutes },
          { socketId: socket.id, userId: socket.userId, timeMinutes: waiting.timeMinutes },
          { isPrivate: true, roomCode: cleanCode, customMod: waiting.customMod }
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

        if (!expectedColor) return socket.emit('match:error', { error: 'No perteneces a esta partida.' });
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
        if (!result.ok) return socket.emit('match:error', { error: result.error });

        // Asimilación 1:1 de Free Mittens si el jugador tiene el buff activo
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

      // === EJECUCIÓN DE PODERES OFICIALES (PÚBLICAS) O MODS CUSTOM (SALAS PRIVADAS) ===
      socket.on('match:use_power', ({ matchId, fr, fc, tr, tc } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) {
          socket.emit('match:error', { error: 'Partida no encontrada o ya finalizada.' });
          return;
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

      socket.on('match:resign', ({ matchId } = {}) => {
        const room = this.matches.get(matchId);
        if (!room || room.finished) return;
        if (room.white.socketId === socket.id) {
          this.finishMatch(room, 'b', `${room.white.profile.username} se rindió.`);
        } else if (room.black.socketId === socket.id) {
          this.finishMatch(room, 'w', `${room.black.profile.username} se rindió.`);
        }
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
        this.removeFromQueue(socket.id);
        this.removePrivateRoomBySocket(socket.id);
        const matchId = this.socketToMatch.get(socket.id);
        if (matchId) {
          const room = this.matches.get(matchId);
          if (room && !room.finished) {
            const winner = room.white.socketId === socket.id ? 'b' : 'w';
            const quitter = room.white.socketId === socket.id ? room.white.profile.username : room.black.profile.username;
            this.finishMatch(room, winner, `${quitter} se desconectó de la partida.`);
          }
        }
      });
    });
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
        await this.createMatch(entryA, entryB, { isPrivate: false });
      }
    }
  }

  async createMatch(entryA, entryB, { isPrivate = false, roomCode = null, customMod = null } = {}) {
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
    const whiteProfile = this.db.formatPublicUser(whiteRow);
    const blackProfile = this.db.formatPublicUser(blackRow);

    const matchId = `${isPrivate ? 'priv' : 'room'}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`;
    const engine = new ClassicChessEngine(whiteEntry.timeMinutes);
    if (isPrivate && customMod) {
      applyCustomModSetupToEngine(engine, customMod);
    }

    const powerState = createInitialPowerState();
    engine.logs = [{
      turn: 0,
      type: 'special',
      text: isPrivate
        ? `Sala Privada ${roomCode || ''} iniciada${customMod ? ` con Mod Abierto «${customMod.name}»` : ''}: ${whiteProfile.username} vs ${blackProfile.username}.`
        : `Partida Pública Oficial iniciada: ${whiteProfile.username} (${whiteProfile.elo} Elo) vs ${blackProfile.username} (${blackProfile.elo} Elo). Poderes oficiales activos.`
    }];

    const room = {
      id: matchId,
      isPrivate,
      roomCode,
      customMod: isPrivate ? customMod : null,
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
      customMod: room.customMod,
      timeMinutes: whiteEntry.timeMinutes,
      white: whiteProfile,
      black: blackProfile,
      state: engine.cloneState(),
      powerState
    };

    whiteSock.emit('match:found', { ...basePayload, yourColor: 'w', opponent: blackProfile });
    blackSock.emit('match:found', { ...basePayload, yourColor: 'b', opponent: whiteProfile });
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
      const wRow = await this.db.findUserById(room.white.userId);
      const bRow = await this.db.findUserById(room.black.userId);

      // Las Salas Privadas con Mods NO alteran el Elo competitivo público (para proteger el Ranking Global)
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
      this.socketToMatch.delete(room.white.socketId);
      this.socketToMatch.delete(room.black.socketId);
      this.matches.delete(room.id);
    }
  }
}
