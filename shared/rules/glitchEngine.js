import { PIECE_NAMES, toAlg, inBounds } from '../config/constants.js';

/**
 * Motor del Capítulo 04 — BOSS GLITCH (5 Niveles · Súper Difícil)
 *
 * Mecánicas de Corrupción de CHESS.MOD:
 * - Rasgado del Tablero: cada `riftInterval` turnos se rasgan 2 a 4 casillas vacías creando
 *   Grietas de Vacío (`rifts`). Ninguna pieza puede entrar ni cruzar una grieta mientras dure.
 * - Ruptura de leyes del ajedrez (telegrafiadas y válidas sin romper invariantes):
 *   - anomalyLevel >= 1: Peones corruptos pueden atacar recto hacia adelante 1 casilla o retroceder 1 casilla vacía.
 *   - anomalyLevel >= 2: Caballos corruptos pueden ejecutar salto largo anómalo (±3,±1 o ±1,±3).
 *   - anomalyLevel >= 3: En fase de furia (o cada 4 turnos), puede intercambiar 2 piezas negras no-Rey.
 */
export class GlitchEngine {
  constructor(levelId = 5, minutes = 10) {
    this.mode = 'glitch';
    this.levelId = Math.max(1, Math.min(5, Number(levelId) || 5));
    this.timePresetMinutes = minutes;
    this.reset(this.levelId, minutes);
  }

  reset(levelId = this.levelId, minutes = this.timePresetMinutes) {
    this.levelId = Math.max(1, Math.min(5, Number(levelId) || 5));
    this.timePresetMinutes = minutes;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { id: `xB_${c}`, color: 'b', type: back[c], hasMoved: false };
      this.board[1][c] = { id: `xP_${c}`, color: 'b', type: 'P', hasMoved: false };
      this.board[7][c] = { id: `wB_${c}`, color: 'w', type: back[c], hasMoved: false };
      this.board[6][c] = { id: `wP_${c}`, color: 'w', type: 'P', hasMoved: false };
    }
    if (this.levelId === 1) {
      this.board[1][7] = null; // Pequeña ventaja inicial en Nivel 1
    }
    // 2 Barreras Cortafuegos inmortales del jugador (c3, f3): sellan Grietas al pisarlas y bloquean ataques anómalos adyacentes
    this.board[5][2] = { id: 'wU1', color: 'w', type: 'U' };
    this.board[5][5] = { id: 'wU2', color: 'w', type: 'U' };

    const cfg = {
      1: { riftInterval: 5, anomalyLevel: 0, riftCount: 2 },
      2: { riftInterval: 5, anomalyLevel: 1, riftCount: 2 },
      3: { riftInterval: 4, anomalyLevel: 2, riftCount: 2 },
      4: { riftInterval: 4, anomalyLevel: 3, riftCount: 3 },
      5: { riftInterval: 3, anomalyLevel: 4, riftCount: 3 }
    }[this.levelId];

    this.riftInterval = cfg.riftInterval;
    this.anomalyLevel = cfg.anomalyLevel;
    this.riftCount = cfg.riftCount;
    this.rifts = []; // [{ r, c, turnsLeft }]
    this.turnsSinceRift = 0;
    this.swapCooldown = 4;

