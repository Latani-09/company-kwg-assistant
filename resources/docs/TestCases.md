# Test Cases

This document lists the implemented automated test cases for Company Knowledge Assistant. The suite includes normal-flow tests as well as negative, authorization, validation, integration, and defensive tests.

## Test Categories

- **Normal flow:** A valid request completes successfully.
- **Negative flow:** Invalid input or credentials are rejected.
- **Authorization:** Access is allowed or denied according to role, status, or sector membership.
- **Integration:** Multiple application layers work together, such as a router, service, and database.
- **Defensive:** Failure paths and external-service problems are handled safely.

## Backend Test Cases

### Test harness

File: `python-backend/tests/test_harness.py`

| Case | Category | Expected result |
|---|---|---|
| Health endpoint responds | Normal flow | Returns HTTP 200 and `{"status": "ok"}` |
| Seeded gap fixture is available | Harness | User, sector, and gap relationships are created correctly |

### Authentication service

File: `python-backend/tests/test_auth_service.py`

| Case | Category | Expected result |
|---|---|---|
| Signup with an existing sector | Normal flow | Creates a pending user and assigns the selected sector |
| Signup with a custom sector | Normal flow | Creates a custom sector using a slugified key |
| Signup with duplicate email | Negative flow | Returns HTTP 400 |
| Signup with duplicate username | Negative flow | Returns HTTP 400 |
| Login with valid granted account | Normal flow | Returns a valid access token |
| Login with invalid password | Negative flow | Returns HTTP 401 |
| Login with missing user | Negative flow | Returns HTTP 401 |
| Login with pending account | Authorization | Returns HTTP 403 with `pending_access` |
| Login with revoked account | Authorization | Returns HTTP 403 with `access_revoked` |

### Knowledge service

File: `python-backend/tests/test_knowledge_service.py`

| Case | Category | Expected result |
|---|---|---|
| Super admin accesses any sector | Authorization | Access is allowed without membership |
| Assigned member accesses own sector | Authorization | Access is allowed |
| Non-member accesses a sector | Authorization | Returns HTTP 403 |
| Member creates a QA entry | Normal flow | Stores metadata and embedding |
| Super admin creates a QA entry | Authorization | Entry is created without sector membership |
| Member deletes an entry in an assigned sector | Normal flow | Entry is removed |
| User without sector access deletes an entry | Authorization | Returns HTTP 403 and preserves the entry |

### Knowledge-gap service

File: `python-backend/tests/test_gap_service.py`

| Case | Category | Expected result |
|---|---|---|
| Create gap from chat miss | Normal flow | Copies question metadata and creates an open gap |
| Assign a gap | Normal flow | Sets assignee, sector, status, and timestamp; attempts email |
| Assign missing gap | Negative flow | Returns HTTP 404 |
| Resolve a gap | Normal flow | Sets resolved status, timestamp, and resolver |
| Resolve an already resolved gap | Negative flow | Returns HTTP 400 |
| Resolve a missing gap | Negative flow | Returns HTTP 404 |
| Auto-resolve matching assigned gaps | Normal flow | Resolves matching assigned gaps |
| Auto-resolve with no matching gaps | Edge case | Returns an empty list without changes |

### User service

File: `python-backend/tests/test_user_service.py`

| Case | Category | Expected result |
|---|---|---|
| Filter users by status | Normal flow | Returns only users with the requested status |
| Filter users by sector | Normal flow | Returns users assigned to the requested sector |
| Update user access | Normal flow | Changes the user's status and persists it |

### Chat and RAG pipeline

Files: `python-backend/tests/test_chat_service.py` and `python-backend/tests/test_rag_adapters.py`

| Case | Category | Expected result |
|---|---|---|
| Chat with no retrieval matches | Normal flow / gap flow | Creates a gap and returns `is_gap: true` |
| Chat with confident retrieval and generation | Normal flow | Returns an answer, confidence, and source citation |
| Embedding request | Integration with mock | Uses the configured Gemini model and embedding dimension |
| Embedding client construction | Defensive | Builds the Gemini client from settings without a live call |
| Generation prompt construction | Integration with mock | Includes system prompt, context, and question |
| Valid generation JSON | Normal flow | Returns parsed answer and source IDs |
| Invalid generation JSON | Defensive | Raises a JSON parsing error |
| Generation client construction | Defensive | Builds the Gemini client from settings without a live call |
| Retrieval ordering | Integration | Returns the closest pgvector match first |
| Retrieval with no entries | Edge case | Returns an empty list |
| Low similarity score | Negative flow | Flags a gap |
| LLM says answer is insufficient | Negative flow | Flags a gap |
| High similarity and sufficient answer | Normal flow | Does not flag a gap |

### Mail service

File: `python-backend/tests/test_mail_service.py`

