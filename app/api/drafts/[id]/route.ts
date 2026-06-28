import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { auth } from "@/auth";
import { getOrCreateUserByEmail } from "@/lib/ingestion";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: draftId } = await params;

  const session = await auth();
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const user = await getOrCreateUserByEmail(session.user.email, session.user.name ?? null);

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { finalText } = body;

  if (!finalText || typeof finalText !== "string") {
    return NextResponse.json({ error: "finalText is required" }, { status: 400 });
  }

  const result = await pool.query(
    `UPDATE followup_drafts fd
     SET final_text = $1, status = 'edited'
     FROM leads l
     WHERE fd.id = $2 AND fd.lead_id = l.id AND l.user_id = $3
     RETURNING fd.*`,
    [finalText, draftId, user.id]
  );

  if (result.rows.length === 0) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  return NextResponse.json({ status: "edited" });
}
