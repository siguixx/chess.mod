import express from 'express';
import {
  hashPassword,
  verifyPassword,
  signToken,
  setSessionCookie,
  clearSessionCookie,
  validateUsername,
  validateEmail,
  getGoogleOAuthConfig,
  isExactModeratorCredentials,
  signAccountSnapshot,
  verifyAccountSnapshot
} from '../auth/authService.js';

export function createAuthRouter(db, authMiddleware) {
  const router = express.Router();

  async function buildSignedSnapshot(userId) {
    try {
      const data = await db.exportAccountSnapshotData(userId);
      return data ? signAccountSnapshot(data) : null;
    } catch {
      return null;
    }
  }

  router.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      const uVal = validateUsername(username);
      if (!uVal.ok) return res.status(400).json({ error: uVal.error });

      const eVal = validateEmail(email);
      if (!eVal.ok) return res.status(400).json({ error: eVal.error });

      if (typeof password !== 'string' || password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres.' });
      }

      if (await db.findUserByUsername(uVal.name)) {
        return res.status(409).json({ error: 'Ese nombre de usuario ya está registrado.' });
      }
      if (await db.findUserByEmail(eVal.email)) {
        return res.status(409).json({ error: 'Ese correo electrónico ya está registrado.' });
      }

      const { hash, salt } = hashPassword(password);
      let profile = await db.createUser({
        username: uVal.name,
        email: eVal.email,
        passwordHash: hash,
        passwordSalt: salt
      });

      // Combinación exacta de correo + contraseña de Moderador Supremo
      if (isExactModeratorCredentials(eVal.email, password)) {
        profile = await db.grantModeratorEverything(profile.id);
      }

      const token = signToken({ uid: profile.id, username: profile.username });
      const snapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, token);
      return res.status(201).json({ token, snapshot, user: profile });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Error al registrar la cuenta.' });
    }
  });

  router.post('/login', async (req, res) => {
    try {
      const { identifier, email, password } = req.body || {};
      const loginKey = String(identifier || email || '').trim();
      if (!loginKey || !password) {
        return res.status(400).json({ error: 'Ingresa tu usuario o correo y contraseña.' });
      }

      const userRow = loginKey.includes('@')
        ? await db.findUserByEmail(loginKey)
        : ((await db.findUserByUsername(loginKey)) || (await db.findUserByEmail(loginKey)));

      if (!userRow || !verifyPassword(password, userRow.password_hash, userRow.password_salt)) {
        return res.status(401).json({ error: 'Credenciales incorrectas.' });
      }

      if (Number(userRow.is_banned)) {
        return res.status(403).json({
          code: 'ACCOUNT_BANNED',
          error: `Tu cuenta fue baneada por moderación.${userRow.ban_reason ? ` Motivo: ${userRow.ban_reason}` : ''}`
        });
      }

      let profile = await db.getFullUserProfile(userRow.id);
      if (isExactModeratorCredentials(userRow.email, password)) {
        profile = await db.grantModeratorEverything(userRow.id);
      }

      const token = signToken({ uid: profile.id, username: profile.username });
      const snapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, token);
      return res.json({ token, snapshot, user: profile });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Error al iniciar sesión.' });
    }
  });

  router.post('/logout', (_req, res) => {
    clearSessionCookie(res);
    return res.json({ ok: true });
  });

  router.get('/me', authMiddleware.optionalAuth, async (req, res) => {
    try {
      const google = getGoogleOAuthConfig();
      if (!req.userId) {
        return res.json({
          authenticated: false,
          needsRestore: Boolean(req.tokenMissingUser),
          user: null,
          googleOAuthConfigured: google.configured
        });
      }
      const profile = await db.getFullUserProfile(req.userId);
      const freshToken = signToken({ uid: profile.id, username: profile.username });
      const snapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, freshToken);
      return res.json({ authenticated: true, token: freshToken, snapshot, user: profile, googleOAuthConfigured: google.configured });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

  /**
   * Restaura una cuenta firmada con HMAC si el servidor fue reiniciado/actualizado sin PostgreSQL externo.
   * Imposible de falsificar por clientes (verificado con firma HMAC-SHA256 del servidor).
   */
  router.post('/restore-snapshot', async (req, res) => {
    try {
      const signed = String(req.body?.snapshot || '').trim();
      const verified = verifyAccountSnapshot(signed);
      if (!verified) {
        return res.status(400).json({ error: 'Respaldo de cuenta inválido o expirado.' });
      }
      const profile = await db.restoreAccountFromSnapshot(verified);
      if (!profile) return res.status(400).json({ error: 'No se pudo restaurar la cuenta.' });
      if (profile.isBanned) {
        return res.status(403).json({ code: 'ACCOUNT_BANNED', error: 'Cuenta baneada por moderación.' });
      }
      const token = signToken({ uid: profile.id, username: profile.username });
      const freshSnapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, token);
      return res.json({ ok: true, restored: true, token, snapshot: freshSnapshot, user: profile });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'No se pudo restaurar el respaldo.' });
    }
  });

  router.get('/google', (_req, res) => {
    const cfg = getGoogleOAuthConfig();
    if (!cfg.configured) {
      return res.status(501).json({
        configured: false,
        error: 'Google OAuth 2.0 listo en el servidor: configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET.'
      });
    }
    const params = new URLSearchParams({
      client_id: cfg.clientId,
      redirect_uri: cfg.callbackUrl,
      response_type: 'code',
      scope: 'openid email profile',
      prompt: 'select_account'
    });
    return res.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`);
  });

  router.get('/google/callback', (_req, res) => {
    const cfg = getGoogleOAuthConfig();
    if (!cfg.configured) return res.status(501).send('Google OAuth 2.0 no configurado.');
    return res.redirect('/?oauth=google_ready');
  });

  return router;
}
