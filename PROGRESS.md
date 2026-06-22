# Follow-up Agent — Build Progress

_Last updated: Day 2, cleaning up duplicate seed data_

## Stack decisions (locked in)
- Next.js (TypeScript, App Router) + Tailwind
- Database: Neon Postgres
- Placeholder LLM: Groq (`llama-3.3-70b-versatile`)

## Day 1 — Foundation ✅ DONE
- [x] Scaffolded Next.js project
- [x] Neon project created, schema.sql run (5 tables: users, leads, messages, signals, followup_drafts)
- [x] lib/db.ts — shared Postgres pool, connection verified
- [x] scripts/test-llm.mjs — proved Groq call returns valid Signal-shaped JSON

## Day 2 — Ingestion + Demo Seed ✅ DONE
- [x] lib/ingestion.ts — reusable ingestMessage() function
- [x] app/api/demo/seed/route.ts — seeds 3 leads (Jordan Lee/Acme, Priya Shah/Northwind, Sam Okafor/Globex)
- [x] Database cleaned of stray/duplicate data
- [x] Seed re-run and verified clean (exactly 3 leads, correct statuses)

## Day 3 — Agent Orchestration Layer  ✅ DONE
- [x] lib/agents/summarize.ts — Summarization Agent
- [x] lib/agents/draft.ts — Draft Generation Agent
- [x] lib/agents/pipeline.ts — chains them, writes to signals + followup_drafts
- [x] Wired into lib/ingestion.ts so every inbound message auto-triggers the pipeline
- [x] Verified: seeded inbound replies produce real signals + drafts in the DB

## Day 4 — API Layer ✅ DONE
- [x] lib/priorityScore.ts — base urgency + tag boosts, verified against real seeded data
- [x] GET /api/queue — verified: correct scores/tiers/sort order for all 3 seeded leads
- [x] GET /api/leads/:id — verified full detail view for Jordan (profile, thread, signal, draft)
- [x] PATCH /api/drafts/:id, POST /approve, POST /dismiss — verified full edit→approve→send flow
- [x] PATCH /api/leads/:id — verified Sam marked 'won'
- [x] GET /api/leads/:id/signals — verified Jordan's signal history returns correctly

## Day 5 — Frontend 🔄 IN PROGRESS
- [ ] Priority Queue Dashboard (app/page.tsx)
- [ ] Lead Detail / Review & Send view (app/leads/[id]/page.tsx)

## Stretch — POST /api/sync ⬜ DEFERRED
- Not needed for the recorded demo — spec's /api/demo/seed exists specifically so the
  demo never depends on a live inbox
- Requires real Gmail OAuth (Cloud Console project, consent screen, refresh tokens) —
  meaningfully riskier than anything built so far
- Only build if time remains after the dashboard is fully working
