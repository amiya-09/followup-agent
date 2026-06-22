import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: leadId } = await params;

  const result = await pool.query(
    `SELECT id, sentiment, summary_text, signal_tags, recommended_action, confidence, created_at
     FROM signals WHERE lead_id = $1 ORDER BY created_at DESC`,
    [leadId]
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
