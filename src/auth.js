// EksporIn | auth: scrypt password hashing + cookie sessions
'use strict';
const { scryptSync, randomBytes, timingSafeEqual } = require('node:crypto');

function hashPassword(pw) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${scryptSync(pw, salt, 64).toString('hex')}`;
}

function verifyPassword(pw, stored) {
  const [salt, hash] = String(stored).split(':');
  if (!salt || !hash) return false;
  const a = scryptSync(pw, salt, 64);
  const b = Buffer.from(hash, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

function createSession(db, userId) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 86400000).toISOString();
  db.prepare('INSERT INTO sessions (token,user_id,expires_at) VALUES (?,?,?)').run(token, userId, expires);
  return token;
}

function getSessionUser(db, req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)eksporin_session=([a-f0-9]{64})/);
  if (!m) return null;
  const row = db.prepare(`SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > datetime('now')`).get(m[1]);
  return row || null;
}

function destroySession(db, req) {
  const cookie = req.headers.cookie || '';
  const m = cookie.match(/(?:^|;\s*)eksporin_session=([a-f0-9]{64})/);
  if (m) db.prepare('DELETE FROM sessions WHERE token = ?').run(m[1]);
}

const sessionCookie = (token) =>
  `eksporin_session=${token}; HttpOnly; Path=/; Max-Age=${30 * 86400}; SameSite=Lax`;
const clearCookie = () => 'eksporin_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax';

// ---------- Stateless admin token ----------
// The user session table lives in sql.js which is in-memory on Vercel.
// Cold starts wipe it, so admin cookies expire mid-flow. Admin auth
// runs on a signed token instead: no DB lookup, verified by HMAC on
// every request. The token embeds user id + email + expiry, signed with
// ADMIN_TOKEN_SECRET (falls back to a per-install constant so local dev
// still works).

const { createHmac } = require('node:crypto');

const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ||
  'eksporin-admin-fallback-secret-do-not-use-in-prod-swap-via-env';

function _sign(payload) {
  return createHmac('sha256', ADMIN_TOKEN_SECRET).update(payload).digest('base64url');
}

// Token uses '|' as the separator so a '.' inside an email (like ".com")
// never confuses the split.
function createAdminToken(user, ttlDays = 30) {
  const exp = Date.now() + ttlDays * 86400 * 1000;
  const payload = `admin|${user.id}|${user.email}|${exp}`;
  return `${payload}|${_sign(payload)}`;
}

function verifyAdminToken(token) {
  if (!token || typeof token !== 'string' || !token.startsWith('admin|')) return null;
  const parts = token.split('|');
  if (parts.length !== 5) return null;
  const [, id, email, exp, sig] = parts;
  const payload = `admin|${id}|${email}|${exp}`;
  const expected = _sign(payload);
  if (sig !== expected) return null;
  if (Number(exp) < Date.now()) return null;
  return { id: Number(id), email };
}

module.exports = {
  hashPassword, verifyPassword,
  createSession, getSessionUser, destroySession,
  sessionCookie, clearCookie,
  createAdminToken, verifyAdminToken,
};
