import { PIECE_NAMES, toAlg, inBounds } from '../config/constants.js';

export class ClassicChessEngine {
  constructor(minutes = 10) {
    this.mode = 'classic';
    this.timePresetMinutes = minutes;
    this.reset(minutes);
  }

  reset(minutes = this.timePresetMinutes) {
    this.timePresetMinutes = minutes;
    this.board = Array.from({ length: 8 }, () => Array(8).fill(null));
    const back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    for (let c = 0; c < 8; c++) {
      this.board[0][c] = { id: `b${back[c]}${c}`, color: 'b', type: back[c], hasMoved: false };
      this.board[1][c] = { id: `bP${c}`, color: 'b', type: 'P', hasMoved: false };
      this.board[7][c] = { id: `w${back[c]}${c}`, color: 'w', type: back[c], hasMoved: false };
      this.board[6][c] = { id: `wP${c}`, color: 'w', type: 'P', hasMoved: false };
    }
    this.enPassantTarget = null;
    this.turn = 'w';
    this.turnNumber = 1;
    this.halfMoveClock = 0;
    this.winner = null; // 'w', 'b', 'draw'
    this.winReason = '';
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.clocks = minutes > 0 ? { w: minutes * 60, b: minutes * 60 } : { w: null, b: null };
    this.logs = [{ turn: 0, type: 'special', text: 'Partida clásica iniciada. ¡Buena suerte!' }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      board: this.board,
      enPassantTarget: this.enPassantTarget,
      turn: this.turn,
      turnNumber: this.turnNumber,
      halfMoveClock: this.halfMoveClock,
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
    this.enPassantTarget = s.enPassantTarget || null;
    this.turn = s.turn;
    this.turnNumber = s.turnNumber;
    this.halfMoveClock = s.halfMoveClock || 0;
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
    if (this.history.length > 80) this.history.shift();
  }

  undo() {
    if (this.history.length === 0) return false;
    this.loadState(this.history.pop());
    return true;
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

    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? 6 : 1;
      const nr = r + dir;
      if (inBounds(nr, c) && !this.board[nr][c]) {
        moves.push({ fr: r, fc: c, tr: nr, tc: c });
        const nr2 = r + dir * 2;
        if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !this.board[nr2][c]) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (inBounds(nr, tc)) {
          const target = this.board[nr][tc];
          if (target && target.color !== p.color) {
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
        if (!inBounds(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr, nc = c + dc;
          if (!inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
      if (includeCastling && !p.hasMoved && c === 4 && (r === 7 || r === 0)) {
        const oppAttacks = this.getSquaresAttackedBy(p.color === 'w' ? 'b' : 'w');
        if (!oppAttacks.has(`${r},4`)) {
          const rK = this.board[r][7];
          if (rK && rK.color === p.color && rK.type === 'R' && !rK.hasMoved
              && !this.board[r][5] && !this.board[r][6]
              && !oppAttacks.has(`${r},5`) && !oppAttacks.has(`${r},6`)) {
            moves.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
          }
          const rQ = this.board[r][0];
          if (rQ && rQ.color === p.color && rQ.type === 'R' && !rQ.hasMoved
              && !this.board[r][1] && !this.board[r][2] && !this.board[r][3]
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
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
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
        if (!p || p.color !== color) continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) {
            if (inBounds(nr, c + dc)) set.add(`${nr},${c + dc}`);
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
        if (this.board[r][c]?.color === color) moves.push(...this.getLegalMovesForPiece(r, c));
      }
    }
    return moves;
  }

  isInsufficientMaterial() {
    const pieces = [];
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = this.board[r][c];
        if (p && p.type !== 'K') pieces.push(p);
      }
    }
    if (pieces.length === 0) return true;
    if (pieces.length === 1 && (pieces[0].type === 'B' || pieces[0].type === 'N')) return true;
    return false;
  }

  validateAndExecuteMove(fr, fc, tr, tc, promoType = 'Q', recordHistory = true) {
    if (this.winner) return { ok: false, error: 'La partida ya terminó.' };
    const piece = this.board[fr]?.[fc];
    if (!piece || piece.color !== this.turn) return { ok: false, error: 'No es tu pieza o no es tu turno.' };
    const legal = this.getLegalMovesForPiece(fr, fc).find((m) => m.tr === tr && m.tc === tc);
    if (!legal) return { ok: false, error: 'Movimiento ilegal.' };
    const validPromo = ['Q', 'R', 'B', 'N'].includes(promoType) ? promoType : 'Q';
    const events = this.executeMove(legal, validPromo, recordHistory);
    return { ok: true, move: legal, events };
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const actingColor = this.turn;
    const piece = this.board[move.fr][move.fc];
    const target = move.isEnPassant ? this.board[move.fr][move.tc] : this.board[move.tr][move.tc];

    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;
    piece.hasMoved = true;

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

    let promoNote = '';
    if (piece.type === 'P' && ((actingColor === 'w' && move.tr === 0) || (actingColor === 'b' && move.tr === 7))) {
      piece.type = promoType;
      promoNote = ` y corona en ${PIECE_NAMES[promoType]}`;
    }

    if (target) {
      if (actingColor === 'w') this.capturedByWhite.push({ color: target.color, type: target.type });
      else this.capturedByBlack.push({ color: target.color, type: target.type });
      this.halfMoveClock = 0;
    } else if (piece.type === 'P') {
      this.halfMoveClock = 0;
    } else {
      this.halfMoveClock++;
    }

    this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
    const sideLabel = actingColor === 'w' ? 'Blancas' : 'Negras';
    const text = move.isCastle
      ? `${sideLabel}: Enroque ${move.isCastle === 'K' ? 'corto' : 'largo'}.`
      : `${sideLabel}: ${PIECE_NAMES[piece.type]} ${toAlg(move.fr, move.fc)} → ${toAlg(move.tr, move.tc)}${promoNote}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}`;
    if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: actingColor === 'w' ? 'white' : 'black', text });

    const nextTurn = actingColor === 'w' ? 'b' : 'w';
    this.turn = nextTurn;
    if (nextTurn === 'w') this.turnNumber++;

    if (!this.findKing(nextTurn)) {
      this.winner = actingColor;
      this.winReason = `¡Victoria de ${sideLabel}!`;
    } else if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = actingColor;
        this.winReason = `¡Jaque mate! Ganan las ${sideLabel}.`;
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado.';
      }
    } else if (this.isInsufficientMaterial()) {
      this.winner = 'draw';
      this.winReason = 'Tablas por material insuficiente.';
    } else if (this.halfMoveClock >= 100) {
      this.winner = 'draw';
      this.winReason = 'Tablas por regla de los 50 movimientos.';
    }

    return { color: actingColor, captured: target || null, to: [move.tr, move.tc], isCheck: this.isKingInCheck(nextTurn) };
  }
}
