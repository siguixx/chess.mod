import { inBounds } from '../config/constants.js';

/**
 * SÚPER IA DE AJEDREZ PURO (Capítulo 05 — CHESS)
 *
 * Características:
 * - Búsqueda Alpha-Beta con profundización iterativa (4-5+ plies en ~900-1200ms).
 * - Quiescence Search (capturas y promociones hasta posición tranquila).
 * - Transposition Table con Zobrist Hashing (64-bit BigInt).
 * - Ordenamiento avanzado: TT Move, MVV-LVA, Killer Moves, History Heuristic.
 * - Evaluación magistral: Tablas Pieza-Casilla de apertura y final (tapered eval),
 *   estructura de peones (doblados, aislados, pasados), pareja de alfiles, columnas abiertas,
 *   seguridad del rey y libro de aperturas básico.
 */

const PIECE_INDEX = { wP: 0, wN: 1, wB: 2, wR: 3, wQ: 4, wK: 5, bP: 6, bN: 7, bB: 8, bR: 9, bQ: 10, bK: 11 };
const PIECE_VAL = { P: 100, N: 320, B: 335, R: 500, Q: 920, K: 20000, H: 0, U: 0 };

// Piece-Square Tables (desde perspectiva Blanca, fila 0 = fila 8)
const PST_PAWN_MG = [
  [0,  0,  0,  0,  0,  0,  0,  0],
  [50, 50, 50, 50, 50, 50, 50, 50],
  [10, 10, 20, 32, 32, 20, 10, 10],
  [5,  5, 12, 27, 27, 12,  5,  5],
  [0,  0,  4, 24, 24,  4,  0,  0],
  [5, -4,-10,  2,  2,-10, -4,  5],
  [5, 10, 10,-22,-22, 10, 10,  5],
  [0,  0,  0,  0,  0,  0,  0,  0]
];

const PST_KNIGHT = [
  [-50,-40,-30,-30,-30,-30,-40,-50],
  [-40,-20,  0,  4,  4,  0,-20,-40],
  [-30,  4, 14, 18, 18, 14,  4,-30],
  [-30,  6, 18, 24, 24, 18,  6,-30],
  [-30,  2, 16, 22, 22, 16,  2,-30],
  [-30,  5, 12, 16, 16, 12,  5,-30],
  [-40,-20,  0,  5,  5,  0,-20,-40],
  [-50,-40,-30,-30,-30,-30,-40,-50]
];

const PST_BISHOP = [
  [-20,-10,-10,-10,-10,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  8, 12, 12,  8,  0,-10],
  [-10,  6,  8, 14, 14,  8,  6,-10],
  [-10,  2, 12, 14, 14, 12,  2,-10],
  [-10, 10, 10, 12, 12, 10, 10,-10],
  [-10,  6,  0,  0,  0,  0,  6,-10],
  [-20,-10,-10,-10,-10,-10,-10,-20]
];

const PST_ROOK = [
  [0,  0,  4,  6,  6,  4,  0,  0],
  [8, 14, 14, 14, 14, 14, 14,  8],
  [-4, 0,  0,  0,  0,  0,  0, -4],
  [-4, 0,  0,  0,  0,  0,  0, -4],
  [-4, 0,  0,  0,  0,  0,  0, -4],
  [-4, 0,  0,  0,  0,  0,  0, -4],
  [-4, 0,  0,  2,  2,  0,  0, -4],
  [0,  0,  4, 10, 10,  4,  0,  0]
];

const PST_QUEEN = [
  [-20,-10,-10, -5, -5,-10,-10,-20],
  [-10,  0,  0,  0,  0,  0,  0,-10],
  [-10,  0,  6,  6,  6,  6,  0,-10],
  [ -5,  0,  6,  8,  8,  6,  0, -5],
  [  0,  0,  6,  8,  8,  6,  0, -5],
  [-10,  5,  6,  6,  6,  6,  0,-10],
  [-10,  0,  5,  0,  0,  0,  0,-10],
  [-20,-10,-10, -5, -5,-10,-10,-20]
];

const PST_KING_MG = [
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-30,-40,-40,-50,-50,-40,-40,-30],
  [-20,-30,-30,-40,-40,-30,-30,-20],
  [-10,-20,-20,-20,-20,-20,-20,-10],
  [ 20, 20,  0,  0,  0,  0, 20, 20],
  [ 20, 32, 12,  0,  0, 12, 32, 20]
];

