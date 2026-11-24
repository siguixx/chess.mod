import { PIECE_NAMES, toAlg } from '../config/constants.js';
import { MayaBossEngine } from '../rules/mayaEngine.js';
import { MayaBossAI } from './mayaAI.js';
import { MayaCampaignAI } from './mayaCampaignAI.js';
import { FreeMittensAI } from './mittensAI.js';
import { GalaxyAI } from './galaxyAI.js';
import { GlitchAI } from './glitchAI.js';
import { ClassicAI } from './classicAI.js';
import { SuperChessAI } from './superChessAI.js';

export class HintEngine {
  static evaluateMayaForWhite(engine) {
    if (engine.winner === 'w') return 100000;
    if (engine.winner === 'b') return -100000;
    let score = -MayaBossAI.evaluate(engine);
    score += (4 - engine.countAliveBases()) * 260;
    if (!engine.pyramid.destroyed && engine.pyramid.disabledTurns === 0) {
      score += engine.getProtectedWhiteSquares().size * 22;
    }
    return score;
  }

  static orderMayaMoves(engine, moves, color) {
    return moves.slice().sort((a, b) => MayaBossAI.scoreMoveOrder(engine, b, color) - MayaBossAI.scoreMoveOrder(engine, a, color));
  }

  static alphaBetaMaya(engine, depth, alpha, beta, maximizingWhite, deadline) {
    if (engine.winner || depth <= 0 || performance.now() > deadline) {
      return this.evaluateMayaForWhite(engine);
    }
    if (maximizingWhite) {
      const moves = this.orderMayaMoves(engine, engine.getAllLegalMoves('w'), 'w');
      if (moves.length === 0) return engine.isKingInCheck('w') ? -90000 - depth * 100 : 0;
      const limit = Math.min(depth >= 2 ? 14 : 10, moves.length);
      let value = -Infinity;
      for (let i = 0; i < limit; i++) {
        const sim = new MayaBossEngine();
        sim.loadState(engine.cloneState());
        sim.executeWhiteMove(moves[i], 'Q', false);
        const sc = this.alphaBetaMaya(sim, depth - 1, alpha, beta, false, deadline);
        if (sc > value) value = sc;
        if (value > alpha) alpha = value;
        if (alpha >= beta || performance.now() > deadline) break;
      }
      return value;
    } else {
      const moves = this.orderMayaMoves(engine, engine.getAllLegalMoves('b'), 'b');
      if (moves.length === 0) return engine.isKingInCheck('b') ? 90000 + depth * 100 : 0;
      const limit = Math.min(depth >= 2 ? 14 : 10, moves.length);
      let value = Infinity;
      for (let i = 0; i < limit; i++) {
        const sim = new MayaBossEngine();
        sim.loadState(engine.cloneState());
        sim.executeBlackMove(moves[i], false);
        const sc = this.alphaBetaMaya(sim, depth - 1, alpha, beta, true, deadline);
        if (sc < value) value = sc;
        if (value < beta) beta = value;
        if (alpha >= beta || performance.now() > deadline) break;
      }
      return value;
    }
  }

  static analyzeMaya(engine) {
    const legal = engine.getAllLegalMoves('w');
    if (legal.length === 0) return null;
    const ordered = this.orderMayaMoves(engine, legal, 'w');
    const deadline = performance.now() + 360;
    let bestMove = ordered[0];
    let bestScore = -Infinity;

    for (let depth = 1; depth <= 3; depth++) {
      let iterBest = bestMove;
      let iterScore = -Infinity;
      let alpha = -Infinity;
      const limit = Math.min(depth === 3 ? 10 : 18, ordered.length);
      for (let i = 0; i < limit; i++) {
        const m = ordered[i];
        const sim = new MayaBossEngine();
        sim.loadState(engine.cloneState());
        sim.executeWhiteMove(m, 'Q', false);
        if (sim.winner === 'w') { bestMove = m; bestScore = 100000; depth = 99; break; }
        const sc = this.alphaBetaMaya(sim, depth - 1, alpha, Infinity, false, deadline);
        if (sc > iterScore) { iterScore = sc; iterBest = m; }
        if (iterScore > alpha) alpha = iterScore;
        if (performance.now() > deadline) break;
      }
      if (performance.now() <= deadline || depth === 1) { bestMove = iterBest; bestScore = iterScore; }
      if (performance.now() > deadline) break;
    }

    const piece = engine.board[bestMove.fr][bestMove.fc];
    const target = bestMove.isEnPassant ? engine.board[bestMove.fr][bestMove.tc] : engine.board[bestMove.tr][bestMove.tc];
    const fromAlg = toAlg(bestMove.fr, bestMove.fc);
    const toAlgSq = toAlg(bestMove.tr, bestMove.tc);
    let text = `Mueve tu ${PIECE_NAMES[piece.type]} de ${fromAlg} a ${toAlgSq} para reforzar tu ventaja estratégica.`;
    if (bestScore >= 90000) text = `¡Jugada ganadora! Mueve ${PIECE_NAMES[piece.type]} (${fromAlg} → ${toAlgSq}).`;
    else if (target?.isBase) text = `¡Ataca una Base Sagrada! Captura ${target.baseLabel} (${fromAlg} → ${toAlgSq}) para deshabilitar la Pirámide.`;
    else if (piece.type === 'H') text = `Desplaza tu Casa (${fromAlg} → ${toAlgSq}) para escudar tus piezas contra la Pirámide.`;
    return { from: [bestMove.fr, bestMove.fc], to: [bestMove.tr, bestMove.tc], text };
  }

