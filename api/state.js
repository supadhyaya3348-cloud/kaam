import { sql, userOf, send } from './_lib.js';

// GET /api/state: everything the page needs, plus this user's private documents (CV, roadmap).
export default async function handler(req, res) {
  if (req.method !== 'GET') return send(res, 405, { error: 'method_not_allowed' });
  try {
    const user = await userOf(req);
    const [profiles, jobs, apps, ments, priv] = await Promise.all([
      sql`SELECT data FROM profiles`,
      sql`SELECT data FROM jobs`,
      sql`SELECT data FROM applications`,
      sql`SELECT data FROM mentorships`,
      user ? sql`SELECT doc_id, data FROM private_docs WHERE user_id = ${user}` : Promise.resolve([])
    ]);
    const byId = rows => Object.fromEntries(rows.map(r => [r.data.id, r.data]));
    send(res, 200, {
      profiles: byId(profiles), jobs: byId(jobs), apps: byId(apps), mentorships: byId(ments),
      priv: Object.fromEntries(priv.map(r => [r.doc_id, r.data]))
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'database_error' });
  }
}
