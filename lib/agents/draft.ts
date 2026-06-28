interface DraftParams {
  leadName?: string;
  company?: string;
  summaryText: string;
  recommendedAction: string;
}

const SYSTEM_PROMPT = `You are a sales follow-up writing assistant. You write short,
warm, professional follow-up emails on behalf of a startup founder, replying to a
lead based on a summary of what they said. Never claim to have attached files,
scheduled meetings, or taken any action you haven't actually taken in this
conversation. Return ONLY the email body text — no subject line, no markdown, no
preamble, no signature block (the founder adds their own sign-off). Keep it under
100 words.`;

export async function generateDraft(params: DraftParams): Promise<string> {
  const userPrompt = `Lead name: ${params.leadName ?? "the lead"}
Company: ${params.company ?? "their company"}
What they said (summary): ${params.summaryText}
Recommended action: ${params.recommendedAction}

Write the follow-up email body now.`;

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  const data = await response.json();
  const body = data.choices?.[0]?.message?.content?.trim() ?? "";
  if (!body) {
    throw new Error("Groq returned an empty draft");
  }
  return body;
}
