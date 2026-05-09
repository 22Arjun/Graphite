# Graphite - Remaining Work & Execution Plan

## Context

Graphite is an AI-powered Builder Reputation Graph platform. The goal is to transform
fragmented developer activity (GitHub, wallets, hackathons) into multidimensional reputation
intelligence. This plan documents what's already built and provides a prioritized execution
roadmap to reach a professional, production-ready application.

---

## Current State Summary

### Backend — apps/api/

| Module | Status | Notes |
|--------|--------|-------|
| Auth (wallet + GitHub OAuth) | ✅ Complete | Solana ed25519 + GitHub OAuth 2.0, JWT |
| Builder profile CRUD | ✅ Complete | GET/PATCH profile, repos, stats |
| GitHub API client | ✅ Complete | Rate-limit-aware, pagination, commits, contributors |
| Ingestion pipeline | ✅ Complete | Async jobs, QUEUED→PROCESSING→COMPLETED/FAILED |
| Database schema | ✅ Complete | All tables: builders, repos, analyses, scores, edges, skills |
| Analysis module | ❌ Missing | Schema exists, no routes/service |
| Scoring/Reputation module | ❌ Missing | Schema exists, no routes/service |
| Graph builder module | ❌ Missing | Schema exists (collaboration_edges), no service |
| Recommendation engine | ❌ Missing | Not started |
| BullMQ background workers | ❌ Missing | Currently fire-and-forget; designed for BullMQ |
| API documentation (Swagger) | ❌ Missing | Package listed but not integrated |

### Frontend — apps/web/

| Feature | Status | Notes |
|---------|--------|-------|
| Landing page | ✅ Complete | Animations, CTA, how-it-works |
| Dashboard page | ✅ Complete | Stats, radar chart, activity — uses mock fallback |
| Profile page | ✅ Complete | Reputation breakdown, skills, AI summary — uses mock fallback |
| Repositories page | ✅ Complete | Search, filter, analysis cards — uses mock fallback |
| Graph page | ✅ Complete | Interactive force graph, clusters — 100% mock data |
| Solana wallet auth | ✅ Complete | Phantom, message signing, token storage |
| GitHub OAuth UI flow | ❌ Missing | Button shown but not wired (no redirect to /auth/github) |
| Ingestion trigger | ❌ Missing | No real POST /ingestion/trigger call |
| Job status polling | ❌ Missing | No polling loop to show real analysis progress |
| Real graph data | ❌ Missing | Graph page reads mock only, no GET /graph endpoint |
| Real recommendations | ❌ Missing | Recommendations panel is 100% mock |
| Protected route guard | ❌ Missing | Unauthenticated users can access /dashboard |
| Per-repo analyze button | ❌ Missing | "Analyze" button calls nothing |
| Profile settings | ❌ Missing | No settings/preferences page |
| GitHub OAuth callback UI | ❌ Missing | No /auth/callback frontend route |

---

## Remaining Work — Prioritized Roadmap

### Phase 1 — Core Intelligence Pipeline (MVP Critical)

These are the heart of Graphite. Nothing is meaningful without them.

#### 1.1 Backend: Analysis Module
**Files to create:**
- `apps/api/src/modules/analysis/analysis.service.ts`
- `apps/api/src/modules/analysis/analysis.routes.ts`
- `apps/api/src/modules/analysis/analysis.schema.ts`

**What to build:**
- AI-powered repository analysis using OpenAI/Gemini API
- For each repo: infer `architectureComplexity`, `codeQuality`, `maturity`, `originality`
- Skill tag extraction: languages, frameworks, domains, patterns
- Builder summary generation (2-3 sentence AI summary)
- Write results to `repository_analyses` and `skill_tags` tables
- Trigger analysis after ingestion completes (chain jobs)

**Endpoints to add:**
- `POST /api/analysis/trigger/:repoId` — Trigger analysis for a single repo
- `GET /api/analysis/status/:repoId` — Get analysis status

#### 1.2 Backend: Scoring/Reputation Module
**Files to create:**
- `apps/api/src/modules/scoring/scoring.service.ts`
- `apps/api/src/modules/scoring/scoring.routes.ts`

**What to build:**
- Compute 5 reputation dimensions from ingested + analyzed data:
  - `TECHNICAL_DEPTH` — architecture complexity, advanced patterns
  - `EXECUTION_ABILITY` — deployed projects, maintained repos, shipping consistency
  - `CONSISTENCY` — long-term activity, commit patterns
  - `COLLABORATION_QUALITY` — contributor relationships, OSS interaction
  - `INNOVATION` — originality scores, experimentation
- Write to `reputation_scores` table
- Trigger after analysis completes

**Endpoints to add:**
- `POST /api/scoring/compute` — Trigger reputation recomputation
- `GET /api/scoring/dimensions` — Get dimension breakdown

#### 1.3 Backend: Graph Builder Module
**Files to create:**
- `apps/api/src/modules/graph/graph.service.ts`
- `apps/api/src/modules/graph/graph.routes.ts`

**What to build:**
- Build collaboration edges between builders based on:
  - Shared repositories (co-contributors)
  - Forked relationships
  - Skill similarity
- Write weighted edges to `collaboration_edges` table
- Expose graph data for frontend consumption

**Endpoints to add:**
- `GET /api/graph/builder` — Get builder's collaboration graph (nodes + edges)
- `POST /api/graph/build` — Trigger graph computation

