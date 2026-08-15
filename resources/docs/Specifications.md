# APPLICATION SPECIFICATION

## Company Knowledge Assistant

*An AI-powered internal knowledge chat platform*

Prepared as a project specification and UI prototype submission

---

## 1. Application Overview & Target Users

Company Knowledge Assistant is an internal, AI-powered chat application that lets employees ask natural-language questions about the company — onboarding, policies, products, and projects — and receive answers grounded in a living, sector-organized knowledge base. Rather than searching scattered documents, wikis, and Slack threads, employees ask a single assistant and get a cited answer or a clear signal that the answer doesn't exist yet.

- **Primary users:** employees across departments who need fast, trustworthy answers about the company and want to contribute knowledge for the sector(s) they own (e.g., a Product Manager maintaining the Products sector).
- **Administrative users:** a small set of superAdmins (e.g., People Ops, IT, or knowledge managers) responsible for approving new accounts, monitoring unanswered questions, and routing knowledge gaps to the right owner.
- **Organizational context:** best suited for mid-sized organizations (roughly 50–1000 employees) with knowledge spread across multiple teams and no single source of truth, where onboarding and cross-team questions currently rely on asking a colleague or searching multiple tools.

## 2. Problem Being Solved

New and existing employees waste time locating accurate information because company knowledge is fragmented across documents, chat history, and individual memory. Common failure modes this application addresses:

- No single place to ask a question and trust the answer is current — employees default to interrupting colleagues, which does not scale.
- Knowledge gaps are invisible. When an answer doesn't exist anywhere, nobody is notified, so the same question gets asked repeatedly with no resolution.
- Access and ownership are unclear. Anyone can technically edit a shared doc, but nobody is accountable for keeping a given topic accurate.
- Onboarding is inconsistent because new hires depend on whoever happens to answer their questions rather than a maintained source.

The application solves this by combining a cross-sector question-answering chat with a sector-scoped contribution model. Everyone can ask about anything, but only accountable owners can edit a given sector, and unanswered questions are automatically routed for follow-up instead of disappearing.

## 3. Defined MVP & Future Features

### 3.1 MVP

- Simulated signup/login with two roles only: user and superAdmin
- Signup capture of name, email, username, password, position, and one or more sectors, including a custom 'Other' sector name
- SuperAdmin approval queue: grant or revoke access per signed-up user
- Cross-sector AI chat with source citations on every answered response
- Automatic knowledge-gap detection: unanswered questions are flagged with asker and timestamp for superAdmin review
- Sector-scoped 'My Knowledge Base': users view tabs only for their assigned sectors and can add or remove documents (Question, Answer, Source) within those sectors
- SuperAdmin flagged-gaps queue with the ability to assign a gap to a specific user and trigger a simulated email notification

### 3.2 Overall Features

- Real authentication (SSO/OAuth) and a real backend replacing simulated login and in-memory data
- Actual retrieval-augmented generation (RAG) over uploaded documents/files, instead of a static demo answer set
- Real email notifications for approvals and gap assignments, plus an in-app notification center
- Analytics dashboard: most-asked questions, sectors with the most gaps, response accuracy trends, and stale-document alerts
- Versioning and review workflow for knowledge edits (draft → reviewed → published)

## 4. Scope, Limitations, Risks & Assumptions

### 4.1 Scope

This project delivers a company-wide knowledge assistant with two roles: an employee who can chat across every sector and manage documents only in their own assigned sectors, and a superAdmin who grants or revokes access and assigns unresolved questions. Employees sign up, select their sectors, and wait for approval before logging in. Once inside, they can ask questions and get cited answers pulled from the company's full knowledge base, and any question the system can't answer gets automatically flagged for the superAdmin to assign and resolve. The system runs on a Python backend with PostgreSQL as the database, a React frontend, real authentication, and a RAG pipeline that powers the chat's answers and citations. Single sign-on, analytics, real email notifications, and a document review workflow are not part of this delivery.

### 4.2 Limitations

- Authentication is simulated client-side; there is no real password storage, hashing, or session security.
- Chat answers are drawn from a small hardcoded demo dataset, not a real retrieval or language model.
- Data does not persist between page loads in the prototype — a real build requires a backend and database.
- No real notification delivery (email/Slack); notifications are shown as in-app confirmation messages only.

### 4.3 Risks

- **Data accuracy risk:** if sector owners don't maintain their knowledge promptly, the assistant will confidently surface stale answers; mitigated by review workflows planned for a future release.
- **Adoption risk:** employees may default back to asking colleagues if early answer quality is poor; mitigated by a focused pilot in one department before company-wide rollout.
- **Access-control risk:** incorrect sector scoping could let a user edit content outside their ownership.
- **Overreliance risk:** employees may trust AI-generated answers without verifying sources for high-stakes decisions (compliance, legal). This can be mitigated by always surfacing citations and encouraging source review.

### 4.4 Assumptions

