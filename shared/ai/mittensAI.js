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

  static chooseBestMove(engine, difficulty = 5, color = 'b') {
    const moves = engine.getAllLegalMoves(color);
    if (moves.length === 0) return null;

    moves.sort((a, b) => this.scoreMove(engine, b, color) - this.scoreMove(engine, a, color));
    const diff = Math.max(1, Math.min(5, difficulty || 5));
    const opp = color === 'b' ? 'w' : 'b';
    const limit = Math.min(diff >= 4 ? 22 : 14, moves.length);
    const replyLimit = Math.min(diff >= 4 ? 14 : 9, 18);
    const noiseRange = [115, 70, 36, 16, 6][diff - 1];

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (let i = 0; i < limit; i++) {
      const m = moves[i];
      const sim = new FreeMittensEngine(engine.bossId);
      sim.loadState(engine.cloneState());
      sim.executeMove(m, 'Q', false);

      let val;
      if (sim.winner === color) return m;
      if (sim.winner === opp) {
        val = -100000;
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
            if (val <= bestScore - noiseRange) break;
          }
        }
      }
      if (m.isWaterShot && m.canDisplace) val += 55;
      val += (Math.random() * noiseRange * 2 - noiseRange);
      if (val > bestScore) {
        bestScore = val;
        bestMove = m;
      }
    }
    return bestMove;
  }
}
