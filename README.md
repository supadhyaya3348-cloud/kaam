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
