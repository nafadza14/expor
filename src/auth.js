// EksporIn — auth: scrypt password hashing + cookie sessions
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

module.exports = { hashPassword, verifyPassword, createSession, getSessionUser, destroySession, sessionCookie, clearCookie };
