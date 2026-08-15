# Current Progress

This document tracks what's been requested and verified in the Company Knowledge Assistant project so far, so work can pick back up next session without re-deriving context. It's a running log of user-initiated work and app-level checks — not an environment/install log. Update it as work continues.

## Requested (2026-08-15)

1. Get PostgreSQL working for the backend (`python-backend/`).
2. Add short setup instructions to root [`README.md`](../README.md) — no commands, just what needs to be in place.
3. Diagnose and resolve `alembic upgrade head` failures.
4. Add an Alembic migration to seed an initial admin user, with a randomly generated password (to be changed later).
5. Log in with the seeded admin account and confirm it actually works.

## Checks performed against the app

- `alembic upgrade head` runs clean end-to-end on a fresh database (migrations `0001` initial schema, `0002` seed admin user).
- Seeded `admin` user created via [`0002_seed_admin_user.py`](../python-backend/app/db/migrations/versions/0002_seed_admin_user.py) — `superAdmin` role, `granted` status, random password printed once at migration time (not stored in this repo).
- `POST /api/v1/auth/login` with the seeded `admin` credentials — succeeds, returns a valid JWT.
- `GET /api/v1/auth/me` with that token — succeeds, returns the expected profile (`role: superAdmin`, `status: granted`).

## Open items / next steps

- Change the seeded `admin` password to something known/managed (explicitly deferred — "i will update it later").
- No seed data beyond the fixed sector list and the one admin user.

### React app generation

- `react-app/` is currently an empty scaffold (just `AGENTS.md`, no implementation).
- Prototype to build from: [`resources/prototypes/knowledge-assistant_grp7final.html`](../resources/prototypes/knowledge-assistant_grp7final.html) (static HTML/localStorage prototype — see [`resources/docs/Specifications.md`](../resources/docs/Specifications.md)).
- Not started yet: re-platform the 3 prototype screens (signup/login, user dashboard, admin dashboard) into React, wired to the real `/api/v1` backend instead of `localStorage`.

### Remaining API checks (not yet verified against the running backend)

- `POST /api/v1/auth/signup` — new user signup (should land in `pending` status)
- `GET /api/v1/sectors` — fixed sector list
- `GET /api/v1/admin/users` + `PATCH /api/v1/admin/users/{id}/access` — admin grant/revoke flow
- `GET /api/v1/knowledge/qa`, `POST /api/v1/knowledge/qa`, `DELETE /api/v1/knowledge/qa/{id}` — sector-scoped Q&A CRUD
- `POST /api/v1/chat/query` — RAG-backed chat answer
- `GET /api/v1/admin/gaps` + `POST /api/v1/admin/gaps/{id}/assign` — knowledge gap review/assignment

### RAG pipeline check

- `qa_entries` table is currently empty — no knowledge data has been seeded yet.
- Pipeline (`chat_service.ask`): embed question → `retrieval.search` (pgvector similarity) → if best score ≥ `RAG_SIMILARITY_FLOOR`, call Gemini (`generation.generate`) → `gap_detection.decide` → answer or gap.
- With zero `qa_entries`, every `/api/v1/chat/query` call will currently resolve as a gap (no match to retrieve) — need to add at least a few Q&A entries via `POST /api/v1/knowledge/qa` (or a seed migration) before this can be meaningfully tested end-to-end.
- Also needs a valid `GEMINI_API_KEY` in `.env` for the generation step to run at all.
