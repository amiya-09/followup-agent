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

## Day 5 — Frontend ✅ DONE
- [x] Priority Queue Dashboard — verified live against real seeded + agent-generated data
- [x] Lead Detail / Review & Send view — verified edit → approve → send flow
- [x] Bug fix: draft lock-state now reads from server truth (draft.status), re-fetches after actions
- [x] Bug fix: approve endpoint now aborts instead of silently "succeeding" if message insert fails
- [x] Bug fix: priorityScore only scores leads with status 'replied' — handled leads correctly drop to 0/low

## 🏁 MILESTONE — Full dry run, hand-verified, top to bottom ✅ DONE
Dashboard → click critical lead → edit draft → approve & send → thread/badge/score all
update live → back to queue → score correctly reflects resolved status. No agents, no
scripts — manually walked through and confirmed by eye.

## Real Pipeline — Step 1: Auth + Google OAuth ✅ DONE
- [x] next-auth v5 (beta) configured with Google provider, gmail.readonly + gmail.send scopes
- [x] Token refresh logic in jwt callback (handles Google's ~1hr access token expiry)
- [x] middleware.ts → proxy.ts (Next.js 16 rename)
- [x] Google Cloud OAuth client created, Testing mode, self as test user, redirect URI on port 3001
- [x] Verified: visiting localhost:3001 redirects to real Google sign-in, consent screen
      lists Gmail permissions, lands back on authenticated dashboard

## Real Pipeline — Step 2: POST /api/sync ✅ DONE
- [x] lib/gmail.ts — listUnreadMessages, getMessage, markRead, MIME parsing helpers
- [x] app/api/sync/route.ts — pulls unread Gmail, runs ingestMessage, auto-fires agents
- [x] Robustness fix: AI pipeline failures no longer poison the whole message ingest
- [x] Verified against real Gmail: 20 real messages synced, 14 new leads created,
      signals/drafts generated correctly (gmail.modify scope fix resolved mark-read errors)

## Real Pipeline — Step 3: Real Gmail Send on Approve ✅ DONE
- [x] lib/gmail.ts — sendMessage (RFC 2822 construction, base64url encoding)
- [x] app/api/drafts/[id]/approve/route.ts — real Gmail send after DB write, with
      explicit emailSent/emailError reporting instead of silent failure
- [x] Verified: real email sent and received in a separate live inbox

## 🏁 FULL REAL PIPELINE — auth → real inbox → AI agents → real send ✅ DONE

## Demo Polish ✅ DONE
- [x] Sync inbox button in queue header — POST /api/sync, live status line, auto-refresh
- [x] Signed-in user email + Sign out link in header
- [x] DB truncated and reseeded to pristine 3-lead demo state
- [x] Verified against real screenshot: Jordan 62/critical, Priya 31/medium, Sam 0/low
      (corrected two inaccurate claims in Claude Code's own summary before trusting them)

## Security Fix — Per-User Data Scoping ✅ DONE
- [x] All API routes now scope queries to the logged-in user via getOrCreateUserByEmail
- [x] Verified with a real second Google account: queue correctly shows 0 leads,
      confirming no cross-account data leakage
- [x] Lead-detail crash fixed (graceful error message instead of raw JS error)
- [x] Manual status override (Won/Lost/Cold) added to lead detail page UI

## Demo Data — Real Leads (replacing seed data) ✅ DONE
- [x] lib/gmail.ts — sync now uses a rolling 3-day date window instead of category
      filtering (safer: won't risk silently missing a real lead miscategorized by Gmail)
- [x] Real Lead A (Amabani Singh) backdated to 51h — confirmed 64/CRITICAL
- [x] Real Lead B (Amiya Singh) backdated to 28h — confirmed 31/MEDIUM
- [x] Lead C reserved — to be sent live during the actual recording