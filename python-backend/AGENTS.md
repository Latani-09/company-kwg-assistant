# AGENTS.md — python-backend

## Version History

- Version: 0.1.0
- Last updated: 2026-08-15
- Status: Initial backend architecture and API plan draft

### Change log

- v0.1.0: First draft — data model, API surface, and RAG/gap-detection flow, derived from `resources/docs/Specifications.md`, root `AGENTS.md`, root `README.md` technical decisions, and the prototype's data shapes.

---

## Scope of this document

This is the implementation plan for `python-backend/` only. Product intent and cross-repo rules live in the root `AGENTS.md` — read that first. This document exists to turn the MVP feature list into concrete tables, endpoints, and a RAG pipeline design so implementation can start without re-deriving decisions each session.

## Stack

- **Framework:** FastAPI
- **Database:** PostgreSQL (locked in root README technical decision doc)
- **Vector storage:** `pgvector` extension on the same Postgres instance — no separate vector DB service for MVP. Revisit only if retrieval volume/latency actually demands it.
- **Auth:** JWT (access token), passwords hashed with `bcrypt`/`passlib`
- **LLM:** Gemini API (generation). Also used for embeddings unless latency/cost pushes us to a local embedding model later — open decision, not blocking.
- **Migrations:** Alembic

## Project layout

```
python-backend/
  app/
    main.py                 # FastAPI app, router registration, startup
    core/
      config.py              # env-based settings (pydantic-settings)
      security.py            # password hashing, JWT issue/verify
      deps.py                 # shared FastAPI dependencies (current_user, require_role, db session)
    db/
      base.py                 # SQLAlchemy declarative base, session factory
      models/                 # one module per table (see Data model)
      migrations/              # Alembic
    schemas/                  # Pydantic request/response models, mirrors models/
    routers/
      auth.py                  # signup, login, me
      admin_users.py            # list users, grant/revoke access
      sectors.py                 # list sectors
      knowledge.py                # QA entry CRUD (sector-scoped)
      chat.py                      # ask question -> RAG answer
      gaps.py                       # list/assign knowledge gaps
      notifications.py               # in-app notifications
    services/
      auth_service.py
      user_service.py
      knowledge_service.py          # QA entry ownership + validation rules
      rag/
        embeddings.py                # embed_text(text) -> vector
        retrieval.py                  # similarity search over QA entries
        generation.py                  # Gemini call, prompt construction
        gap_detection.py               # combines retrieval score + LLM signal -> is_gap
      gap_service.py                 # gap lifecycle: create, assign, notify
      notification_service.py
  requirements.txt
  .env.example
```

Keep routers thin (parse request, call service, return response). Business rules — sector ownership checks, role checks, gap thresholds — live in `services/`, not in routers, so they're testable without spinning up HTTP.

---

## Data model

Roles and statuses match the prototype exactly (`user` / `superAdmin`; `pending` / `granted` / `revoked`) — no new states invented.

### `users`
| column | type | notes |
|---|---|---|
| id | uuid/pk | |
| name | text | |
| email | text, unique | |
| username | text, unique | |
| password_hash | text | never return in any response |
| position | text | job title, from signup |
| role | enum(`user`, `superAdmin`) | default `user` |
| status | enum(`pending`, `granted`, `revoked`) | default `pending` |
| created_at / updated_at | timestamptz | |

### `sectors`
| column | type | notes |
|---|---|---|
| id | uuid/pk | |
| key | text, unique | `onboarding`, `company`, `product`, `project`, or a slugified custom key |
| label | text | display label, e.g. `"Partnerships"` for a custom "Other" sector |
| is_custom | boolean | true when created via a user's "Other" signup entry |

Seed the four fixed sectors on startup/migration. Custom "Other" sectors are created on demand at signup if the label doesn't already exist.

### `user_sectors` (many-to-many)
| column | type | notes |
|---|---|---|
| user_id | fk -> users | |
| sector_id | fk -> sectors | |

A `superAdmin` doesn't strictly need rows here (prototype used `sectors: ['all']`) — treat "all sector access" as implicit from `role == superAdmin` in authorization logic rather than a magic sector row, so the sector table stays clean.

### `qa_entries` (the knowledge base — this replaces "documents" for MVP, since docs are out of scope for now)
| column | type | notes |
|---|---|---|
| id | uuid/pk | |
| sector_id | fk -> sectors | which sector owns this entry |
| question | text | |
| answer | text | |
| source | text | free-text reference, e.g. `"Doc-123"` or a URL — not a stored file |
| embedding | vector | embedding of `question + answer`, used for retrieval |
| created_by | fk -> users | |
| created_at / updated_at | timestamptz | |

