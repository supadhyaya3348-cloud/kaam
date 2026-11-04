-- Kaam database schema (Neon Postgres). Already created in the Neon project "kaam".
-- Run this only if you make a new Neon project.
CREATE TABLE profiles (id text PRIMARY KEY, role text, name text, district text, level text, data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE jobs (id text PRIMARY KEY, owner text NOT NULL, title text NOT NULL, level text, status text NOT NULL DEFAULT 'open', data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE applications (id text PRIMARY KEY, job_id text NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, user_id text NOT NULL, status text NOT NULL DEFAULT 'applied', data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE mentorships (id text PRIMARY KEY, mentee text NOT NULL, mentor text NOT NULL, status text NOT NULL DEFAULT 'requested', data jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE private_docs (user_id text NOT NULL, doc_id text NOT NULL, data jsonb NOT NULL DEFAULT '{}'::jsonb, updated_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, doc_id));
CREATE INDEX applications_job_idx ON applications(job_id);
CREATE INDEX applications_user_idx ON applications(user_id);
CREATE INDEX mentorships_mentor_idx ON mentorships(mentor);
CREATE INDEX mentorships_mentee_idx ON mentorships(mentee);
CREATE INDEX jobs_owner_idx ON jobs(owner);

-- Accounts (added for login): passwords are stored only as scrypt hashes.
CREATE TABLE IF NOT EXISTS users (id text PRIMARY KEY, email text NOT NULL UNIQUE, pass_hash text NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE IF NOT EXISTS sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS sessions_user_idx ON sessions(user_id);
CREATE TABLE IF NOT EXISTS login_fails (email text NOT NULL, at timestamptz NOT NULL DEFAULT now());
CREATE INDEX IF NOT EXISTS login_fails_email_idx ON login_fails(email, at);
