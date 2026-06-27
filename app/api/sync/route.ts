import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  listUnreadMessages,
  getMessage,
  markRead,
  extractHeader,
  extractPlainTextBody,
  parseFromHeader,
} from "@/lib/gmail";
import { ingestMessage, getOrCreateUserByEmail } from "@/lib/ingestion";

export async function POST() {
  try {
    const session = await auth();
    const accessToken = (session as any)?.accessToken;

    if (!session?.user?.email || !accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const user = await getOrCreateUserByEmail(session.user.email, session.user.name ?? null);
    const unread = await listUnreadMessages(accessToken, 20);

    let newMessages = 0;
    const updatedLeadIds = new Set<string>();
    const errors: string[] = [];

    for (const { id } of unread) {
      try {
        const full = await getMessage(accessToken, id);
        const fromHeader = extractHeader(full, "From") ?? "";
        const subject = extractHeader(full, "Subject") ?? "(no subject)";
        const { email: leadEmail, name: leadName } = parseFromHeader(fromHeader);

        if (!leadEmail) {
          errors.push(`Message ${id}: could not parse sender email`);
          continue;
        }

        const bodyText = extractPlainTextBody(full);
        const sentAt = new Date(Number(full.internalDate)).toISOString();

        const { lead, message } = await ingestMessage({
          userId: user.id,
          leadEmail,
          leadName,
          direction: "inbound",
          subject,
          bodyText,
          sentAt,
          gmailMessageId: full.id,
        });

        if (message) {
          newMessages++;
          updatedLeadIds.add(lead.id);
        }

        await markRead(accessToken, id);
      } catch (err) {
        console.error(`Failed to process Gmail message ${id}:`, err);
        errors.push(`Message ${id}: ${(err as Error).message}`);
      }
    }

    return NextResponse.json({
      newMessages,
      leadsUpdated: updatedLeadIds.size,
      ...(errors.length > 0 ? { errors } : {}),
    });
  } catch (err) {
    console.error("Sync failed:", err);
    return NextResponse.json(
      { error: "Sync failed", details: (err as Error).message },
      { status: 500 }
    );
  }
}
