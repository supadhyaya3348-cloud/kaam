import { sql, userOf, send, readBody } from './_lib.js';

const MAX_BYTES = 200_000;
// Hiring pipeline: applied -> shortlisted -> assessment (proctored mock test) -> interview -> selected, or rejected.
// The employer shortlists. The candidate starts the assessment when ready, and passing it moves them to interview
// (both handled in api/test.js, never set by hand here).
const NEXT = {
  applied: ['shortlisted', 'rejected'],
  shortlisted: ['rejected'],
  assessment: ['rejected'],
  interview: ['selected', 'rejected'],
  selected: [],
  rejected: []
};
const MENT_STATUS = ['requested', 'accepted', 'declined', 'done'];

// POST /api/save { col, id, data } — upserts one document, with ownership checks per collection.
export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method_not_allowed' });
  let user;
  try { user = await userOf(req); } catch (e) { console.error(e); return send(res, 500, { error: 'database_error' }); }
  if (!user) return send(res, 401, { error: 'login_required' });
  const body = await readBody(req);
  const { col, id, data } = body || {};
  if (typeof id !== 'string' || !/^[A-Za-z0-9_.:-]{1,120}$/.test(id) || !data || typeof data !== 'object' || Array.isArray(data)) return send(res, 400, { error: 'bad_request' });
  if (JSON.stringify(data).length > MAX_BYTES) return send(res, 413, { error: 'too_large' });
  const doc = { ...data, id };
  const j = v => JSON.stringify(v);
  try {
    if (col === 'profiles') {
      if (id !== user) return send(res, 403, { error: 'forbidden' });
      // Work-sim results are written only by api/sim.js: keep the stored ones, never the browser's.
      const [curP] = await sql`SELECT data FROM profiles WHERE id = ${id}`;
      const serverSims = (curP && curP.data && curP.data.sims) || undefined;
      if (serverSims) doc.sims = serverSims; else delete doc.sims;
      const simSamples = new Set(((curP && curP.data && curP.data.portfolio) || []).filter(x => x && x.sim).map(x => x.sim));
      if (Array.isArray(doc.portfolio)) doc.portfolio = doc.portfolio.map(x => (x && x.sim && !simSamples.has(x.sim)) ? { ...x, sim: undefined } : x);
      await sql`INSERT INTO profiles (id, role, name, district, level, data)
        VALUES (${id}, ${doc.role || null}, ${doc.name || null}, ${doc.district || null}, ${doc.level || null}, ${j(doc)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, district = EXCLUDED.district,
          level = EXCLUDED.level, data = EXCLUDED.data, updated_at = now()`;
    } else if (col === 'jobs') {
      const [cur] = await sql`SELECT owner, data FROM jobs WHERE id = ${id}`;
      if (cur ? cur.owner !== user : doc.owner !== user) return send(res, 403, { error: 'forbidden' });
      // Generated work sims are attached only by api/sim.js: keep the stored link, ignore the browser's.
      const cd = (cur && cur.data) || {};
      if (cd.sim && String(cd.sim).startsWith('gen-')) { doc.sim = cd.sim; doc.simInfo = cd.simInfo; }
      else { if (doc.sim && String(doc.sim).startsWith('gen-')) delete doc.sim; delete doc.simInfo; }
      if (!doc.title || typeof doc.title !== 'string') return send(res, 400, { error: 'title_required' });
      doc.owner = cur ? cur.owner : user; delete doc.sample;
      // Application deadline (YYYY-MM-DD). The job closes automatically at the end of that day, Nepal time.
      if (doc.deadline != null && doc.deadline !== '') {
        if (typeof doc.deadline !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.deadline) || isNaN(Date.parse(doc.deadline + 'T23:59:59+05:45'))) return send(res, 400, { error: 'bad_deadline' });
      } else delete doc.deadline;
      await sql`INSERT INTO jobs (id, owner, title, level, status, data)
        VALUES (${id}, ${doc.owner}, ${doc.title.slice(0, 200)}, ${doc.level || null}, ${doc.status || 'open'}, ${j(doc)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, level = EXCLUDED.level, status = EXCLUDED.status,
          data = EXCLUDED.data, updated_at = now()`;
    } else if (col === 'apps') {
      const [cur] = await sql`SELECT a.user_id, a.job_id, a.status, a.data, j.owner FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ${id}`;
      if (cur) {
        // Only the employer who owns the job can move an application, one allowed step at a time.
        if (user !== cur.owner) return send(res, 403, { error: 'forbidden' });
        if (!(NEXT[cur.status] || []).includes(doc.status)) return send(res, 400, { error: 'bad_status' });
        // The employer only changes the stage; the CV snapshot and test result are kept exactly as stored.
        const next = { ...(cur.data || {}), id, uid: cur.user_id, jobId: cur.job_id, status: doc.status, [doc.status + 'At']: Date.now() };
        await sql`UPDATE applications SET status = ${next.status}, data = ${j(next)}::jsonb, updated_at = now() WHERE id = ${id}`;
        return send(res, 200, { ok: true, doc: next });
      } else {
        if (doc.uid !== user) return send(res, 403, { error: 'forbidden' });
        const [job] = await sql`SELECT id, owner, status, data FROM jobs WHERE id = ${String(doc.jobId || '')}`;
        if (!job) return send(res, 400, { error: 'job_not_found' });
        // Closed jobs (closed by hand, or past their application deadline) take no new applications.
        const dl = job.data && job.data.deadline;
        if (job.status === 'closed' || (dl && Date.now() > Date.parse(dl + 'T23:59:59+05:45'))) return send(res, 409, { error: 'job_closed' });
        const [dup] = await sql`SELECT 1 AS x FROM applications WHERE job_id = ${job.id} AND user_id = ${user}`;
        if (dup) return send(res, 409, { error: 'already_applied' });
        delete doc.test; delete doc.testStart;
        // The applicant's CV is shared with this job's employer only (see api/state.js).
        if (typeof doc.cv !== 'string') delete doc.cv; else doc.cv = doc.cv.slice(0, 12000);
        // Demo jobs (owner "sample") have no real employer, so every applicant is shortlisted straight away.
        doc.status = job.owner === 'sample' ? 'shortlisted' : 'applied';
        if (job.owner === 'sample') doc.demo = true;
        await sql`INSERT INTO applications (id, job_id, user_id, status, data) VALUES (${id}, ${job.id}, ${user}, ${doc.status}, ${j(doc)}::jsonb)`;
      }
    } else if (col === 'mentorships') {
      const [cur] = await sql`SELECT mentee, mentor FROM mentorships WHERE id = ${id}`;
      if (!MENT_STATUS.includes(doc.status)) return send(res, 400, { error: 'bad_status' });
      if (cur) {
        if (user !== cur.mentee && user !== cur.mentor) return send(res, 403, { error: 'forbidden' });
        if ((doc.status === 'accepted' || doc.status === 'declined') && user !== cur.mentor) return send(res, 403, { error: 'forbidden' });
        doc.mentee = cur.mentee; doc.mentor = cur.mentor;
        await sql`UPDATE mentorships SET status = ${doc.status}, data = ${j(doc)}::jsonb, updated_at = now() WHERE id = ${id}`;
      } else {
        if (doc.mentee !== user || !doc.mentor || doc.mentor === user) return send(res, 403, { error: 'forbidden' });
        const [mp] = await sql`SELECT data FROM profiles WHERE id = ${String(doc.mentor)}`;
        if (!mp || !mp.data.mentor) return send(res, 400, { error: 'not_a_mentor' });
        // Demo mentors accept straight away so the video-call step can be shown.
        doc.status = mp.data.sample ? 'accepted' : 'requested';
        await sql`INSERT INTO mentorships (id, mentee, mentor, status, data) VALUES (${id}, ${user}, ${String(doc.mentor)}, ${doc.status}, ${j(doc)}::jsonb)`;
      }
    } else if (col === 'private') {
      await sql`INSERT INTO private_docs (user_id, doc_id, data) VALUES (${user}, ${id}, ${j(doc)}::jsonb)
        ON CONFLICT (user_id, doc_id) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`;
    } else {
      return send(res, 400, { error: 'unknown_collection' });
    }
    send(res, 200, { ok: true, doc });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'database_error' });
  }
}
