import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/auth";
import { getOrCreateUserByEmail } from "@/lib/ingestion";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: draftId } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await getOrCreateUserByEmail(session.user.email, session.user.name ?? null);

  const result = await pool.query(
    `UPDATE followup_drafts fd
     SET status = 'dismissed'
     FROM leads l
     WHERE fd.id = $1 AND fd.lead_id = l.id AND l.user_id = $2
     RETURNING fd.*`,
    [draftId, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "dismissed" });
}
