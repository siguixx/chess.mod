import { MayaCampaignEngine } from '../rules/mayaCampaignEngine.js';

export class MayaCampaignAI {
  static VAL = {
    K: 20000,
    Q: 950,
    R: 520,
    B: 350,
    N: 330,
    P: 100,
    H: 0,
    A: 370, // Arquera de Obsidiana
    G: 260, // Escudero de Jade
    J: 390, // Jaguar de Piedra
    C: 310  // Chamán Solar
  };

  static evaluate(engine, perspective = 'b') {
    if (engine.winner === perspective) return 100000;
    if (engine.winner && engine.winner !== perspective) return -100000;

    let score = 0;
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        let val = this.VAL[p.type] || 100;
        if (p.type === 'G' && p.shieldIntact) val += 75;
        if (p.type === 'C' && p.pushCooldown === 0) val += 40;
        const center = (3.5 - Math.abs(3.5 - c)) * 5 + (3.5 - Math.abs(3.5 - r)) * 4;
        if (p.color === 'b') {
          score += val + center + (p.type === 'P' ? r * 12 : 0);
        } else {
          score -= val + center + (p.type === 'P' ? (7 - r) * 12 : 0);
        }
      }
    }
    if (engine.isKingInCheck('w')) score += 65;
    if (engine.isKingInCheck('b')) score -= 80;
    return perspective === 'b' ? score : -score;
  }

  static scoreMove(engine, m) {
    if (m.isRangedAttack) {
      const target = engine.board[m.tr][m.tc];
      return 480 + (this.VAL[target?.type] || 100);
    }
    if (m.isShamanPush) {
      const target = engine.board[m.tr][m.tc];
      return 240 + (this.VAL[target?.type] || 100) * 0.35;
    }
    const piece = engine.board[m.fr][m.fc];
    const target = engine.board[m.tr][m.tc];
    let s = (3.5 - Math.abs(3.5 - m.tc)) * 4;
    if (target) {
      s += 320 + (this.VAL[target.type] || 100) - (this.VAL[piece.type] || 100) * 0.12;
      if (target.type === 'G' && target.shieldIntact && engine.isFrontalAttackOnEscudero(m.fr, m.fc, m.tr, m.tc)) {
        s -= 140; // Preferir flanquear al Escudero si hay alternativa
      }
    }
    if (m.isJaguarLeap) s += 35;
    return s;
  }

  static chooseBestMove(engine, difficulty = 3, color = 'b') {
    const moves = engine.getAllLegalMoves(color);
    if (moves.length === 0) return null;

    moves.sort((a, b) => this.scoreMove(engine, b) - this.scoreMove(engine, a));
    const diff = Math.max(1, Math.min(5, difficulty || 3));
    const limit = Math.min([12, 14, 16, 20, 22][diff - 1], moves.length);
    const replyLimit = [0, 5, 8, 12, 15][diff - 1];
    const noiseRange = [220, 155, 100, 45, 4][diff - 1];
    const blunderChance = [0.34, 0.22, 0.12, 0.04, 0][diff - 1];
    const opp = color === 'b' ? 'w' : 'b';

    const scored = [];

    for (let i = 0; i < limit; i++) {
      const m = moves[i];
      const sim = new MayaCampaignEngine(engine.levelId);
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
          replies.sort((a, b) => this.scoreMove(sim, b) - this.scoreMove(sim, a));
          const rLim = Math.min(replyLimit, replies.length);
          val = Infinity;
          for (let j = 0; j < rLim; j++) {
            const sim2 = new MayaCampaignEngine(engine.levelId);
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
      const poolSize = Math.min(diff === 1 ? 4 : 3, scored.length);
      const pick = scored[1 + Math.floor(Math.random() * (poolSize - 1))];
      if (pick && pick.val > -50000) return pick.move;
    }
    return scored[0].move;
  }
}
