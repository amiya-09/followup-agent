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

## Day 4 — API Layer ⬜ NOT STARTED
- [ ] GET /api/queue (+ priorityScore function)
- [ ] GET /api/leads/:id
- [ ] PATCH /api/leads/:id
- [ ] PATCH /api/drafts/:id, /approve, /dismiss
- [ ] GET /api/leads/:id/signals

## Day 5 — Frontend ⬜ NOT STARTED
- [ ] Priority Queue Dashboard
- [ ] Lead Detail / Review & Send view

## Notes
- A teammate split was attempted and abandoned (solo build from here on).
  lib/types.ts and lib/mockData.ts may exist from that — harmless, ignore or delete.
- 8 extra stray leads (Linear, Stripe, Notion, Vercel, Figma, GitHub, Shopify, +duplicate
  Jordan Lee) appeared in the DB from an untracked run — likely an earlier non-idempotent
  seed created a second "founder" user, and since leads are unique per-user-not-globally,
  it got its own full set of leads. Fixed by truncating and reseeding from the single
  canonical route.ts above.