import { GalaxyEngine } from '../rules/galaxyEngine.js';

export class GalaxyAI {
  static VAL = { K: 20000, Q: 960, R: 540, B: 460, N: 440, P: 100, U: 0 };

  static evaluate(engine, perspective = 'b') {
    if (engine.winner === perspective) return 100000;
    if (engine.winner && engine.winner !== perspective) return -100000;

    let score = 0;
    const wAttacks = engine.getSquaresAttackedBy('w');
    const bAttacks = engine.getSquaresAttackedBy('b');

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const p = engine.board[r][c];
        if (!p) continue;
        let val = this.VAL[p.type] || 100;
        const center = (3.5 - Math.abs(3.5 - c)) * 6 + (3.5 - Math.abs(3.5 - r)) * 5;
        if (p.color === 'b') {
          score += val + center + (p.type === 'P' ? r * 12 : 0);
          // En Nivel 5 los Alfiles y Caballos sostienen al Hombre Galaxia 2×2
          if (engine.hasGalaxyMan && (p.type === 'B' || p.type === 'N')) {
            score += 220;
            if (wAttacks.has(`${r},${c}`)) {
              score -= bAttacks.has(`${r},${c}`) ? 120 : 320;
            }
          }
        } else {
          score -= val + center + (p.type === 'P' ? (7 - r) * 12 : 0);
        }
      }
    }

    if (engine.hasGalaxyMan && engine.galaxyMan && !engine.galaxyMan.destroyed) {
      score += 300 + engine.galaxyMan.r * 22;
      for (const sq of engine.getGalaxyManThreatSquares()) {
        const [tr, tc] = sq.split(',').map(Number);
        const wp = engine.board[tr][tc];
        if (wp && wp.color === 'w' && wp.type !== 'U' && !engine.isProtectedByBarrier(tr, tc)) {
          score += (this.VAL[wp.type] || 100) * 0.45;
        }
      }
    }

    if (engine.isKingInCheck('w')) score += 75;
    if (engine.isKingInCheck('b')) score -= 90;
    return perspective === 'b' ? score : -score;
  }

  static scoreMove(engine, m) {
    if (m.isGalaxyMan) {
      let s = 240 + m.nr * 14;
      for (const [r, c] of [[m.nr, m.nc], [m.nr, m.nc + 1], [m.nr + 1, m.nc], [m.nr + 1, m.nc + 1]]) {
        const p = engine.board[r][c];
        if (p && p.color === 'w' && p.type !== 'U' && !engine.isProtectedByBarrier(r, c)) {
          s += 500 + (this.VAL[p.type] || 100);
        }
      }
      return s;
    }
    if (m.isTeleport) return 150 + (3.5 - Math.abs(3.5 - m.tc)) * 8;
    const piece = engine.board[m.fr][m.fc];
    const target = engine.board[m.tr][m.tc];
    let s = (3.5 - Math.abs(3.5 - m.tc)) * 5;
    if (target) s += 360 + (this.VAL[target.type] || 100) - (this.VAL[piece.type] || 100) * 0.14;
    if (engine.hasGalaxyMan && piece && (piece.type === 'B' || piece.type === 'N')) {
      const wAtk = engine.getSquaresAttackedBy('w');
      if (wAtk.has(`${m.fr},${m.fc}`) && !wAtk.has(`${m.tr},${m.tc}`)) s += 260;
    }
    return s;
  }

  static chooseBestMove(engine, difficulty = 5, color = 'b') {
    const moves = engine.getAllLegalMoves(color);
    if (moves.length === 0) return null;
    moves.sort((a, b) => this.scoreMove(engine, b) - this.scoreMove(engine, a));

    const diff = Math.max(1, Math.min(5, difficulty || 5));
    const limit = Math.min(diff >= 4 ? 26 : 18, moves.length);
    const replyLimit = Math.min(diff >= 4 ? 18 : 12, 22);
    const noiseRange = [75, 45, 22, 10, 4][diff - 1];
    const opp = color === 'b' ? 'w' : 'b';

    let bestMove = moves[0];
    let bestScore = -Infinity;

    for (let i = 0; i < limit; i++) {
      const m = moves[i];
      const sim = new GalaxyEngine(engine.levelId);
      sim.loadState(engine.cloneState());
      sim.executeMove(m, 'Q', false);

      let val;
      if (sim.winner === color) return m;
      if (sim.winner === opp) val = -100000;
      else {
        const replies = sim.getAllLegalMoves(opp);
        if (replies.length === 0) val = 90000;
        else {
          replies.sort((a, b) => this.scoreMove(sim, b) - this.scoreMove(sim, a));
          const rLim = Math.min(replyLimit, replies.length);
          val = Infinity;
          for (let j = 0; j < rLim; j++) {
            const sim2 = new GalaxyEngine(engine.levelId);
            sim2.loadState(sim.cloneState());
            sim2.executeMove(replies[j], 'Q', false);
            const ev = this.evaluate(sim2, color);
            if (ev < val) val = ev;
            if (val <= bestScore - noiseRange) break;
          }
        }
      }
      if (m.isGalaxyMan) val += 24;
      val += (Math.random() * noiseRange * 2 - noiseRange);
      if (val > bestScore) {
        bestScore = val;
        bestMove = m;
      }
    }
    return bestMove;
  }
}
