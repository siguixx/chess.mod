import crypto from 'node:crypto';
import express from 'express';
import { validateUsername } from '../auth/authService.js';
import { getAllCosmetics, MOD_VIP_PLAN } from '../../shared/config/cosmetics.js';
import { TRAINERS } from '../../shared/config/constants.js';

function getVipBillingConfig() {
  const stripeSecretKey = String(process.env.STRIPE_SECRET_KEY || '').trim();
  const stripeWebhookSecret = String(process.env.STRIPE_WEBHOOK_SECRET || '').trim();
  const paymentLinkUrl = String(process.env.VIP_PAYMENT_LINK_URL || '').trim();
  const serverBillingSecret = String(process.env.VIP_WEBHOOK_SECRET || '').trim();
  return {
    stripeSecretKey,
    stripeWebhookSecret,
    paymentLinkUrl,
    serverBillingSecret,
    stripeConfigured: Boolean(stripeSecretKey),
    billingConfigured: Boolean(stripeSecretKey || paymentLinkUrl)
  };
}

async function createRealStripeCheckoutSession(req, userProfile, cfg) {
  const origin = `${req.protocol}://${req.get('host')}`;
  const params = new URLSearchParams();
  params.set('mode', 'subscription');
  params.set('success_url', `${origin}/?vip_session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/?vip_canceled=1`);
  params.set('client_reference_id', userProfile.id);
  params.set('customer_email', userProfile.email);
  params.set('metadata[userId]', userProfile.id);
  params.set('line_items[0][quantity]', '1');

  const priceId = String(process.env.STRIPE_VIP_PRICE_ID || '').trim();
  if (priceId) {
    params.set('line_items[0][price]', priceId);
  } else {
    params.set('line_items[0][price_data][currency]', 'usd');
    params.set('line_items[0][price_data][unit_amount]', String(MOD_VIP_PLAN.priceUsd * 100)); // 500 = $5.00 USD
    params.set('line_items[0][price_data][recurring][interval]', 'month');
    params.set('line_items[0][price_data][product_data][name]', 'CHESS.MOD — Suscripción Mensual Mod VIP');
    params.set('line_items[0][price_data][product_data][description]', 'Aurora dorada visible, Poder Tormenta Dorada OP, Fichas Doradas y Tablero Dorado/Negro.');
  }

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${cfg.stripeSecretKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok || !data.url) {
    throw new Error(data.error?.message || 'Stripe no pudo generar la sesión de cobro de $5 USD/mes.');
  }
  return { sessionId: data.id, checkoutUrl: data.url };
}

async function verifyStripePaidSession(sessionId, stripeSecretKey) {
  if (!sessionId || !stripeSecretKey) return null;
  const resp = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
    headers: { Authorization: `Bearer ${stripeSecretKey}` }
  });
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) return null;
  if (data.payment_status !== 'paid' && data.status !== 'complete') return null;
  return data;
}

