interface SummarizeResult {
  sentiment: "positive" | "neutral" | "negative" | "frustrated";
  summaryText: string;
  signalTags: string[];
  recommendedAction: string;
  confidence: number;
}

const SYSTEM_PROMPT = `You are a sales signal extraction agent. Given an inbound email
reply from a lead, return ONLY a raw JSON object — no markdown, no code fences, no
preamble — with exactly these fields:

{
  "sentiment": "positive" | "neutral" | "negative" | "frustrated",
  "summaryText": "one sentence summary of what the lead said",
  "signalTags": ["budget_mentioned", "objection", "timeline_mentioned", ...],
  "recommendedAction": "send_pricing" | "schedule_call" | "answer_question" | "no_action",
  "confidence": a number between 0 and 1
}`;

export async function summarizeMessage(bodyText: string): Promise<SummarizeResult> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      temperature: 0.2,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: bodyText },
      ],
    }),
  });

  const data = await response.json();
  const raw = data.choices?.[0]?.message?.content;
  if (!raw) {
    throw new Error("Groq returned no content to summarize (empty or malformed response)");
  }
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();
  return JSON.parse(cleaned);
}
