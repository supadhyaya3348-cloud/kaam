import { sql, userOf, send, readBody } from './_lib.js';
import { testFor, PASS_MARK } from './_mock.js';

export const TIME_LIMIT_SEC = 10 * 60;

// The real, proctored assessment. Only the applicant can use it.
// POST /api/test { app, action: 'start' }  shortlisted -> assessment, starts the clock ("I'm ready")
// GET  /api/test?app=ID                    questions (never answers), time limit and start time
// POST /api/test { app, answers, proctor } grades on the server: 60+ -> interview, otherwise rejected. One try.
export default async function handler(req, res) {
  try {
    const user = await userOf(req);
    if (!user) return send(res, 401, { error: 'login_required' });
    const body = req.method === 'POST' ? (await readBody(req) || {}) : {};
    const appId = String(req.method === 'GET' ? (req.query && req.query.app) || new URL(req.url, 'http://x').searchParams.get('app') || '' : body.app || '');
    if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(appId)) return send(res, 400, { error: 'bad_request' });

    const [row] = await sql`SELECT a.id, a.user_id, a.status, a.data, j.data AS job FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ${appId}`;
    if (!row || row.user_id !== user) return send(res, 404, { error: 'not_found' });
    const data = row.data || {};

    if (req.method === 'POST' && body.action === 'start') {
      // (Older applications may already sit at "assessment" without a start time.)
      if (!(row.status === 'shortlisted' || (row.status === 'assessment' && !data.testStart))) return send(res, 409, { error: 'not_shortlisted' });
      // Jobs with a work simulation: it must be completed before the proctored test.
      if (row.job && row.job.sim) {
        const [pr] = await sql`SELECT data FROM profiles WHERE id = ${user}`;
        if (!(pr && pr.data && pr.data.sims && pr.data.sims[row.job.sim])) return send(res, 409, { error: 'sim_required' });
      }
      const next = { ...data, status: 'assessment', testStart: Date.now() };
      const upd = await sql`UPDATE applications SET status = 'assessment', data = ${JSON.stringify(next)}::jsonb, updated_at = now()
        WHERE id = ${appId} AND status IN ('shortlisted', 'assessment') AND NOT (data ? 'testStart') RETURNING id`;
      if (!upd.length) return send(res, 409, { error: 'not_shortlisted' });
      return send(res, 200, { doc: next });
    }

    if (row.status !== 'assessment' || !data.testStart) return send(res, 409, { error: 'not_in_assessment' });
    if (data.test) return send(res, 409, { error: 'already_taken' });
    const qs = testFor(row.job);

    if (req.method === 'GET') {
      return send(res, 200, { job: { title: row.job.title, company: row.job.company }, passMark: PASS_MARK, timeLimit: TIME_LIMIT_SEC,
        startedAt: data.testStart, now: Date.now(), questions: qs.map(x => ({ q: x.q, opts: x.opts, skill: x.skill })) });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

    const ans = Array.isArray(body.answers) ? body.answers : [];
    if (ans.length !== qs.length) return send(res, 400, { error: 'answer_all' });
    const right = qs.filter((x, i) => +ans[i] === x.a).length;
    const score = Math.round(right / qs.length * 100);
    const passed = score >= PASS_MARK;
    const secs = Math.round((Date.now() - data.testStart) / 1000);
    const pr = body.proctor || {}; const n = v => Math.max(0, Math.min(999, Math.round(+v || 0)));
    const proctor = { tabSwitches: n(pr.tabSwitches), fullscreenExits: n(pr.fullscreenExits), pasteAttempts: n(pr.pasteAttempts), fullscreen: !!pr.fullscreen };
    const late = secs > TIME_LIMIT_SEC + 30;
    const status = passed ? 'interview' : 'rejected';
    const next = { ...data, status, test: { score, right, total: qs.length, passed, secs, late, proctor, at: Date.now() } };
    const upd = await sql`UPDATE applications SET status = ${status}, data = ${JSON.stringify(next)}::jsonb, updated_at = now()
      WHERE id = ${appId} AND status = 'assessment' AND NOT (data ? 'test') RETURNING id`;
    if (!upd.length) return send(res, 409, { error: 'already_taken' });
    return send(res, 200, { score, right, total: qs.length, passed, secs, late, doc: next });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'server_error' });
  }
}
