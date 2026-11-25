import express from 'express';
import { validateUsername } from '../auth/authService.js';
import { getAllCosmetics } from '../../shared/config/cosmetics.js';

export function createProfileRouter(db, authMiddleware) {
  const router = express.Router();

  router.get('/cosmetics', (_req, res) => res.json(getAllCosmetics()));
  router.get('/shop', (_req, res) => res.json(getAllCosmetics()));

  router.post('/shop/buy', authMiddleware.requireAuth, async (req, res) => {
    try {
      const itemId = String(req.body?.itemId || '').trim();
      if (!itemId) return res.status(400).json({ error: 'Debes indicar el artículo a comprar.' });
      const result = await db.buyShopItem(req.userId, itemId);
      return res.json(result);
    } catch (err) {
      return res.status(err.status || 400).json({ code: err.code, error: err.message });
    }
  });

  router.post('/vip/subscribe', authMiddleware.requireAuth, async (req, res) => {
    try {
      const durationDays = Number(req.body?.durationDays) || 30;
      const result = await db.activateModVip(req.userId, { durationDays });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'No se pudo activar Mod VIP.' });
    }
  });

  router.post('/vip/cancel', authMiddleware.requireAuth, async (req, res) => {
    try {
      const result = await db.cancelModVip(req.userId);
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'No se pudo cancelar Mod VIP.' });
    }
  });

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
      const { avatar, frameId, boardThemeId, pieceSkinId, equippedPowerId } = req.body || {};
      const profile = await db.updateCosmetics(req.userId, { avatar, frameId, boardThemeId, pieceSkinId, equippedPowerId });
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
