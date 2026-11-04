// Demo-day data: a "Cloud security engineer" demo job and a demo jobseeker (Aarati) whose verified skills,
// CV and portfolio match it. POST /api/auth { action: 'demo' } resets Aarati to a fresh state and logs in,
// so the whole journey can be shown again and again. Any employer account can review this demo job.
import { randomBytes } from 'node:crypto';
import { sql, hashPassword } from './_lib.js';

export const DEMO_JOB_ID = 'demo-cloud-security';
export const DEMO_SEEKER_ID = 'udemoaaratishrestha';
const DEMO_EMAIL = 'aarati.demo@careercamp.app';
const VERSION = 1;

export const DEMO_JOB = {
  id: DEMO_JOB_ID, v: VERSION, owner: 'sample', sample: true, demo: true, openReview: true,
  company: 'Demo: Himalayan Cloud Pvt. Ltd.', title: 'Cloud security engineer', district: 'Kathmandu', level: 'mid', type: 'full', blind: true,
  desc: 'Keep our customers’ cloud systems safe. You will secure AWS and Azure accounts, watch security alerts, fix risky settings before attackers find them, and explain incidents clearly to the team. We train you on our tools and pair you with a senior engineer for the first three months.',
  requirements: [
    'Secure AWS or Azure accounts with IAM and least privilege access',
    'Configure security groups, firewalls and VPC networks',
    'Monitor logs and alerts in a SIEM such as CloudWatch or Sentinel',
    'Manage encryption keys and secrets with KMS or Key Vault',
    'Scan cloud infrastructure for misconfigurations and vulnerabilities',
    'Respond to security incidents and write clear incident reports',
    'Automate security checks with Python or Bash scripts',
    'Follow security policies and compliance standards such as ISO 27001'
  ],
  skills: { digital: 5, english: 4, excel: 2, service: 2 },
  extra: [{ name: 'AWS', w: 5 }, { name: 'Linux', w: 4 }, { name: 'Python', w: 3 }],
  sim: 'cloud-security-day', deadline: '2026-12-31', status: 'open', at: Date.parse('2026-11-05T00:00:00Z')
};

export const DEMO_CV = `Aarati Shrestha
Cloud security engineer · Pokhara, Kaski · aarati.demo@careercamp.app

SUMMARY
Cloud security engineer with two years of hands-on work securing AWS and Azure accounts for small businesses in Nepal. Calm under pressure, clear in English and Nepali, and careful with every detail.

EXPERIENCE
Junior cloud security engineer, Annapurna Web Services, Pokhara (2024 to now)
- Secured 12 AWS and Azure accounts with IAM roles and least privilege access; removed unused admin access keys.
- Configured security groups, firewalls and VPC networks; closed public database ports.
- Monitored logs and alerts in a SIEM (CloudWatch and Microsoft Sentinel) and handled the first response to security incidents.
- Managed encryption keys and secrets with AWS KMS and Azure Key Vault.
- Ran weekly scans of the cloud infrastructure for misconfigurations and vulnerabilities, and tracked fixes in an Excel spreadsheet.
- Wrote clear incident reports and emails for customers and the team; explained risks to non-technical clients.
- Automated security checks with Python and Bash scripts on Linux servers.

IT support intern, Pokhara Computer Centre (2023)
- Helped customers with computer, internet and online safety problems at the service desk.

EDUCATION AND CERTIFICATES
- BSc in Computer Science and Information Technology (BSc CSIT), Tribhuvan University, 2024
- AWS Certified Security Specialty (study in progress), ISO 27001 awareness course: followed security policies and compliance standards in every project.

SKILLS
AWS, Azure, Linux, Python, Bash, IAM, VPC, KMS, SIEM, incident response, Excel, English communication, customer service.`;

export const DEMO_PROFILE = {
  id: DEMO_SEEKER_ID, role: 'seeker', name: 'Aarati Shrestha', district: 'Kaski', company: '', lang: 'en', gender: 'woman', careerBreak: false,
  level: 'mid', demo: true, createdAt: Date.parse('2026-10-01T00:00:00Z'),
  scores: { digital: 100, english: 100, excel: 100, service: 100 },
  portfolio: [
    { title: 'Locked down 12 AWS and Azure accounts', desc: 'Moved every user to IAM roles with least privilege, turned on MFA, removed old admin keys and wrote a one-page guide for the team.', skill: 'digital', at: Date.parse('2026-09-12T00:00:00Z') },
    { title: 'Python script that finds public S3 buckets', desc: 'Runs every night with Bash and cron, checks all buckets and security groups, and emails a short report of risky settings.', skill: 'digital', link: '', at: Date.parse('2026-08-20T00:00:00Z') },
    { title: 'Incident report: SSH brute-force attack', desc: 'Explained what happened, how I blocked the IP and rotated the keys, and what we changed so it cannot happen again. Written in plain English for the client.', skill: 'english', at: Date.parse('2026-07-02T00:00:00Z') }
  ]
};

let seeded = false;
export async function ensureDemoJob() {
  if (seeded) return; seeded = true;
  await sql`INSERT INTO jobs (id, owner, title, level, status, data)
    VALUES (${DEMO_JOB_ID}, 'sample', ${DEMO_JOB.title}, ${DEMO_JOB.level}, 'open', ${JSON.stringify(DEMO_JOB)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, level = EXCLUDED.level, status = 'open', data = EXCLUDED.data, updated_at = now()
    WHERE (jobs.data->>'v') IS DISTINCT FROM (EXCLUDED.data->>'v')`;
}

// Fresh demo jobseeker: verified skills, CV, phone and portfolio; no applications, no work-sim or roadmap progress.
export async function resetDemoSeeker() {
  await ensureDemoJob();
  const [u] = await sql`SELECT id FROM users WHERE id = ${DEMO_SEEKER_ID}`;
  if (!u) {
    // No one can log in to this account with a password: it is only reachable through the demo button.
    const pass_hash = await hashPassword(randomBytes(24).toString('base64url'));
    await sql`INSERT INTO users (id, email, pass_hash) VALUES (${DEMO_SEEKER_ID}, ${DEMO_EMAIL}, ${pass_hash}) ON CONFLICT DO NOTHING`;
  }
  await sql`DELETE FROM applications WHERE user_id = ${DEMO_SEEKER_ID}`;
  await sql`DELETE FROM private_docs WHERE user_id = ${DEMO_SEEKER_ID}`;
  await sql`INSERT INTO profiles (id, role, name, district, level, data)
    VALUES (${DEMO_SEEKER_ID}, 'seeker', ${DEMO_PROFILE.name}, ${DEMO_PROFILE.district}, ${DEMO_PROFILE.level}, ${JSON.stringify(DEMO_PROFILE)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET role = EXCLUDED.role, name = EXCLUDED.name, district = EXCLUDED.district, level = EXCLUDED.level, data = EXCLUDED.data, updated_at = now()`;
  await sql`INSERT INTO private_docs (user_id, doc_id, data) VALUES
    (${DEMO_SEEKER_ID}, 'cv', ${JSON.stringify({ id: 'cv', text: DEMO_CV, name: 'Aarati-Shrestha-CV.pdf', at: Date.now() })}::jsonb),
    (${DEMO_SEEKER_ID}, 'contact', ${JSON.stringify({ id: 'contact', phone: '9800000000' })}::jsonb)`;
  return { id: DEMO_SEEKER_ID, email: DEMO_EMAIL };
}
