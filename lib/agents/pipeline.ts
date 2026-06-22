import pool from "../db";
import { summarizeMessage } from "./summarize";
import { generateDraft } from "./draft";

interface PipelineInput {
  messageId: string;
  leadId: string;
  bodyText: string;
  leadName?: string;
  leadCompany?: string;
}

export async function runAgentPipeline(input: PipelineInput) {
  const signalData = await summarizeMessage(input.bodyText);

  const signalResult = await pool.query(
    `INSERT INTO signals (message_id, lead_id, sentiment, summary_text, signal_tags, recommended_action, confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [
      input.messageId,
      input.leadId,
      signalData.sentiment,
      signalData.summaryText,
      JSON.stringify(signalData.signalTags),
      signalData.recommendedAction,
      signalData.confidence,
    ]
  );
  const signal = signalResult.rows[0];

  const draftText = await generateDraft({
    leadName: input.leadName,
    company: input.leadCompany,
    summaryText: signalData.summaryText,
    recommendedAction: signalData.recommendedAction,
  });

  const draftResult = await pool.query(
    `INSERT INTO followup_drafts (lead_id, signal_id, draft_text, status)
     VALUES ($1, $2, $3, 'pending_review')
     RETURNING *`,
    [input.leadId, signal.id, draftText]
  );

  return { signal, draft: draftResult.rows[0] };
}
