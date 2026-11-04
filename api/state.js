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
    // Phone numbers live in private_docs ("contact") and are shared only at the interview stage:
    // the employer sees the candidate's number, and the candidate sees the employer's.
    const iv = user ? apps.filter(r => ['interview', 'selected'].includes(r.data.status) && (r.owner === user || r.user_id === user)) : [];
    const ids = [...new Set(iv.map(r => (r.owner === user ? r.user_id : r.owner)))];
    const phones = ids.length ? Object.fromEntries((await sql`SELECT user_id, data FROM private_docs WHERE doc_id = 'contact' AND user_id = ANY(${ids})`).map(r => [r.user_id, r.data.phone])) : {};
    for (const r of appRows) {
      if (!user || !['interview', 'selected'].includes(r.data.status)) continue;
      const src = apps.find(x => x.data.id === r.data.id);
      if (src && src.owner === user && phones[src.user_id]) r.data = { ...r.data, phone: phones[src.user_id] };
      else if (src && src.user_id === user && phones[src.owner]) r.data = { ...r.data, employerPhone: phones[src.owner] };
    }
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
