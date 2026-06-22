import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: draftId } = await params;
  const body = await request.json();
  const { finalText } = body;

  if (!finalText || typeof finalText !== "string") {
    return NextResponse.json({ error: "finalText is required" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE followup_drafts SET final_text = $1, status = 'edited'
     WHERE id = $2 RETURNING *`,
    [finalText, draftId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "edited" });
}
