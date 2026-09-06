# Backlog

Task list for the two-person team. Priority: **P0** blocker, **P1** high, **P2** medium, **P3** low.
When picking one up, either work directly against this file (check the box, add your name) or convert it
into a GitHub Issue (`gh issue create --title "..." --label P1`) and link back here.

---

## P2 — Interactive gap-assignment email (deep link into Add Knowledge)

**Problem:** the assignment email (`gap_service.py:44-56`) is plain text telling the assignee to "add a
Q&A entry" with no way to get there directly.

**Subtasks:**
- [ ] Add an `app_base_url` setting (`.env` / `config.py`) pointing at the deployed frontend origin.
- [ ] Frontend: `DashboardPage.tsx` reads a query param (e.g. `?sector=<id>&addDoc=1`) on mount, sets
      `activeSectorId`/`docSectorId` to it, and opens `addDocOpen` automatically.
- [ ] Backend: build the deep link in `gap_service.assign_gap` using `app_base_url` + the assigned
      sector's id, e.g. `{app_base_url}/dashboard?sector={sector.id}&addDoc=1`.
- [ ] Switch `mail_service.send_email` (or add a sibling `send_html_email`) to support an HTML body so the
      link can render as a real button/link, with a plain-text fallback for clients that need it.
- [ ] Update the email copy to include the gap question, sector, and the link/button.

---

## Done

### P1 — Admin: resolved gaps disappear, no status filter

Merged via PR #26 (`8ac5fe2`, `135c560`).

- [x] Backend: manual resolve endpoint — `POST /gaps/{id}/resolve` (`gaps.py`) + `resolve_gap` in
      `gap_service.py` (sets `status=resolved`, `resolved_at`).
- [x] Frontend: status filter control on the Gaps tab (`AdminPage.tsx`) — Open/Assigned/Resolved/All.
- [x] Frontend: `reloadGaps()` refetches based on the selected filter instead of hardcoding `"open"`.
- [x] Frontend: rows update via refetch instead of being deleted from local state on assign.
- [x] Frontend: "Mark Resolved" action + resolved-state badge on `GapRow`.

### P3 — Test suite (currently zero tests in the repo)

See [resources/docs/Testing.md](resources/docs/Testing.md) for the test strategy, isolation rules,
coverage priorities, and local commands.

#### Backend (pytest)
- [x] P1 — Test harness: `pytest` + `pytest-asyncio`/`httpx` `TestClient`, a throwaway SQLite or a
      dockerized Postgres+pgvector fixture DB, fixtures for a seeded user/sector/gap.
- [x] P1 — `auth_service`: signup (dup email/username, sector resolution incl. "Other"), login (pending/
      revoked/bad password paths).
- [x] P1 — `knowledge_service`: `_assert_sector_access` (superAdmin bypass vs. non-member 403), create/
      delete entry.
- [x] P1 — `gap_service`: create on chat miss, assign (status/timestamps update, email attempted), the new
      resolve path once it exists.
- [x] P2 — `user_service` (admin list/filter, access update) and `chat_service`/RAG pipeline with the
      Gemini client mocked (no live API calls in tests).
- [x] P2 — Router-level tests for auth guards (`require_admin`, `get_current_user`) returning 401/403.

#### Frontend (Vitest + React Testing Library)
- [x] P2 — Test harness: add `vitest`, `@testing-library/react`, `jsdom` to `react-app`, wire an `npm test`
      script.
- [x] P2 — `AuthContext`: login/signup/logout state transitions.
- [x] P2 — `SectorChips` (toggle selection, "Other" free-text, payload shape).
- [x] P3 — `DashboardPage` (superAdmin sees all sectors, doc add/delete flow) and `AdminPage` (gap
      assign flow, user grant/revoke).

#### CI
- [x] P2 — GitHub Actions workflow running both suites on PRs to `main` once the harnesses above exist.