  static analyze(engine) {
    if (!engine || engine.winner) return null;
    if (engine.mode === 'maya') return this.analyzeMaya(engine);

    if (engine.mode === 'mittens') {
      const m = FreeMittensAI.chooseBestMove(engine, 5, 'w');
      if (!m) return null;
      const fromAlg = toAlg(m.fr, m.fc);
      const toAlgSq = toAlg(m.tr, m.tc);
      if (m.isWaterShot) {
        return { from: [m.fr, m.fc], to: [m.tr, m.tc], text: `Haz 1 clic en tu Soldado (${fromAlg}) y dispara a ${toAlgSq} para repeler sin moverte.` };
      }
      const p = engine.board[m.fr][m.fc];
      return { from: [m.fr, m.fc], to: [m.tr, m.tc], text: `Juega ${PIECE_NAMES[p.type]} (${fromAlg} → ${toAlgSq}).` };
    }

    if (engine.mode === 'maya_campaign') {
      const m = MayaCampaignAI.chooseBestMove(engine, 4, 'w');
      if (!m) return null;
      const p = engine.board[m.fr][m.fc];
      return { from: [m.fr, m.fc], to: [m.tr, m.tc], text: `Juega ${PIECE_NAMES[p.type]} (${toAlg(m.fr, m.fc)} → ${toAlg(m.tr, m.tc)}).` };
    }

    if (engine.mode === 'galaxy') {
      const m = GalaxyAI.chooseBestMove(engine, 4, 'w');
      if (!m) return null;
      const p = engine.board[m.fr][m.fc];
      const t = engine.board[m.tr][m.tc];
      const note = (engine.hasGalaxyMan && t && (t.type === 'B' || t.type === 'N'))
        ? `¡Elimina ese ${PIECE_NAMES[t.type]} para debilitar al Hombre Galaxia 2×2!`
        : `Juega ${PIECE_NAMES[p.type]} (${toAlg(m.fr, m.fc)} → ${toAlg(m.tr, m.tc)}).`;
      return { from: [m.fr, m.fc], to: [m.tr, m.tc], text: note };
    }

    if (engine.mode === 'glitch') {
      const m = GlitchAI.chooseBestMove(engine, 4, 'w');
      if (!m) return null;
      const p = engine.board[m.fr][m.fc];
      return { from: [m.fr, m.fc], to: [m.tr, m.tc], text: `Esquiva las grietas con ${PIECE_NAMES[p.type]} (${toAlg(m.fr, m.fc)} → ${toAlg(m.tr, m.tc)}).` };
    }

    if (engine.mode === 'chess_final') {
      const superAi = new SuperChessAI();
      const res = superAi.chooseBestMove(engine.cloneState(), { maxDepth: 4, thinkTimeMs: 380, color: 'w' });
      const m = res?.move;
      if (!m) return null;
      const p = engine.board[m.fr][m.fc];
      return { from: [m.fr, m.fc], to: [m.tr, m.tc], text: `Cálculo maestro: ${PIECE_NAMES[p.type]} (${toAlg(m.fr, m.fc)} → ${toAlg(m.tr, m.tc)}).` };
    }

    const m = ClassicAI.chooseBestMove(engine, 4, engine.turn);
    if (!m) return null;
    const p = engine.board[m.fr][m.fc];
    return { from: [m.fr, m.fc], to: [m.tr, m.tc], text: `Jugada recomendada: ${PIECE_NAMES[p.type]} (${toAlg(m.fr, m.fc)} → ${toAlg(m.tr, m.tc)}).` };
  }
}