| Case | Category | Expected result |
|---|---|---|
| SMTP is not configured | Defensive | Logs a warning and skips sending |
| SMTP with TLS and authentication | Normal flow with mock | Sends a correctly populated email |
| SMTP without TLS or authentication | Normal flow with mock | Sends the email without optional steps |
| SMTP connection failure | Defensive | Logs the failure and does not raise to the caller |

### Security, dependencies, and API edges

Files: `python-backend/tests/test_security_and_dependencies.py` and `python-backend/tests/test_auth_guards.py`

| Case | Category | Expected result |
|---|---|---|
| JWT without subject | Negative flow | Token is rejected |
| JWT with invalid UUID subject | Negative flow | Token is rejected |
| Expired JWT | Negative flow | Token is rejected |
| Database session closes normally | Defensive | Session is closed after use |
| Database session closes after exception | Defensive | Session is still closed |
| Missing database user for valid token | Authorization | Returns HTTP 401 |
| Pending user on protected route | Authorization | Returns HTTP 403 |
| Protected route without token | Authorization | Returns HTTP 401 |
| Protected route with invalid token | Authorization | Returns HTTP 401 |
| Protected route with valid token | Integration | Returns the protected response |
| Regular user on admin route | Authorization | Returns HTTP 403 |
| Super admin on admin route | Authorization | Request succeeds |
| Missing gap assignment target | Negative flow | Returns HTTP 404 |
| Missing gap resolution target | Negative flow | Returns HTTP 404 |
| Invalid signup email at API boundary | Validation | Returns HTTP 422 |
| Empty sector list | Edge case | Returns HTTP 200 with an empty list |

## Frontend Test Cases

### Frontend harness

File: `react-app/src/test/smoke.test.tsx`

| Case | Category | Expected result |
|---|---|---|
| Render a React component in jsdom | Harness | Component renders successfully |

### AuthContext

File: `react-app/src/test/auth-context.test.tsx`

| Case | Category | Expected result |
|---|---|---|
| Login with valid credentials | Normal flow | Stores token and exposes the user |
| Login with invalid credentials | Negative flow | Returns invalid result without a token |
| Signup with valid data | Normal flow | Calls signup API and keeps user signed out pending approval |
| Signup API error | Negative flow | Returns the API error message |
| Pending login response | Authorization | Returns `pending` result |
| Revoked login response | Authorization | Returns `revoked` result |
| Token recovery on mount | Normal flow | Calls `/me` and restores the user |
| Expired token on mount | Defensive | Clears token and user state |
| Logout | Normal flow | Clears token and user state |
| Role and sector state | Normal flow | Exposes role and assigned sector data |

### SectorChips

File: `react-app/src/test/sector-chips.test.tsx`

| Case | Category | Expected result |
|---|---|---|
| Select one sector | Normal flow | Emits the expected sector object |
| Select multiple sectors | Normal flow | Emits all selected sectors |
| Remove a selected sector | Normal flow | Emits the remaining selections |
| Enable Other | Normal flow | Displays the custom-sector input |
| Submit custom Other text | Normal flow | Emits the custom key and trimmed label |
| Disable Other | Normal flow | Removes the custom sector from the payload |

### DashboardPage

File: `react-app/src/test/dashboard-page.test.tsx`

| Case | Category | Expected result |
|---|---|---|
| Regular user sector visibility | Authorization | Shows only assigned sectors |
| Super admin sector visibility | Authorization | Shows all sectors returned by the API |
| Delete a knowledge entry | Normal flow | Removes the entry from the visible list |
| Add knowledge metadata | Normal flow | Sends sector, question, answer, and source |
| Chat answer with citation | Normal flow | Displays answer and source reference |
| Low-confidence chat result | Negative flow | Displays a flagged knowledge gap |

### AdminPage

File: `react-app/src/test/admin-page.test.tsx`

| Case | Category | Expected result |
|---|---|---|
| Display users | Normal flow | Renders users returned by the API |
| Filter users by status | Normal flow | Shows only users matching the selected status |
| Grant access | Normal flow | Calls the API and updates the row |
| Revoke access cancellation | Defensive | Does not call the API when confirmation is declined |
| Assign a knowledge gap | Normal flow | Sends sector and SME IDs and updates/removes the row according to the filter |
| Change gap status filter | Normal flow | Refetches gaps with the selected status |

## Summary

The suite is not limited to normal-flow testing. It combines normal flows with negative, authorization, validation, integration, and defensive cases. This is intentional: normal-flow tests prove the feature works, while the other categories protect security boundaries and failure behavior.

## Not Covered by the Current Suite

The current pytest and Vitest suites do not cover full browser workflows, responsive layouts, accessibility,
visual regressions, real email delivery, or real AI answer quality. These cases will be covered with Playwright
browser end-to-end tests and a small manual release checklist.
