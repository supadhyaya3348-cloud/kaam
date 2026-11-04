import { send, readBody, userOf } from './_lib.js';

// GET /api/ai -> { enabled } ; POST /api/ai { messages, json, tier } -> { text }
// Uses the Anthropic Messages API. Set ANTHROPIC_API_KEY in Vercel to turn AI features on.
export default async function handler(req, res) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (req.method === 'GET') return send(res, 200, { enabled: !!key });
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  if (!key) return send(res, 503, { error: 'ai_not_configured' });
  // Only logged-in users can spend AI credits.
  let user = null;
  try { user = await userOf(req); } catch (e) { console.error(e); }
  if (!user) return send(res, 401, { error: 'login_required' });
  const body = await readBody(req);
  const { messages, json, tier } = body || {};
  const ok = Array.isArray(messages) && messages.length >= 1 && messages.length <= 20 &&
    messages.every(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.length <= 30000) &&
    messages[messages.length - 1].role === 'user';
  if (!ok) return send(res, 400, { error: 'bad_request' });
  const model = (tier === 'quick' ? process.env.ANTHROPIC_MODEL_QUICK : process.env.ANTHROPIC_MODEL) || (tier === 'quick' ? 'claude-haiku-5-5' : 'claude-sonnet-5-5');
  const system = json
    ? 'You return only valid JSON that matches the requested shape. No prose, no markdown, no code fences.'
    : 'You are the AI Manager inside CareerCamp, a job platform in Nepal. Be brief, kind and practical.';
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model, max_tokens: json ? 2000 : 700, system, messages })
    });
    const out = await r.json();
    if (!r.ok) { console.error(out); return send(res, 502, { error: 'ai_failed' }); }
    const text = (out.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    send(res, 200, { text });
  } catch (e) {
    console.error(e);
    send(res, 502, { error: 'ai_failed' });
  }
}
