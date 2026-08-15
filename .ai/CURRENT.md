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
- Frontend (`react-app/`) hasn't been exercised against the live backend yet.
