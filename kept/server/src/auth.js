// Password hashing (scrypt) + cookie sessions. No external deps.
import crypto from 'node:crypto';
import { now } from './db.js';

export const COOKIE = 'kept_session';
const SESSION_TTL = 1000 * 60 * 60 * 24 * 30; // 30 days

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `scrypt$${salt}$${hash}`;
}

export function verifyPassword(password, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  const candidate = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function createSession(db, userId) {
  const token = crypto.randomBytes(32).toString('hex');
  db.prepare('INSERT INTO sessions (token, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)')
    .run(token, userId, now(), now() + SESSION_TTL);
  return token;
}

export function destroySession(db, token) {
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}

export function userFromToken(db, token) {
  if (!token) return null;
  const row = db.prepare(`
    SELECT u.id, u.username, u.display_name, u.avatar_color, u.bio, u.timezone, u.created_at
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token = ? AND s.expires_at > ?`).get(token, now());
  return row || null;
}

export function cookieHeader(token, { clear = false } = {}) {
  const base = `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Lax`;
  return clear ? `${base}; Max-Age=0` : `${base}; Max-Age=${SESSION_TTL / 1000}`;
}

/** Express middleware: attaches req.user (or null). */
export function attachUser(db) {
  return (req, _res, next) => {
    const cookies = parseCookies(req.headers.cookie);
    req.sessionToken = cookies[COOKIE];
    req.user = userFromToken(db, req.sessionToken);
    next();
  };
}

export function requireUser(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Not signed in' });
  next();
}
