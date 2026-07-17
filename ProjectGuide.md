Project Overview

A Node.js/TypeScript backend for AI-powered test case generation from Jira tickets. It integrates with Jira, multiple AI providers (OpenAI/Copilot, Gemini, Claude/Anthropic), generates BDD test cases in
Gherkin format, creates Postman collections, runs them via Newman, and tracks defects — all backed by a PostgreSQL database.

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

Stack

┌────────────────┬───────────────────────────────────────────────────────────────────────┐
│ Layer          │ Technology                                                            │
├────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Runtime        │ Node.js + TypeScript                                                  │
├────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Framework      │ Express 5                                                             │
├────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Database       │ PostgreSQL (via pg pool)                                              │
├────────────────┼───────────────────────────────────────────────────────────────────────┤
│ AI Providers   │ GitHub Copilot, Google Gemini, Anthropic Claude                       │
├────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Test Runner    │ Newman + newman-reporter-htmlextra                                    │
├────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Auth           │ JWT (access token 15min) + refresh token (1 day) via httpOnly cookies │
├────────────────┼───────────────────────────────────────────────────────────────────────┤
│ Infrastructure │ Docker Compose (Postgres + Node server)                               │
└────────────────┴───────────────────────────────────────────────────────────────────────┘

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

Architecture

server/src/
├── index.ts               — App entry, route mounting, startup cleanup
├── config/db.ts           — PostgreSQL connection pool
├── middleware/
│   ├── authenticate.ts    — JWT verification + role fetch
│   └── isAdmin.ts         — Admin role guard
├── types/index.ts         — Shared interfaces (User, AIRequest/Response, JiraTicket…)
├── utils/tokens.ts        — JWT + refresh token generation/storage/cookies
├── routes/                — 10 route files
├── controllers/           — 10 controller files
└── services/
├── aiService.ts       — Multi-provider AI call abstraction + BDD prompt builder
├── jiraService.ts     — Jira REST API integration
└── postmanService.ts  — Postman collection generation logic

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

API Routes

┌────────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ Prefix                                         │ Description                                  │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/auth/register                        │ Register (first user auto-promoted to admin) │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/auth/login                           │ Login, sets httpOnly cookies                 │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/auth/refresh                         │ Rotate refresh token (one-time use)          │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/auth/logout                          │ Invalidate refresh token + clear cookies     │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/auth/me                               │ Get current user                             │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/ai/generate                          │ Generate BDD test cases from a Jira ticket   │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/jira/:ticketKey                       │ Fetch Jira ticket details                    │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/testcases/:ticketKey                  │ List test cases for a ticket                 │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PUT /api/testcases/:id/approve                 │ Approve a test case                          │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PUT /api/testcases/:id/reject                  │ Reject a test case                           │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PUT /api/testcases/:ticketKey/approve-all      │ Approve all test cases for a ticket          │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PUT /api/testcases/:id                         │ Update/edit a test case                      │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ DELETE /api/testcases/:id                      │ Delete a test case                           │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/testcases/:ticketKey/download         │ Download test cases (CSV)                    │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/testcases/:ticketKey/upload          │ Upload test cases (CSV)                      │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/postman/generate                     │ Generate Postman collection from test cases  │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/postman/:ticketKey                    │ List collections for a ticket                │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/postman/collection/:id                │ Get a single collection                      │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/postman/collection/:id/download       │ Download collection JSON                     │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/newman/run/:collectionId             │ Run a collection via Newman                  │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/newman/runs/:runId                    │ Get run status                               │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/newman/runs/:runId/report             │ Get HTML/JSON test report                    │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/newman/collections/:collectionId/runs │ All runs for a collection                    │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/newman/tickets/:ticketKey/runs        │ All runs for a ticket                        │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/push/:ticketKey/push                 │ Push approved test cases to Jira as subtasks │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ POST /api/defects                              │ Create a defect from a Newman failure        │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/defects/ticket/:ticketKey             │ Get defects by ticket                        │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/defects/run/:runId                    │ Get defects by test run                      │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/admin/users                           │ List all users (admin only)                  │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PUT /api/admin/users/:userId/promote           │ Promote to admin                             │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PUT /api/admin/users/:userId/demote            │ Demote to user                               │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PUT /api/admin/users/:userId/toggle            │ Activate/deactivate user                     │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/tokens/my                             │ Own token usage stats                        │
├────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ GET /api/tokens/all                            │ All users' token usage (admin only)          │
└────────────────────────────────────────────────┴──────────────────────────────────────────────┘

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

Database Schema (7 tables)

- users — auth, roles (admin/user), active status
- refresh_tokens — one-time-use tokens with expiry
- token_usage — per-user AI token consumption tracking by provider/model/action
- test_cases — generated BDD test cases with status lifecycle (draft → approved/rejected/modified)
- postman_collections — AI-generated Postman collections stored as JSONB
- test_runs — Newman execution results with pass/fail counts, HTML report, duration
- defects — linked to failed test cases + Jira defect keys

──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────

Notable Observations

- Duplicate route mounting in index.ts — jiraRoutes and aiRoutes are both mounted twice (/api/jira and /api/ai appear twice). This is harmless but redundant.
- Refresh token expiry mismatch — storeRefreshToken stores with INTERVAL '1 day' but the cookie maxAge comment says "7 days" (it's actually set to 1 day in ms too). The comment is misleading.
- AI prompt is very large — the BDD prompt in aiService.ts is ~200 lines and generates exhaustive negative/boundary test cases per field type. It's designed to produce hundreds of test cases per ticket.
- Startup cleanup — cleanupOldRuns is defined but never called (missing cleanupOldRuns() invocation in index.ts).
- No frontend — this is a backend-only repo. There's no client code; a frontend likely exists separately.
- No tests — no test files, no test framework configured.
- env variables managed via Docker Compose .env file. No .env.example file present in the repo.

