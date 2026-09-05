# Company Knowledge Assistant

This repository is set up as a two-part application:

- `python-backend/`: Python FastAPI API
- `react-app/`: React + Vite frontend

## Quick start

### Prerequisites

- PostgreSQL must be installed and running locally (setup commands are OS-specific — Ubuntu/Debian uses `apt`, macOS typically uses `brew`, etc.).
- The `pgvector` extension must be installed for your PostgreSQL version (e.g. `postgresql-<version>-pgvector` on Ubuntu/Debian) and enabled on the target database by a superuser before running migrations.
- Create a `kwg` database role with password `kwg`, and a `kwg_assistant` database owned by that role (see `python-backend/.env.example` for the expected connection string).
- Node 20+ for the frontend (`react-app/.nvmrc` pins 20.20.2 via `nvm use`) — an older system-wide Node won't run the current Vite toolchain.

### Backend

```bash
cd python-backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload --host 0.0.0.0 --port 8001
```

### Frontend

```bash
cd react-app
nvm use 20         # picks up .nvmrc (Node 20.20.2)
cp .env.example .env   # VITE_API_BASE_URL, defaults to the backend above
npm install
npm run dev -- --host 0.0.0.0
```

Open the app at http://localhost:5173 and the API at http://localhost:8000.

## Project status

The backend exposes the full `/api/v1` surface (auth, sectors, admin users, knowledge, chat, gaps) backed by PostgreSQL + pgvector. The React app (`react-app/`) re-platforms all 3 prototype screens — signup/login, user dashboard, admin dashboard — wired to that real API; see `react-app/AGENTS.md` for the frontend's specific technical decisions.

## Technical decision summary

The repository still follows the original product direction:

- Phase 1 prototype used static HTML and localStorage
- Phase 2 product is locked to Python + React + RAG
- The current scaffold acts as the implementation starting point for that architecture

---

`react-app/` and `python-backend/` are independent projects with their own dependencies and run commands — see each folder's own AGENTS.md for setup/decisions.

## Status

Currently transitioning from a static HTML/JS clickable prototype (localStorage-based, simulated auth/chat) into a real Python + React + RAG product. See the Technical Decision Document below for what's locked in and what's still open.

---

## Technical Decision Document — Company Knowledge Assistant

**Status:** Draft v1 — Phase 1 (prototype) decisions are final and already built. Phase 2 (product) stack is locked as Python + React + RAG. Everything marked "open" is genuinely undecided.

### 1. Phases

**Phase 1 — Prototype (done, unchanged)**
Static HTML/CSS/vanilla JS, 3 pages, `localStorage` as the only data store, auth/email/notifications simulated client-side. Purpose: validate flows and UX before writing real infrastructure. Not being touched or re-decided.

**Phase 2 — Product (locked direction, being built now)**
- Backend: **Python**
- Frontend: **React**
- Knowledge base / chat answering: **RAG pipeline** (retrieval-augmented generation) — replaces the simulated chat logic with real retrieval over uploaded documents + an LLM call, grounded answers with real citations, and gap detection driven by retrieval confidence rather than a hardcoded demo branch.

### 2. Why this split
The prototype exists to prove the UX (role gating, sector-scoped uploads, chat-across-all-sectors, gap flagging, admin assignment) is right before paying the cost of a real backend and a real retrieval pipeline. Phase 2 keeps every UX decision from Phase 1 — it's a re-platforming, not a redesign.

### 3. What Phase 2 replaces, 1:1

| Prototype (Phase 1) | Product (Phase 2) |
|---|---|
| `localStorage` for Users/Documents/Gaps/Session | Real database, served via a Python API |
| Simulated login (no real check) | Real auth against the Python backend |
| Simulated chat answer logic | RAG pipeline: embed docs → retrieve → LLM answers with citations |
| Simulated "gap detected" branch | Retrieval-confidence threshold decides gap vs. answer |
| Simulated toast "email sent" | Real notification (channel TBD — see open decisions) |
| 3 static HTML files | React app calling the Python API |

### 4. Decisions explicitly NOT being made right now
- Still exactly 2 roles (user, superAdmin) — no third role introduced by the backend split.
- Still the same fixed sector list + "Other" custom sector.
- Still no separate "pending" page — same modal-based flow.
- Screen set stays at 3 (signup/login, user dashboard, admin dashboard) unless stated otherwise.

### 5. Open decisions (deliberately deferred, not assumed)
- Python web framework (FastAPI is the common default for an API a React app + RAG pipeline both call, but not chosen yet)
- Vector store for RAG (e.g. pgvector, Chroma, Pinecone)
- LLM provider/model for generation
- Embedding model
- Primary database (e.g. Postgres)
- Real auth mechanism (session vs JWT, etc.)
- Real notification channel for "assigned" alerts (email service, in-app only, etc.)
- Hosting/infra

### 6. Migration path (high level)
Prototype validates UX → Python API stands up real data model → React frontend replaces the 3 static HTML files, calling that API → RAG pipeline replaces simulated chat/gap logic → `localStorage` retired in favor of the real database.