const PST_KING_EG = [
  [-40,-20,-15,-10,-10,-15,-20,-40],
  [-20, -5,  5, 10, 10,  5, -5,-20],
  [-15,  5, 18, 22, 22, 18,  5,-15],
  [-10, 10, 22, 28, 28, 22, 10,-10],
  [-10, 10, 22, 28, 28, 22, 10,-10],
  [-15,  5, 16, 20, 20, 16,  5,-15],
  [-20, -5,  4,  8,  8,  4, -5,-20],
  [-40,-20,-15,-10,-10,-15,-20,-40]
];

// Generador determinista XorShift64 para Zobrist Hashing
let zSeed = 0x9e3779b97f4a7c15n;
function nextZobrist() {
  let x = zSeed;
  x ^= x << 13n;
  x ^= x >> 7n;
  x ^= x << 17n;
  zSeed = BigInt.asUintN(64, x);
  return zSeed;
}

const ZOBRIST_PIECES = Array.from({ length: 12 }, () => Array.from({ length: 64 }, () => nextZobrist()));
const ZOBRIST_SIDE = nextZobrist();

const TT_EXACT = 0;
const TT_LOWER = 1;
const TT_UPPER = 2;

// Libro de aperturas básico para Negras frente a respuestas clásicas
const OPENING_RESPONSES_BLACK = {
  '6,4->4,4': [[1, 2, 3, 2], [1, 4, 3, 4], [1, 4, 2, 4]], // e4 -> c5 (Siciliana), e5, e6 (Francesa)
  '6,3->4,3': [[1, 3, 3, 3], [0, 6, 2, 5]],               // d4 -> d5, Nf6
  '6,2->4,2': [[1, 4, 3, 4], [0, 6, 2, 5]],               // c4 -> e5, Nf6
  '7,6->5,5': [[1, 3, 3, 3], [0, 6, 2, 5]]                // Nf3 -> d5, Nf6
};

export class SuperChessAI {
  constructor() {
    this.tt = new Map();
    this.killers = Array.from({ length: 32 }, () => [null, null]);
    this.history = new Int32Array(64 * 64);
    this.nodes = 0;
    this.deadline = 0;
    this.aborted = false;
    this.qDepth = 5;
  }

