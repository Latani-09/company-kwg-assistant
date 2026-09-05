# Testing Guide

## Purpose

This document defines the test strategy for Company Knowledge Assistant as the project moves from prototype to product. Tests should protect the role model, sector access rules, knowledge workflows, chat and gap lifecycle, and the frontend's key user flows.

See [TestCases.md](TestCases.md) for the implemented test-case inventory and expected results.

Current limitation: pytest and Vitest verify application logic, but browser workflows, responsive behavior,
accessibility, visual regressions, real email delivery, and real AI answer quality are not covered yet; we will
use Playwright for the browser-level end-to-end coverage.

The first Playwright smoke test is in `react-app/e2e/` and runs with:

```bash
cd react-app
npm run test:e2e
```

## Playwright Plan

Playwright covers real-browser workflows that Vitest and pytest cannot fully verify. Split the work by
independent user journey so multiple contributors can work in parallel:

- **Auth:** login, signup, pending/revoked messages, logout, and redirects.
- **Knowledge:** assigned sectors, add entry, delete entry, and source metadata.
- **Chat:** successful answers, citations, gap detection, and error states.
- **Admin users:** user list, filters, grant, revoke, and confirmation dialogs.
- **Admin gaps:** gap list, status filters, assignment, and resolution.
- **Responsive/accessibility:** desktop/mobile layouts, keyboard navigation, focus, and basic accessibility.

Use one spec area per journey under `react-app/e2e/`:

```text
e2e/auth/
e2e/knowledge/
e2e/chat/
e2e/admin/
e2e/accessibility/
```

Each contributor should own a separate spec area, update [TestCases.md](TestCases.md), and link the
corresponding GitHub issue. Avoid simultaneous edits to `playwright.config.ts` and shared fixtures.
Keep tests isolated, use stable user-facing locators, and attach traces/screenshots on CI failure.
Playwright runs in CI after the frontend build with `npm run test:e2e`; Chromium is the first browser target,
with Firefox and WebKit added later if cross-browser coverage is needed.

## Keeping Test Cases Current

When adding or changing a feature:

1. Add or update the automated test in the relevant backend or frontend test file.
2. Add the test case and expected result to [TestCases.md](TestCases.md), including its category.
3. Update the related GitHub issue or [BACKLOG.md](../../BACKLOG.md) item.
4. Run the focused test file, then the full suite before merging.

Pull requests should mention the test cases added or changed. A test case should be removed from
the inventory only when the corresponding behavior is intentionally removed from the product.

## Current baseline

- The backend and frontend harnesses, component tests, and CI workflow are now in place.
- Backend tests will use `pytest`, `pytest-asyncio`, `httpx`, and FastAPI's test client.
- Frontend tests will use Vitest with React Testing Library and `jsdom`.
- External services must be mocked in tests: PostgreSQL/pgvector where practical, Gemini, and email delivery.
- Tests must not call live LLM or email services and must not depend on production data.