    this.enPassantTarget = null;
    this.turn = 'w';
    this.turnNumber = 1;
    this.winner = null;
    this.winReason = '';
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.clocks = minutes > 0 ? { w: minutes * 60, b: minutes * 60 } : { w: null, b: null };
    this.logs = [{
      turn: 0,
      type: 'special',
      text: `ERR_CHESS.MOD — Nivel ${this.levelId} Glitch: Grietas cada ${this.riftInterval} turnos${this.anomalyLevel > 0 ? ' + Anomalías' : ''}. Tus 2 Cortafuegos (c3, f3) sellan Grietas al pisarlas y bloquean ataques anómalos adyacentes.`
    }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      levelId: this.levelId,
      riftInterval: this.riftInterval,
      anomalyLevel: this.anomalyLevel,
      riftCount: this.riftCount,
      rifts: this.rifts,
      turnsSinceRift: this.turnsSinceRift,
      swapCooldown: this.swapCooldown,
      board: this.board,
      enPassantTarget: this.enPassantTarget,
      turn: this.turn,
      turnNumber: this.turnNumber,
      winner: this.winner,
      winReason: this.winReason,
      lastMoveSquares: this.lastMoveSquares,
      capturedByWhite: this.capturedByWhite,
      capturedByBlack: this.capturedByBlack,
      clocks: this.clocks,
      timePresetMinutes: this.timePresetMinutes,
      logs: this.logs
    }));
  }

  loadState(s) {
    this.levelId = s.levelId || 5;
    this.riftInterval = s.riftInterval || 2;
    this.anomalyLevel = s.anomalyLevel || 0;
    this.riftCount = s.riftCount || 2;
    this.rifts = s.rifts || [];
    this.turnsSinceRift = s.turnsSinceRift || 0;
    this.swapCooldown = s.swapCooldown ?? 3;
    this.board = s.board;
    this.enPassantTarget = s.enPassantTarget || null;
    this.turn = s.turn;
    this.turnNumber = s.turnNumber;
    this.winner = s.winner || null;
    this.winReason = s.winReason || '';
    this.lastMoveSquares = s.lastMoveSquares || [];
    this.capturedByWhite = s.capturedByWhite || [];
    this.capturedByBlack = s.capturedByBlack || [];
    this.clocks = s.clocks || { w: null, b: null };
    this.timePresetMinutes = s.timePresetMinutes ?? 10;
    this.logs = s.logs || [];
  }

  pushHistory() {
    this.history.push(this.cloneState());
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    if (this.history.length === 0) return false;
    this.loadState(this.history.pop());
    return true;
  }

  isRift(r, c) {
    return this.rifts.some((rf) => rf.r === r && rf.c === c);
  }

  /**
   * Barrera Cortafuegos ('U'): protege piezas blancas adyacentes contra ataques ANÓMALOS del Boss Glitch
   * (peón frontal corrupto y salto largo de caballo) y sella Grietas de Vacío al pisarlas.
   */
  isProtectedByBarrier(r, c) {
    const p = this.board[r]?.[c];
    if (!p || p.color !== 'w' || p.type === 'U') return false;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && this.board[nr][nc]?.color === 'w' && this.board[nr][nc]?.type === 'U') {
        return true;
      }
    }
    return false;
  }

  getProtectedWhiteSquares() {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.isProtectedByBarrier(r, c)) set.add(`${r},${c}`);
      }
    }
    return set;
  }

  tearBoardRifts(count = this.riftCount) {
    const emptySquares = [];
    for (let r = 2; r <= 5; r++) {
      for (let c = 0; c < 8; c++) {
        if (!this.board[r][c] && !this.isRift(r, c)) emptySquares.push({ r, c });
      }
    }
    const created = [];
    const targetCount = Math.min(count, emptySquares.length);
    for (let i = 0; i < targetCount; i++) {
      const idx = Math.floor(Math.random() * emptySquares.length);
      const chosen = emptySquares.splice(idx, 1)[0];
      this.rifts.push({ r: chosen.r, c: chosen.c, turnsLeft: 3 });
      created.push(chosen);
    }
    return created;
  }

  countPieces(color) {
    let n = 0;
    for (let r = 0; r < 8; r++) for (let c = 0; c < 8; c++) if (this.board[r][c]?.color === color) n++;
    return n;
  }

  findKing(color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === color && p.type === 'K') return { r, c };
      }
    }
    return null;
  }

  getPseudoMoves(r, c, includeCastling = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];

    // BARRERA CORTAFUEGOS ('U'): 1 casilla ortogonal a casilla vacía o Grieta de Vacío (para sellarla)
    if (p.type === 'U') {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !this.board[nr][nc]) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc, sealsRift: this.isRift(nr, nc) });
        }
      }
      return moves;
    }

    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      const nr = r + dir;
      if (inBounds(nr, c) && !this.isRift(nr, c)) {
        if (!this.board[nr][c]) {
          moves.push({ fr: r, fc: c, tr: nr, tc: c });
          const nr2 = r + dir * 2;
          if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !this.board[nr2][c] && !this.isRift(nr2, c)) {
            moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
          }
        } else if (
          p.color === 'b'
          && this.anomalyLevel >= 1
          && this.board[nr][c].color === 'w'
          && this.board[nr][c].type !== 'U'
          && !this.isProtectedByBarrier(nr, c)
        ) {
          // ANOMALÍA GLITCH: Peón corrupto puede atacar recto hacia adelante (bloqueado por Cortafuegos)
          moves.push({ fr: r, fc: c, tr: nr, tc: c, isAnomaly: true, anomalyLabel: 'Ataque frontal corrupto' });
        }
      }
      // ANOMALÍA GLITCH: Peón corrupto puede retroceder 1 casilla vacía
      if (p.color === 'b' && this.anomalyLevel >= 1) {
        const backR = r - 1;
        if (inBounds(backR, c) && !this.board[backR][c] && !this.isRift(backR, c)) {
          moves.push({ fr: r, fc: c, tr: backR, tc: c, isAnomaly: true, anomalyLabel: 'Retroceso anómalo' });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (inBounds(nr, tc) && !this.isRift(nr, tc)) {
          const target = this.board[nr][tc];
          if (target && target.color !== p.color && target.type !== 'U') {
            moves.push({ fr: r, fc: c, tr: nr, tc });
          } else if (this.enPassantTarget && this.enPassantTarget.r === nr && this.enPassantTarget.c === tc) {
            const epPawn = this.board[r][tc];
            if (epPawn && epPawn.color !== p.color && epPawn.type === 'P') {
              moves.push({ fr: r, fc: c, tr: nr, tc, isEnPassant: true });
            }
          }
        }
      }
    } else if (p.type === 'N') {
      const jumps = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
      for (const [dr, dc] of jumps) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc) || this.isRift(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target || (target.color !== p.color && target.type !== 'U')) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
      if (p.color === 'b' && this.anomalyLevel >= 2) {
        // ANOMALÍA GLITCH: Caballo corrupto enlaza salto extendido (3,1) (bloqueado por Cortafuegos en piezas adyacentes)
        for (const [dr, dc] of [[3, -1], [3, 1], [1, -3], [1, 3], [-1, -3], [-1, 3]]) {
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc) || this.isRift(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || (target.color !== p.color && target.type !== 'U' && !this.isProtectedByBarrier(nr, nc))) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc, isAnomaly: true, anomalyLabel: 'Salto corrupto extendido' });
          }
        }
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc) || this.isRift(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || (target.color !== p.color && target.type !== 'U')) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      if (includeCastling && !p.hasMoved && c === 4 && (r === 7 || r === 0)) {
        const oppAttacks = this.getSquaresAttackedBy(p.color === 'w' ? 'b' : 'w');
        if (!oppAttacks.has(`${r},4`)) {
          const rK = this.board[r][7];
          if (rK && rK.color === p.color && rK.type === 'R' && !rK.hasMoved
              && !this.board[r][5] && !this.board[r][6]
              && !this.isRift(r, 5) && !this.isRift(r, 6)
              && !oppAttacks.has(`${r},5`) && !oppAttacks.has(`${r},6`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
          }
          const rQ = this.board[r][0];
          if (rQ && rQ.color === p.color && rQ.type === 'R' && !rQ.hasMoved
              && !this.board[r][1] && !this.board[r][2] && !this.board[r][3]
              && !this.isRift(r, 1) && !this.isRift(r, 2) && !this.isRift(r, 3)
              && !oppAttacks.has(`${r},3`) && !oppAttacks.has(`${r},2`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 2, isCastle: 'Q' });
          }
        }
      }
    } else {
      const dirs = p.type === 'R' ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : p.type === 'B' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr, nc = c + dc;
        while (inBounds(nr, nc)) {
          if (this.isRift(nr, nc)) break; // Grieta bloquea totalmente el paso
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (target.color !== p.color && target.type !== 'U') moves.push({ fr: r, fc: c, tr: nr, tc: nc });
            break;
          }
          nr += dr; nc += dc;
        }
      }
    }
    return moves;
  }

  getFurySwapMoves() {
    if (this.anomalyLevel < 3 || this.swapCooldown > 0) return [];
    const blacks = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === 'b' && p.type !== 'K') blacks.push({ r, c, type: p.type });
      }
    }
    const swaps = [];
    for (let i = 0; i < blacks.length && swaps.length < 12; i++) {
      for (let j = i + 1; j < blacks.length && swaps.length < 12; j++) {
        if (blacks[i].type === blacks[j].type) continue;
        const m = { fr: blacks[i].r, fc: blacks[i].c, tr: blacks[j].r, tc: blacks[j].c, isFurySwap: true, isAnomaly: true };
        if (this.isMoveSafeForKing('b', m)) swaps.push(m);
      }
    }
    return swaps;
  }

  getSquaresAttackedBy(color) {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== color || p.type === 'U') continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) {
            if (inBounds(nr, c + dc) && !this.isRift(nr, c + dc)) set.add(`${nr},${c + dc}`);
          }
          if (color === 'b' && this.anomalyLevel >= 1 && inBounds(nr, c) && !this.isRift(nr, c) && !this.isProtectedByBarrier(nr, c)) {
            set.add(`${nr},${c}`);
          }
        } else {
          for (const m of this.getPseudoMoves(r, c, false)) set.add(`${m.tr},${m.tc}`);
        }
      }
    }
    return set;
  }

  isKingInCheck(color) {
    const k = this.findKing(color);
    if (!k) return true;
    return this.getSquaresAttackedBy(color === 'w' ? 'b' : 'w').has(`${k.r},${k.c}`);
  }

  isMoveSafeForKing(color, move) {
    const savedBoard = this.board.map((row) => row.slice());
    const savedEP = this.enPassantTarget;
    if (move.isFurySwap) {
      const a = this.board[move.fr][move.fc];
      const b = this.board[move.tr][move.tc];
      this.board[move.fr][move.fc] = b;
      this.board[move.tr][move.tc] = a;
    } else {
      const piece = this.board[move.fr][move.fc];
      this.board[move.tr][move.tc] = piece;
      this.board[move.fr][move.fc] = null;
      if (move.isEnPassant) this.board[move.fr][move.tc] = null;
      if (move.isCastle === 'K') {
        this.board[move.fr][5] = this.board[move.fr][7];
        this.board[move.fr][7] = null;
      } else if (move.isCastle === 'Q') {
        this.board[move.fr][3] = this.board[move.fr][0];
        this.board[move.fr][0] = null;
      }
    }
    const safe = !this.isKingInCheck(color);
    this.board = savedBoard;
    this.enPassantTarget = savedEP;
    return safe;
  }

  getLegalMovesForPiece(r, c) {
    const p = this.board[r][c];
    if (!p) return [];
    return this.getPseudoMoves(r, c, true).filter((m) => {
      const tgt = m.isEnPassant ? this.board[m.fr][m.tc] : this.board[m.tr][m.tc];
      if (tgt && tgt.type === 'K') return false;
      return this.isMoveSafeForKing(p.color, m);
    });
  }

  getAllLegalMoves(color) {
    const moves = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.board[r][c]?.color === color) moves.push(...this.getLegalMovesForPiece(r, c));
      }
    }
    if (color === 'b') moves.push(...this.getFurySwapMoves());
    return moves;
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const actingColor = this.turn;
    const events = {
      color: actingColor,
      captured: null,
      isAnomaly: Boolean(move.isAnomaly),
      isFurySwap: Boolean(move.isFurySwap),
      riftSealed: false,
      riftsCreated: [],
      to: [move.tr, move.tc]
    };

    if (move.isFurySwap) {
      const a = this.board[move.fr][move.fc];
      const b = this.board[move.tr][move.tc];
      this.board[move.fr][move.fc] = b;
      this.board[move.tr][move.tc] = a;
      this.swapCooldown = 5;
      this.enPassantTarget = null;
      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      if (recordHistory) {
        this.logs.unshift({
          turn: this.turnNumber,
          type: 'special',
          text: `⚡ FURIA GLITCH: Permutación súbita entre ${PIECE_NAMES[a.type]} (${toAlg(move.fr, move.fc)}) y ${PIECE_NAMES[b.type]} (${toAlg(move.tr, move.tc)}).`
        });
      }
    } else {
      const piece = this.board[move.fr][move.fc];
      const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];
      this.board[move.tr][move.tc] = piece;
      this.board[move.fr][move.fc] = null;
      piece.hasMoved = true;

      if (piece.type === 'U' && this.isRift(move.tr, move.tc)) {
        this.rifts = this.rifts.filter((rf) => !(rf.r === move.tr && rf.c === move.tc));
        events.riftSealed = true;
      }

      if (move.isEnPassant) this.board[move.fr][move.tc] = null;
      if (move.isCastle === 'K') {
        this.board[move.fr][5] = this.board[move.fr][7];
        this.board[move.fr][7] = null;
        if (this.board[move.fr][5]) this.board[move.fr][5].hasMoved = true;
      } else if (move.isCastle === 'Q') {
        this.board[move.fr][3] = this.board[move.fr][0];
        this.board[move.fr][0] = null;
        if (this.board[move.fr][3]) this.board[move.fr][3].hasMoved = true;
      }

      this.enPassantTarget = move.doublePawn ? { r: (move.fr + move.tr) / 2, c: move.fc } : null;
      if (piece.type === 'P' && ((actingColor === 'w' && move.tr === 0) || (actingColor === 'b' && move.tr === 7))) {
        piece.type = actingColor === 'w' ? promoType : 'Q';
      }

      if (target) {
        events.captured = target;
        if (actingColor === 'w') this.capturedByWhite.push({ color: target.color, type: target.type });
        else this.capturedByBlack.push({ color: target.color, type: target.type });
      }

      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      const side = actingColor === 'w' ? 'Blancas' : 'Boss Glitch';
      const anomNote = move.isAnomaly ? ` [${move.anomalyLabel || 'ANOMALÍA'}]` : '';
      const sealNote = events.riftSealed ? ' — ¡Grieta de Vacío sellada por el Cortafuegos! 🛡️' : '';
      const text = `${side}: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}${anomNote}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}${sealNote}`;
      if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: (move.isAnomaly || events.riftSealed) ? 'special' : (actingColor === 'w' ? 'white' : 'black'), text });
    }

    // Ciclo de Grietas de Vacío (solo en turnos del Boss Glitch)
    if (actingColor === 'b') {
      if (!move.isFurySwap && this.swapCooldown > 0) this.swapCooldown--;
      this.rifts = this.rifts
        .map((rf) => ({ ...rf, turnsLeft: rf.turnsLeft - 1 }))
        .filter((rf) => rf.turnsLeft > 0);
      this.turnsSinceRift++;
      if (this.turnsSinceRift >= this.riftInterval) {
        this.turnsSinceRift = 0;
        const created = this.tearBoardRifts(this.riftCount);
        events.riftsCreated = created;
        if (created.length && recordHistory) {
          this.logs.unshift({
            turn: this.turnNumber,
            type: 'special',
            text: `💥 RASGADO DE REALIDAD: Grietas abiertas en ${created.map((x) => toAlg(x.r, x.c)).join(', ')}.`
          });
        }
      }
    }

    const nextTurn = actingColor === 'w' ? 'b' : 'w';
    this.turn = nextTurn;
    if (nextTurn === 'w') this.turnNumber++;
    if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = actingColor;
        this.winReason = actingColor === 'w'
          ? '¡Jaque mate! El Boss Glitch se desintegra.'
          : '¡Jaque mate corrupto! El Boss Glitch prevalece.';
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado: no hay jaque ni movimientos legales.';
      }
    }

    return events;
  }
}
