import crypto from 'node:crypto';

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(numBytes = 20) {
  const bytes = crypto.randomBytes(numBytes);
  let bits = 0;
  let value = 0;
  let output = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) {
    output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
  }
  return output;
}

function decodeBase32(str) {
  const clean = String(str || '').toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = 0;
  let value = 0;
  const out = [];
  for (const ch of clean) {
    const idx = BASE32_ALPHABET.indexOf(ch);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

/**
 * Genera un código TOTP RFC 6238 de 6 dígitos compatible con Google Authenticator / Authy / 1Password.
 */
export function generateTotpCode(base32Secret, timeMs = Date.now(), stepSeconds = 30) {
  const key = decodeBase32(base32Secret);
  const counter = Math.floor(timeMs / 1000 / stepSeconds);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
  buf.writeUInt32BE(counter >>> 0, 4);

  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binary = ((hmac[offset] & 0x7f) << 24)
    | ((hmac[offset + 1] & 0xff) << 16)
    | ((hmac[offset + 2] & 0xff) << 8)
    | (hmac[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

/**
 * Verifica código TOTP con tolerancia de ±1 ventana de 30 segundos (desfase de reloj móvil).
 */
export function verifyTotpCode(base32Secret, code, timeMs = Date.now()) {
  const clean = String(code || '').replace(/\s+/g, '');
  if (!/^\d{6}$/.test(clean)) return false;
  for (const delta of [-1, 0, 1]) {
    const expected = generateTotpCode(base32Secret, timeMs + delta * 30_000);
    if (crypto.timingSafeEqual(Buffer.from(clean), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

export function buildOtpAuthUri(email, secret, issuer = 'CHESS.MOD') {
  const label = encodeURIComponent(`${issuer}:${email}`);
  return `otpauth://totp/${label}?secret=${encodeURIComponent(secret)}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

export function generateBackupCodes(count = 6) {
  const codes = [];
  for (let i = 0; i < count; i++) {
    const raw = crypto.randomBytes(4).toString('hex').toUpperCase();
    codes.push(`${raw.slice(0, 4)}-${raw.slice(4, 8)}`);
  }
  return codes;
}

export function hashBackupCode(code) {
  const norm = String(code || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  return crypto.createHash('sha256').update(`cm_backup_v1:${norm}`).digest('hex');
}

/**
 * Evalúa fortaleza de contraseña para nuevas cuentas y cambios de contraseña.
 */
export function evaluatePasswordStrength(password) {
  const pw = String(password || '');
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  const hasMinStrong = pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);
  return { score, hasMinStrong };
}

/**
 * Protección contra ataques de fuerza bruta en login (máx. 6 fallos en 10 min -> bloqueo temporal).
 */
export class LoginRateLimiter {
  constructor({ maxAttempts = 6, windowMs = 10 * 60 * 1000, lockMs = 10 * 60 * 1000 } = {}) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
    this.lockMs = lockMs;
    this.records = new Map();
  }

  check(key) {
    const now = Date.now();
    const rec = this.records.get(key);
    if (!rec) return { allowed: true };
    if (rec.lockedUntil && rec.lockedUntil > now) {
      const retrySec = Math.ceil((rec.lockedUntil - now) / 1000);
      return { allowed: false, retrySec };
    }
    if (now - rec.firstAt > this.windowMs) {
      this.records.delete(key);
      return { allowed: true };
    }
    return { allowed: true };
  }

  recordFailure(key) {
    const now = Date.now();
    const rec = this.records.get(key);
    if (!rec || now - rec.firstAt > this.windowMs) {
      this.records.set(key, { count: 1, firstAt: now, lockedUntil: 0 });
      return 1;
    }
    rec.count++;
    if (rec.count >= this.maxAttempts) {
      rec.lockedUntil = now + this.lockMs;
    }
    return rec.count;
  }

  clear(key) {
    this.records.delete(key);
  }
}
