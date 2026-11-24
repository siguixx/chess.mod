import { MayaBossEngine } from '../rules/mayaEngine.js';

export class MayaBossAI {
  static VAL = { K: 20000, Q: 950, R: 540, B: 360, N: 330, P: 100, H: 0 };

  static evaluate(engine) {
    if (engine.winner === 'b') return 100000;
    if (engine.winner === 'w') return -100000;

    let score = 0;
    const wAttacks = engine.getSquaresAttackedBy('w');
    const bAttacks = engine.getSquaresAttackedBy('b');

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        const val = this.VAL[p.type] || 0;
        const center = (3.5 - Math.abs(3.5 - c)) * 5 + (3.5 - Math.abs(3.5 - r)) * 4;

        if (p.color === 'b') {
          score += val + center;
          if (p.type === 'P') score += r * 12;
          if (p.isBase) {
            score += 240;
            if (wAttacks.has(`${r},${c}`)) {
              const defended = bAttacks.has(`${r},${c}`);
              score -= defended ? 130 : 340;
            }
          } else if (wAttacks.has(`${r},${c}`) && p.type !== 'K') {
            const defended = bAttacks.has(`${r},${c}`);
            score -= defended ? val * 0.2 : val * 0.65;
          }
        } else {
          score -= val + center;
          if (p.type === 'P') score -= (7 - r) * 14;
          if (p.type === 'H') score -= 22;
        }
      }
    }

    if (!engine.pyramid.destroyed) {
      if (engine.pyramid.disabledTurns === 0) {
        score += 260 + engine.pyramid.r * 24;
        const threats = engine.getPyramidThreatSquares();
        for (const sq of threats) {
          const [tr, tc] = sq.split(',').map(Number);
          const wp = engine.board[tr][tc];
          if (wp && wp.color === 'w' && wp.type !== 'H' && !engine.isProtectedByCasa(tr, tc)) {
            score += wp.type === 'K' ? 280 : (this.VAL[wp.type] || 100) * 0.35;
          }
        }
      } else {
        score -= engine.pyramid.disabledTurns * 75;
      }
    } else {
      score -= 900;
    }

    if (engine.isKingInCheck('w')) score += 80;
    if (engine.isKingInCheck('b')) score -= 95;
    return score;
  }

  static scoreMoveOrder(engine, m, color) {
    if (m.isPyramid) {
      let s = 170 + m.nr * 14 + (m.steps === 2 ? 25 : 0);
      for (const [r, c] of engine.getPyramidCells(m.nr, m.nc)) {
        const p = engine.board[r][c];
        if (p && p.color === 'w' && p.type !== 'H' && !engine.isProtectedByCasa(r, c)) {
          s += 420 + (this.VAL[p.type] || 100);
        } else if (p && p.color === 'b') {
          s += 45;
        }
      }
      return s;
    }
    const piece = engine.board[m.fr][m.fc];
    const target = engine.board[m.tr][m.tc];
    let s = (3.5 - Math.abs(3.5 - m.tc)) * 4;
    if (target) {
      s += 320 + (this.VAL[target.type] || 100) - (this.VAL[piece.type] || 100) * 0.15;
      if (target.isBase) s += 550;
    }
    if (color === 'b' && piece?.isBase) {
      const wAttacks = engine.getSquaresAttackedBy('w');
      if (wAttacks.has(`${m.fr},${m.fc}`) && !wAttacks.has(`${m.tr},${m.tc}`)) s += 260;
    }
    return s;
  }

  static chooseBestMove(engine, difficulty = 5) {
    const moves = engine.getAllLegalMoves('b');
    if (moves.length === 0) return null;

    moves.sort((a, b) => this.scoreMoveOrder(engine, b, 'b') - this.scoreMoveOrder(engine, a, 'b'));
    const diff = Math.max(1, Math.min(5, difficulty || 5));
    const maxCandidates = Math.min(diff >= 4 ? 26 : 18, moves.length);
    const maxReplies = diff >= 4 ? 18 : 12;
    const noiseRange = [95, 55, 28, 12, 5][diff - 1];

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (let i = 0; i < maxCandidates; i++) {
      const move = moves[i];
      const sim = new MayaBossEngine();
      sim.loadState(engine.cloneState());
      sim.executeBlackMove(move, false);

      let val;
      if (sim.winner === 'b') return move;
      if (sim.winner === 'w') {
        val = -100000;
      } else {
        const wMoves = sim.getAllLegalMoves('w');
        if (wMoves.length === 0) {
          val = 100000;
        } else {
          wMoves.sort((a, b) => this.scoreMoveOrder(sim, b, 'w') - this.scoreMoveOrder(sim, a, 'w'));
          const limitW = Math.min(maxReplies, wMoves.length);
          val = Infinity;
          for (let j = 0; j < limitW; j++) {
            const sim2 = new MayaBossEngine();
            sim2.loadState(sim.cloneState());
            sim2.executeWhiteMove(wMoves[j], 'Q', false);
            const ev = this.evaluate(sim2);
            if (ev < val) val = ev;
            if (val <= bestScore - noiseRange) break;
          }
        }
      }

      if (move.isPyramid) val += 22;
      val += (Math.random() * noiseRange * 2 - noiseRange);

      if (val > bestScore) {
        bestScore = val;
        bestMove = move;
      }
    }
    return bestMove;
  }
}
