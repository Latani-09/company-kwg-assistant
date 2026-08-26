# Deployment

- Last updated: 2026-08-26
- Status: **decided — deploying everything on Render today** (demo app, free tier)

## Today's plan: all-on-Render via Blueprint

Since this is a demo and needs to be live in a few hours, all three pieces go on Render using the
`render.yaml` Blueprint at the repo root — one "Apply" creates the DB, backend, and frontend together
instead of clicking through three separate setups.

### What's already in the repo for this
- `render.yaml` — defines `kwg-db` (free Postgres), `kwg-backend` (free Python web service, runs
  `alembic upgrade head` as a pre-deploy step, which also creates the `pgvector` extension per
  `0001_initial_schema.py`), and `kwg-frontend` (free static site, with an SPA rewrite so
  `react-router-dom` client routes don't 404 on refresh).
- `python-backend/app/core/config.py` — now normalizes `postgres://`/`postgresql://` URLs (what Render
  hands you) to `postgresql+psycopg://` (what SQLAlchemy needs for the psycopg3 driver), so Render's
  injected `DATABASE_URL` works without edits.

### Steps
1. Push these changes to the branch Render will deploy from (Blueprints default to your repo's main
   branch — merge to `main` first if you're working off a feature branch).
2. Render dashboard → **New → Blueprint** → connect this GitHub repo → it detects `render.yaml`.
3. Render will prompt you to fill in the env vars marked `sync: false` before the first deploy:
   `GEMINI_API_KEY`, `SMTP_PASSWORD` (your SendGrid API key), `SMTP_FROM_EMAIL` (a sender verified in
   SendGrid). `JWT_SECRET` is auto-generated; everything else is pre-filled.
4. Click **Apply**. Watch the `kwg-backend` deploy log for the pre-deploy step — the seed migration
   (`0002_seed_admin_user.py`) prints a **generated admin username/password once**. Copy it immediately,
   it's not shown again (it's only in that log).
5. Once both services are live, open the `kwg-frontend` URL and log in with the seeded admin account.

### Gotchas to watch for
- **Service names are global on Render** — `kwg-backend.onrender.com` / `kwg-frontend.onrender.com` might
  already be taken by someone else's app. If Render assigns different names, update the hardcoded
  `VITE_API_BASE_URL` (in `kwg-backend`'s block) and `APP_BASE_URL` (in `kwg-frontend`'s block) inside
  `render.yaml` to match, then redeploy — they reference each other by predicted URL since Blueprint
  cross-service URL lookups aren't used here for speed.
- **Cold starts**: free web services spin down after ~15 min idle; the first request after that takes
  10–30s. Fine for a demo, just don't panic mid-walkthrough — hit the backend `/health` once before
  presenting.
- **DB expiry**: `kwg-db` is free-tier Postgres and expires 30 days after creation (14-day grace period
  after that). Fine for a demo; revisit before this needs to be a lasting deployment (see the provider
  comparison below for options that don't expire).
- **CORS** is still `allow_origins=["*"]` in `app/main.py` — acceptable for a demo, not for anything
  handling real user data long-term.

---

## What has to be hosted

Three pieces, each can live on a different free provider:

1. **Database** — PostgreSQL with the `pgvector` extension (embeddings live in the `qa_entries` table).
2. **Backend** — the FastAPI app in `python-backend/` (needs outbound HTTPS to call the Gemini API and,
   once configured, the SendGrid SMTP relay).
3. **Frontend** — the Vite/React static build in `react-app/`.

---

## Free-tier options

### Database (Postgres + pgvector)

| Provider | Free tier | pgvector | Notes |
|---|---|---|---|
| **Supabase** (recommended) | 500MB DB, 2 projects, no card required | Enabled via a checkbox in the dashboard | Easiest path for this project; also gives you a DB browser for free |
| **Neon** | 0.5GB storage, generous compute hours, no card required | `CREATE EXTENSION vector` works out of the box | Serverless Postgres, scales to zero when idle |
| Render Postgres | Free instance expires 30 days after creation (14-day grace period, then deleted; no backups on the free tier) | Supported (available by default on new DBs) | Good only for a short-lived demo, not ongoing use |

### Backend (FastAPI)

| Provider | Free tier | Notes |
|---|---|---|
| **Render** (recommended) | 750 instance-hours/month, no card required | Spins down after ~15 min idle; first request after that has a cold-start delay (10–30s) — fine for a bootcamp project, mention it if demoing live |
| Fly.io | Small free allowance (shared-cpu VM) | Requires a card on file even though usage stays free; stays warm (no cold start) if you're on the always-on config |
| PythonAnywhere | Free "Hacker" tier | Restricted outbound HTTPS on the free tier — would block calls to the Gemini API and SendGrid, so avoid for this project |

### Frontend (static Vite build)

| Provider | Free tier | Notes |
|---|---|---|
| **Vercel** or **Cloudflare Pages** (either is fine) | Generous free tier, no card required | Both auto-deploy from a GitHub push; Cloudflare Pages has no bandwidth cap |
| Netlify | Similar free tier | Also fine, slightly lower free build-minutes than the two above |
| GitHub Pages | Free | Works but needs extra config for client-side routing (`react-router-dom`) and doesn't support per-branch preview URLs as cleanly |

---

## Longer-term alternative (if the DB needs to outlive 30 days)

Not what we're doing today, but worth knowing: swap `kwg-db` for Supabase or Neon (neither expires) and
keep the backend/frontend on Render.

1. **Supabase**: create a project → Database → Extensions → enable `vector` → copy the connection
   string into the `kwg-backend` service's `DATABASE_URL` env var (remove the `fromDatabase` link and
   the `databases:` block from `render.yaml`, or just override it manually in the dashboard).
2. Everything else in the Blueprint stays the same — `kwg-backend` and `kwg-frontend` don't care which
   Postgres they point at.

---

## Environment variables per service

All of these are already declared in `render.yaml`; listed here for reference.

**Backend (`kwg-backend`):**
- `DATABASE_URL` — from `kwg-db` automatically (`fromDatabase`)
- `GEMINI_API_KEY` — fill in during Blueprint setup
- `JWT_SECRET` — auto-generated
- `JWT_EXPIRE_MINUTES`, `RAG_SIMILARITY_FLOOR`, `RAG_TOP_K` — pre-filled defaults
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_USE_TLS` — pre-filled SendGrid defaults;
  `SMTP_PASSWORD`, `SMTP_FROM_EMAIL` — fill in during Blueprint setup
- `APP_BASE_URL` — pre-filled to `kwg-frontend`'s predicted URL (used once the interactive-email-link
  task in [BACKLOG.md](BACKLOG.md) is built, to construct the deep link in assignment emails)

**Frontend (`kwg-frontend`):**
- `VITE_API_BASE_URL` — pre-filled to `kwg-backend`'s predicted URL + `/api/v1`
- `NODE_VERSION` — pinned to `20.20.2` to match `react-app/.nvmrc`
