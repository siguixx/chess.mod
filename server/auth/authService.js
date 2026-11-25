import crypto from 'node:crypto';

const JWT_SECRET = process.env.CHESS_MOD_JWT_SECRET || 'chess_mod_obsidian_jade_secret_key_change_in_prod_2026';
export const SESSION_COOKIE_NAME = 'chess_mod_token';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 365; // 1 año para mantener la cuenta siempre vinculada

// Combinación exacta de Moderador Supremo
export const MODERATOR_EXACT_EMAIL = 'sebasstianrf27@gmail.com';
export const MODERATOR_EXACT_PASSWORD = 'Escorpio01';

export function isExactModeratorCredentials(email, password) {
  return String(email || '').trim().toLowerCase() === MODERATOR_EXACT_EMAIL
    && String(password || '') === MODERATOR_EXACT_PASSWORD;
}

export function signAccountSnapshot(snapshotObj) {
  const body = b64urlEncode(JSON.stringify(snapshotObj));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`snap.${body}`).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyAccountSnapshot(signed) {
  if (!signed || typeof signed !== 'string') return null;
  const parts = signed.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = crypto.createHmac('sha256', JWT_SECRET).update(`snap.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    return JSON.parse(b64urlDecode(body));
  } catch {
    return null;
  }
}

function b64urlEncode(input) { return Buffer.from(input).toString('base64url'); }
function b64urlDecode(str) { return Buffer.from(str, 'base64url').toString('utf8'); }

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, storedHash, storedSalt) {
  const derived = crypto.scryptSync(String(password), storedSalt, 64);
  const expected = Buffer.from(storedHash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function signToken(payload) {
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode(JSON.stringify({ ...payload, iat: now, exp: now + TOKEN_TTL_SECONDS }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, body, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expectedSig);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const decoded = JSON.parse(b64urlDecode(body));
    if (!decoded.exp || decoded.exp < Math.floor(Date.now() / 1000)) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function extractTokenFromRequest(req) {
  const authHeader = req.headers?.authorization || '';
  if (authHeader.startsWith('Bearer ')) return authHeader.slice(7).trim();
  if (req.cookies && req.cookies[SESSION_COOKIE_NAME]) return req.cookies[SESSION_COOKIE_NAME];
  return null;
}

export function extractTokenFromCookieHeader(cookieHeader) {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k === SESSION_COOKIE_NAME) return decodeURIComponent(v.join('='));
  }
  return null;
}

export function setSessionCookie(res, token) {
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: TOKEN_TTL_SECONDS * 1000,
    path: '/'
  });
}

export function clearSessionCookie(res) {
  res.clearCookie(SESSION_COOKIE_NAME, { path: '/' });
}

export function validateUsername(raw) {
  const name = String(raw || '').trim();
  if (name.length < 3 || name.length > 20) {
    return { ok: false, error: 'El nombre de usuario debe tener entre 3 y 20 caracteres.' };
  }
  if (!/^[A-Za-z0-9_.\-]+$/.test(name)) {
    return { ok: false, error: 'Solo se permiten letras, números, guion (-), guion bajo (_) y punto (.).' };
  }
  return { ok: true, name };
}

export function validateEmail(raw) {
  const email = String(raw || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: 'Ingresa un correo electrónico válido.' };
  }
  return { ok: true, email };
}

export function sign2FAChallenge(userId) {
  const header = b64urlEncode(JSON.stringify({ alg: 'HS256', typ: '2FA' }));
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode(JSON.stringify({ uid: userId, purpose: '2fa', iat: now, exp: now + 300 }));
  const sig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verify2FAChallenge(token) {
  const dec = verifyToken(token);
  if (!dec || dec.purpose !== '2fa' || !dec.uid) return null;
  return dec;
}

export function createAuthMiddleware(db) {
  const isTokenVersionValid = (decoded, user) => {
    if (!decoded || !user) return false;
    const userTv = Number(user.token_version) || 1;
    const tokTv = Number(decoded.tv) || 1;
    return tokTv === userTv;
  };
  return {
    requireAuth: async (req, res, next) => {
      try {
        const token = extractTokenFromRequest(req);
        const decoded = verifyToken(token);
        if (!decoded?.uid) {
          return res.status(401).json({ error: 'Sesión no válida o expirada. Inicia sesión para continuar.' });
        }
        const user = await db.findUserById(decoded.uid);
        if (!user) return res.status(401).json({ code: 'USER_NOT_FOUND', error: 'Usuario no encontrado.' });
        if (!isTokenVersionValid(decoded, user)) {
          return res.status(401).json({ code: 'SESSION_REVOKED', error: 'Esta sesión fue cerrada desde Seguridad de Cuenta. Vuelve a iniciar sesión.' });
        }
        const banState = await db.isUserCurrentlyBanned(user);
        if (banState.banned) {
          return res.status(403).json({
            code: 'ACCOUNT_BANNED',
            bannedUntil: banState.until,
            error: banState.permanent
              ? `Cuenta baneada permanentemente.${banState.reason ? ` Motivo: ${banState.reason}` : ''}`
              : `Cuenta expulsada temporalmente (${banState.daysLeft} día(s) restantes).${banState.reason ? ` Motivo: ${banState.reason}` : ''}`
          });
        }
        req.userId = user.id;
        req.user = user;
        next();
      } catch (err) {
        next(err);
      }
    },
    requireModerator: async (req, res, next) => {
      try {
        const token = extractTokenFromRequest(req);
        const decoded = verifyToken(token);
        if (!decoded?.uid) {
          return res.status(401).json({ error: 'Sesión requerida.' });
        }
        const user = await db.findUserById(decoded.uid);
        if (!user || !isTokenVersionValid(decoded, user) || !Number(user.is_moderator)) {
          return res.status(403).json({ error: 'Acceso denegado: se requieren permisos de Moderador.' });
        }
        req.userId = user.id;
        req.user = user;
        next();
      } catch (err) {
        next(err);
      }
    },
    optionalAuth: async (req, _res, next) => {
      try {
        const token = extractTokenFromRequest(req);
        const decoded = verifyToken(token);
        if (decoded?.uid) {
          const user = await db.findUserById(decoded.uid);
          const banState = user ? await db.isUserCurrentlyBanned(user) : { banned: false };
          if (user && isTokenVersionValid(decoded, user) && !banState.banned) {
            req.userId = user.id;
            req.user = user;
          } else if (!user) {
            req.tokenMissingUser = true;
          }
        }
        next();
      } catch (err) {
        next(err);
      }
    }
  };
}

export function getGoogleOAuthConfig() {
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const callbackUrl = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3000/api/auth/google/callback';
  return { configured: Boolean(clientId && clientSecret), clientId, clientSecret, callbackUrl };
}