The GitHub issue tracker is the acceptance-criteria source for this plan. The parent issue is [#11](https://github.com/Latani-09/company-kwg-assistant/issues/11), with harness, service, component, and CI work split into child issues.

## Harness requirements

### Backend harness ([#13](https://github.com/Latani-09/company-kwg-assistant/issues/13))

- Add `pytest`, `pytest-asyncio`, and `httpx` to `python-backend/requirements.txt`.
- Create `python-backend/tests/conftest.py` and a clear `tests/` structure.
- Provide a throwaway SQLite database or dockerized PostgreSQL + pgvector database.
- Provide seeded user, sector, and gap fixtures plus database-session cleanup.
- Include a smoke test that proves the harness works before adding service tests.

### Frontend harness ([#20](https://github.com/Latani-09/company-kwg-assistant/issues/20))

- Add `vitest`, `@testing-library/react`, and `jsdom` to `react-app/package.json`.
- Configure `vitest.config.ts` with the `jsdom` environment.
- Create frontend test utilities and fixtures for the API client, auth context, and router.
- Add an `npm test` script that runs Vitest in watch mode.
- Include a frontend smoke test.

## Test layers

### Backend service tests

Start with service-level tests because business rules live in `app/services/` and can be tested without HTTP routing:

- `auth_service`: signup validation, duplicate email/username, sector resolution, login status, and password failures.
- `knowledge_service`: sector access, super-admin bypass, entry creation, and deletion.
- `gap_service`: gap creation, assignment status/timestamps, email attempt, and resolution once implemented.
- `user_service`: admin filtering and grant/revoke access.
- `chat_service` and `app/services/rag/`: retrieval and gap decisions with Gemini mocked.

The service issue acceptance criteria require these specific cases:

- Auth signup/login: valid flows, duplicate email/username, custom "Other" sectors, bad passwords, missing users, and pending/revoked accounts ([#14](https://github.com/Latani-09/company-kwg-assistant/issues/14)).
- Knowledge: super-admin bypass, member access, non-member `403`, valid metadata, ownership, and delete authorization ([#15](https://github.com/Latani-09/company-kwg-assistant/issues/15)).
- Gaps: creation on a chat miss, metadata/timestamps, assignment status/timestamps, mocked email and notification attempts, and idempotent resolution once implemented ([#16](https://github.com/Latani-09/company-kwg-assistant/issues/16)).
- Users: admin listing, non-admin `403`, status filters, grant/revoke changes, and audit-trail recording ([#17](https://github.com/Latani-09/company-kwg-assistant/issues/17)).
- RAG/chat: relevant chunk retrieval, sector visibility, empty results, prompt construction, citations, confidence scoring, and low-confidence gap detection ([#18](https://github.com/Latani-09/company-kwg-assistant/issues/18)).

### Backend router tests

Add a smaller set of API-level tests for authentication and authorization boundaries:

- public signup, login, and sector listing
- `401` for missing or invalid tokens
- `403` for pending/revoked users and non-admin users on admin routes
- successful requests for granted users and super-admins

The router suite must cover `require_admin`, `get_current_user`, valid/invalid/expired tokens, missing tokens, and one protected endpoint end to end ([#19](https://github.com/Latani-09/company-kwg-assistant/issues/19)).

### Frontend component and flow tests

Cover the highest-risk interactions rather than every presentational detail:

- `AuthContext`: login, signup, logout, token bootstrap, and access-state errors
- `SectorChips`: selection, custom "Other" input, and request payload shape
- `DashboardPage`: sector-scoped knowledge entry add/delete and chat response states
- `AdminPage`: user grant/revoke and gap assignment

The component issue acceptance criteria also require:

- `AuthContext`: token storage/recovery, role and sector state, signup/login errors, logout reset and redirect, and expired-token logout ([#21](https://github.com/Latani-09/company-kwg-assistant/issues/21)).
- `SectorChips`: single and multiple selection, custom "Other" input, and exact payload shape ([#22](https://github.com/Latani-09/company-kwg-assistant/issues/22)).
- `DashboardPage`: role-based sector visibility, add/delete metadata, optimistic updates, chat messages/chunks, and low-confidence gap detection ([#23](https://github.com/Latani-09/company-kwg-assistant/issues/23)).
- `AdminPage`: gap assignment modal and status update, user filters, grant/revoke, destructive-action confirmations, and persisted filter state ([#24](https://github.com/Latani-09/company-kwg-assistant/issues/24)).

## Test data and isolation

- Use fixtures for users, sectors, QA entries, chat queries, and knowledge gaps.
- Each test should receive isolated data and should not rely on execution order.
- Prefer a throwaway test database that supports the SQLAlchemy models and pgvector behavior. If a lightweight SQLite fixture cannot represent a feature accurately, use a disposable PostgreSQL/pgvector service instead.
- Use factory helpers for repeated records; keep scenario-specific values in the test itself.

## Suggested implementation order

1. Add the backend test dependencies and pytest configuration.
2. Build database and authentication fixtures.
3. Add backend service tests for auth, knowledge, and gaps.
4. Add the frontend Vitest and React Testing Library harness.
5. Add frontend component and flow tests.
6. Add CI for both suites.
7. Expand router, RAG, and CI coverage as features land.

## CI requirements

The CI issue ([#12](https://github.com/Latani-09/company-kwg-assistant/issues/12)) requires `.github/workflows/test.yml` to run on pushes to `main` and pull requests targeting `main`. It should install the backend and frontend dependencies, start the test database, run backend `pytest` with coverage, run frontend `npm test` with coverage, publish coverage on pull requests, and require both suites to pass before merge.

## Local commands

Backend, after the test harness is installed:

```bash
cd python-backend
pytest
```

Frontend, after the Vitest script is added:

```bash
cd react-app
npm test
```

Before opening a pull request, run the relevant suite for the files changed and include any required environment or database setup in the pull request description.
