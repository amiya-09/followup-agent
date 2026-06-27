const GMAIL_BASE = "https://gmail.googleapis.com/gmail/v1/users/me";

export async function listUnreadMessages(accessToken: string, maxResults = 20) {
  const url = `${GMAIL_BASE}/messages?q=${encodeURIComponent("is:unread in:inbox")}&maxResults=${maxResults}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`Gmail list failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return (data.messages ?? []) as { id: string; threadId: string }[];
}

export async function getMessage(accessToken: string, id: string) {
  const res = await fetch(`${GMAIL_BASE}/messages/${id}?format=full`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Gmail get message failed: ${res.status} ${await res.text()}`);
  return res.json();
}

export async function markRead(accessToken: string, id: string) {
  const res = await fetch(`${GMAIL_BASE}/messages/${id}/modify`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ removeLabelIds: ["UNREAD"] }),
  });
  if (!res.ok) throw new Error(`Gmail mark-read failed: ${res.status} ${await res.text()}`);
}

export function extractHeader(message: any, name: string): string | undefined {
  const headers = message.payload?.headers ?? [];
  return headers.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value;
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf-8");
}

export function extractPlainTextBody(message: any): string {
  function walk(part: any): string | null {
    if (!part) return null;
    if (part.mimeType === "text/plain" && part.body?.data) {
      return decodeBase64Url(part.body.data);
    }
    if (part.parts) {
      for (const child of part.parts) {
        const found = walk(child);
        if (found) return found;
      }
    }
    return null;
  }

  const plain = walk(message.payload);
  if (plain) return plain;
  if (message.payload?.body?.data) return decodeBase64Url(message.payload.body.data);
  return message.snippet ?? "";
}

export function parseFromHeader(fromHeader: string): { email: string; name?: string } {
  const match = fromHeader.match(/^(.*?)\s*<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    return { email: match[2].trim(), name: name || undefined };
  }
  return { email: fromHeader.trim() };
}

export async function sendMessage(
  accessToken: string,
  { to, subject, body }: { to: string; subject: string; body: string }
) {
  const messageLines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    "",
    body,
  ];
  const rawMessage = messageLines.join("\r\n");
  const encodedMessage = Buffer.from(rawMessage)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

  const res = await fetch(`${GMAIL_BASE}/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodedMessage }),
  });
  if (!res.ok) throw new Error(`Gmail send failed: ${res.status} ${await res.text()}`);
  return res.json();
}
