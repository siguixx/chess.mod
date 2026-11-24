import express from 'express';
import { HINT_XP_COST } from '../../shared/config/constants.js';
import { getCampaignLevel, isCampaignLevelUnlocked, getCampaignUnlockReason } from '../../shared/config/campaigns.js';

export function createGameRouter(db, authMiddleware) {
  const router = express.Router();

  /**
   * Valida estrictamente en servidor si un nivel de campaña está desbloqueado.
   * Nadie puede saltar niveles (1->2->3->4->5) ni capítulos (1->2->3->4->5).
   */
  router.post('/campaign/start', authMiddleware.requireAuth, async (req, res) => {
    try {
      const { campaignId, levelId } = req.body || {};
      const lvl = getCampaignLevel(campaignId, levelId);
      if (!lvl) return res.status(404).json({ error: 'Nivel de campaña inexistente.' });

      const campaigns = await db.getCampaignsProgress(req.userId);
      if (!isCampaignLevelUnlocked(campaignId, lvl.id, campaigns)) {
        return res.status(403).json({
          ok: false,
          code: 'LEVEL_LOCKED',
          error: getCampaignUnlockReason(campaignId, lvl.id, campaigns) || 'Nivel bloqueado.'
        });
      }
      return res.json({ ok: true, campaignId, levelId: lvl.id });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * Valida y descuenta el coste REAL de XP (25 XP) en servidor antes de otorgar pista táctica.
   */
  router.post('/hint', authMiddleware.requireAuth, async (req, res) => {
    const result = await db.spendXpForHint(req.userId, HINT_XP_COST);
    if (!result.ok) return res.status(400).json(result);
    return res.json(result);
  });

  /**
   * Registra resultado de partida de un jugador o campaña (validando desbloqueo en servidor).
   */
  router.post('/report', authMiddleware.requireAuth, async (req, res) => {
    try {
      const {
        mode = 'classic',
        opponentName = 'IA',
        winner = 'b',
        resultReason = '',
        turns = 1,
        basesDestroyed = 0,
        campaignId = null,
        levelId = null
      } = req.body || {};

      if (!['w', 'b', 'draw'].includes(winner)) {
        return res.status(400).json({ error: 'Resultado de partida inválido.' });
      }

      let xpReward = 65;
      if (campaignId && levelId) {
        const lvl = getCampaignLevel(campaignId, levelId);
        if (!lvl) return res.status(404).json({ error: 'Nivel de campaña inválido.' });
        xpReward = lvl.xpReward;
      }

      const report = await db.recordSinglePlayerMatch(req.userId, {
        mode,
        opponentName,
        winner,
        resultReason,
        turns,
        basesDestroyed,
        campaignId,
        levelId,
        xpReward
      });

      return res.json(report);
    } catch (err) {
      return res.status(err.status || 500).json({ code: err.code, error: err.message || 'No se pudo guardar el resultado.' });
    }
  });

  return router;
}
