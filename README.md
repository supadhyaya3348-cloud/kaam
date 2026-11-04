# Kaam

Hiring on proven skills in Nepal. Jobseekers choose a card (Fresher, Mid-level or Senior), upload a CV, get a
roadmap of what is missing, take skill checks, meet mentors on video and apply blind. Employers post jobs for a
level, see applicants ranked by verified skill, and check fair hiring at each stage.

- **Frontend:** `index.html` (one page, no build step)
- **Backend:** Vercel serverless functions in `api/`
- **Database:** Neon Postgres, project **kaam** (tables already created, 4 sample jobs added)
- **AI (optional):** Anthropic API, used for CV gap analysis, the AI Manager chat and "Improve with AI"

## Deploy (about 10 minutes)

1. **Put the code on GitHub.** Create a new repository and upload everything in this folder.
2. **Import it in Vercel.** vercel.com → Add New → Project → pick the repository. Framework preset: **Other**. No build command.
3. **Add environment variables** in the import screen (or later in Settings → Environment Variables):
   - `DATABASE_URL`: in the Neon console open project **kaam** → **Connect** → copy the connection string.
   - `ANTHROPIC_API_KEY` (optional): from console.anthropic.com. Without it the site still works and uses a basic,
     keyword-based CV check instead of AI.
4. **Deploy.** Vercel gives you a public link such as `kaam.vercel.app`. Anyone can use it, with no Claude account.

## Run it on your computer

```bash
npm install
npm i -g vercel
cp .env.example .env   # then paste your DATABASE_URL (and optional ANTHROPIC_API_KEY)
vercel dev             # opens http://localhost:3000
```

## API

| Route | Does |
|---|---|
| `GET /api/state` | Profiles, jobs, applications and mentor sessions, plus the caller's private CV and roadmap |
| `POST /api/save` | Saves one record `{ col, id, data }`. Checks who may change what (see below) |
| `GET/POST /api/ai` | Says whether AI is on; runs one AI request |

Rules enforced by the server: you can only edit your own profile and private documents; only a job's owner can edit
it or move its applicants through the stages; you can apply only as yourself and only once per job; only the mentor
can accept or decline a session.

## Tables

`profiles`, `jobs`, `applications`, `mentorships`, `private_docs` — see `schema.sql`. Each row keeps key columns
(owner, status, level…) for queries plus the full record in a `data` JSONB column.

## Known limits (fine for the hackathon demo)

- People are identified by an anonymous id stored in their browser, not a login. Clearing browser data or switching
  phones starts a new profile. Next step: add Neon Auth for real sign-in.
- Blind hiring is enforced in the interface. Profile details are still sent to the browser, so a determined user
  could read them. Next step: have `/api/state` hide names, gender and district from employers until selection.
- Set a monthly spending limit on your Anthropic key, since `/api/ai` is open to anyone using the site.


## Accounts and security
- Email + password sign up and log in (`/api/auth`), plus a logout page.
- Passwords are hashed with **scrypt** (Node's built-in crypto, random 16-byte salt per user). The plain password is never stored.
- Logging in creates a random session token kept in an **HttpOnly, Secure, SameSite=Lax** cookie for 30 days. The database stores only a SHA-256 of the token.
- 5 wrong passwords for one email locks that email for 15 minutes.
- Saving anything, private CV data and AI calls all require a logged-in session; the server decides who you are from the cookie, not from the browser.

## Hiring pipeline
Applied → Shortlisted → Assessment (proctored mock test) → Interview → Hired, or "Not now" at any stage.
- Employers can add their own skills (e.g. Tally, Canva) and requirements to a job. Both are checked against each applicant's CV.
- Applying shares the jobseeker's CV with that job's employer only (`api/state.js` strips it for everyone else). With blind hiring, name, email and phone are hidden in the CV until the interview.
- **Review** shows verified skill scores, requirements vs. CV, the CV, work samples and the assessment result.
- When shortlisted, the jobseeker gets a notification, can take unlimited practice tests, and starts the real assessment when ready ("I'm ready").
- The real assessment (`api/test.js`, questions in `api/_mock.js`): 10-minute timer kept by the server, full screen, and tab or app switches, full-screen exits and copy/paste attempts are recorded and shown to the employer. One try, graded on the server; 60+ moves to Interview.
- Interviews use a free Jitsi room shared by both sides.

## Demos
- Demo jobs `demo-bookkeeping` and `demo-social-media` have requirements. Applying shortlists you straight away so the whole journey can be shown with one account.
- Demo mentors `demo-mentor-asha` and `demo-mentor-rabin` accept requests instantly.
- Two demo CVs on the CV upload step.

## Offline
- `sw.js` (service worker) keeps the app page, fonts and libraries on the device, so Kaam opens with no internet. It never caches `/api`.
- After each sync, the signed-in user's roadmap, courses, jobs and applications are saved in the browser. Offline, the app shows them with an "offline" banner.
- Roadmap steps and course lessons ticked offline are queued and sent automatically when the connection returns. Other actions (apply, tests, posting) need a connection.
- Logging out removes the saved copy from the device.

## Nepali
`ne.js` holds the Nepali translation of the whole interface (dictionary plus patterns for sentences that contain names or job titles). When Nepali is chosen, every screen, message and label is translated after it renders; user content (CVs, job descriptions, names, districts) stays as written. Excel formulas and English example sentences in the English quiz are kept in English on purpose.
