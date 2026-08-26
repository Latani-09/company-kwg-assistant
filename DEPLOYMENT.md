# Deployment

- Last updated: 2026-08-26
- Status: options draft — nothing deployed yet

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
| Render Postgres | Free instance expires after 90 days | Supported | Good only for a short-lived demo, not ongoing use |

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

## Recommended stack (all free, no card required)

- **DB:** Supabase (enable the `vector` extension in the dashboard, then run the Alembic migrations
  in `python-backend/` against its connection string)
- **Backend:** Render free web service, pointed at `python-backend/`
- **Frontend:** Cloudflare Pages or Vercel, pointed at `react-app/`

### Setup outline

1. **Supabase**: create a project → Database → Extensions → enable `vector` → copy the connection
   string into `DATABASE_URL`.
2. **Backend on Render**: new Web Service from the GitHub repo, root directory `python-backend/`,
   build command `pip install -r requirements.txt`, start command
   `uvicorn app.main:app --host 0.0.0.0 --port $PORT`. Set env vars (see below), then run
   `alembic upgrade head` once (Render's shell tab, or a one-off job) against the Supabase DB.
3. **Frontend on Vercel/Cloudflare Pages**: new project from the repo, root directory `react-app/`,
   build command `npm run build`, output directory `dist`. Set `VITE_API_BASE_URL` to the Render
   backend's public URL + `/api/v1`.
4. **CORS**: `python-backend/app/main.py` currently allows `allow_origins=["*"]` — tighten this to the
   deployed frontend origin before treating this as a real deployment, not just a demo.

---

## Environment variables per service

**Backend (Render):**
- `DATABASE_URL` — Supabase/Neon connection string
- `GEMINI_API_KEY`
- `JWT_SECRET`
- `JWT_EXPIRE_MINUTES`
- `RAG_SIMILARITY_FLOOR`, `RAG_TOP_K`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `SMTP_USE_TLS`, `SMTP_FROM_EMAIL`
  (see `python-backend/.env.example` — SendGrid values)
- `APP_BASE_URL` — the deployed frontend's URL, once the interactive-email-link task in
  [BACKLOG.md](BACKLOG.md) is built (needed to construct the deep link in assignment emails)

**Frontend (Vercel/Cloudflare Pages):**
- `VITE_API_BASE_URL` — the deployed backend's URL + `/api/v1`

---

## Alternative: everything on one provider

If juggling three dashboards is annoying, Render alone can host the frontend as a **Static Site**
(free) alongside the backend **Web Service** (free) — same account, same repo, two services. You'd
still want Supabase or Neon for the DB rather than Render's own Postgres, since Render's free Postgres
expires after 90 days.
