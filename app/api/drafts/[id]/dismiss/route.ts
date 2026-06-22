import { NextResponse } from "next/server";
import pool from "@/lib/db";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: draftId } = await params;

  const result = await pool.query(
    `UPDATE followup_drafts SET status = 'dismissed' WHERE id = $1 RETURNING *`,
    [draftId]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "dismissed" });
}