export function createProfileRouter(db, authMiddleware) {
  const router = express.Router();

  router.get('/cosmetics', (_req, res) => res.json(getAllCosmetics()));
  router.get('/shop', (_req, res) => res.json(getAllCosmetics()));

  router.get('/vip/status', (_req, res) => {
    const cfg = getVipBillingConfig();
    return res.json({
      plan: MOD_VIP_PLAN,
      billingConfigured: cfg.billingConfigured,
      stripeConfigured: cfg.stripeConfigured,
      paymentLinkConfigured: Boolean(cfg.paymentLinkUrl)
    });
  });

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

  /**
   * Inicia una sesión de cobro REAL de $5 USD / mes (Stripe Checkout o Payment Link oficial).
   * Jamás otorga Mod VIP gratis sin comprobación de pago.
   */
  router.post('/vip/checkout', authMiddleware.requireAuth, async (req, res) => {
    try {
      const cfg = getVipBillingConfig();
      const user = await db.getFullUserProfile(req.userId);
      if (!user) return res.status(404).json({ error: 'Usuario no encontrado.' });

      if (cfg.stripeConfigured) {
        const session = await createRealStripeCheckoutSession(req, user, cfg);
        return res.json({ ok: true, provider: 'stripe', ...session });
      }
      if (cfg.paymentLinkUrl) {
        const sep = cfg.paymentLinkUrl.includes('?') ? '&' : '?';
        return res.json({
          ok: true,
          provider: 'payment_link',
          checkoutUrl: `${cfg.paymentLinkUrl}${sep}client_reference_id=${encodeURIComponent(user.id)}`
        });
      }
      return res.status(402).json({
        ok: false,
        code: 'PAYMENT_REQUIRED',
        billingConfigured: false,
        priceLabel: MOD_VIP_PLAN.priceLabel,
        error: 'Mod VIP ($5 USD/mes) requiere cobro real. El administrador debe configurar STRIPE_SECRET_KEY (o VIP_PAYMENT_LINK_URL) en Render para activar la pasarela de pago.'
      });
    } catch (err) {
      return res.status(502).json({ error: err.message || 'Error al iniciar la pasarela de pago.' });
    }
  });

  /**
   * Verifica un pago REAL completado en Stripe (tras redirección ?vip_session_id=...)
   * o mediante secreto verificado de webhook de cobro del servidor.
   */
  router.post('/vip/verify-payment', authMiddleware.requireAuth, async (req, res) => {
    try {
      const cfg = getVipBillingConfig();
      const sessionId = String(req.body?.sessionId || '').trim();
      if (!cfg.stripeConfigured || !sessionId) {
        return res.status(402).json({
          ok: false,
          code: 'PAYMENT_REQUIRED',
          error: 'Se requiere un pago verificado de $5 USD/mes para activar Mod VIP.'
        });
      }
      const session = await verifyStripePaidSession(sessionId, cfg.stripeSecretKey);
      const refUid = session?.client_reference_id || session?.metadata?.userId;
      if (!session || refUid !== req.userId) {
        return res.status(402).json({ ok: false, code: 'PAYMENT_NOT_VERIFIED', error: 'El pago de $5 USD aún no ha sido confirmado por Stripe.' });
      }
      const result = await db.activateModVip(req.userId, { durationDays: 30 });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'No se pudo verificar el pago.' });
    }
  });

  /**
   * Bloquea activación gratuita directa: solo permite activar si viene firmado por el webhook/cobro real del servidor.
   */
  router.post('/vip/subscribe', authMiddleware.requireAuth, async (req, res) => {
    try {
      const cfg = getVipBillingConfig();
      const providedSecret = String(req.headers['x-vip-billing-secret'] || '');
      const validServerSecret = cfg.serverBillingSecret && providedSecret
        && providedSecret.length === cfg.serverBillingSecret.length
        && crypto.timingSafeEqual(Buffer.from(providedSecret), Buffer.from(cfg.serverBillingSecret));

      if (!validServerSecret) {
        return res.status(402).json({
          ok: false,
          code: 'PAYMENT_REQUIRED',
          priceLabel: MOD_VIP_PLAN.priceLabel,
          error: 'Mod VIP cuesta $5 USD/mes y solo se activa tras confirmar el cobro real en la pasarela de pago.'
        });
      }

      const durationDays = Number(req.body?.durationDays) || 30;
      const result = await db.activateModVip(req.userId, { durationDays });
      return res.json(result);
    } catch (err) {
      return res.status(400).json({ error: err.message || 'No se pudo activar Mod VIP.' });
    }
  });

  /**
   * Webhook de cobro real (Stripe / pasarela): activa al cobrar y REVOCA TODO el inventario al cancelar o fallar el cobro.
   */
  router.post('/vip/webhook', async (req, res) => {
    try {
      const cfg = getVipBillingConfig();
      const secret = cfg.serverBillingSecret || cfg.stripeWebhookSecret;
      if (!secret) {
        return res.status(503).json({ error: 'Webhook de pagos no configurado.' });
      }
      const headerSec = String(req.headers['x-vip-billing-secret'] || '');
      const authorized = headerSec.length === secret.length
        && crypto.timingSafeEqual(Buffer.from(headerSec), Buffer.from(secret));
      if (!authorized) {
        return res.status(401).json({ error: 'Firma de webhook inválida.' });
      }

      const eventType = String(req.body?.type || '');
      const obj = req.body?.data?.object || req.body || {};
      const userId = obj.client_reference_id || obj.metadata?.userId || obj.userId;
      if (!userId) return res.status(400).json({ error: 'Falta userId en el evento de pago.' });

      if (eventType === 'checkout.session.completed' || eventType === 'invoice.paid') {
        const result = await db.activateModVip(userId, { durationDays: 30 });
        return res.json({ ok: true, action: 'activated', user: result.user });
      }
      if (eventType === 'customer.subscription.deleted' || eventType === 'invoice.payment_failed') {
        const result = await db.cancelModVip(userId);
        return res.json({ ok: true, action: 'revoked', user: result.user });
      }
      return res.json({ ok: true, ignored: eventType });
    } catch (err) {
      return res.status(400).json({ error: err.message });
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

  // Selección OBLIGATORIA y ÚNICA de Entrenador después de crear la cuenta (1 sola vez)
  router.post('/profile/trainer', authMiddleware.requireAuth, async (req, res) => {
    try {
      const trainerId = String(req.body?.trainerId || '').trim();
      const valid = TRAINERS.find((t) => t.id === trainerId);
      if (!valid) return res.status(400).json({ error: 'Entrenador no válido.' });
      const profile = await db.setUserTrainerOnce(req.userId, trainerId);
      return res.json({ ok: true, user: profile, trainer: valid });
    } catch (err) {
      return res.status(err.status || 400).json({ code: err.code, trainerId: err.trainerId, error: err.message });
    }
  });

  // Cambio de idioma desde el selector inicial o desde Configuración
  router.patch('/profile/language', authMiddleware.requireAuth, async (req, res) => {
    try {
      const language = String(req.body?.language || 'es').trim().toLowerCase();
      if (!['es', 'en', 'pt', 'fr'].includes(language)) {
        return res.status(400).json({ error: 'Idioma no soportado.' });
      }
      const profile = await db.updateUserLanguage(req.userId, language);
      return res.json({ ok: true, user: profile });
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
