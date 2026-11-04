import { sql, userOf, send } from './_lib.js';
import { ruleSim, simInfoOf } from './_simgen.js';

// GET /api/state: everything the page needs, plus this user's private documents (CV, roadmap).
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const user = await userOf(req);
    const [profiles, jobs, apps, ments, priv] = await Promise.all([
      sql`SELECT data FROM profiles`,
      sql`SELECT id, owner, data FROM jobs`,
      sql`SELECT a.data, a.user_id, j.owner FROM applications a JOIN jobs j ON j.id = a.job_id`,
      sql`SELECT data FROM mentorships`,
      user ? sql`SELECT doc_id, data FROM private_docs WHERE user_id = ${user}` : Promise.resolve([])
    ]);
    const byId = rows => Object.fromEntries(rows.map(r => [r.data.id, r.data]));
    // A CV inside an application is visible only to the applicant and the employer who owns the job.
    const appRows = apps.map(r => {
      if (r.data.cv && user !== r.user_id && user !== r.owner) { const { cv, ...rest } = r.data; return { data: { ...rest, hasCv: true } }; }
      return r;
    });
    // Work sims are compulsory: demo jobs without a stored sim show the one built from their post.
    const jobRows = jobs.map(r => (r.owner === 'sample' && !(r.data && r.data.sim)) ? { data: { ...r.data, sim: 'gen-' + r.id, simInfo: simInfoOf(ruleSim(r.data || {}, 'gen-' + r.id)) } } : { data: r.data });
    send(res, 200, {
      profiles: byId(profiles), jobs: byId(jobRows), apps: byId(appRows), mentorships: byId(ments),
      priv: Object.fromEntries(priv.map(r => [r.doc_id, r.data]))
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'database_error' });
  }
}
