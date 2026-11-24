import { PIECE_NAMES, toAlg, inBounds, dirText } from '../config/constants.js';

/**
 * Motor del Jefe Final: REY MAYA (Nivel 5)
 * Conserva 100% de las reglas originales de chess_modded.html:
 * - 16 piezas negras + 4 Bases (2 Torres y 2 Alfiles)
 * - Pirámide 2×2 (1-2 pasos diagonales, empujes en cadena, aplastamiento)
 * - 16 piezas blancas + 2 Casas inmortales de 1 casilla ortogonal (c3, f3)
 *   con escudo adyacente exclusivo contra la Pirámide.
 */
export class MayaBossEngine {
  constructor(minutes = 10) {
    this.mode = 'maya';
    this.timePresetMinutes = minutes;
    this.reset(minutes);
  }

  reset(minutes = this.timePresetMinutes) {
    this.timePresetMinutes = minutes;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));

    // EJÉRCITO NEGRO (REY MAYA): 16 PIEZAS TRADICIONALES + 4 BASES
    this.board[0][0] = { id: 'bR1', color: 'b', type: 'R', isBase: true, baseLabel: 'Torre a8', hasMoved: false };
    this.board[0][1] = { id: 'bN1', color: 'b', type: 'N' };
    this.board[0][2] = { id: 'bB1', color: 'b', type: 'B', isBase: true, baseLabel: 'Alfil c8' };
    this.board[0][3] = { id: 'bQ',  color: 'b', type: 'Q' };
    this.board[0][4] = { id: 'bK',  color: 'b', type: 'K', hasMoved: false };
    this.board[0][5] = { id: 'bB2', color: 'b', type: 'B', isBase: true, baseLabel: 'Alfil f8' };
    this.board[0][6] = { id: 'bN2', color: 'b', type: 'N' };
    this.board[0][7] = { id: 'bR2', color: 'b', type: 'R', isBase: true, baseLabel: 'Torre h8', hasMoved: false };
    for (let c = 0; c < 8; c++) {
      this.board[1][c] = { id: `bP${c + 1}`, color: 'b', type: 'P', hasMoved: false };
    }

    // EJÉRCITO BLANCO: 16 PIEZAS TRADICIONALES + 2 CASAS INMORTALES (c3 y f3)
    this.board[7][0] = { id: 'wR1', color: 'w', type: 'R', hasMoved: false };
    this.board[7][1] = { id: 'wN1', color: 'w', type: 'N' };
    this.board[7][2] = { id: 'wB1', color: 'w', type: 'B' };
    this.board[7][3] = { id: 'wQ',  color: 'w', type: 'Q' };
    this.board[7][4] = { id: 'wK',  color: 'w', type: 'K', hasMoved: false };
    this.board[7][5] = { id: 'wB2', color: 'w', type: 'B' };
    this.board[7][6] = { id: 'wN2', color: 'w', type: 'N' };
    this.board[7][7] = { id: 'wR2', color: 'w', type: 'R', hasMoved: false };
    for (let c = 0; c < 8; c++) {
      this.board[6][c] = { id: `wP${c + 1}`, color: 'w', type: 'P', hasMoved: false };
    }
    // Las 2 Casas blancas inmortales
    this.board[5][2] = { id: 'wH1', color: 'w', type: 'H' }; // c3
    this.board[5][5] = { id: 'wH2', color: 'w', type: 'H' }; // f3

    // Pirámide gigante 2x2 en d6, e6, d5, e5 -> esquina superior izquierda (r=2, c=3)
    this.pyramid = { r: 2, c: 3, disabledTurns: 0, destroyed: false };
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
      text: 'Batalla iniciada contra El Rey Maya. Destruye sus 4 Bases (2 Torres y 2 Alfiles) o derrota al Rey negro.'
    }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      board: this.board,
      pyramid: this.pyramid,
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
    this.board = s.board;
    this.pyramid = s.pyramid;
    this.enPassantTarget = s.enPassantTarget || null;
    this.turn = s.turn;
    this.turnNumber = s.turnNumber;
    this.winner = s.winner;
    this.winReason = s.winReason;
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

  getPyramidCells(r = this.pyramid.r, c = this.pyramid.c) {
    return [[r, c], [r, c + 1], [r + 1, c], [r + 1, c + 1]];
  }

  isSquareInPyramid(r, c, pr = this.pyramid.r, pc = this.pyramid.c) {
    if (this.pyramid.destroyed) return false;
    return r >= pr && r <= pr + 1 && c >= pc && c <= pc + 1;
  }

  isProtectedByCasa(r, c) {
    const p = this.board[r]?.[c];
    if (!p || p.color !== 'w' || p.type === 'H') return false;
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
      const nr = r + dr, nc = c + dc;
      if (inBounds(nr, nc) && this.board[nr][nc]?.color === 'w' && this.board[nr][nc]?.type === 'H') {
        return true;
      }
    }
    return false;
  }

  getProtectedWhiteSquares() {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (this.isProtectedByCasa(r, c)) set.add(`${r},${c}`);
      }
    }
    return set;
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

  countAliveBases() {
    let count = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.color === 'b' && p.isBase) count++;
      }
    }
    return count;
  }

  getBasesStatus() {
    const expected = [
      { id: 'bR1', label: 'Torre a8' },
      { id: 'bB1', label: 'Alfil c8' },
      { id: 'bB2', label: 'Alfil f8' },
      { id: 'bR2', label: 'Torre h8' }
    ];
    const whiteAttacks = this.getSquaresAttackedBy('w');
    const positions = new Map();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.isBase) positions.set(p.id, { r, c });
      }
    }
    return expected.map((b) => {
      const pos = positions.get(b.id) || null;
      return {
        id: b.id,
        label: b.label,
        alive: Boolean(pos),
        pos,
        threatened: Boolean(pos && whiteAttacks.has(`${pos.r},${pos.c}`))
      };
    });
  }

  canPyramidOccupy(nr, nc) {
    if (nr < 0 || nr > 6 || nc < 0 || nc > 6) return false;
    for (const [r, c] of this.getPyramidCells(nr, nc)) {
      const p = this.board[r][c];
      if (p && p.color === 'w' && (p.type === 'H' || p.type === 'K' || this.isProtectedByCasa(r, c))) {
        return false;
      }
    }
    return true;
  }

  isPyramidMoveLegalForKing(move) {
    const snap = this.cloneState();
    const res = this.resolvePyramidMove(move, false);
    const blackKingAlive = Boolean(this.findKing('b'));
    const whiteKingAlive = Boolean(this.findKing('w'));
    const blackSafe = blackKingAlive && !this.isKingInCheck('b');
    const ok = blackKingAlive && whiteKingAlive && blackSafe && !res.illegalKingElimination;
    this.loadState(snap);
    return ok;
  }

  getPyramidLegalMoves(skipKingSafety = false) {
    if (this.pyramid.destroyed || this.pyramid.disabledTurns > 0) return [];
    const moves = [];
    for (const [dr, dc] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) {
      const r1 = this.pyramid.r + dr;
      const c1 = this.pyramid.c + dc;
      if (!this.canPyramidOccupy(r1, c1)) continue;
      const m1 = { isPyramid: true, nr: r1, nc: c1, dr, dc, steps: 1 };
      if (skipKingSafety || this.isPyramidMoveLegalForKing(m1)) moves.push(m1);

      const r2 = this.pyramid.r + dr * 2;
      const c2 = this.pyramid.c + dc * 2;
      if (this.canPyramidOccupy(r2, c2)) {
        const m2 = { isPyramid: true, nr: r2, nc: c2, dr, dc, steps: 2 };
        if (skipKingSafety || this.isPyramidMoveLegalForKing(m2)) moves.push(m2);
      }
    }
    return moves;
  }

  getPyramidThreatSquares() {
    const set = new Set();
    for (const m of this.getPyramidLegalMoves()) {
      for (const [r, c] of this.getPyramidCells(m.nr, m.nc)) {
        if (!this.isSquareInPyramid(r, c)) set.add(`${r},${c}`);
      }
    }
    return set;
  }

  getPushableBlackSquares() {
    const set = new Set();
    for (const m of this.getPyramidLegalMoves()) {
      for (const [r, c] of this.getPyramidCells(m.nr, m.nc)) {
        if (this.board[r][c]?.color === 'b') set.add(`${r},${c}`);
      }
    }
    return set;
  }

  getPseudoMoves(r, c, includeCastling = true) {
    const p = this.board[r][c];
    if (!p) return [];
    const moves = [];
    const pyramidBlocking = (tr, tc) => !this.pyramid.destroyed && this.isSquareInPyramid(tr, tc);

    if (p.type === 'H') {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (inBounds(nr, nc) && !this.board[nr][nc] && !pyramidBlocking(nr, nc)) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      return moves;
    }

    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      const nr = r + dir;
      if (inBounds(nr, c) && !this.board[nr][c] && !pyramidBlocking(nr, c)) {
        moves.push({ fr: r, fc: c, tr: nr, tc: c });
        const nr2 = r + dir * 2;
        if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !this.board[nr2][c] && !pyramidBlocking(nr2, c)) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (inBounds(nr, tc) && !pyramidBlocking(nr, tc)) {
          const target = this.board[nr][tc];
          if (target && target.color !== p.color && target.type !== 'H') {
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
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        const nr = r + dr, nc = c + dc;
        if (!inBounds(nr, nc) || pyramidBlocking(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target || (target.color !== p.color && target.type !== 'H')) {
          moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc) || pyramidBlocking(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || (target.color !== p.color && target.type !== 'H')) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          }
        }
      }
      if (includeCastling && !p.hasMoved && c === 4 && (r === 7 || r === 0)) {
        const oppAttacks = this.getSquaresAttackedBy(p.color === 'w' ? 'b' : 'w');
        if (!oppAttacks.has(`${r},4`)) {
          const rK = this.board[r][7];
          if (rK && rK.color === p.color && rK.type === 'R' && !rK.hasMoved
              && !this.board[r][5] && !this.board[r][6]
              && !pyramidBlocking(r, 5) && !pyramidBlocking(r, 6)
              && !oppAttacks.has(`${r},5`) && !oppAttacks.has(`${r},6`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
          }
          const rQ = this.board[r][0];
          if (rQ && rQ.color === p.color && rQ.type === 'R' && !rQ.hasMoved
              && !this.board[r][1] && !this.board[r][2] && !this.board[r][3]
              && !pyramidBlocking(r, 1) && !pyramidBlocking(r, 2) && !pyramidBlocking(r, 3)
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
          if (pyramidBlocking(nr, nc)) break;
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (target.color !== p.color && target.type !== 'H') {
              moves.push({ fr: r, fc: c, tr: nr, tc: nc });
            }
            break;
          }
          nr += dr; nc += dc;
        }
      }
    }
    return moves;
  }

  getSquaresAttackedBy(color) {
    const set = new Set();
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== color || p.type === 'H') continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) {
            if (inBounds(nr, c + dc) && !this.isSquareInPyramid(nr, c + dc)) {
              set.add(`${nr},${c + dc}`);
            }
          }
        } else {
          for (const m of this.getPseudoMoves(r, c, false)) {
            set.add(`${m.tr},${m.tc}`);
          }
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
        if (this.board[r][c]?.color === color) {
          moves.push(...this.getLegalMovesForPiece(r, c));
        }
      }
    }
    if (color === 'b') {
      moves.push(...this.getPyramidLegalMoves());
    }
    return moves;
  }

  executeWhiteMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner || this.turn !== 'w') return null;
    if (recordHistory) this.pushHistory();

    const pyrMovesBefore = this.getPyramidLegalMoves().length;
    const piece = this.board[move.fr][move.fc];
    const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];
    const casaMoved = piece.type === 'H';

    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;
    piece.hasMoved = true;

    if (move.isEnPassant) this.board[move.fr][move.tc] = null;
    if (move.isCastle === 'K') {
      this.board[7][5] = this.board[7][7];
      this.board[7][7] = null;
      if (this.board[7][5]) this.board[7][5].hasMoved = true;
    } else if (move.isCastle === 'Q') {
      this.board[7][3] = this.board[7][0];
      this.board[7][0] = null;
      if (this.board[7][3]) this.board[7][3].hasMoved = true;
    }

    this.enPassantTarget = move.doublePawn ? { r: (move.fr + move.tr) / 2, c: move.fc } : null;

    let promoNote = '';
    if (piece.type === 'P' && move.tr === 0) {
      piece.type = promoType;
      promoNote = ` y corona en ${PIECE_NAMES[promoType]}`;
    }

    let baseDestroyed = false;
    let logType = 'white';
    let text = move.isCastle
      ? `Blancas: Enroque ${move.isCastle === 'K' ? 'corto' : 'largo'}.`
      : `Blancas: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}${promoNote}.`;

    if (target) {
      this.capturedByWhite.push({ color: target.color, type: target.type });
      if (target.isBase) {
        baseDestroyed = true;
        logType = 'special';
        const remaining = this.countAliveBases();
        if (remaining === 0) {
          this.pyramid.destroyed = true;
          this.pyramid.disabledTurns = 0;
          this.winner = 'w';
          this.winReason = '¡Has destruido las 4 Bases Sagradas! La Pirámide del Rey Maya colapsa permanentemente.';
          text += ` ¡Base ${target.baseLabel} destruida! Todas las Bases han caído.`;
        } else {
          this.pyramid.disabledTurns = 2;
          text += ` ¡Base ${target.baseLabel} destruida! La Pirámide queda deshabilitada durante 2 turnos.`;
        }
      } else {
        text += ` Captura ${PIECE_NAMES[target.type]} negro.`;
      }
    }

    let casaProtectedCount = 0;
    if (casaMoved) {
      for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
        const nr = move.tr + dr, nc = move.tc + dc;
        if (inBounds(nr, nc) && this.board[nr][nc]?.color === 'w' && this.board[nr][nc]?.type !== 'H') {
          casaProtectedCount++;
        }
      }
    }
    const pyrMovesAfter = this.getPyramidLegalMoves().length;
    const newlyBlockedPyramid = casaMoved && pyrMovesAfter < pyrMovesBefore;

    this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
    if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: logType, text });

    if (!this.winner) {
      this.turn = 'b';
      if (this.getAllLegalMoves('b').length === 0) {
        if (this.isKingInCheck('b')) {
          this.winner = 'w';
          this.winReason = '¡Jaque mate al Rey negro! Has vencido al Dios Maya.';
        } else {
          this.winner = 'draw';
          this.winReason = 'Tablas por ahogado: el Dios Maya no está en jaque pero no tiene jugadas legales.';
        }
      }
    }

    return { captured: target || null, baseDestroyed, casaMoved, casaProtectedCount, newlyBlockedPyramid };
  }

  pushBlackPiece(r, c, dr, dc, blockedSet, events, depth = 0) {
    if (depth > 16) return;
    const piece = this.board[r][c];
    if (!piece || piece.color !== 'b') return;
    this.board[r][c] = null;

    let nr = r + dr;
    let nc = c + dc;
    const invalidTarget = (tr, tc) => !inBounds(tr, tc) || blockedSet.has(`${tr},${tc}`) || this.board[tr][tc]?.type === 'H' || this.board[tr][tc]?.type === 'K';

    if (invalidTarget(nr, nc)) {
      nr = r + 1;
      nc = c;
    }

    if (invalidTarget(nr, nc)) {
      if (piece.type === 'K') {
        events.illegalKingElimination = true;
        this.board[r][c] = piece;
        return;
      }
      this.capturedByWhite.push({ color: 'b', type: piece.type });
      events.pushed.push({ piece, from: [r, c], to: null, eliminated: true });
      if (piece.isBase && this.countAliveBases() === 0) {
        this.pyramid.destroyed = true;
        this.pyramid.disabledTurns = 0;
        this.winner = 'w';
        this.winReason = 'La última Base cayó fuera del tablero. ¡La Pirámide se destruye permanentemente!';
      } else if (piece.isBase) {
        this.pyramid.disabledTurns = 2;
      }
      return;
    }

    const occupant = this.board[nr][nc];
    if (occupant && occupant.color === 'b') {
      this.pushBlackPiece(nr, nc, dr, dc, blockedSet, events, depth + 1);
      if (this.board[nr][nc]) {
        if (!invalidTarget(nr + 1, nc) && !this.board[nr + 1][nc]) {
          nr = nr + 1;
        } else {
          if (piece.type === 'K') {
            events.illegalKingElimination = true;
            this.board[r][c] = piece;
            return;
          }
          this.capturedByWhite.push({ color: 'b', type: piece.type });
          events.pushed.push({ piece, from: [r, c], to: null, eliminated: true });
          return;
        }
      }
    } else if (occupant && occupant.color === 'w' && occupant.type !== 'H' && occupant.type !== 'K') {
      this.capturedByBlack.push({ color: 'w', type: occupant.type });
      events.chainCaptures.push({ piece: occupant, by: piece, r: nr, c: nc });
      this.board[nr][nc] = null;
    }

    this.board[nr][nc] = piece;
    events.pushed.push({ piece, from: [r, c], to: [nr, nc], eliminated: false });
  }

  resolvePyramidMove(move, recordHistory = true) {
    const events = { isPyramid: true, captured: null, crushed: [], pushed: [], chainCaptures: [] };
    const steps = move.steps || 1;
    const startCells = this.getPyramidCells(this.pyramid.r, this.pyramid.c);

    for (let s = 1; s <= steps; s++) {
      const nextR = this.pyramid.r + move.dr;
      const nextC = this.pyramid.c + move.dc;
      const newCells = this.getPyramidCells(nextR, nextC);
      const blockedSet = new Set(newCells.map(([r, c]) => `${r},${c}`));

      const blackOccupants = [];
      for (const [r, c] of newCells) {
        if (this.board[r][c]?.color === 'b') blackOccupants.push([r, c]);
      }
      blackOccupants.sort((a, b) => ((b[0] * move.dr + b[1] * move.dc) - (a[0] * move.dr + a[1] * move.dc)));
      for (const [r, c] of blackOccupants) {
        if (this.board[r][c]?.color === 'b') {
          this.pushBlackPiece(r, c, move.dr, move.dc, blockedSet, events);
        }
      }

      for (const [r, c] of newCells) {
        const p = this.board[r][c];
        if (p && p.color === 'w' && p.type !== 'H' && p.type !== 'K' && !this.isProtectedByCasa(r, c)) {
          this.capturedByBlack.push({ color: 'w', type: p.type });
          events.crushed.push({ piece: p, r, c });
          this.board[r][c] = null;
        }
      }

      this.pyramid.r = nextR;
      this.pyramid.c = nextC;
    }

    this.enPassantTarget = null;
    this.lastMoveSquares = [...startCells, ...this.getPyramidCells(this.pyramid.r, this.pyramid.c)];

    let text = `El Rey Maya desplaza la Pirámide ${steps > 1 ? `${steps} casillas ` : ''}hacia ${dirText(move.dr, move.dc)} (${toAlg(this.pyramid.r, this.pyramid.c)}-${toAlg(this.pyramid.r + 1, this.pyramid.c + 1)}).`;
    if (events.pushed.length > 0) text += ` ${events.pushed.length} pieza(s) negra(s) empujada(s).`;
    if (events.chainCaptures.length > 0) text += ` ¡Captura en cadena: ${events.chainCaptures.map((c) => PIECE_NAMES[c.piece.type]).join(', ')}!`;
    if (events.crushed.length > 0) text += ` ¡Aplastamiento: ${events.crushed.map((c) => PIECE_NAMES[c.piece.type]).join(', ')}!`;

    if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: 'special', text });
    return events;
  }

  executeBlackMove(move, recordHistory = true) {
    if (this.winner || this.turn !== 'b') return null;
    let events;

    if (move.isPyramid) {
      events = this.resolvePyramidMove(move, recordHistory);
    } else {
      const piece = this.board[move.fr][move.fc];
      const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];
      this.board[move.tr][move.tc] = piece;
      this.board[move.fr][move.fc] = null;
      piece.hasMoved = true;

      if (move.isEnPassant) this.board[move.fr][move.tc] = null;
      if (move.isCastle === 'K') {
        this.board[0][5] = this.board[0][7];
        this.board[0][7] = null;
        if (this.board[0][5]) this.board[0][5].hasMoved = true;
      } else if (move.isCastle === 'Q') {
        this.board[0][3] = this.board[0][0];
        this.board[0][0] = null;
        if (this.board[0][3]) this.board[0][3].hasMoved = true;
      }

      this.enPassantTarget = move.doublePawn ? { r: (move.fr + move.tr) / 2, c: move.fc } : null;
      if (piece.type === 'P' && move.tr === 7) piece.type = 'Q';

      if (target) this.capturedByBlack.push({ color: target.color, type: target.type });

      this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
      let text = move.isCastle
        ? `Rey Maya: Enroque ${move.isCastle === 'K' ? 'corto' : 'largo'}.`
        : `Rey Maya: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}.`;
      if (target) text += ` Captura ${PIECE_NAMES[target.type]} blanco.`;
      if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: 'black', text });

      events = { isPyramid: false, captured: target || null, crushed: [], pushed: [], chainCaptures: [] };
    }

    if (!move.isPyramid && !this.pyramid.destroyed && this.pyramid.disabledTurns > 0) {
      this.pyramid.disabledTurns = Math.max(0, this.pyramid.disabledTurns - 1);
    }

    if (!this.winner) {
      this.turn = 'w';
      this.turnNumber++;
      if (this.getAllLegalMoves('w').length === 0) {
        if (this.isKingInCheck('w')) {
          this.winner = 'b';
          this.winReason = '¡Jaque mate! El Dios Maya reclama el santuario.';
        } else {
          this.winner = 'draw';
          this.winReason = 'Tablas por ahogado: no estás en jaque pero no tienes movimientos legales.';
        }
      }
    }
    return events;
  }
}
