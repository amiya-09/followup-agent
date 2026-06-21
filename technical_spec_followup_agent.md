# Technical Spec — AI Sales/Founder Follow-up Agent

**Core loop (anchor):** new reply arrives → system remembers the thread → AI summarizes it → drafts a follow-up → surfaces it by urgency → founder approves and sends → status updates.

This spec is written to be **SDK-agnostic**: everything here is buildable today, before Lemma launches on June 24. The Agent Orchestration Layer is the only piece designed to swap cleanly into Lemma's agent/workflow components once they exist — see the mapping table at the end.

Stack assumption: **Next.js (TypeScript) full-stack** — matches Lemma's published SDK being TypeScript-based, and lets frontend + API routes live in one codebase. Swap freely if you'd rather split frontend/backend.

---

## 1. System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Next.js)                            │
│  ┌───────────────────────┐      ┌───────────────────────────────┐    │
│  │ Priority Queue          │      │ Lead Detail / Review & Send    │    │
│  │ Dashboard               │◄────►│ (thread + signal + draft edit) │    │
│  └────────────┬────────────┘      └───────────────┬─────────────────┘    │
└───────────────┼──────────────────────────────────┼───────────────────┘
                │ REST (JSON)                       │
┌───────────────▼──────────────────────────────────▼───────────────────┐
│                   API LAYER (Next.js API routes)                     │
│  /api/queue   /api/leads   /api/drafts   /api/sync   /api/demo       │
└───────────────┬──────────────────────────────────┬───────────────────┘
                │                                    │
┌───────────────▼─────────────┐      ┌───────────────▼─────────────────┐
│   INGESTION SERVICE           │      │   ACTION SERVICE                  │
│ - polls/receives email        │      │ - approve/send draft               │
│ - parses + matches lead       │      │ - updates lead status              │
│ - stores message              │      │ - sends via email integration      │
└───────────────┬────────────────┘      └───────────────┬───────────────────┘
                │ triggers                                │ uses
┌───────────────▼──────────────────────────────────────────▼───────────────┐
│                AGENT ORCHESTRATION LAYER                                 │
│         (today: direct LLM calls — June 24+: Lemma agents/workflow)      │
│  ┌──────────────────────┐        ┌────────────────────────────────┐      │
│  │ Summarization Agent    │ ─────► │ Draft Generation Agent          │      │
│  │ reads thread + signal  │        │ writes personalized reply       │      │
│  └──────────┬─────────────┘        └──────────────┬───────────────────┘      │
│             │ writes → signals               writes → followup_drafts     │
└─────────────┼──────────────────────────────────────┼─────────────────────┘
              │                                       │
┌─────────────▼───────────────────────────────────────▼─────────────────────┐
│                  DATASTORE (Postgres today → Lemma datastore later)        │
│        users · leads · messages · signals · followup_drafts               │
└───────────────────────────────────┬─────────────────────────────────────────┘
                                     │
┌────────────────────────────────────▼────────────────────────────────────────┐
│              EMAIL INTEGRATION (Gmail API or IMAP + SMTP)                  │
└──────────────────────────────────────────────────────────────────────────────┘
```

**Priority score** is computed at query time, not stored (avoids staleness):

```
priorityScore(lead) =
    baseUrgency(hoursSinceLastReply)     // 0-24h: low · 24-48h: medium · >48h: high
  + signalBoost(latestSignal.tags)       // budget_mentioned: +2 · objection: +1 · timeline_mentioned: +2
```

---

## 2. Data Model (abstract — TypeScript interfaces)

```typescript
interface User {
  id: string;
  email: string;
  name: string;
  gmailConnected: boolean;
  createdAt: string;
}

type LeadStatus = "new" | "contacted" | "replied" | "follow_up_sent" | "cold" | "won" | "lost";

interface Lead {
  id: string;
  userId: string;
  email: string;
  name?: string;
  company?: string;
  status: LeadStatus;
  lastContactAt?: string;   // last time founder sent something
  lastReplyAt?: string;     // last time lead replied — drives urgency
  createdAt: string;
}

type MessageDirection = "inbound" | "outbound";

interface Message {
  id: string;
  leadId: string;
  direction: MessageDirection;
  subject: string;
  bodyText: string;
  sentAt: string;
  gmailMessageId: string;   // for idempotent re-sync
  createdAt: string;
}

type Sentiment = "positive" | "neutral" | "negative" | "frustrated";

interface Signal {
  id: string;
  messageId: string;
  leadId: string;
  sentiment: Sentiment;
  summaryText: string;
  signalTags: string[];          // e.g. ["budget_mentioned", "objection"]
  recommendedAction: string;     // e.g. "send_pricing", "schedule_call"
  confidence: number;
  createdAt: string;
}

type DraftStatus = "pending_review" | "edited" | "approved" | "sent" | "dismissed";

interface FollowUpDraft {
  id: string;
  leadId: string;
  signalId: string;
  draftText: string;
  finalText?: string;     // populated if founder edits before sending
  status: DraftStatus;
  createdAt: string;
  sentAt?: string;
}
```

---

## 3. Database Schema (Postgres reference implementation)

```sql
-- Requires: CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  gmail_connected BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TYPE lead_status AS ENUM (
  'new', 'contacted', 'replied', 'follow_up_sent', 'cold', 'won', 'lost'
);

CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255),
  company VARCHAR(255),
  status lead_status DEFAULT 'new',
  last_contact_at TIMESTAMPTZ,
  last_reply_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);
CREATE INDEX idx_leads_user_id ON leads(user_id);
CREATE INDEX idx_leads_last_reply_at ON leads(last_reply_at DESC);

CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction message_direction NOT NULL,
  subject VARCHAR(500),
  body_text TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL,
  gmail_message_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_messages_lead_id ON messages(lead_id, sent_at);

CREATE TYPE sentiment_type AS ENUM ('positive', 'neutral', 'negative', 'frustrated');

CREATE TABLE signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sentiment sentiment_type DEFAULT 'neutral',
  summary_text TEXT,
  signal_tags JSONB DEFAULT '[]',
  recommended_action VARCHAR(100),
  confidence FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX idx_signals_lead_id ON signals(lead_id);

CREATE TYPE draft_status AS ENUM (
  'pending_review', 'edited', 'approved', 'sent', 'dismissed'
);

CREATE TABLE followup_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  signal_id UUID REFERENCES signals(id),
  draft_text TEXT NOT NULL,
  final_text TEXT,
  status draft_status DEFAULT 'pending_review',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  sent_at TIMESTAMPTZ
);
CREATE INDEX idx_drafts_lead_id ON followup_drafts(lead_id, status);
```

---

## 4. API Contract

All routes require an authenticated session (no public/unauthenticated access — required by the hackathon brief).

### `GET /api/queue`
Primary dashboard feed — leads sorted by computed urgency.

**Response 200**
```json
{
  "leads": [
    {
      "leadId": "uuid",
      "name": "Jordan Lee",
      "company": "Acme Co",
      "priorityScore": 87,
      "urgencyTier": "critical",
      "hoursSinceReply": 51,
      "latestSignal": { "summaryText": "Asked about annual pricing", "recommendedAction": "send_pricing" },
      "draftPreview": "Hi Jordan, following up on..."
    }
  ]
}
```

### `GET /api/leads/:id`
Full detail view — profile, message history, latest signal, current draft.

**Response 200**
```json
{
  "lead": { "id": "uuid", "name": "Jordan Lee", "company": "Acme Co", "status": "replied" },
  "messages": [ { "direction": "inbound", "bodyText": "...", "sentAt": "2026-06-25T10:00:00Z" } ],
  "signal": { "sentiment": "positive", "summaryText": "...", "signalTags": ["budget_mentioned"] },
  "draft": { "id": "uuid", "draftText": "...", "status": "pending_review" }
}
```

### `PATCH /api/leads/:id`
Manual status override (e.g., mark cold/won/lost).

**Request**: `{ "status": "won" }` → **Response 200**: updated lead object.

### `POST /api/sync`
Triggers an inbox check (polling-based for MVP). Ingests new inbound messages, creates/updates leads, fires the agent pipeline for each new reply.

**Response 200**: `{ "newMessages": 3, "leadsUpdated": 2 }`

### `GET /api/leads/:id/signals`
History of extracted signals for a lead (debugging/transparency — optional but cheap).

**Response 200**: `{ "signals": [ {...}, {...} ] }`

### `PATCH /api/drafts/:id`
Save an edit to a draft before sending.

**Request**: `{ "finalText": "edited follow-up text" }` → **Response 200**: `{ "status": "edited" }`

### `POST /api/drafts/:id/approve`
Approves and sends. Triggers outbound send via the email integration, updates `lead.last_contact_at`, sets draft status to `sent`, recomputes queue.

**Response 200**: `{ "status": "sent", "sentAt": "2026-06-25T12:00:00Z" }`

### `POST /api/drafts/:id/dismiss`
Dismiss without sending — lead stays in queue or snoozes per logic.

**Response 200**: `{ "status": "dismissed" }`

### `POST /api/demo/seed`
Seeds realistic sample leads/threads for the recorded demo — avoids depending on a live inbox during recording.

**Response 200**: `{ "seeded": 8 }`

---

## 5. Lemma SDK Mapping (wire in once the SDK drops June 24)

| Component here | Likely Lemma building block | Notes |
|---|---|---|
| `users` / `leads` / `messages` / `signals` / `followup_drafts` | **Datastore** | Structured persistent records |
| Full conversation thread content | **Document store** | Semi-structured text Lemma can retrieve/search |
| Summarization Agent | **Agent** | Single reasoning step |
| Draft Generation Agent | **Agent** | Chained second reasoning step |
| Reply → summarize → draft → queue pipeline | **Workflow** | Multi-step, event-driven |
| Gmail send/receive | **Integration** | External system connector |
| `priorityScore()` | **Function** | Deterministic, non-LLM computation |

---

## 6. What's safe to build before June 24

- Full data model + Postgres schema — buildable now, as-is
- API routes — buildable now, with agent logic calling any LLM API directly as a placeholder
- Frontend (queue dashboard + review/send UI) — buildable now against this exact contract
- Demo seed data — buildable now

**Single swap-in point on day 1 of the build window:** replace the placeholder direct-LLM calls in the Agent Orchestration Layer with Lemma's actual agent/workflow API, and migrate the datastore layer if Lemma provides its own persistence rather than plain Postgres. Everything else should need zero rework.
