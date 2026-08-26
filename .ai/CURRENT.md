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

### React app generation (2026-08-26)

- Built. `react-app/` is now a Vite + React 18 + TypeScript + Tailwind app (see [`react-app/AGENTS.md`](../react-app/AGENTS.md) for the frontend-specific technical decisions: stack, routing, auth, the gaps-assignment deviation from the prototype).
- Re-platformed all 3 prototype screens 1:1 in UX from [`resources/prototypes/knowledge-assistant_grp7final.html`](../resources/prototypes/knowledge-assistant_grp7final.html): `/` (login/signup), `/dashboard` (chat + My Knowledge Base), `/admin` (User Management + Knowledge Gaps) — all wired to the real `/api/v1` backend instead of `localStorage`.
- Verified end-to-end in a headless browser against the live backend: signup → pending modal → admin grant → granted-user login → sector-scoped KB tabs → add/delete a knowledge doc → unmatched chat question → gap logged → admin assigns gap (sector then SME selects) → gap drops off the open list.
- Bug found and fixed along the way: `GET/PATCH /api/v1/admin/users` 500'd (`AdminUserOut.model_validate` required `granted` before the follow-up `.model_copy()` could set it — Pydantic validates first). Fixed in [`admin_users.py`](../python-backend/app/routers/admin_users.py) by validating against `UserOut` first, then constructing `AdminUserOut` with `granted` supplied directly. This was blocking the Admin Users screen entirely; now confirmed working.
- For local testing, the seeded admin's password was reset to a known value (`TestAdmin123!`, via `passlib`'s hash + direct SQL update) since the original migration-time random password was never captured. Change it again before any real use — this repo's DB now also has a handful of test signups/gaps/docs from that verification pass that can be cleared out if you want a clean slate.
- Not done: automated tests (none were added — verification was manual/browser-driven only), and the backend's `/api/v1/admin/users` and `/api/v1/admin/gaps` have no server-side text search — the frontend filters/searches client-side instead.

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
