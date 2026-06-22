type UrgencyTier = "low" | "medium" | "high" | "critical";

export function computePriorityScore(
  hoursSinceReply: number | null,
  signalTags: string[]
): { score: number; tier: UrgencyTier } {
  // No reply yet at all — nothing for the founder to act on, lowest priority.
  if (hoursSinceReply === null) {
    return { score: 0, tier: "low" };
  }

  let base: number;
  if (hoursSinceReply <= 24) base = 10;
  else if (hoursSinceReply <= 48) base = 30;
  else base = 60;

  let boost = 0;
  if (signalTags.includes("budget_mentioned")) boost += 2;
  if (signalTags.includes("objection")) boost += 1;
  if (signalTags.includes("timeline_mentioned")) boost += 2;

  const score = base + boost;

  let tier: UrgencyTier;
  if (hoursSinceReply > 48 && boost > 0) tier = "critical";
  else if (hoursSinceReply > 48) tier = "high";
  else if (hoursSinceReply > 24) tier = "medium";
  else tier = "low";

  return { score, tier };
}
