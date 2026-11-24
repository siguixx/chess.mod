import express from 'express';
import { validateUsername } from '../auth/authService.js';
import { getAllCosmetics } from '../../shared/config/cosmetics.js';

export function createProfileRouter(db, authMiddleware) {
  const router = express.Router();

  router.get('/cosmetics', (_req, res) => res.json(getAllCosmetics()));

  router.get('/profile', authMiddleware.requireAuth, async (req, res) => {
    const profile = await db.getFullUserProfile(req.userId);
    return res.json({ user: profile });
  });

  router.patch('/profile/username', authMiddleware.requireAuth, async (req, res) => {
    try {
      const uVal = validateUsername(req.body?.username);
      if (!uVal.ok) return res.status(400).json({ error: uVal.error });
      const profile = await db.updateUsername(req.userId, uVal.name);
      return res.json({ user: profile });
    } catch (err) {
      return res.status(409).json({ error: err.message });
    }
  });

  router.patch('/profile/avatar', authMiddleware.requireAuth, async (req, res) => {
    try {
      const avatar = String(req.body?.avatar || '');
      const isPreset = /^preset:[a-z0-9_]+$/.test(avatar);
      const isDataImg = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(avatar);
      if (!isPreset && !isDataImg) return res.status(400).json({ error: 'Formato de avatar inválido.' });
      if (isDataImg && avatar.length > 260000) return res.status(400).json({ error: 'Imagen demasiado pesada.' });
      const profile = isPreset
        ? await db.updateCosmetics(req.userId, { avatar })
        : await db.updateAvatar(req.userId, avatar);
      return res.json({ user: profile });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.patch('/profile/cosmetics', authMiddleware.requireAuth, async (req, res) => {
    try {
      const { avatar, frameId, boardThemeId } = req.body || {};
      const profile = await db.updateCosmetics(req.userId, { avatar, frameId, boardThemeId });
      return res.json({ user: profile });
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
  });

  router.get('/profile/history', authMiddleware.requireAuth, async (req, res) => {
    const matches = await db.getUserMatches(req.userId, 50);
    return res.json({ matches });
  });

  router.get('/users/:id/public', async (req, res) => {
    const row = await db.findUserById(req.params.id);
    if (!row) return res.status(404).json({ error: 'Jugador no encontrado.' });
    return res.json({ user: db.formatPublicUser(row) });
  });

  return router;
}
