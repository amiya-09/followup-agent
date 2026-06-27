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

  const result = await pool.query(
    `SELECT s.id, s.sentiment, s.summary_text, s.signal_tags, s.recommended_action, s.confidence, s.created_at
     FROM signals s
     JOIN leads l ON l.id = s.lead_id
     WHERE s.lead_id = $1 AND l.user_id = $2
     ORDER BY s.created_at DESC`,
    [leadId, user.id]
  );

  return NextResponse.json({
    signals: result.rows.map((s) => ({
      id: s.id,
      sentiment: s.sentiment,
      summaryText: s.summary_text,
      signalTags: s.signal_tags,
      recommendedAction: s.recommended_action,
      confidence: s.confidence,
      createdAt: s.created_at,
    })),
  });
}
