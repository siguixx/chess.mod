import express from 'express';

export function createLeaderboardRouter(db) {
  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 50));
      const players = await db.getLeaderboard(limit);
      return res.json({ players });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  return router;
}
