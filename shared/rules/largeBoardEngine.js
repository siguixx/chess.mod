import { PIECE_NAMES, toAlg } from '../config/constants.js';

/**
 * Motor de ajedrez dinámico para tableros absurdamente grandes (10×10, 12×12)
 * y modos caóticos (explosivo/atómico, mutaciones, etc.).
 */
export class LargeBoardChessEngine {
  constructor(boardSize = 12, minutes = 10, options = {}) {
    this.mode = 'large_board';
    this.boardSize = Math.max(8, Math.min(12, Number(boardSize) || 12));
    this.timePresetMinutes = minutes;
    this.atomicMode = Boolean(options.atomicMode);
    this.reset(minutes);
  }

  inBounds(r, c) {
    return r >= 0 && r < this.boardSize && c >= 0 && c < this.boardSize;
  }

  alg(r, c) {
    return toAlg(r, c, this.boardSize);
  }

  reset(minutes = this.timePresetMinutes) {
    this.timePresetMinutes = minutes;
    const N = this.boardSize;
    this.board = Array.from({ length: N }, () => Array(N).fill(null));

    let back;
    if (N === 12) {
      // 12×12 Colosal: 3 Torres, 3 Caballos, 3 Alfiles, 2 Damas, 1 Rey + 12 Peones por bando
      back = ['R', 'N', 'B', 'Q', 'R', 'K', 'Q', 'B', 'N', 'B', 'N', 'R'];
    } else if (N === 10) {
      // 10×10 Mega-Tablero: doble Dama, doble Torre, doble Alfil, doble Caballo + 10 Peones
      back = ['R', 'N', 'B', 'Q', 'K', 'Q', 'B', 'N', 'R', 'N'];
    } else {
      back = ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R'];
    }

    for (let c = 0; c < N; c++) {
      this.board[0][c] = { id: `b${back[c]}${c}`, color: 'b', type: back[c], hasMoved: false };
      this.board[1][c] = { id: `bP${c}`, color: 'b', type: 'P', hasMoved: false };
      this.board[N - 1][c] = { id: `w${back[c]}${c}`, color: 'w', type: back[c], hasMoved: false };
      this.board[N - 2][c] = { id: `wP${c}`, color: 'w', type: 'P', hasMoved: false };
    }

    this.turn = 'w';
    this.turnNumber = 1;
    this.halfMoveClock = 0;
    this.winner = null;
    this.winReason = '';
    this.lastMoveSquares = [];
    this.capturedByWhite = [];
    this.capturedByBlack = [];
    this.clocks = minutes > 0 ? { w: minutes * 60, b: minutes * 60 } : { w: null, b: null };
    this.logs = [{ turn: 0, type: 'special', text: `🗺️ Tablero Colosal ${N}×${N} (${N * N} casillas) iniciado. ¡A conquistar!` }];
    this.history = [];
  }

