# Company Knowledge Assistant

An internal, AI-powered chat application that lets employees ask natural-language questions about the company — onboarding, policies, products, and projects — and get answers grounded in a living, sector-organized knowledge base, backed by a RAG (retrieval-augmented generation) pipeline with real citations. Questions the assistant can't answer are automatically flagged as knowledge gaps and routed to the right owner for follow-up.

Full product specification, [technical architecture](resources/docs/Architecture.md), database structure, test cases, and technical decisions live in [`resources/docs/`](resources/docs/).

## Tech stack

- **Backend:** Python, FastAPI, SQLAlchemy + Alembic, PostgreSQL with `pgvector` for embeddings, Google Gemini (`google-genai`) for RAG generation
- **Frontend:** React + TypeScript, Vite, Tailwind CSS, React Router
- **Testing:** Pytest (backend), Vitest + Testing Library (frontend unit), Playwright (frontend e2e)

## Project structure

```
.
├── python-backend/        # FastAPI service (auth, sectors, knowledge, chat/RAG, gaps)
│   ├── app/
│   │   ├── routers/       # API endpoints
│   │   ├── services/      # Business logic, incl. RAG pipeline (services/rag/)
│   │   ├── schemas/       # Pydantic request/response models
│   │   ├── db/            # SQLAlchemy models + Alembic migrations
│   │   └── core/          # Config, security, shared dependencies
│   └── tests/
├── react-app/             # Vite + React frontend
│   └── src/
│       ├── pages/         # AuthPage, DashboardPage, AdminPage
│       ├── api/           # Typed client for the backend API
│       ├── components/    # Shared UI components
│       ├── auth/          # Auth context + route guards
│       └── test/          # Vitest unit tests (Playwright e2e lives in react-app/e2e/)
├── resources/
│   ├── docs/              # Specification, database structure, test cases, testing notes, technical decision log
│   └── prototypes/        # Original static HTML/JS clickable prototype
├── AGENTS.md               # Repository conventions and architecture guide
├── BACKLOG.md               # Prioritized task list
└── DEPLOYMENT.md             # Deployment notes
```

`react-app/` and `python-backend/` are independent projects with their own dependencies and run commands — see each folder's own `AGENTS.md` for setup/decisions.

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