### `chat_queries` (log of every question asked — needed to drive gap creation and later analytics)
| column | type | notes |
|---|---|---|
| id | uuid/pk | |
| asker_id | fk -> users | |
| question_text | text | |
| answer_text | text, nullable | null when it became a gap |
| matched_entry_id | fk -> qa_entries, nullable | best-matching entry, if any |
| similarity_score | float, nullable | retrieval score of the best match |
| is_gap | boolean | |
| created_at | timestamptz | |

### `knowledge_gaps`
| column | type | notes |
|---|---|---|
| id | uuid/pk | |
| source_query_id | fk -> chat_queries | the question that triggered the gap |
| question_text | text | denormalized copy, so gap list rendering doesn't need a join |
| asker_id | fk -> users | |
| status | enum(`open`, `assigned`, `resolved`) | default `open` |
| assigned_to_id | fk -> users, nullable | |
| assigned_sector_id | fk -> sectors, nullable | admin picks a sector when assigning, matching the prototype's per-row sector select |
| created_at | timestamptz | |
| assigned_at | timestamptz, nullable | |
| resolved_at | timestamptz, nullable | |

### `notifications` (in-app only for MVP — root README leaves the real channel as an open decision)
| column | type | notes |
|---|---|---|
| id | uuid/pk | |
| user_id | fk -> users | recipient |
| type | enum(`gap_assigned`, `access_granted`, `access_revoked`) | extend as needed |
| message | text | |
| related_gap_id | fk -> knowledge_gaps, nullable | |
| is_read | boolean | default false |
| created_at | timestamptz | |

---

## API surface

All routes prefixed `/api/v1`. `Auth` column: `public` = no token, `user` = any granted user, `admin` = `superAdmin` only.

### Auth
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/auth/signup` | public | Create user: name, email, username, password, position, sectors[] (incl. custom "Other" label). Status starts `pending`. |
| POST | `/auth/login` | public | Verify credentials + `status == granted`. Returns JWT. `pending`/`revoked` return a distinct error code so the frontend shows the right modal. |
| GET | `/auth/me` | user | Current user profile, role, sectors, status. |

### Sectors
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/sectors` | public | List all sectors (fixed + any custom ones already created) — powers signup chips. |

### Admin — user access
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/users` | admin | List users. Query params: `status` (`pending`\|`granted`\|`revoked`), `sector` (sector key, optional per the "nice to have" filter). Response includes `granted: boolean`-style status plus sector list per user. |
| PATCH | `/admin/users/{user_id}/access` | admin | Body `{ "status": "granted" \| "revoked" }`. Grant or revoke. Triggers an `access_granted`/`access_revoked` notification. |

### Knowledge base (QA entries — "My Knowledge Base")
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/knowledge/qa?sector=` | user | List QA entries for a sector. Frontend calls once per tab. |
| POST | `/knowledge/qa` | user | Add entry `{ sector_id, question, answer, source }`. Backend rejects if the user isn't assigned to that sector — enforced server-side, not just hidden in the UI. |
| DELETE | `/knowledge/qa/{id}` | user | Remove entry. Same ownership check as create. |

Embedding generation for a new/edited entry happens synchronously in `knowledge_service` right after validation, before the row commits — keeps retrieval consistent with what's actually stored, and avoids a background-job system for MVP scale.

### Chat / RAG
| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/chat/query` | user | Body `{ question }`. Runs the RAG flow below. Returns `{ answer, sources[], is_gap, confidence }`. Cross-sector — any granted user can query any sector's entries. |

### Knowledge gaps (admin)
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/admin/gaps` | admin | List gaps, filterable by `status`. |
| POST | `/admin/gaps/{gap_id}/assign` | admin | Body `{ assigned_to_id, assigned_sector_id }`. Sets status `assigned`, creates a `gap_assigned` notification for that user. |

### Notifications
| Method | Path | Auth | Purpose |
|---|---|---|---|
| GET | `/notifications` | user | Current user's notifications, newest first. |
| PATCH | `/notifications/{id}/read` | user | Mark read. |

---

## RAG + gap-detection flow

This is the part the user explicitly asked to reason about, so the decision and the reasoning are recorded here, not just the mechanics.

### What MVP retrieves over

Per current scope, there's no document ingestion yet — retrieval runs over `qa_entries` (the sector-owned Question/Answer/Source rows), not files. This keeps "RAG" honest: it's real retrieval + real grounded generation, just over a smaller, structured corpus. Swapping in chunked documents later is additive (new source type feeding the same embedding/retrieval interface), not a rework.

### Request flow

