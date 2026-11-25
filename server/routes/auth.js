import crypto from 'node:crypto';
import express from 'express';
import {
  hashPassword,
  verifyPassword,
  signToken,
  sign2FAChallenge,
  verify2FAChallenge,
  setSessionCookie,
  clearSessionCookie,
  validateUsername,
  validateEmail,
  getGoogleOAuthConfig,
  isExactModeratorCredentials,
  signAccountSnapshot,
  verifyAccountSnapshot
} from '../auth/authService.js';
import {
  generateBase32Secret,
  verifyTotpCode,
  buildOtpAuthUri,
  generateBackupCodes,
  hashBackupCode,
  evaluatePasswordStrength,
  LoginRateLimiter
} from '../auth/securityService.js';

export function createAuthRouter(db, authMiddleware) {
  const router = express.Router();
  const rateLimiter = new LoginRateLimiter({ maxAttempts: 6, windowMs: 10 * 60 * 1000, lockMs: 10 * 60 * 1000 });

  function getClientMeta(req) {
    return {
      ip: String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim(),
      userAgent: String(req.headers['user-agent'] || '').slice(0, 140)
    };
  }

  async function buildSignedSnapshot(userId) {
    try {
      const data = await db.exportAccountSnapshotData(userId);
      return data ? signAccountSnapshot(data) : null;
    } catch {
      return null;
    }
  }

  function issueUserToken(profile) {
    const tv = Number(profile?.security?.tokenVersion) || 1;
    return signToken({ uid: profile.id, username: profile.username, tv });
  }

  router.post('/register', async (req, res) => {
    try {
      const { username, email, password } = req.body || {};
      const uVal = validateUsername(username);
      if (!uVal.ok) return res.status(400).json({ error: uVal.error });

      const eVal = validateEmail(email);
      if (!eVal.ok) return res.status(400).json({ error: eVal.error });

      const pwCheck = evaluatePasswordStrength(password);
      if (!pwCheck.hasMinStrong) {
        return res.status(400).json({
          code: 'WEAK_PASSWORD',
          error: 'Contraseña segura requerida: mínimo 8 caracteres con al menos 1 mayúscula, 1 minúscula y 1 número.'
        });
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

      await db.recordSecurityEvent(profile.id, 'register', { ...getClientMeta(req), details: 'Cuenta creada con contraseña segura' });

      const token = issueUserToken(profile);
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

      const meta = getClientMeta(req);
      const rlKey = `${meta.ip}:${loginKey.toLowerCase()}`;
      const rlCheck = rateLimiter.check(rlKey);
      if (!rlCheck.allowed) {
        return res.status(429).json({
          code: 'RATE_LIMITED',
          retryAfterSec: rlCheck.retrySec,
          error: `Demasiados intentos fallidos. Por seguridad tu acceso está bloqueado temporalmente (${Math.ceil(rlCheck.retrySec / 60)} min).`
        });
      }

      const userRow = loginKey.includes('@')
        ? await db.findUserByEmail(loginKey)
        : ((await db.findUserByUsername(loginKey)) || (await db.findUserByEmail(loginKey)));

      if (!userRow || !verifyPassword(password, userRow.password_hash, userRow.password_salt)) {
        const count = rateLimiter.recordFailure(rlKey);
        if (userRow) {
          await db.recordSecurityEvent(userRow.id, 'login_failed', { ...meta, details: `Intento fallido #${count}` });
        }
        return res.status(401).json({ error: 'Credenciales incorrectas.' });
      }

      if (Number(userRow.is_banned)) {
        return res.status(403).json({
          code: 'ACCOUNT_BANNED',
          error: `Tu cuenta fue baneada por moderación.${userRow.ban_reason ? ` Motivo: ${userRow.ban_reason}` : ''}`
        });
      }

      rateLimiter.clear(rlKey);

      // Si tiene 2FA TOTP activado, exigir el segundo factor antes de emitir sesión
      if (Number(userRow.totp_enabled) && userRow.totp_secret) {
        const challengeToken = sign2FAChallenge(userRow.id);
        await db.recordSecurityEvent(userRow.id, 'login_2fa_challenge', { ...meta, details: 'Esperando código 2FA' });
        return res.json({
          requires2FA: true,
          challengeToken,
          message: 'Ingresa el código de 6 dígitos de tu app autenticadora (Google Authenticator / Authy) o un código de respaldo.'
        });
      }

      let profile = await db.getFullUserProfile(userRow.id);
      if (isExactModeratorCredentials(userRow.email, password)) {
        profile = await db.grantModeratorEverything(userRow.id);
      }

      await db.recordSecurityEvent(profile.id, 'login_ok', { ...meta, details: 'Inicio de sesión exitoso' });
      const token = issueUserToken(profile);
      const snapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, token);
      return res.json({ token, snapshot, user: profile });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Error al iniciar sesión.' });
    }
  });

  // Verificación de 2do factor (TOTP 6 dígitos o código de respaldo de un solo uso)
  router.post('/login/2fa', async (req, res) => {
    try {
      const { challengeToken, code } = req.body || {};
      const dec = verify2FAChallenge(challengeToken);
      if (!dec?.uid) {
        return res.status(401).json({ error: 'El desafío 2FA expiró. Vuelve a ingresar tu contraseña.' });
      }
      const userRow = await db.findUserById(dec.uid);
      if (!userRow || !Number(userRow.totp_enabled) || !userRow.totp_secret) {
        return res.status(400).json({ error: '2FA no configurado en esta cuenta.' });
      }
      if (Number(userRow.is_banned)) {
        return res.status(403).json({ code: 'ACCOUNT_BANNED', error: 'Cuenta baneada por moderación.' });
      }

      const meta = getClientMeta(req);
      const totpOk = verifyTotpCode(userRow.totp_secret, code);
      let usedBackup = false;
      if (!totpOk) {
        usedBackup = await db.consumeBackupCode(userRow.id, hashBackupCode(code));
      }
      if (!totpOk && !usedBackup) {
        await db.recordSecurityEvent(userRow.id, 'login_2fa_failed', { ...meta, details: 'Código 2FA incorrecto' });
        return res.status(401).json({ error: 'Código 2FA o código de respaldo inválido.' });
      }

      const profile = await db.getFullUserProfile(userRow.id);
      await db.recordSecurityEvent(profile.id, 'login_2fa_ok', {
        ...meta,
        details: usedBackup ? 'Acceso verificado con código de respaldo (1 uso)' : 'Acceso verificado con app 2FA'
      });
      const token = issueUserToken(profile);
      const snapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, token);
      return res.json({ token, snapshot, usedBackup, user: profile });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Error al verificar 2FA.' });
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
      const freshToken = issueUserToken(profile);
      const snapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, freshToken);
      return res.json({ authenticated: true, token: freshToken, snapshot, user: profile, googleOAuthConfigured: google.configured });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  });

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
      const token = issueUserToken(profile);
      const freshSnapshot = await buildSignedSnapshot(profile.id);
      setSessionCookie(res, token);
      return res.json({ ok: true, restored: true, token, snapshot: freshSnapshot, user: profile });
    } catch (err) {
      return res.status(500).json({ error: err.message || 'No se pudo restaurar el respaldo.' });
    }
  });

  /* ================= ENDPOINTS DE SEGURIDAD DE CUENTA ================= */
  router.get('/security/status', authMiddleware.requireAuth, async (req, res) => {
    const row = await db.findUserById(req.userId);
    let backupRemaining = 0;
    try { backupRemaining = JSON.parse(row.backup_codes_json || '[]').length; } catch {}
    const events = await db.getSecurityEvents(req.userId, 15);
    return res.json({
      totpEnabled: Boolean(Number(row.totp_enabled)),
      hasPin: Boolean(row.security_pin_hash),
      backupCodesRemaining: backupRemaining,
      tokenVersion: Number(row.token_version) || 1,
      events
    });
  });

  router.post('/security/2fa/setup', authMiddleware.requireAuth, async (req, res) => {
    const row = await db.findUserById(req.userId);
    const secret = generateBase32Secret(20);
    await db.savePendingTotpSecret(req.userId, secret);
    const otpauthUrl = buildOtpAuthUri(row.email, secret, 'CHESS.MOD');
    return res.json({ secret, otpauthUrl });
  });

  router.post('/security/2fa/verify', authMiddleware.requireAuth, async (req, res) => {
    const row = await db.findUserById(req.userId);
    const code = String(req.body?.code || '').trim();
    if (!row?.totp_pending_secret) {
      return res.status(400).json({ error: 'Primero genera tu clave secreta 2FA.' });
    }
    if (!verifyTotpCode(row.totp_pending_secret, code)) {
      return res.status(400).json({ error: 'El código de 6 dígitos no coincide. Verifica la hora de tu dispositivo.' });
    }
    const backupCodes = generateBackupCodes(6);
    const hashed = backupCodes.map(hashBackupCode);
    await db.enableTotp(req.userId, row.totp_pending_secret, hashed);
    await db.recordSecurityEvent(req.userId, '2fa_enabled', { ...getClientMeta(req), details: 'Autenticación 2FA TOTP activada' });
    return res.json({ ok: true, backupCodes, user: await db.getFullUserProfile(req.userId) });
  });

  router.post('/security/2fa/disable', authMiddleware.requireAuth, async (req, res) => {
    const row = await db.findUserById(req.userId);
    const { password, code } = req.body || {};
    if (!verifyPassword(String(password || ''), row.password_hash, row.password_salt)) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta.' });
    }
    if (Number(row.totp_enabled) && row.totp_secret) {
      const okTotp = verifyTotpCode(row.totp_secret, code) || (await db.consumeBackupCode(req.userId, hashBackupCode(code)));
      if (!okTotp) return res.status(401).json({ error: 'Ingresa un código 2FA o de respaldo válido para desactivar 2FA.' });
    }
    await db.disableTotp(req.userId);
    await db.recordSecurityEvent(req.userId, '2fa_disabled', { ...getClientMeta(req), details: '2FA desactivado por el usuario' });
    return res.json({ ok: true, user: await db.getFullUserProfile(req.userId) });
  });

  router.post('/security/pin', authMiddleware.requireAuth, async (req, res) => {
    const pin = String(req.body?.pin || '').trim();
    if (!pin) {
      await db.setSecurityPinHash(req.userId, null);
      await db.recordSecurityEvent(req.userId, 'pin_removed', { ...getClientMeta(req), details: 'PIN de seguridad eliminado' });
      return res.json({ ok: true, hasPin: false, user: await db.getFullUserProfile(req.userId) });
    }
    if (!/^\d{4,6}$/.test(pin)) {
      return res.status(400).json({ error: 'El PIN de seguridad debe tener entre 4 y 6 dígitos numéricos.' });
    }
    const pinHash = crypto.createHash('sha256').update(`cm_pin:${req.userId}:${pin}`).digest('hex');
    await db.setSecurityPinHash(req.userId, pinHash);
    await db.recordSecurityEvent(req.userId, 'pin_updated', { ...getClientMeta(req), details: 'PIN de seguridad configurado' });
    return res.json({ ok: true, hasPin: true, user: await db.getFullUserProfile(req.userId) });
  });

  router.post('/security/change-password', authMiddleware.requireAuth, async (req, res) => {
    const row = await db.findUserById(req.userId);
    const { currentPassword, newPassword } = req.body || {};
    if (!verifyPassword(String(currentPassword || ''), row.password_hash, row.password_salt)) {
      return res.status(401).json({ error: 'Tu contraseña actual es incorrecta.' });
    }
    const pwCheck = evaluatePasswordStrength(newPassword);
    if (!pwCheck.hasMinStrong) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener mínimo 8 caracteres con mayúscula, minúscula y número.' });
    }
    const { hash, salt } = hashPassword(newPassword);
    await db.updatePasswordAndRevoke(req.userId, hash, salt);
    await db.recordSecurityEvent(req.userId, 'password_changed', { ...getClientMeta(req), details: 'Contraseña actualizada y sesiones anteriores cerradas' });
    const profile = await db.getFullUserProfile(req.userId);
    const token = issueUserToken(profile);
    const snapshot = await buildSignedSnapshot(profile.id);
    setSessionCookie(res, token);
    return res.json({ ok: true, token, snapshot, user: profile });
  });

  router.post('/security/revoke-sessions', authMiddleware.requireAuth, async (req, res) => {
    await db.revokeAllSessions(req.userId);
    await db.recordSecurityEvent(req.userId, 'sessions_revoked', { ...getClientMeta(req), details: 'Todas las sesiones en otros dispositivos fueron cerradas' });
    const profile = await db.getFullUserProfile(req.userId);
    const token = issueUserToken(profile);
    const snapshot = await buildSignedSnapshot(profile.id);
    setSessionCookie(res, token);
    return res.json({ ok: true, token, snapshot, user: profile });
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
