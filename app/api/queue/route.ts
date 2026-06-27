import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/auth";
import { getOrCreateUserByEmail } from "@/lib/ingestion";
import { computePriorityScore } from "@/lib/priorityScore";

export async function GET() {
  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await getOrCreateUserByEmail(session.user.email, session.user.name ?? null);

  const result = await pool.query(
    `
    SELECT
      l.id AS lead_id,
      l.name,
      l.company,
      l.last_reply_at,
      l.status,
      s.summary_text,
      s.recommended_action,
      s.signal_tags,
      d.draft_text
    FROM leads l
    LEFT JOIN LATERAL (
      SELECT summary_text, recommended_action, signal_tags
      FROM signals
      WHERE signals.lead_id = l.id
      ORDER BY created_at DESC
      LIMIT 1
    ) s ON true
    LEFT JOIN LATERAL (
      SELECT draft_text
      FROM followup_drafts
      WHERE followup_drafts.lead_id = l.id
      ORDER BY created_at DESC
      LIMIT 1
    ) d ON true
    WHERE l.user_id = $1
  `,
    [user.id]
  );

  const leads = result.rows.map((row) => {
    const hoursSinceReply = row.last_reply_at
      ? Math.round((Date.now() - new Date(row.last_reply_at).getTime()) / (1000 * 60 * 60))
      : null;

    const { score, tier } =
      row.status === "replied"
        ? computePriorityScore(hoursSinceReply, row.signal_tags ?? [])
        : { score: 0, tier: "low" as const };

    return {
      leadId: row.lead_id,
      name: row.name,
      company: row.company,
      priorityScore: score,
      urgencyTier: tier,
      hoursSinceReply,
      latestSignal: row.summary_text
        ? { summaryText: row.summary_text, recommendedAction: row.recommended_action }
        : null,
      draftPreview: row.draft_text ? row.draft_text.slice(0, 80) + "..." : null,
    };
  });

  leads.sort((a, b) => b.priorityScore - a.priorityScore);

  return NextResponse.json({ leads });
}
