import express from 'express';
import { CLAN_CREATE_COST_MODS } from '../../shared/config/constants.js';

export function createSocialRouter(db, authMiddleware, multiplayer) {
  const router = express.Router();

  // ================= CLANES =================
  router.get('/clans', async (_req, res) => {
    try {
      const clans = await db.listClans();
      return res.json({ clans, createCostMods: CLAN_CREATE_COST_MODS });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/clans', authMiddleware.requireAuth, async (req, res) => {
    try {
      const { name, tag, description } = req.body || {};
      const result = await db.createClan(req.userId, { name, tag, description });
      return res.status(201).json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ code: err.code, error: err.message });
    }
  });

  router.post('/clans/:id/join', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.joinClan(req.userId, req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/clans/leave', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.leaveClan(req.userId);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ================= AMIGOS =================
  router.get('/friends', authMiddleware.requireAuth, async (req, res) => {
    try {
      const summary = await db.getFriendsSummary(req.userId);
      return res.json(summary);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/friends/request', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.sendFriendRequest(req.userId, req.body?.username);
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/friends/:id/accept', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.respondFriendRequest(req.userId, req.params.id, true);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/friends/:id/reject', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.respondFriendRequest(req.userId, req.params.id, false);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.delete('/friends/:id', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.removeFriendship(req.userId, req.params.id);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ================= REPORTES DE HACKS Y CHEATS =================
  router.post('/reports', authMiddleware.requireAuth, async (req, res) => {
    try {
      const { reportedUsername, category, description, matchId } = req.body || {};
      const result = await db.createReport(req.userId, { reportedUsername, category, description, matchId });
      return res.status(201).json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  // ================= PANEL DE MODERACIÓN (EXCLUSIVO MODERADORES) =================
  router.get('/mod/overview', authMiddleware.requireModerator, async (_req, res) => {
    try {
      const overview = await db.getModeratorOverview();
      return res.json(overview);
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  router.post('/mod/ban', authMiddleware.requireModerator, async (req, res) => {
    try {
      const { userId, reason } = req.body || {};
      const result = await db.banUser(req.userId, userId, reason);
      if (multiplayer?.disconnectUserById) multiplayer.disconnectUserById(userId);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/mod/unban', authMiddleware.requireModerator, async (req, res) => {
    try {
      const { userId } = req.body || {};
      const result = await db.unbanUser(userId);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/mod/reports/:id/resolve', authMiddleware.requireModerator, async (req, res) => {
    try {
      const { status, resolutionNote } = req.body || {};
      const result = await db.resolveReport(req.userId, req.params.id, { status, resolutionNote });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.post('/mod/grant-all', authMiddleware.requireModerator, async (req, res) => {
    try {
      const user = await db.grantModeratorEverything(req.userId);
      return res.json({ ok: true, user });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  return router;
}
