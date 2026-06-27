import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { ingestMessage } from "@/lib/ingestion";
import { auth } from "@/auth";
import { sendMessage } from "@/lib/gmail";

async function getUserIdForLead(leadId: string): Promise<string> {
  const result = await pool.query(`SELECT user_id FROM leads WHERE id = $1`, [leadId]);
  return result.rows[0].user_id;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: draftId } = await params;

  const draftResult = await pool.query(
    `SELECT fd.*, l.email, l.name, l.company
     FROM followup_drafts fd
     JOIN leads l ON l.id = fd.lead_id
     WHERE fd.id = $1`,
    [draftId]
  );
  const draft = draftResult.rows[0];

  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  const sendText = draft.final_text ?? draft.draft_text;
  const sentAt = new Date().toISOString();

  const { message } = await ingestMessage({
    userId: await getUserIdForLead(draft.lead_id),
    leadEmail: draft.email,
    leadName: draft.name,
    leadCompany: draft.company,
    direction: "outbound",
    subject: "Re: following up",
    bodyText: sendText,
    sentAt,
    gmailMessageId: `approved-draft-${draftId}`,
  });

  if (!message) {
    return NextResponse.json(
      { error: "Could not record the outbound message — this draft may have already been sent." },
      { status: 409 }
    );
  }

  // ingestMessage sets status to 'contacted' for outbound — override to the
  // more specific status now that we know this was a follow-up send.
  await pool.query(`UPDATE leads SET status = 'follow_up_sent' WHERE id = $1`, [draft.lead_id]);

  await pool.query(
    `UPDATE followup_drafts SET status = 'sent', sent_at = $1 WHERE id = $2`,
    [sentAt, draftId]
  );

  let emailSent = false;
  let emailError: string | null = null;
  try {
    const session = await auth();
    const accessToken = (session as any)?.accessToken;
    if (!accessToken) throw new Error("No active Google session to send from");

    await sendMessage(accessToken, {
      to: draft.email,
      subject: "Re: following up",
      body: sendText,
    });
    emailSent = true;
  } catch (err) {
    console.error(`Real Gmail send failed for draft ${draftId}:`, err);
    emailError = (err as Error).message;
  }

  return NextResponse.json({ status: "sent", sentAt, emailSent, ...(emailError ? { emailError } : {}) });
}