- The organization already has some documented knowledge (docs, wikis, FAQs) that can seed the sectors, even if incomplete.
- Only one admin, or a small number of trusted staff, are willing to act as superAdmins for approvals and gap triage.
- Sectors map reasonably well to how the organization already thinks about knowledge domains (Onboarding, Company, Products, Projects, Other).
- Employees have basic comfort with chat-style interfaces (e.g., Slack, Teams).

## 5. Proposed Development Methodology

Development follows a lightweight iterative approach across two weeks, organized into milestones rather than formal scrum sprints, since available time is about one hour on weekdays and three to four hours on weekends.

**Milestone 1 — Requirements and UI Prototype (complete)**
- Finalize requirements
- Design user flows
- Create wireframes
- Develop high-fidelity UI
- Create clickable prototype

**Milestone 2 — Authentication and User Management**
- User registration
- Login
- Access approval
- Grant/revoke functionality
- Role management

**Milestone 3 — Knowledge Management**
- Sector management
- Document management
- Add/remove knowledge
- Permission validation

**Milestone 4 — AI Knowledge Assistant**
- AI integration
- Knowledge search
- Source citations
- Knowledge-gap detection

**Milestone 5 — SuperAdmin Features**
- Flagged questions
- Gap assignment
- Notifications
- User management

**Milestone 6 — Testing and Deployment**
- Functional testing
- UI testing
- Security testing
- User acceptance testing
- Deployment plan

## 6. Initial Delivery Plan

### 6.1 Phased Timeline

**Phase 1 — Week 1: Development**

By the end of week 1, the full application works end to end.

- Backend built with real authentication
- PostgreSQL schema and data persistence in place
- Sector-scoped knowledge management (add/remove documents) working
- RAG-based chat pipeline built, returning answers with citations
- Knowledge-gap detection working
- React frontend built for all three screens (signup/login, user dashboard, admin dashboard)
- Frontend wired to the real backend end to end
- SuperAdmin features (grant/revoke, gap assignment) working

**Phase 2 — Week 2: Deployment, Testing & Launch**

By the end of week 2, the application has been tested, deployed, and launched.

- Full functional testing across all flows
- Security testing on sector permissions and authentication
- Bugs found and fixed
- UI polish and cleanup
- Application deployed to a live environment
- Connected to the production database
- Smoke-tested on the live deployment
- User acceptance testing completed
- Final fixes applied
- Application launched

### 6.2 User Stories, Priorities & Success Measures

Priorities use MoSCoW-style shorthand: P0 = must-have for MVP launch, P1 = should-have for pilot, P2 = nice-to-have that can follow the pilot.

| ID | User Story | Priority | Success Measure |
|----|-------------|----------|------------------|
| US-1 | As a new employee, I can sign up with my details and requested sector(s) so my access request is visible to the superAdmin. | P0 | 100% of signups appear in the superAdmin queue within the same session; 0 unauthorized logins before approval. |
| US-2 | As a superAdmin, I can review and grant or revoke access for signed-up users so only approved staff can use the assistant. | P0 | Grant/revoke action reflected in the user's login state on next attempt, 100% of the time. |
| US-3 | As a user, I can ask natural-language questions and receive an answer with cited sources, regardless of which sectors I'm assigned to. | P0 | ≥80% of pilot questions return a sourced answer instead of a knowledge gap. |
| US-4 | As a user, I want unanswered questions automatically flagged as knowledge gaps so the company can close the gap instead of losing the question. | P0 | 100% of no-answer chat queries create a flagged-gap record with question, asker, and date. |
| US-5 | As a user, I can add or remove knowledge documents only within my assigned sector(s) so contributions stay accountable to sector owners. | P0 | 0 successful uploads/removals outside a user's assigned sectors in QA testing. |
| US-6 | As a superAdmin, I can assign a flagged gap to a specific user and trigger a notification so accountability for closing the gap is clear. | P1 | 100% of assigned gaps change status to Assigned and generate a notification event. |
| US-7 | As a user, I can browse my knowledge base by sector tab so I can quickly audit what's published under my ownership. | P1 | Sector tab loads only that sector's documents with no cross-sector leakage. |
| US-8 | As a superAdmin, I can see custom 'Other' sectors labeled clearly (e.g., 'Other: Partnerships') so ad-hoc sectors remain identifiable. | P2 | Custom sector names render distinctly in the users table in 100% of cases. |
| US-9 | As a user, I want suggested starter questions on the chat screen so I understand what the assistant can do without guessing. | P2 | New users issue a first query within 60 seconds of landing on the dashboard in usability testing. |

### 6.3 Overall Success Measures

- ≥80% of pilot chat questions return a sourced answer rather than a knowledge gap within the first month.
- 100% of signup requests are visible to and actionable by a superAdmin with no manual workaround.
- Average time to grant/revoke access or assign a flagged gap is under 2 minutes.
- At least 70% of pilot users report (via short survey) that the assistant's answers were trustworthy and well-sourced.
- Knowledge gaps opened during the pilot are assigned within 3 business days and closed (answered) within 10.