#### 1.4 Backend: Recommendation Engine
**Files to create:**
- `apps/api/src/modules/recommendation/recommendation.service.ts`
- `apps/api/src/modules/recommendation/recommendation.routes.ts`

**What to build:**
- Collaborator recommendations based on:
  - Skill complementarity
  - Shared ecosystems
  - Graph proximity
  - Reputation dimension compatibility
- Returns ranked list with match scores and reasons

**Endpoints to add:**
- `GET /api/recommendation/collaborators` — Top N recommended builders

---

### Phase 2 — Frontend Wiring (Connect UI to Real Backend)

#### 2.1 GitHub OAuth UI Flow
**File:** `apps/web/src/hooks/use-auth.tsx`

- Add `connectGitHub()` function that redirects to `GET /api/auth/github`
- Add `/auth/callback` route in `apps/web/src/App.tsx` that extracts token from URL params
- Create `apps/web/src/pages/AuthCallback.tsx` to handle OAuth redirect

#### 2.2 Ingestion Trigger
**File:** `apps/web/src/pages/Dashboard.tsx`, `apps/web/src/lib/api.ts`

- Wire "Start Analysis" / "Sync GitHub" button to `POST /api/ingestion/trigger`
- Show real job status from `GET /api/ingestion/jobs`
- Add polling with React Query's `refetchInterval` every 3 seconds when job is active

#### 2.3 Per-Repo Analysis Trigger
**File:** `apps/web/src/components/RepoCard.tsx`

- Wire "Analyze" button to `POST /api/analysis/trigger/:repoId`
- Poll `GET /api/analysis/status/:repoId` to show live progress

#### 2.4 Real Graph Data
**File:** `apps/web/src/pages/Graph.tsx`, `apps/web/src/components/GraphCanvas.tsx`

- Replace mock graph data with `GET /api/graph/builder`
- Keep mock as fallback when no data exists

#### 2.5 Real Recommendations
**File:** `apps/web/src/pages/Graph.tsx`

- Replace mock recommendations with `GET /api/recommendation/collaborators`
- Keep mock as fallback

#### 2.6 Protected Route Guard
**File:** `apps/web/src/App.tsx`

- Add `<ProtectedRoute>` wrapper that redirects to `/` if not authenticated
- Apply to `/dashboard`, `/profile`, `/repositories`, `/graph`

---

### Phase 3 — Quality & Production Readiness

#### 3.1 Job Pipeline Chaining
**File:** `apps/api/src/modules/ingestion/ingestion.service.ts`

- After ingestion completes → auto-trigger analysis jobs
- After all repos analyzed → auto-trigger reputation scoring
- After scoring → auto-trigger graph build
- Sequence: GITHUB_INGEST → REPO_ANALYSIS → REPUTATION_COMPUTE → GRAPH_BUILD

#### 3.2 Environment Setup Documentation
- Create `apps/api/.env.example` with all required variables (already exists, verify completeness)
- Ensure `OPENAI_API_KEY` or `GEMINI_API_KEY` is included

#### 3.3 API Documentation (Swagger)
**File:** `apps/api/src/app.ts`

- Integrate `@fastify/swagger` + `@fastify/swagger-ui`
- All routes already have Zod schemas — wire them to OpenAPI

#### 3.4 Error States in Frontend
- Replace silent mock fallbacks with actual error states + retry buttons
- Show "No data yet — connect GitHub to start" state instead of mock data for new users

---

## Critical Files Reference

| File | Purpose |
|------|---------|
| `apps/api/prisma/schema.prisma` | Full DB schema — all tables already defined |
| `apps/api/src/modules/ingestion/ingestion.service.ts` | Pipeline to extend with job chaining |
| `apps/api/src/modules/ingestion/ingestion.queue.ts` | Job queue to extend for analysis/scoring/graph jobs |
| `apps/api/src/lib/types.ts` | Shared types — extend for analysis/scoring responses |
| `apps/web/src/hooks/use-auth.tsx` | Auth context — add GitHub OAuth connect |
| `apps/web/src/lib/api.ts` | Add new API call functions |
| `apps/web/src/lib/mock-data.ts` | Keep as fallback until real data exists |
| `apps/web/src/pages/Dashboard.tsx` | Wire ingestion trigger + job polling |
| `apps/web/src/pages/Graph.tsx` | Wire real graph + recommendations |

---

## Execution Order

1. **Analysis module** (backend) — AI repo analysis is the core differentiator
2. **Scoring module** (backend) — Reputation dimensions need analysis data
3. **Graph module** (backend) — Collaboration edges need scored builders
4. **Recommendation module** (backend) — Needs graph + scoring
5. **Job pipeline chaining** (backend) — Auto-trigger modules in sequence
6. **GitHub OAuth UI** (frontend) — Gate for GitHub data access
7. **Ingestion trigger + polling** (frontend) — User can kick off analysis
8. **Real graph + recommendations** (frontend) — Remove mock fallbacks
9. **Protected routes** (frontend) — Security baseline
10. **Swagger docs** (backend) — Polish

---

## Verification Plan

- Backend: `npm run dev` in `apps/api` → hit `/health`, `/api/auth/wallet`, `/api/ingestion/trigger`
- Frontend: `npm run dev` in `apps/web` → connect Phantom wallet → GitHub OAuth → verify ingestion starts and progress updates live
- End-to-end: Connect wallet → connect GitHub → trigger ingestion → watch pipeline GITHUB_INGEST → REPO_ANALYSIS → REPUTATION_COMPUTE → GRAPH_BUILD → verify dashboard shows real scores → verify graph page shows real nodes
