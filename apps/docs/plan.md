Project Name: Graphite

Graphite is an AI-powered Builder Reputation Graph platform that transforms fragmented developer activity into multidimensional builder intelligence and reputation analysis.

The platform analyzes builder signals across GitHub, wallets, hackathons, LinkedIn, X/Twitter, resumes, and future ecosystem integrations to generate:

* reputation dimensions
* builder intelligence profiles
* collaboration graphs
* skill inference
* ecosystem trust analysis
* AI-powered collaborator recommendations

IMPORTANT:
Graphite is NOT:

* a GitHub stats dashboard
* a portfolio website
* a social media clone

Graphite is:

* an intelligence infrastructure system
* a builder reputation engine
* a developer graph platform
* an AI-native ecosystem analysis system

Core Problem:
Traditional builder reputation is fragmented across:

* GitHub
* LinkedIn
* resumes
* hackathons
* wallets
* social platforms

Graphite unifies these fragmented signals into a portable, intelligent builder profile.

---

## TECH STACK

Frontend:

* React
* Vite
* TypeScript
* TailwindCSS
* shadcn/ui
* React Query
* React Flow / D3.js for graph visualization

Backend:

* Fastify
* TypeScript
* Prisma ORM
* Supabase PostgreSQL
* Modular backend architecture
* Queue-ready async architecture

AI:

* OpenAI/Gemini APIs
* AI-powered repository analysis
* Skill inference
* Builder summaries
* Future embeddings support

Web3:

* Solana wallet adapter
* Phantom wallet
* QuickNode RPC

---

## MONOREPO STRUCTURE

/apps
/api
/web

IMPORTANT:
Frontend and backend must remain fully separated.
No backend business logic inside frontend.
No mock backend simulation inside frontend.

Frontend responsibilities:

* UI
* dashboards
* graph visualization
* auth UI
* API consumption only

Backend responsibilities:

* ingestion pipelines
* AI analysis
* reputation scoring
* graph generation
* GitHub integration
* database operations
* async processing

---

## BACKEND MODULES

auth/

* wallet auth
* JWT
* GitHub OAuth

github/

* GitHub API integration
* repository fetching
* contributor analysis
* commit analysis

ingestion/

* async ingestion pipelines
* orchestration
* job processing

analysis/

* AI repository analysis
* architecture complexity estimation
* skill inference
* builder summaries

scoring/

* reputation dimensions
* weighted scoring
* trust estimation

graph/

* collaboration graphs
* relationship generation
* trust propagation

recommendation/

* collaborator recommendations
* similarity analysis
* compatibility scoring

builder/

* builder profiles
* unified intelligence views

---

## CORE REPUTATION DIMENSIONS

Technical Depth

* architecture complexity
* advanced engineering patterns
* systems knowledge

Execution Ability

* deployed projects
* maintained repositories
* shipping consistency

Consistency

* long-term activity
* sustained development behavior

Collaboration Quality

* contributor relationships
* teamwork signals
* open-source interaction

Innovation

* originality
* experimentation
* project uniqueness

---

## DATABASE ENTITIES

users
repositories
repository_analyses
builder_profiles
reputation_dimensions
graph_edges
recommendations
skills
builder_relationships

---

## MVP GOALS

Phase 1:

* wallet authentication
* GitHub OAuth
* repository ingestion pipeline
* AI repository analysis
* builder intelligence profile
* reputation dimensions dashboard

Phase 2:

* graph visualization
* collaborator recommendations
* relationship mapping

Phase 3:

* embeddings
* vector search
* trust propagation
* advanced recommendations

Phase 4:

* multi-platform ingestion
* LinkedIn/X integration
* hackathon analysis
* ecosystem intelligence

---

## AI ANALYSIS GOALS

The AI system should analyze repositories and infer:

* skill tags
* probable expertise domains
* architecture maturity
* execution quality
* project originality
* builder summaries
* ecosystem fit

The AI system should eventually support:

* embeddings
* similarity search
* collaborator recommendations
* trust estimation
* builder clustering

---

## IMPORTANT ENGINEERING PRINCIPLES

* Think like a systems architect, not a frontend-only developer
* Prefer modular architecture
* Prefer maintainability over hackathon shortcuts
* Use strong TypeScript typing
* Keep frontend/backend boundaries clean
* Design APIs intentionally
* Avoid tightly coupling systems
* Design for future scalability
* Avoid unnecessary microservices initially
* Queue-ready async architecture is preferred
* Use service/repository patterns
* Focus on the intelligence pipeline as the core innovation

The core innovation of Graphite is:
Transforming fragmented builder activity into meaningful reputation intelligence.
