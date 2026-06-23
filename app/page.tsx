"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface QueueItem {
  leadId: string;
  name: string | null;
  company: string | null;
  priorityScore: number;
  urgencyTier: "low" | "medium" | "high" | "critical";
  hoursSinceReply: number | null;
  latestSignal: { summaryText: string; recommendedAction: string } | null;
  draftPreview: string | null;
}

const TIER_STYLES: Record<string, { bar: string; text: string; label: string }> = {
  critical: { bar: "bg-[#FF4D4D]", text: "text-[#FF4D4D]", label: "CRITICAL" },
  high:     { bar: "bg-[#FF9F40]", text: "text-[#FF9F40]", label: "HIGH" },
  medium:   { bar: "bg-[#F4D35E]", text: "text-[#F4D35E]", label: "MEDIUM" },
  low:      { bar: "bg-[#5B6472]", text: "text-[#5B6472]", label: "LOW" },
};

export default function QueuePage() {
  const [leads, setLeads] = useState<QueueItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/queue")
      .then((res) => res.json())
      .then((data) => setLeads(data.leads))
      .catch(() => setError("Couldn't load the queue. Is the dev server running?"));
  }, []);

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <header className="mb-10 flex items-baseline justify-between border-b border-white/10 pb-6">
        <div>
          <p className="font-data text-xs tracking-widest text-[#5B6472] uppercase">
            Follow-up Agent
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Priority Queue</h1>
        </div>
        {leads && <p className="font-data text-sm text-[#5B6472]">{leads.length} leads</p>}
      </header>

      {error && <p className="text-[#FF4D4D]">{error}</p>}
      {!leads && !error && (
        <p className="font-data text-sm text-[#5B6472]">Loading signals…</p>
      )}
      {leads && leads.length === 0 && (
        <p className="text-[#5B6472]">No leads yet. Run the seed endpoint to get started.</p>
      )}

      <div className="flex flex-col gap-3">
        {leads?.map((lead) => {
          const tier = TIER_STYLES[lead.urgencyTier] ?? TIER_STYLES.low;
          return (
            <Link
              key={lead.leadId}
              href={`/leads/${lead.leadId}`}
              className="group flex items-stretch overflow-hidden rounded-lg border border-white/10 bg-[#1A1D24] transition hover:border-white/25 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4D35E]"
            >
              <div className={`w-1.5 shrink-0 ${tier.bar}`} />
              <div className="flex flex-1 items-center gap-6 px-5 py-4">
                <div className="font-data w-16 shrink-0 text-right text-lg font-semibold">
                  {lead.priorityScore}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="font-semibold">{lead.name ?? "Unknown lead"}</span>
                    {lead.company && (
                      <span className="text-sm text-[#5B6472]">{lead.company}</span>
                    )}
                    <span className={`font-data ml-auto text-[11px] tracking-wider ${tier.text}`}>
                      {tier.label}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-[#A8ACB3]">
                    {lead.latestSignal?.summaryText ?? "No reply yet"}
                  </p>
                </div>
                <div className="font-data hidden w-40 shrink-0 text-right text-xs text-[#5B6472] md:block">
                  {lead.hoursSinceReply !== null ? `${lead.hoursSinceReply}h since reply` : "—"}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </main>
  );
}