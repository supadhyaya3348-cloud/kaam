import { sql, userOf, send, readBody } from './_lib.js';

const MAX_BYTES = 200_000;
const APP_STATUS = ['applied', 'shortlisted', 'selected', 'rejected'];
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
      await sql`INSERT INTO profiles (id, role, name, district, level, data)
        VALUES (${id}, ${doc.role || null}, ${doc.name || null}, ${doc.district || null}, ${doc.level || null}, ${j(doc)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, district = EXCLUDED.district,
          level = EXCLUDED.level, data = EXCLUDED.data, updated_at = now()`;
    } else if (col === 'jobs') {
      const [cur] = await sql`SELECT owner FROM jobs WHERE id = ${id}`;
      if (cur ? cur.owner !== user : doc.owner !== user) return send(res, 403, { error: 'forbidden' });
      if (!doc.title || typeof doc.title !== 'string') return send(res, 400, { error: 'title_required' });
      doc.owner = cur ? cur.owner : user; delete doc.sample;
      await sql`INSERT INTO jobs (id, owner, title, level, status, data)
        VALUES (${id}, ${doc.owner}, ${doc.title.slice(0, 200)}, ${doc.level || null}, ${doc.status || 'open'}, ${j(doc)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, level = EXCLUDED.level, status = EXCLUDED.status,
          data = EXCLUDED.data, updated_at = now()`;
    } else if (col === 'apps') {
      const [cur] = await sql`SELECT a.user_id, a.job_id, j.owner FROM applications a JOIN jobs j ON j.id = a.job_id WHERE a.id = ${id}`;
      if (cur) {
        // Only the employer who owns the job can move an application through the stages.
        if (user !== cur.owner) return send(res, 403, { error: 'forbidden' });
        if (!APP_STATUS.includes(doc.status)) return send(res, 400, { error: 'bad_status' });
        doc.uid = cur.user_id; doc.jobId = cur.job_id;
        await sql`UPDATE applications SET status = ${doc.status}, data = ${j(doc)}::jsonb, updated_at = now() WHERE id = ${id}`;
      } else {
        if (doc.uid !== user) return send(res, 403, { error: 'forbidden' });
        const [job] = await sql`SELECT id FROM jobs WHERE id = ${String(doc.jobId || '')}`;
        if (!job) return send(res, 400, { error: 'job_not_found' });
        const [dup] = await sql`SELECT 1 AS x FROM applications WHERE job_id = ${job.id} AND user_id = ${user}`;
        if (dup) return send(res, 409, { error: 'already_applied' });
        doc.status = 'applied';
        await sql`INSERT INTO applications (id, job_id, user_id, status, data) VALUES (${id}, ${job.id}, ${user}, 'applied', ${j(doc)}::jsonb)`;
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
        doc.status = 'requested';
        await sql`INSERT INTO mentorships (id, mentee, mentor, status, data) VALUES (${id}, ${user}, ${String(doc.mentor)}, 'requested', ${j(doc)}::jsonb)`;
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
