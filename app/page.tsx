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
  const [session, setSession] = useState<{ user?: { name?: string; email?: string } } | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/queue")
      .then((res) => res.json())
      .then((data) => setLeads(data.leads))
      .catch(() => setError("Couldn't load the queue. Is the dev server running?"));

    fetch("/api/auth/session")
      .then((res) => res.json())
      .then(setSession)
      .catch(() => {});
  }, []);

  async function handleSync() {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      setSyncStatus(`${data.newMessages ?? 0} new messages, ${data.leadsUpdated ?? 0} leads updated`);
      const qRes = await fetch("/api/queue");
      const qData = await qRes.json();
      setLeads(qData.leads);
      setTimeout(() => setSyncStatus(null), 4000);
    } catch {
      setSyncStatus("Sync failed — check console");
    } finally {
      setSyncing(false);
    }
  }

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <header className="mb-10 border-b border-white/10 pb-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-data text-xs tracking-widest text-[#5B6472] uppercase">
              Follow-up Agent
            </p>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Priority Queue</h1>
          </div>
          {session?.user?.email && (
            <div className="font-data flex items-center gap-3 text-xs text-[#5B6472]">
              <span>{session.user.email}</span>
              <a
                href="/api/auth/signout"
                className="rounded border border-white/10 px-2 py-1 transition hover:text-[#F4F1EA]"
              >
                Sign out
              </a>
            </div>
          )}
        </div>
        <div className="mt-4 flex items-center gap-4">
          <button
            onClick={handleSync}
            disabled={syncing}
            className="font-data rounded-md border border-white/10 px-3 py-1.5 text-xs tracking-wide text-[#5B6472] uppercase transition hover:border-white/25 hover:text-[#F4F1EA] disabled:opacity-40"
          >
            {syncing ? "Syncing…" : "Sync inbox"}
          </button>
          {syncStatus && (
            <span className="font-data text-xs text-[#6EE7B7]">↑ {syncStatus}</span>
          )}
          {leads && !syncStatus && (
            <span className="font-data text-xs text-[#5B6472] ml-auto">{leads.length} leads</span>
          )}
          {leads && syncStatus && (
            <span className="font-data text-xs text-[#5B6472] ml-auto">{leads.length} leads</span>
          )}
        </div>
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