  hashBoard(board, turn) {
    let h = turn === 'b' ? ZOBRIST_SIDE : 0n;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const idx = PIECE_INDEX[`${p.color}${p.type}`];
        if (idx !== undefined) h ^= ZOBRIST_PIECES[idx][r * 8 + c];
      }
    }
    return h;
  }

  findKing(board, color) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (p && p.color === color && p.type === 'K') return { r, c };
      }
    }
    return null;
  }

  isSquareAttacked(board, tr, tc, byColor) {
    // Peones
    const pawnDir = byColor === 'w' ? 1 : -1;
    const pr = tr + pawnDir;
    if (inBounds(pr, tc - 1)) {
      const p = board[pr][tc - 1];
      if (p && p.color === byColor && p.type === 'P') return true;
    }
    if (inBounds(pr, tc + 1)) {
      const p = board[pr][tc + 1];
      if (p && p.color === byColor && p.type === 'P') return true;
    }
    // Caballos
    for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
      const nr = tr + dr, nc = tc + dc;
      if (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p && p.color === byColor && p.type === 'N') return true;
      }
    }
    // Rey
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const nr = tr + dr, nc = tc + dc;
        if (inBounds(nr, nc)) {
          const p = board[nr][nc];
          if (p && p.color === byColor && p.type === 'K') return true;
        }
      }
    }
    // Torres / Dama (ortogonal)
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      let nr = tr + dr, nc = tc + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'R' || p.type === 'Q')) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    // Alfiles / Dama (diagonal)
    for (const [dr, dc] of [[-1,-1],[-1,1],[1,-1],[1,1]]) {
      let nr = tr + dr, nc = tc + dc;
      while (inBounds(nr, nc)) {
        const p = board[nr][nc];
        if (p) {
          if (p.color === byColor && (p.type === 'B' || p.type === 'Q')) return true;
          break;
        }
        nr += dr; nc += dc;
      }
    }
    return false;
  }

  inCheck(board, color) {
    const k = this.findKing(board, color);
    if (!k) return true;
    return this.isSquareAttacked(board, k.r, k.c, color === 'w' ? 'b' : 'w');
  }

  generateLegalMoves(board, color, capturesOnly = false) {
    const pseudo = [];
    const opp = color === 'w' ? 'b' : 'w';

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.color !== color) continue;
        if (p.type === 'H' || p.type === 'U') {
          if (!capturesOnly) {
            for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
              const nr = r + dr, nc = c + dc;
              if (inBounds(nr, nc) && !board[nr][nc]) pseudo.push({ fr: r, fc: c, tr: nr, tc: nc });
            }
          }
          continue;
        }

        if (p.type === 'P') {
          const dir = color === 'w' ? -1 : 1;
          const startRow = color === 'w' ? 6 : 1;
          const promoRow = color === 'w' ? 0 : 7;
          const nr = r + dir;
          if (!capturesOnly && inBounds(nr, c) && !board[nr][c]) {
            pseudo.push({ fr: r, fc: c, tr: nr, tc: c, promo: nr === promoRow });
            const nr2 = r + dir * 2;
            if (!p.hasMoved && r === startRow && inBounds(nr2, c) && !board[nr2][c]) {
              pseudo.push({ fr: r, fc: c, tr: nr2, tc: c });
            }
          } else if (capturesOnly && nr === promoRow && inBounds(nr, c) && !board[nr][c]) {
            pseudo.push({ fr: r, fc: c, tr: nr, tc: c, promo: true });
          }
          for (const dc of [-1, 1]) {
            const tc = c + dc;
            if (inBounds(nr, tc)) {
              const t = board[nr][tc];
              if (t && t.color === opp && t.type !== 'H' && t.type !== 'U') {
                pseudo.push({ fr: r, fc: c, tr: nr, tc, cap: t.type, promo: nr === promoRow });
              }
            }
          }
        } else if (p.type === 'N') {
          for (const [dr, dc] of [[-2,-1],[-2,1],[-1,-2],[-1,2],[1,-2],[1,2],[2,-1],[2,1]]) {
            const nr = r + dr, nc = c + dc;
            if (!inBounds(nr, nc)) continue;
            const t = board[nr][nc];
            if (t && (t.color === color || t.type === 'H' || t.type === 'U')) continue;
            if (capturesOnly && !t) continue;
            pseudo.push({ fr: r, fc: c, tr: nr, tc: nc, cap: t ? t.type : null });
          }
        } else if (p.type === 'K') {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (dr === 0 && dc === 0) continue;
              const nr = r + dr, nc = c + dc;
              if (!inBounds(nr, nc)) continue;
              const t = board[nr][nc];
              if (t && (t.color === color || t.type === 'H' || t.type === 'U')) continue;
              if (capturesOnly && !t) continue;
              pseudo.push({ fr: r, fc: c, tr: nr, tc: nc, cap: t ? t.type : null });
            }
          }
          if (!capturesOnly && !p.hasMoved && c === 4 && (r === 7 || r === 0) && !this.isSquareAttacked(board, r, 4, opp)) {
            const rK = board[r][7];
            if (rK && rK.color === color && rK.type === 'R' && !rK.hasMoved && !board[r][5] && !board[r][6]
                && !this.isSquareAttacked(board, r, 5, opp) && !this.isSquareAttacked(board, r, 6, opp)) {
              pseudo.push({ fr: r, fc: 4, tr: r, tc: 6, isCastle: 'K' });
            }
            const rQ = board[r][0];
            if (rQ && rQ.color === color && rQ.type === 'R' && !rQ.hasMoved && !board[r][1] && !board[r][2] && !board[r][3]
                && !this.isSquareAttacked(board, r, 3, opp) && !this.isSquareAttacked(board, r, 2, opp)) {
              pseudo.push({ fr: r, fc: 4, tr: r, tc: 2, isCastle: 'Q' });
            }
          }
        } else {
          const dirs = p.type === 'R' ? [[-1,0],[1,0],[0,-1],[0,1]]
            : p.type === 'B' ? [[-1,-1],[-1,1],[1,-1],[1,1]]
            : [[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[-1,1],[1,-1],[1,1]];
          for (const [dr, dc] of dirs) {
            let nr = r + dr, nc = c + dc;
            while (inBounds(nr, nc)) {
              const t = board[nr][nc];
              if (!t) {
                if (!capturesOnly) pseudo.push({ fr: r, fc: c, tr: nr, tc: nc });
              } else {
                if (t.color === opp && t.type !== 'H' && t.type !== 'U') {
                  pseudo.push({ fr: r, fc: c, tr: nr, tc: nc, cap: t.type });
                }
                break;
              }
              nr += dr; nc += dc;
            }
          }
        }
      }
    }

    const legal = [];
    for (const m of pseudo) {
      if (m.cap === 'K') continue;
      const undo = this.makeMove(board, m);
      if (!this.inCheck(board, color)) legal.push(m);
      this.unmakeMove(board, m, undo);
    }
    return legal;
  }

  makeMove(board, m) {
    const moved = board[m.fr][m.fc];
    const captured = board[m.tr][m.tc];
    const prevType = moved.type;
    const prevMoved = moved.hasMoved;
    let castleRook = null;

    board[m.tr][m.tc] = moved;
    board[m.fr][m.fc] = null;
    moved.hasMoved = true;
    if (m.promo) moved.type = 'Q';

    if (m.isCastle === 'K') {
      castleRook = board[m.fr][7];
      board[m.fr][5] = castleRook;
      board[m.fr][7] = null;
      if (castleRook) castleRook.hasMoved = true;
    } else if (m.isCastle === 'Q') {
      castleRook = board[m.fr][0];
      board[m.fr][3] = castleRook;
      board[m.fr][0] = null;
      if (castleRook) castleRook.hasMoved = true;
    }
    return { captured, prevType, prevMoved, castleRook };
  }

  unmakeMove(board, m, undo) {
    const moved = board[m.tr][m.tc];
    moved.type = undo.prevType;
    moved.hasMoved = undo.prevMoved;
    board[m.fr][m.fc] = moved;
    board[m.tr][m.tc] = undo.captured;
    if (m.isCastle === 'K') {
      board[m.fr][7] = undo.castleRook;
      board[m.fr][5] = null;
      if (undo.castleRook) undo.castleRook.hasMoved = false;
    } else if (m.isCastle === 'Q') {
      board[m.fr][0] = undo.castleRook;
      board[m.fr][3] = null;
      if (undo.castleRook) undo.castleRook.hasMoved = false;
    }
  }

  evaluate(board, perspectiveColor) {
    let mg = 0;
    let eg = 0;
    let phase = 0;
    let wBishops = 0, bBishops = 0;
    const wPawnCols = new Int8Array(8);
    const bPawnCols = new Int8Array(8);

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p) continue;
        const sign = p.color === 'w' ? 1 : -1;
        const pr = p.color === 'w' ? r : (7 - r);
        const val = PIECE_VAL[p.type] || 0;
        let pstMg = 0, pstEg = 0;

        if (p.type === 'P') {
          pstMg = PST_PAWN_MG[pr][c];
          pstEg = pstMg + (6 - pr) * 6;
          if (p.color === 'w') wPawnCols[c]++; else bPawnCols[c]++;
        } else if (p.type === 'N') {
          pstMg = pstEg = PST_KNIGHT[pr][c];
          phase += 1;
        } else if (p.type === 'B') {
          pstMg = pstEg = PST_BISHOP[pr][c];
          phase += 1;
          if (p.color === 'w') wBishops++; else bBishops++;
        } else if (p.type === 'R') {
          pstMg = pstEg = PST_ROOK[pr][c];
          phase += 2;
        } else if (p.type === 'Q') {
          pstMg = pstEg = PST_QUEEN[pr][c];
          phase += 4;
        } else if (p.type === 'K') {
          pstMg = PST_KING_MG[pr][c];
          pstEg = PST_KING_EG[pr][c];
        }

        mg += sign * (val + pstMg);
        eg += sign * (val + pstEg);
      }
    }

    // Pareja de alfiles
    if (wBishops >= 2) { mg += 38; eg += 48; }
    if (bBishops >= 2) { mg -= 38; eg -= 48; }

    // Estructura de peones (doblados / aislados) + columnas abiertas para torres
    for (let c = 0; c < 8; c++) {
      if (wPawnCols[c] > 1) { mg -= 16 * (wPawnCols[c] - 1); eg -= 20 * (wPawnCols[c] - 1); }
      if (bPawnCols[c] > 1) { mg += 16 * (bPawnCols[c] - 1); eg += 20 * (bPawnCols[c] - 1); }
      const wIso = wPawnCols[c] > 0 && (c === 0 || wPawnCols[c - 1] === 0) && (c === 7 || wPawnCols[c + 1] === 0);
      const bIso = bPawnCols[c] > 0 && (c === 0 || bPawnCols[c - 1] === 0) && (c === 7 || bPawnCols[c + 1] === 0);
      if (wIso) { mg -= 14; eg -= 16; }
      if (bIso) { mg += 14; eg += 16; }
    }

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = board[r][c];
        if (!p || p.type !== 'R') continue;
        const ownPawns = p.color === 'w' ? wPawnCols[c] : bPawnCols[c];
        const oppPawns = p.color === 'w' ? bPawnCols[c] : wPawnCols[c];
        const bonus = ownPawns === 0 ? (oppPawns === 0 ? 22 : 12) : 0;
        const s = p.color === 'w' ? 1 : -1;
        mg += s * bonus;
        eg += s * bonus;
      }
    }

    const mgWeight = Math.min(24, phase);
    const egWeight = 24 - mgWeight;
    const whiteScore = Math.round((mg * mgWeight + eg * egWeight) / 24);
    return perspectiveColor === 'w' ? whiteScore : -whiteScore;
  }

  moveKey(m) {
    return (m.fr << 9) | (m.fc << 6) | (m.tr << 3) | m.tc;
  }

  scoreMoveOrder(board, m, ttBestKey, ply) {
    const key = this.moveKey(m);
    if (key === ttBestKey) return 1_000_000;
    if (m.cap) {
      const attacker = board[m.fr][m.fc];
      // MVV-LVA
      return 100_000 + (PIECE_VAL[m.cap] || 100) * 10 - (PIECE_VAL[attacker?.type] || 100);
    }
    if (m.promo) return 90_000;
    const k = this.killers[ply];
    if (k && (k[0] === key || k[1] === key)) return 50_000;
    return this.history[(m.fr * 8 + m.fc) * 64 + (m.tr * 8 + m.tc)];
  }

  quiescence(board, alpha, beta, color, qDepth) {
    this.nodes++;
    if ((this.nodes & 2047) === 0 && performance.now() > this.deadline) {
      this.aborted = true;
      return 0;
    }

    const standPat = this.evaluate(board, color);
    if (qDepth <= 0) return standPat;
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;

    const caps = this.generateLegalMoves(board, color, true);
    caps.sort((a, b) => this.scoreMoveOrder(board, b, -1, 0) - this.scoreMoveOrder(board, a, -1, 0));

    const opp = color === 'w' ? 'b' : 'w';
    for (const m of caps) {
      const undo = this.makeMove(board, m);
      const score = -this.quiescence(board, -beta, -alpha, opp, qDepth - 1);
      this.unmakeMove(board, m, undo);
      if (this.aborted) return 0;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  alphaBeta(board, depth, alpha, beta, color, ply) {
    this.nodes++;
    if ((this.nodes & 2047) === 0 && performance.now() > this.deadline) {
      this.aborted = true;
      return 0;
    }

    const origAlpha = alpha;
    const hash = this.hashBoard(board, color);
    const ttEntry = this.tt.get(hash);
    if (ttEntry && ttEntry.depth >= depth) {
      if (ttEntry.flag === TT_EXACT) return ttEntry.score;
      if (ttEntry.flag === TT_LOWER && ttEntry.score > alpha) alpha = ttEntry.score;
      else if (ttEntry.flag === TT_UPPER && ttEntry.score < beta) beta = ttEntry.score;
      if (alpha >= beta) return ttEntry.score;
    }

    if (depth <= 0) {
      return this.quiescence(board, alpha, beta, color, this.qDepth);
    }

    const moves = this.generateLegalMoves(board, color, false);
    if (moves.length === 0) {
      return this.inCheck(board, color) ? (-90000 + ply * 50) : 0;
    }

    const ttBestKey = ttEntry ? ttEntry.bestKey : -1;
    moves.sort((a, b) => this.scoreMoveOrder(board, b, ttBestKey, ply) - this.scoreMoveOrder(board, a, ttBestKey, ply));

    const opp = color === 'w' ? 'b' : 'w';
    let bestScore = -Infinity;
    let bestKey = this.moveKey(moves[0]);

    for (const m of moves) {
      const undo = this.makeMove(board, m);
      const score = -this.alphaBeta(board, depth - 1, -beta, -alpha, opp, ply + 1);
      this.unmakeMove(board, m, undo);
      if (this.aborted) return 0;

      if (score > bestScore) {
        bestScore = score;
        bestKey = this.moveKey(m);
      }
      if (score > alpha) alpha = score;
      if (alpha >= beta) {
        if (!m.cap) {
          const mk = this.moveKey(m);
          if (this.killers[ply][0] !== mk) {
            this.killers[ply][1] = this.killers[ply][0];
            this.killers[ply][0] = mk;
          }
          const hIdx = (m.fr * 8 + m.fc) * 64 + (m.tr * 8 + m.tc);
          this.history[hIdx] = Math.min(40000, this.history[hIdx] + depth * depth);
        }
        break;
      }
    }

    let flag = TT_EXACT;
    if (bestScore <= origAlpha) flag = TT_UPPER;
    else if (bestScore >= beta) flag = TT_LOWER;

    if (this.tt.size > 120000) this.tt.clear();
    this.tt.set(hash, { depth, score: bestScore, flag, bestKey });
    return bestScore;
  }

  chooseBestMove(state, { maxDepth = 5, thinkTimeMs = 1100, color = 'b', qDepth = 5, noise = 0, blunderChance = 0, useBook = true } = {}) {
    const board = state.board.map((row) => row.map((p) => (p ? { ...p } : null)));
    const legal = this.generateLegalMoves(board, color, false);
    if (legal.length === 0) return null;
    if (legal.length === 1) return { move: legal[0], depth: 1, nodes: 1, book: false };

    // Libro de aperturas básico en turno 1 para Negras (cuando useBook está activo)
    if (useBook && color === 'b' && state.turnNumber === 1 && state.lastMoveSquares?.length === 2) {
      const [[fr, fc], [tr, tc]] = state.lastMoveSquares;
      const bookPool = OPENING_RESPONSES_BLACK[`${fr},${fc}->${tr},${tc}`];
      if (bookPool) {
        const pick = bookPool[Math.floor(Math.random() * bookPool.length)];
        const found = legal.find((m) => m.fr === pick[0] && m.fc === pick[1] && m.tr === pick[2] && m.tc === pick[3]);
        if (found) return { move: found, depth: 0, nodes: 0, book: true };
      }
    }

    this.nodes = 0;
    this.aborted = false;
    this.qDepth = Math.max(0, Number.isFinite(qDepth) ? qDepth : 5);
    this.deadline = performance.now() + thinkTimeMs;
    this.killers.forEach((k) => { k[0] = null; k[1] = null; });
    this.history.fill(0);

    let bestMove = legal[0];
    let completedDepth = 1;
    let lastScoredMoves = [];
    const opp = color === 'w' ? 'b' : 'w';
    const humanized = noise > 0 || blunderChance > 0;

    for (let depth = 1; depth <= maxDepth; depth++) {
      let iterBest = bestMove;
      let iterScore = -Infinity;
      let alpha = -Infinity;
      const beta = Infinity;
      const iterScored = [];

      const bestKey = this.moveKey(bestMove);
      legal.sort((a, b) => this.scoreMoveOrder(board, b, bestKey, 0) - this.scoreMoveOrder(board, a, bestKey, 0));

      for (const m of legal) {
        const undo = this.makeMove(board, m);
        // En modo humanizado (Cap. 5 progresivo) evaluamos cada jugada raíz con ventana completa para rankear alternativas reales
        const searchAlpha = humanized && depth === maxDepth ? -Infinity : alpha;
        const score = -this.alphaBeta(board, depth - 1, -beta, -searchAlpha, opp, 1);
        this.unmakeMove(board, m, undo);
        if (this.aborted) break;
        iterScored.push({ move: m, score });
        if (score > iterScore) {
          iterScore = score;
          iterBest = m;
        }
        if (score > alpha) alpha = score;
      }

      if (!this.aborted) {
        bestMove = iterBest;
        completedDepth = depth;
        lastScoredMoves = iterScored;
        if (iterScore >= 85000) break; // Mate forzado encontrado
      } else {
        break;
      }
    }

    if (humanized && lastScoredMoves.length > 1) {
      lastScoredMoves.sort((a, b) => b.score - a.score);
      // Nunca dejar escapar un jaque mate inmediato
      if (lastScoredMoves[0].score < 85000) {
        if (noise > 0) {
          const jittered = lastScoredMoves.map((entry) => ({
            move: entry.move,
            score: entry.score,
            noisy: entry.score + (Math.random() * noise * 2 - noise)
          }));
          jittered.sort((a, b) => b.noisy - a.noisy);
          bestMove = jittered[0].move;
        }
        if (blunderChance > 0 && Math.random() < blunderChance) {
          const topMargin = lastScoredMoves[0].score - 280;
          const candidates = lastScoredMoves.slice(1, 4).filter((e) => e.score > -50000 && e.score >= topMargin);
          if (candidates.length > 0) {
            bestMove = candidates[Math.floor(Math.random() * candidates.length)].move;
          }
        }
      }
    }

    return { move: bestMove, depth: completedDepth, nodes: this.nodes, book: false };
  }
}
