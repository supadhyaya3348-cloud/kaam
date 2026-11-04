import { randomBytes } from 'node:crypto';
import {
  sql, send, readBody, sessionOf, readCookie, COOKIE, SESSION_DAYS,
  hashPassword, verifyPassword, newToken, tokenHash, setSessionCookie, clearSessionCookie
} from './_lib.js';
import { resetDemoSeeker } from './_demo.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILS = 5;          // wrong passwords allowed...
const FAIL_WINDOW_MIN = 15;   // ...within this many minutes, then the email is locked for the window

// Used when the email doesn't exist, so a wrong email takes as long as a wrong password.
let dummyHash;
const dummy = async () => (dummyHash ||= await hashPassword('not-a-real-password'));

async function startSession(res, userId) {
  const token = newToken();
  await sql`INSERT INTO sessions (token_hash, user_id, expires_at)
    VALUES (${tokenHash(token)}, ${userId}, now() + make_interval(days => ${SESSION_DAYS}))`;
  setSessionCookie(res, token);
}

// GET /api/auth            -> { user: {id, email} | null }
// POST /api/auth {action: 'signup' | 'login', email, password} -> { user }
// POST /api/auth {action: 'logout'} -> { ok: true }
// POST /api/auth {action: 'demo'} -> { user }   log in as the demo jobseeker, freshly reset (see _demo.js)
export default async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      const s = await sessionOf(req);
      return send(res, 200, { user: s ? { id: s.id, email: s.email } : null });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

    const body = await readBody(req) || {};
    const action = body.action;

    if (action === 'logout') {
      const t = readCookie(req, COOKIE);
      if (t) await sql`DELETE FROM sessions WHERE token_hash = ${tokenHash(t)}`;
      clearSessionCookie(res);
      return send(res, 200, { ok: true });
    }

    if (action === 'demo') {
      // Demo day: log in as the demo jobseeker (Aarati), reset to a fresh state each time.
      const u = await resetDemoSeeker();
      await startSession(res, u.id);
      return send(res, 200, { user: u, demo: true });
    }

    const email = String(body.email || '').trim().toLowerCase();
    const password = typeof body.password === 'string' ? body.password : '';
    if (!EMAIL_RE.test(email) || email.length > 254) return send(res, 400, { error: 'bad_email' });

    if (action === 'signup') {
      if (password.length < 8 || password.length > 200) return send(res, 400, { error: 'weak_password' });
      const [taken] = await sql`SELECT 1 FROM users WHERE email = ${email}`;
      if (taken) return send(res, 409, { error: 'email_taken' });
      const id = 'u' + randomBytes(16).toString('hex');
      const pass_hash = await hashPassword(password);
      try {
        await sql`INSERT INTO users (id, email, pass_hash) VALUES (${id}, ${email}, ${pass_hash})`;
      } catch (e) {
        if (String(e.code) === '23505') return send(res, 409, { error: 'email_taken' });
        throw e;
      }
      await startSession(res, id);
      return send(res, 200, { user: { id, email } });
    }

    if (action === 'login') {
      if (!password || password.length > 200) return send(res, 401, { error: 'bad_credentials' });
      const [{ n }] = await sql`SELECT count(*)::int AS n FROM login_fails
        WHERE email = ${email} AND at > now() - make_interval(mins => ${FAIL_WINDOW_MIN})`;
      if (n >= MAX_FAILS) return send(res, 429, { error: 'too_many_attempts' });

      const [u] = await sql`SELECT id, email, pass_hash FROM users WHERE email = ${email}`;
      const ok = u ? await verifyPassword(password, u.pass_hash) : (await verifyPassword(password, await dummy()), false);
      if (!ok) {
        await sql`INSERT INTO login_fails (email) VALUES (${email})`;
        return send(res, 401, { error: 'bad_credentials' });
      }
      await sql`DELETE FROM login_fails WHERE email = ${email}`;
      await sql`DELETE FROM sessions WHERE expires_at < now()`;
      await startSession(res, u.id);
      return send(res, 200, { user: { id: u.id, email: u.email } });
    }

    return send(res, 400, { error: 'bad_action' });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'server_error' });
  }
}