1. User submits a question via `POST /chat/query`.
2. `embeddings.embed_text(question)` embeds the question.
3. `retrieval.search(embedding, top_k=5)` does a cosine-similarity search over `qa_entries.embedding` via pgvector — cross-sector, since chat is sector-agnostic.
4. If the best match's similarity is below a configured floor (e.g. `SIMILARITY_FLOOR = 0.55`, tune empirically), skip the LLM call entirely and go straight to gap. No point spending a generation call on a corpus that has nothing relevant.
5. Otherwise, call Gemini with the top-k matched Q/A pairs as context, and a system prompt that:
   - instructs it to answer **only** from the provided entries,
   - requires a structured response: `{ answer, used_source_ids[], sufficient: boolean }`.
6. `gap_detection.decide(similarity_score, llm_sufficient_flag)` combines both signals — see recommendation below.
7. If not a gap: return `{ answer, sources, is_gap: false, confidence: similarity_score }`, log the `chat_queries` row.
8. If a gap: log `chat_queries` with `is_gap = true`, create a `knowledge_gaps` row (`status: open`), and return `{ answer: null, is_gap: true }` so the frontend shows the "flagged for review" state from the prototype.

### The design question: who decides "is this a gap" — retrieval score, LLM self-report, or user flag?

**Recommendation: use both retrieval score and LLM self-report together, as a two-stage gate — not either one alone. Leave user-flagging for later as an *additional* signal, not a replacement.**

Reasoning:

- **Retrieval score alone** is cheap and deterministic, but a merely-similar-sounding Q&A entry can score above threshold while not actually answering the question (e.g. "How do I request PTO?" matching an entry about sick leave). Score-alone will confidently return a wrong-but-plausible answer instead of flagging a gap — worse than no answer, per the spec's own "Overreliance risk."
- **LLM self-report alone** is more semantically aware but less trustworthy as the sole gate: an LLM asked "can you answer this" is prone to answering anyway using general world knowledge instead of admitting the provided context doesn't cover it, which defeats the point of grounding. It's also non-deterministic run to run.
- **Combining them fixes each one's failure mode**: retrieval score is a cheap first-pass filter that avoids wasting LLM calls on corpora with nothing relevant; the LLM's `sufficient: boolean` (forced into a structured response, not a free-text confidence claim) catches the case where something scored well but doesn't actually answer the question. Treat it as: `is_gap = (similarity_score < floor) OR (llm_sufficient == false)` — either signal can veto an answer, neither alone can force one through.
- **User-flagging later is a good addition, not a replacement**, because it catches a different failure mode: an answer that's grounded and "sufficient" by the LLM's own judgment but is actually stale, wrong, or unhelpful in the user's view. That's a quality signal the retrieval/LLM pipeline structurally can't see. When it's added, model it as a new gap-creation path (`POST /chat/queries/{id}/flag` or similar) that creates a `knowledge_gaps` row the same way step 8 above does — same table, same admin workflow, just a different `source_query_id` trigger. No schema change needed now, just leave `chat_queries` as the anchor.

This matches the root README's existing decision ("Retrieval-confidence threshold decides gap vs. answer") while sharpening it — confidence alone was underspecified; this makes it two concrete, implementable signals.

### Config

| Env var | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `GEMINI_API_KEY` | LLM + embedding calls |
| `JWT_SECRET` | token signing |
| `JWT_EXPIRE_MINUTES` | token lifetime |
| `RAG_SIMILARITY_FLOOR` | retrieval gate threshold (default ~0.55, tune once real data exists) |
| `RAG_TOP_K` | number of entries retrieved per query (default 5) |

---

## Security notes specific to this backend

- Sector ownership checks (`knowledge.py` create/delete) must happen server-side against `user_sectors`, never trust a sector_id the client claims — this is exactly the "Access-control risk" the spec calls out.
- `role == superAdmin` required on every `/admin/*` route via a shared `require_admin` dependency, not per-route ad hoc checks.
- Never log or return `password_hash`.
- Login must return the same generic error for wrong-password vs. unknown-username; only surface `pending`/`revoked` as distinct states, since those are meant to be user-visible per the prototype's messaging.

## Open decisions (not blocking, revisit when they matter)

- Embedding model: Gemini embeddings vs. a local model — start with Gemini for consistency with generation, revisit if latency/cost becomes an issue.
- Whether `qa_entries` needs an edit endpoint (PATCH) beyond add/remove — not in the MVP user stories, add if requested.
- Real notification delivery channel (email) — explicitly deferred per root README; `notifications` table is channel-agnostic so adding email later is a new dispatch step, not a schema change.
