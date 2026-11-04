import { sql, userOf, send, readBody } from './_lib.js';
import { testFor, PASS_MARK } from './_mock.js';

// GET  /api/test?app=ID           -> { job, questions:[{q, opts, skill}], passMark }   (no answers sent)
// POST /api/test { app, answers } -> { score, right, total, passed }
// Only the applicant can take it, only while the application is at the "assessment" stage, and only once.
export default async function handler(req, res) {
  try {
    const user = await userOf(req);
    if (!user) return send(res, 401, { error: 'login_required' });
    const body = req.method === 'POST' ? (await readBody(req) || {}) : {};
    const appId = String(req.method === 'GET' ? (req.query && req.query.app) || new URL(req.url, 'http://x').searchParams.get('app') || '' : body.app || '');
    if (!/^[A-Za-z0-9_.:-]{1,120}$/.test(appId)) return send(res, 400, { error: 'bad_request' });

    const [row] = await sql`SELECT a.id, a.user_id, a.status, a.data, j.data AS job FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ${appId}`;
    if (!row || row.user_id !== user) return send(res, 404, { error: 'not_found' });
    if (row.status !== 'assessment') return send(res, 409, { error: 'not_in_assessment' });
    if (row.data && row.data.test) return send(res, 409, { error: 'already_taken' });

    const qs = testFor(row.job);
    if (req.method === 'GET') {
      return send(res, 200, { job: { title: row.job.title, company: row.job.company }, passMark: PASS_MARK, questions: qs.map(x => ({ q: x.q, opts: x.opts, skill: x.skill })) });
    }
    if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });

    const ans = Array.isArray(body.answers) ? body.answers : [];
    if (ans.length !== qs.length) return send(res, 400, { error: 'answer_all' });
    const right = qs.filter((x, i) => +ans[i] === x.a).length;
    const score = Math.round(right / qs.length * 100);
    const passed = score >= PASS_MARK;
    const status = passed ? 'interview' : 'rejected';
    const data = { ...(row.data || {}), status, test: { score, right, total: qs.length, passed, at: Date.now() } };
    // Guard against a double submit racing: only update if still at assessment with no test.
    const upd = await sql`UPDATE applications SET status = ${status}, data = ${JSON.stringify(data)}::jsonb, updated_at = now()
      WHERE id = ${appId} AND status = 'assessment' AND NOT (data ? 'test') RETURNING id`;
    if (!upd.length) return send(res, 409, { error: 'already_taken' });
    return send(res, 200, { score, right, total: qs.length, passed, doc: data });
  } catch (e) {
    console.error(e);
    return send(res, 500, { error: 'server_error' });
  }
}
