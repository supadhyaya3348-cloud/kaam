import { neon } from '@neondatabase/serverless';

let client;
// Lazily create the Neon client so a missing DATABASE_URL gives a clear error per request.
export const sql = (...args) => {
  if (!client) {
    if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
    client = neon(process.env.DATABASE_URL);
  }
  return client(...args);
};

// Each browser gets an anonymous id (stored in localStorage) sent as x-kaam-user.
export function userOf(req) {
  const u = String(req.headers['x-kaam-user'] || '');
  return /^[A-Za-z0-9_-]{8,64}$/.test(u) ? u : null;
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
