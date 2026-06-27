import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/auth";
import { getOrCreateUserByEmail } from "@/lib/ingestion";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await getOrCreateUserByEmail(session.user.email, session.user.name ?? null);

  const leadResult = await pool.query(
    `SELECT id, name, company, status, email, last_contact_at, last_reply_at, created_at
     FROM leads WHERE id = $1 AND user_id = $2`,
    [leadId, user.id]
  );
  const lead = leadResult.rows[0];

  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  const messagesResult = await pool.query(
    `SELECT direction, subject, body_text, sent_at
     FROM messages WHERE lead_id = $1 ORDER BY sent_at ASC`,
    [leadId]
  );

  const signalResult = await pool.query(
    `SELECT sentiment, summary_text, signal_tags, recommended_action, confidence
     FROM signals WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [leadId]
  );
  const signal = signalResult.rows[0] ?? null;

  const draftResult = await pool.query(
    `SELECT id, draft_text, final_text, status
     FROM followup_drafts WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1`,
    [leadId]
  );
  const draft = draftResult.rows[0] ?? null;

  return NextResponse.json({
    lead,
    messages: messagesResult.rows.map((m) => ({
      direction: m.direction,
      subject: m.subject,
      bodyText: m.body_text,
      sentAt: m.sent_at,
    })),
    signal: signal
      ? {
          sentiment: signal.sentiment,
          summaryText: signal.summary_text,
          signalTags: signal.signal_tags,
          recommendedAction: signal.recommended_action,
          confidence: signal.confidence,
        }
      : null,
    draft: draft
      ? {
          id: draft.id,
          draftText: draft.draft_text,
          finalText: draft.final_text,
          status: draft.status,
        }
      : null,
  });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await getOrCreateUserByEmail(session.user.email, session.user.name ?? null);

  const body = await request.json();
  const { status } = body;

  const validStatuses = ["new", "contacted", "replied", "follow_up_sent", "cold", "won", "lost"];
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ error: "Invalid or missing status" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE leads SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [status, leadId, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  return NextResponse.json({ lead: result.rows[0] });
}
