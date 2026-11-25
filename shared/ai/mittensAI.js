import { FreeMittensEngine } from '../rules/mittensEngine.js';

export class FreeMittensAI {
  static VAL = { K: 20000, Q: 950, R: 520, B: 340, N: 320, P: 100 };

  static evaluate(engine, perspective = 'b') {
    if (engine.winner === perspective) return 100000;
    if (engine.winner && engine.winner !== perspective) return -100000;

    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        const val = this.VAL[p.type] || 100;
        const center = (3.5 - Math.abs(3.5 - c)) * 5 + (3.5 - Math.abs(3.5 - r)) * 4;
        const soldierBonus = p.isSoldier ? 90 : 0;
        if (p.color === 'b') score += val + center + (p.type === 'P' ? r * 12 : 0);
        else score -= val + center + soldierBonus + (p.type === 'P' ? (7 - r) * 12 : 0);
      }
    }
    if (engine.isKingInCheck('w')) score += 60;
    if (engine.isKingInCheck('b')) score -= 75;
    return perspective === 'b' ? score : -score;
  }

  static scoreMove(engine, m, color) {
    if (m.isWaterShot) {
      const victim = engine.board[m.tr][m.tc];
      return (m.canDisplace ? 260 : 80) + (this.VAL[victim?.type] || 100) * 0.45;
    }
    const piece = engine.board[m.fr][m.fc];
    const target = engine.board[m.tr][m.tc];
    let s = (3.5 - Math.abs(3.5 - m.tc)) * 4;
    if (target) {
      const soldierBonus = target.isSoldier ? 110 : 0;
      const conversionValue = color === 'b' ? (this.VAL[target.type] || 100) * 0.75 : 0;
      s += 360 + (this.VAL[target.type] || 100) + soldierBonus + conversionValue - (this.VAL[piece.type] || 100) * 0.1;
    }
    return s;
  }

  static chooseBestMove(engine, difficulty = 3, color = 'b') {
    const moves = engine.getAllLegalMoves(color);
    if (moves.length === 0) return null;

    moves.sort((a, b) => this.scoreMove(engine, b, color) - this.scoreMove(engine, a, color));
    const diff = Math.max(1, Math.min(5, difficulty || 3));
    const opp = color === 'b' ? 'w' : 'b';
    const limit = Math.min([12, 14, 17, 20, 22][diff - 1], moves.length);
    const replyLimit = [0, 6, 9, 13, 16][diff - 1];
    const noiseRange = [210, 145, 95, 48, 5][diff - 1];
    const blunderChance = [0.32, 0.20, 0.12, 0.05, 0][diff - 1];

    const scored = [];

    for (let i = 0; i < limit; i++) {
      const m = moves[i];
      const sim = new FreeMittensEngine(engine.bossId);
      sim.loadState(engine.cloneState());
      sim.executeMove(m, 'Q', false);

      let val;
      if (sim.winner === color) return m;
      if (sim.winner === opp) {
        val = -100000;
      } else if (replyLimit === 0) {
        val = this.evaluate(sim, color);
      } else {
        const replies = sim.getAllLegalMoves(opp);
        if (replies.length === 0) {
          val = 90000;
        } else {
          replies.sort((a, b) => this.scoreMove(sim, b, opp) - this.scoreMove(sim, a, opp));
          const rLim = Math.min(replyLimit, replies.length);
          val = Infinity;
          for (let j = 0; j < rLim; j++) {
            const sim2 = new FreeMittensEngine(engine.bossId);
            sim2.loadState(sim.cloneState());
            sim2.executeMove(replies[j], 'Q', false);
            const ev = this.evaluate(sim2, color);
            if (ev < val) val = ev;
          }
        }
      }
      if (m.isWaterShot && m.canDisplace) val += 55;
      val += (Math.random() * noiseRange * 2 - noiseRange);
      scored.push({ move: m, val });
    }

    scored.sort((a, b) => b.val - a.val);
    if (blunderChance > 0 && scored.length > 1 && Math.random() < blunderChance) {
      const poolSize = Math.min(diff === 1 ? 4 : 3, scored.length);
      const pick = scored[1 + Math.floor(Math.random() * (poolSize - 1))];
      if (pick && pick.val > -50000) return pick.move;
    }
    return scored[0].move;
  }
}
