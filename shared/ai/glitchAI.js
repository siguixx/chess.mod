import { GlitchEngine } from '../rules/glitchEngine.js';

export class GlitchAI {
  static VAL = { K: 20000, Q: 980, R: 540, B: 360, N: 370, P: 115, U: 0 };

  static evaluate(engine, perspective = 'b') {
    if (engine.winner === perspective) return 100000;
    if (engine.winner && engine.winner !== perspective) return -100000;

    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        const val = this.VAL[p.type] || 100;
        const center = (3.5 - Math.abs(3.5 - c)) * 7 + (3.5 - Math.abs(3.5 - r)) * 6;
        if (p.color === 'b') score += val + center + (p.type === 'P' ? r * 14 : 0);
        else score -= val + center + (p.type === 'P' ? (7 - r) * 14 : 0);
      }
    }
    if (engine.isKingInCheck('w')) score += 95;
    if (engine.isKingInCheck('b')) score -= 110;
    return perspective === 'b' ? score : -score;
  }

  static scoreMove(engine, m) {
    if (m.isFurySwap) return 180;
    const piece = engine.board[m.fr][m.fc];
    const target = engine.board[m.tr][m.tc];
    let s = (3.5 - Math.abs(3.5 - m.tc)) * 6;
    if (target) s += 420 + (this.VAL[target.type] || 100) - (this.VAL[piece.type] || 100) * 0.12;
    if (m.isAnomaly) s += 55;
    return s;
  }

  static chooseBestMove(engine, difficulty = 3, color = 'b') {
    const moves = engine.getAllLegalMoves(color);
    if (moves.length === 0) return null;
    moves.sort((a, b) => this.scoreMove(engine, b) - this.scoreMove(engine, a));

    const diff = Math.max(1, Math.min(5, difficulty || 3));
    const limit = Math.min([12, 15, 18, 22, 28][diff - 1], moves.length);
    const replyLimit = [0, 6, 10, 13, 18][diff - 1];
    const noiseRange = [190, 130, 85, 52, 4][diff - 1];
    const blunderChance = [0.26, 0.18, 0.10, 0.05, 0][diff - 1];
    const opp = color === 'b' ? 'w' : 'b';

    const scored = [];

    for (let i = 0; i < limit; i++) {
      const m = moves[i];
      const sim = new GlitchEngine(engine.levelId);
      sim.loadState(engine.cloneState());
      sim.executeMove(m, 'Q', false);

      let val;
      if (sim.winner === color) return m;
      if (sim.winner === opp) val = -100000;
      else if (replyLimit === 0) val = this.evaluate(sim, color);
      else {
        const replies = sim.getAllLegalMoves(opp);
        if (replies.length === 0) val = 95000;
        else {
          replies.sort((a, b) => this.scoreMove(sim, b) - this.scoreMove(sim, a));
          const rLim = Math.min(replyLimit, replies.length);
          val = Infinity;
          for (let j = 0; j < rLim; j++) {
            const sim2 = new GlitchEngine(engine.levelId);
            sim2.loadState(sim.cloneState());
            sim2.executeMove(replies[j], 'Q', false);
            const ev = this.evaluate(sim2, color);
            if (ev < val) val = ev;
          }
        }
      }
      val += (Math.random() * noiseRange * 2 - noiseRange);
      scored.push({ move: m, val });
    }

    scored.sort((a, b) => b.val - a.val);
    if (blunderChance > 0 && scored.length > 1 && Math.random() < blunderChance) {
      const poolSize = Math.min(3, scored.length);
      const pick = scored[1 + Math.floor(Math.random() * (poolSize - 1))];
      if (pick && pick.val > -50000) return pick.move;
    }
    return scored[0].move;
  }
}
