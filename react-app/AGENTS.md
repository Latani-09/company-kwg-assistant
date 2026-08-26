# react-app — Frontend Technical Decisions

## Stack
- Vite + React 18 + TypeScript
- Tailwind CSS, theme tokens ported from `resources/prototypes/knowledge-assistant_grp7final.html`
- No data-fetching library — plain `fetch` + React Context (app is small enough that TanStack Query would be premature)
- Node pinned via `.nvmrc` (20.20.2) — system default node was too old for current Vite

## Routing
- `react-router-dom`, 3 routes: `/` (auth), `/dashboard` (user), `/admin` (superAdmin)
- Real routes instead of the prototype's div-toggling, because a router gives working
  back/forward + refresh + direct links, and centralizes the "must be logged in" /
  "must be admin" checks in guard components (`RequireAuth`, `RequireAdmin`) instead of
  repeating them in every view-switch function like the prototype does

## Auth
- JWT in `localStorage`; `AuthContext` bootstraps via `GET /auth/me` on load, clears token on 401
- Login posts form-encoded (backend uses `OAuth2PasswordRequestForm`), not JSON
- 403 `pending_access` / `access_revoked` map to the same two-state modal the prototype used

## Knowledge Gaps assignment (deviation from prototype)
- A gap has no inherent sector until assigned (backend schema), so the assign UI needs
  two dependent selects — sector, then SME scoped to that sector — instead of one
  "Assign To" dropdown like the prototype mocked
