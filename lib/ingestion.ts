import pool from "./db";
import { runAgentPipeline } from "./agents/pipeline";

interface IngestParams {
  userId: string;
  leadEmail: string;
  leadName?: string;
  leadCompany?: string;
  direction: "inbound" | "outbound";
  subject: string;
  bodyText: string;
  sentAt: string; // ISO timestamp
  gmailMessageId?: string;
}

export async function ingestMessage(params: IngestParams) {
  const { userId, leadEmail, leadName, leadCompany, direction, subject, bodyText, sentAt, gmailMessageId } = params;

  // 1. Find the lead by email (scoped to this user), or create it
  const existing = await pool.query(
    `SELECT * FROM leads WHERE user_id = $1 AND email = $2`,
    [userId, leadEmail]
  );

  let lead = existing.rows[0];
  if (!lead) {
    const inserted = await pool.query(
      `INSERT INTO leads (user_id, email, name, company, status)
       VALUES ($1, $2, $3, $4, 'new')
       RETURNING *`,
      [userId, leadEmail, leadName ?? null, leadCompany ?? null]
    );
    lead = inserted.rows[0];
  }

  // 2. Insert the message. ON CONFLICT makes this safe to re-run without duplicating
  //    (important: we'll re-run the seed endpoint a lot while testing)
  const messageResult = await pool.query(
    `INSERT INTO messages (lead_id, direction, subject, body_text, sent_at, gmail_message_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (gmail_message_id) DO NOTHING
     RETURNING *`,
    [lead.id, direction, subject, bodyText, sentAt, gmailMessageId ?? null]
  );
  const message = messageResult.rows[0] ?? null;

  // 3. Update the lead's timestamps/status based on which direction this was
  if (direction === "inbound") {
    await pool.query(
      `UPDATE leads SET last_reply_at = $1, status = 'replied' WHERE id = $2`,
      [sentAt, lead.id]
    );

    if (message) {
      try {
        await runAgentPipeline({
          messageId: message.id,
          leadId: lead.id,
          bodyText,
          leadName: lead.name,
          leadCompany: lead.company,
        });
      } catch (err) {
        console.error(`Agent pipeline failed for message ${message.id}:`, err);
        // Message is still ingested even if the AI pipeline fails — visible in the
        // thread, just without an auto-generated signal/draft for this one message.
      }
    }
  } else {
    await pool.query(
      `UPDATE leads SET last_contact_at = $1, status = 'contacted' WHERE id = $2`,
      [sentAt, lead.id]
    );
  }

  return { lead, message };
}

export async function getOrCreateUserByEmail(email: string, name?: string | null) {
  const existing = await pool.query(`SELECT * FROM users WHERE email = $1`, [email]);
  if (existing.rows[0]) return existing.rows[0];

  const inserted = await pool.query(
    `INSERT INTO users (email, name, gmail_connected) VALUES ($1, $2, true) RETURNING *`,
    [email, name ?? null]
  );
  return inserted.rows[0];
}
