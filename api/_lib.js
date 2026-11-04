import { neon } from '@neondatabase/serverless';
import { scrypt, randomBytes, timingSafeEqual, createHash } from 'node:crypto';

let client;
// Lazily create the Neon client so a missing DATABASE_URL gives a clear error per request.
export const sql = (...args) => {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    client = neon(process.env.DATABASE_URL);
  }
  return client(...args);
};

// ---------- password hashing (scrypt, built into Node, no extra packages) ----------
// Stored as: scrypt$N$r$p$<salt base64>$<hash base64>. Every password gets its own random salt.
const SCRYPT = { N: 16384, r: 8, p: 1 };
const KEYLEN = 64;
const derive = (pw, salt, o) => new Promise((ok, no) =>
  scrypt(pw.normalize('NFKC'), salt, KEYLEN, { N: o.N, r: o.r, p: o.p, maxmem: 64 * 1024 * 1024 }, (e, k) => e ? no(e) : ok(k)));

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  const key = await derive(pw, salt, SCRYPT);
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, salt.toString('base64'), key.toString('base64')].join('$');
}

export async function verifyPassword(pw, stored) {
  const parts = String(stored || '').split('$');
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false;
  const [, N, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64, 'base64');
  const got = await derive(pw, Buffer.from(saltB64, 'base64'), { N: +N, r: +r, p: +p });
  return got.length === expected.length && timingSafeEqual(got, expected);
}

// ---------- sessions (random token in an HttpOnly cookie; only its SHA-256 is stored) ----------
export const COOKIE = 'kaam_session';
export const SESSION_DAYS = 30;
export const newToken = () => randomBytes(32).toString('base64url');
export const tokenHash = t => createHash('sha256').update(t).digest('hex');

export function readCookie(req, name) {
  const raw = String(req.headers.cookie || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return decodeURIComponent(part.slice(i + 1).trim());
  }
  return null;
}

export function setSessionCookie(res, token) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}`);
}
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

// Returns { id, email } for the logged-in user, or null.
export async function sessionOf(req) {
  const t = readCookie(req, COOKIE);
  if (!t || !/^[A-Za-z0-9_-]{20,100}$/.test(t)) return null;
  const [row] = await sql`SELECT u.id, u.email FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ${tokenHash(t)} AND s.expires_at > now()`;
  return row || null;
}

// The user id the request is acting as (from the session cookie), or null if logged out.
export async function userOf(req) {
  const s = await sessionOf(req);
  return s ? s.id : null;
}

export function send(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') { try { return JSON.parse(req.body); } catch { return null; } }
  const chunks = []; for await (const c of req) chunks.push(c);
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { return null; }
}