  cloneState() {
    return JSON.parse(JSON.stringify({
      mode: this.mode,
      boardSize: this.boardSize,
      atomicMode: this.atomicMode,
      board: this.board,
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
    this.boardSize = s.boardSize || s.board?.length || 12;
    this.atomicMode = Boolean(s.atomicMode);
    this.board = s.board;
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
    if (this.history.length > 60) this.history.shift();
  }

  undo() {
    if (this.history.length === 0) return false;
    this.loadState(this.history.pop());
    return true;
  }

  countPieces(color) {
    let n = 0;
    const N = this.boardSize;
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (this.board[r][c]?.color === color) n++;
    return n;
  }

  findKing(color) {
    const N = this.boardSize;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.board[r][c];
        if (p && p.color === color && p.type === 'K') return { r, c };
      }
    }
    return null;
  }

  getPseudoMoves(r, c) {
    const p = this.board[r]?.[c];
    if (!p) return [];
    const N = this.boardSize;
    const moves = [];

    if (p.type === 'P') {
      const dir = p.color === 'w' ? -1 : 1;
      const startRow = p.color === 'w' ? N - 2 : 1;
      const nr = r + dir;
      if (this.inBounds(nr, c) && !this.board[nr][c]) {
        moves.push({ fr: r, fc: c, tr: nr, tc: c });
        const nr2 = r + dir * 2;
        if (!p.hasMoved && r === startRow && this.inBounds(nr2, c) && !this.board[nr2][c]) {
          moves.push({ fr: r, fc: c, tr: nr2, tc: c, doublePawn: true });
          // En tablero 12×12 los peones pueden dar hasta 3 pasos en su salida para ritmo ágil
          if (N >= 12) {
            const nr3 = r + dir * 3;
            if (this.inBounds(nr3, c) && !this.board[nr3][c]) {
              moves.push({ fr: r, fc: c, tr: nr3, tc: c, doublePawn: true });
            }
          }
        }
      }
      for (const dc of [-1, 1]) {
        const tc = c + dc;
        if (this.inBounds(nr, tc)) {
          const target = this.board[nr][tc];
          if (target && target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc });
        }
      }
    } else if (p.type === 'N') {
      for (const [dr, dc] of [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]]) {
        const nr = r + dr;
        const nc = c + dc;
        if (!this.inBounds(nr, nc)) continue;
        const target = this.board[nr][nc];
        if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
      }
    } else if (p.type === 'K') {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          if (dr === 0 && dc === 0) continue;
          const nr = r + dr;
          const nc = c + dc;
          if (!this.inBounds(nr, nc)) continue;
          const target = this.board[nr][nc];
          if (!target || target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
        }
      }
    } else {
      const dirs = p.type === 'R' ? [[-1, 0], [1, 0], [0, -1], [0, 1]]
        : p.type === 'B' ? [[-1, -1], [-1, 1], [1, -1], [1, 1]]
        : [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [-1, 1], [1, -1], [1, 1]];
      for (const [dr, dc] of dirs) {
        let nr = r + dr;
        let nc = c + dc;
        while (this.inBounds(nr, nc)) {
          const target = this.board[nr][nc];
          if (!target) {
            moves.push({ fr: r, fc: c, tr: nr, tc: nc });
          } else {
            if (target.color !== p.color) moves.push({ fr: r, fc: c, tr: nr, tc: nc });
            break;
          }
          nr += dr;
          nc += dc;
        }
      }
    }
    return moves;
  }

  getSquaresAttackedBy(color) {
    const set = new Set();
    const N = this.boardSize;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const p = this.board[r][c];
        if (!p || p.color !== color) continue;
        if (p.type === 'P') {
          const nr = r + (color === 'w' ? -1 : 1);
          for (const dc of [-1, 1]) {
            if (this.inBounds(nr, c + dc)) set.add(`${nr},${c + dc}`);
          }
        } else {
          for (const m of this.getPseudoMoves(r, c)) set.add(`${m.tr},${m.tc}`);
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
    const saved = this.board.map((row) => row.slice());
    const piece = this.board[move.fr][move.fc];
    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;
    const safe = !this.isKingInCheck(color);
    this.board = saved;
    return safe;
  }

  getLegalMovesForPiece(r, c) {
    const p = this.board[r]?.[c];
    if (!p) return [];
    return this.getPseudoMoves(r, c).filter((m) => {
      const tgt = this.board[m.tr]?.[m.tc];
      if (tgt && tgt.type === 'K') return false;
      return this.isMoveSafeForKing(p.color, m);
    });
  }

  getAllLegalMoves(color) {
    const moves = [];
    const N = this.boardSize;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        if (this.board[r][c]?.color === color) moves.push(...this.getLegalMovesForPiece(r, c));
      }
    }
    return moves;
  }

  checkMatchOutcome() {
    const nextTurn = this.turn;
    const prevSide = nextTurn === 'w' ? 'b' : 'w';
    const prevLabel = prevSide === 'w' ? 'Blancas' : 'Negras';
    if (!this.findKing(nextTurn)) {
      this.winner = prevSide;
      this.winReason = `¡Victoria de ${prevLabel}!`;
    } else if (this.getAllLegalMoves(nextTurn).length === 0) {
      if (this.isKingInCheck(nextTurn)) {
        this.winner = prevSide;
        this.winReason = `¡Jaque mate en tablero ${this.boardSize}×${this.boardSize}! Ganan las ${prevLabel}.`;
      } else {
        this.winner = 'draw';
        this.winReason = 'Tablas por ahogado.';
      }
    }
  }

  executeMove(move, promoType = 'Q', recordHistory = true) {
    if (this.winner) return null;
    if (recordHistory) this.pushHistory();

    const N = this.boardSize;
    const actingColor = this.turn;
    const piece = this.board[move.fr][move.fc];
    const target = this.board[move.tr][move.tc];

    this.board[move.tr][move.tc] = piece;
    this.board[move.fr][move.fc] = null;
    piece.hasMoved = true;

    let promoNote = '';
    if (piece.type === 'P' && ((actingColor === 'w' && move.tr === 0) || (actingColor === 'b' && move.tr === N - 1))) {
      piece.type = promoType;
      promoNote = ` y corona en ${PIECE_NAMES[promoType]}`;
    }

    const exploded = [];
    if (target) {
      if (actingColor === 'w') this.capturedByWhite.push({ color: target.color, type: target.type });
      else this.capturedByBlack.push({ color: target.color, type: target.type });

      if (this.atomicMode) {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const er = move.tr + dr;
            const ec = move.tc + dc;
            if (!this.inBounds(er, ec)) continue;
            const ep = this.board[er][ec];
            if (ep && ep.type !== 'K') {
              this.board[er][ec] = null;
              exploded.push({ r: er, c: ec, type: ep.type });
            }
          }
        }
      }
    }

    this.lastMoveSquares = [[move.fr, move.fc], [move.tr, move.tc]];
    const sideLabel = actingColor === 'w' ? 'Blancas' : 'Negras';
    const boomTxt = exploded.length ? ` 💥 ¡EXPLOSIÓN 3×3 (${exploded.length} piezas volatilizadas)!` : '';
    const text = `${sideLabel}: ${PIECE_NAMES[piece.type]} ${this.alg(move.fr, move.fc)} → ${this.alg(move.tr, move.tc)}${promoNote}.${target ? ` Captura ${PIECE_NAMES[target.type]}.` : ''}${boomTxt}`;
    if (recordHistory) this.logs.unshift({ turn: this.turnNumber, type: actingColor === 'w' ? 'white' : 'black', text });

    this.turn = actingColor === 'w' ? 'b' : 'w';
    if (this.turn === 'w') this.turnNumber++;
    this.checkMatchOutcome();

    return { color: actingColor, captured: target || null, exploded, to: [move.tr, move.tc], isCheck: this.isKingInCheck(this.turn) };
  }
}

const PIECE_VALS = { P: 100, N: 320, B: 335, R: 510, Q: 920, K: 20000 };

/**
 * IA rápida y táctica para tableros 10×10 y 12×12 (evalúa capturas, centro, avance y seguridad).
 */
export function chooseLargeBoardAIMove(engine, color = 'b') {
  const moves = engine.getAllLegalMoves(color);
  if (!moves.length) return null;
  const N = engine.boardSize || 12;
  const center = (N - 1) / 2;
  let best = moves[0];
  let bestScore = -Infinity;

  for (const m of moves) {
    let score = (Math.random() - 0.5) * 28;
    const mover = engine.board[m.fr][m.fc];
    const target = engine.board[m.tr][m.tc];
    if (target) {
      score += (PIECE_VALS[target.type] || 100) * 1.45 - (PIECE_VALS[mover?.type] || 100) * 0.2;
    }
    const distCenter = Math.hypot(m.tr - center, m.tc - center);
    score += (center - distCenter) * 14;
    if (mover?.type === 'P') {
      score += color === 'b' ? m.tr * 12 : (N - 1 - m.tr) * 12;
    }
    if (score > bestScore) {
      bestScore = score;
      best = m;
    }
  }
  return best;
}
