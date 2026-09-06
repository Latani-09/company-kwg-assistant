# AGENTS.md

## Version History

- Version: 0.6.0
- Last updated: 2026-09-06
- Status: Initial project operating guide and repository conventions draft

### Change log

- v0.6.0: Retrieval/gap fixes — (1) dropped the `qa_entries.embedding` ivfflat index, which was sized for a much larger table and silently skipped the true nearest neighbor at current row counts; replaced with an exact scan. (2) Fixed QA retrieval missing paraphrased questions: embeddings now set Gemini's `task_type` asymmetrically (`RETRIEVAL_DOCUMENT` on index, `RETRIEVAL_QUERY` on search) and `rag_similarity_floor` lowered from 0.55 to 0.4 so borderline-but-correct matches reach the LLM check instead of auto-flagging as a gap. (3) `create_gap()` now reuses an existing non-resolved gap for the same question (trimmed, case-insensitive) instead of creating a duplicate row per repeated ask.
- v0.5.0: Added self-service password reset — backend generates a single-use, expiring token (hash stored, not the token itself), emails a deep link via the existing SMTP `send_email` path, and exposes `POST /auth/forgot-password` / `POST /auth/reset-password`; frontend adds a "Forgot password?" flow on the login page and a `/reset-password` page that consumes the emailed link.
- v0.4.0: Docs restructure — root README rewritten as a standard project overview (what it does, tech stack, structure); technical decisions moved to `resources/docs/Plan.md`; BACKLOG.md completed items moved to a Done section; added `resources/docs/Database.md` (schema/ER reference) and `resources/docs/Architecture.md` (architecture diagram + key architectural decisions); Architecture overview here now links to `Architecture.md` instead of duplicating its diagram.
- v0.3.0: Added backend (pytest) and frontend (Vitest + Playwright) test suites with CI, plus test strategy/coverage docs (`resources/docs/Testing.md`, `TestCases.md`).
- v0.2.0: Added BACKLOG.md and DEPLOYMENT.md references to the repo structure.
- v0.1.0: Initial AGENTS.md created with project overview, repo structure, product direction, workflow expectations, and resources folder conventions.

---

## Documentation standard

This repository follows a lightweight but practical documentation pattern for engineering and product work:

1. Project overview and product intent
2. Repository structure and ownership boundaries
3. Architecture and system responsibilities
4. Product constraints and decisions
5. Workflow and quality expectations
6. Version history and change log

This keeps the docs useful for new contributors without making them too heavy or formal. It is not a full enterprise template, but it follows the same general intent as a project charter plus a simple architecture brief.

## Architecture overview

The application is designed as a split architecture with a clear frontend/backend boundary. See [resources/docs/Architecture.md](resources/docs/Architecture.md) for the architecture diagram and key architectural decisions.

### 1. Frontend: React application

The React app is responsible for the user experience and role-based interactions. It should handle:

- login and signup flows
- user dashboard and admin dashboard views
- sector-aware knowledge browsing
- Q&A entry management (add/remove question, answer, source link) and gap assignment workflows
- knowledge chat / retrieval experience
- gap detection and escalation states
- notifications and activity summaries

The frontend should treat the backend as the source of truth and avoid embedding business rules that belong in the API layer.

### 2. Backend: Python FastAPI service

The backend is the system core for data, auth, retrieval, and orchestration. It should be organized around modules such as:

- authentication and user management
- Q&A knowledge base management (create/edit/delete entries, each with a source link — no file upload/ingestion currently)
- knowledge retrieval and search
- chat / RAG orchestration
- gap detection evaluation
- admin assignment flows
- notification and audit actions

A typical structure should separate routes, schemas, services, and models so that each domain is easy to test and extend.

### 3. Data and knowledge layer

The platform is expected to support both transactional data and retrieval data:

- relational database for users, sectors, Q&A entries, gap assignments, and audit records
- vector store or embedding index for retrieval over the Q&A knowledge base

Currently the knowledge base is Q&A-set data only (question, answer, and a source link/reference) — there is no document/file upload or ingestion. A future iteration could add file storage and document chunk embedding, but that is out of MVP scope; see the RAG + gap-detection notes in `python-backend/AGENTS.md` for the current retrieval design.

### 4. Retrieval and AI flow

The production architecture should follow this general pattern:

1. A sector owner adds a Q&A entry (question, answer, source link)
2. The entry's text is embedded
3. The embedding is saved to a vector database
4. The user asks a question through the frontend
5. The backend retrieves the most relevant Q&A entries
6. A language model generates an answer grounded in those entries
7. Citations (source links) and confidence checks are returned to the UI
8. If confidence is low, the system flags a gap or asks for escalation

This replaces the prototype's localStorage-driven mock logic with a real knowledge retrieval workflow.

### 5. Security and role model

The product should keep the intended role model consistent:

- regular user access for knowledge lookup, requests, and personal work
- super admin access for assignment and admin oversight
- sector-aware visibility and access boundaries

The architecture should ensure the business rules for roles and sectors are enforced in the backend instead of only in the UI.

### 6. Prototype-to-product relationship

The static HTML prototype remains the UX baseline and should inform the new product structure, but it is not the production architecture. The backend and frontend should reflect real system boundaries, while preserving the prototype's flow intent, role logic, and sector-aware behavior.

---

## Project overview

Company Knowledge Assistant is a two-part application focused on helping teams find and manage company knowledge across departments and sectors. The product is intended to support role-based access, Q&A knowledge contribution (question, answer, and a source link — no document/file upload), knowledge retrieval, and gap detection.

This repository is structured as:

- `python-backend/` — Python FastAPI backend
- `react-app/` — React frontend
- `resources/` — design prototypes, HTML mockups, research notes, screenshots, and supporting product documents
- `README.md` — project overview and current product direction
- `BACKLOG.md` — prioritized task list for the team (gaps found in the app, broken down with priorities)
- `DEPLOYMENT.md` — free-tier deployment options and setup outline for backend, frontend, and database

## Product direction

The current project is transitioning from a prototype to a real product.

- Phase 1 prototype: static HTML / CSS / vanilla JS with localStorage-driven flows
- Phase 2 product: Python + React + RAG architecture

The prototype decisions remain the product baseline unless a project decision explicitly changes them. Treat the prototype as a UX source of truth, not as an abandoned artifact.

## Key product constraints

- Keep the system sector-aware and role-aware.
- Preserve the two-role model unless a specific product decision widens scope.
- Favor secure, testable, and maintainable implementation patterns.
- Do not introduce hidden product logic that is not reflected in documentation.
- When a feature is uncertain, document the assumption before implementation.

## Repository rules

### General guidance

- Prefer small, focused changes over large rewrites.
- Keep backend and frontend concerns separated.
- Update docs when behavior, UX, or architecture changes.
- Use clear naming and keep code easy to follow for future contributors.

### File and folder conventions

- Place backend code in `python-backend/`
- Place frontend code in `react-app/`
- Keep prototypes, wireframes, and supporting product docs in `resources/`
- Add product documents in `resources/docs/`
- Add HTML prototypes and mockups in `resources/prototypes/`

### Documentation expectations

- Keep README, AGENTS.md, and supporting docs aligned with the current implementation.
- If a decision affects UX or architecture, record it in the relevant document.
- Include enough context for a new teammate to understand the purpose of a feature or document.

## Working workflow

1. Read the relevant project docs before making a change.
2. Confirm whether the work belongs to backend, frontend, or a product/design artifact.
3. Keep each change scoped to the problem being solved.
4. Validate the change with the smallest relevant command or check.
5. Update related documentation when the change affects project direction or behavior.

## Technical stack expectations

### Backend

- Python-based API service
- Prefer FastAPI-style routing and modular application structure
- Keep business logic organized and testable
- Document required environment configuration clearly

### Frontend

- React application
- Prefer component-based organization and reusable UI patterns
- Keep API contracts and UI states understandable and traceable

### Prototype and research assets

- Save interactive mockups and static HTML prototype files in `resources/prototypes/`
- Save notes, product briefs, decisions, and planning docs in `resources/docs/`
- Keep filenames descriptive and versioned when needed

## Quality bar

- Avoid shipping code without a clear reason or documented requirement.
- Do not commit secrets, API keys, or environment-specific credentials.
- Prefer maintainability over clever shortcuts.
- Preserve the intended product experience from the prototype while moving to production architecture.

## Recommended next steps for the repo

- Create the backend app structure and API routes
- Create the React app shell and route structure
- Move prototype UX artifacts into `resources/prototypes/` as they are finalized
- Add project planning and technical decisions into `resources/docs/`
- Keep this AGENTS.md updated as the implementation matures
