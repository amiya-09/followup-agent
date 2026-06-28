"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";

interface LeadDetail {
  lead: { id: string; name: string | null; company: string | null; status: string; email: string };
  messages: { direction: "inbound" | "outbound"; subject: string; bodyText: string; sentAt: string }[];
  signal: {
    sentiment: string;
    summaryText: string;
    signalTags: string[];
    recommendedAction: string;
    confidence: number;
  } | null;
  draft: { id: string; draftText: string; finalText: string | null; status: string } | null;
}

const SENTIMENT_COLOR: Record<string, string> = {
  positive: "text-[#6EE7B7]",
  neutral: "text-[#5B6472]",
  negative: "text-[#FF9F40]",
  frustrated: "text-[#FF4D4D]",
};

const STATUS_LABEL: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  replied: "Replied",
  follow_up_sent: "Follow-up sent",
  cold: "Cold",
  won: "Won",
  lost: "Lost",
};

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<LeadDetail | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [submitting, setSubmitting] = useState<"approve" | "dismiss" | "status" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadLead = useCallback(async () => {
    const res = await fetch(`/api/leads/${id}`);
    const json = await res.json();

    if (!res.ok || json.error) {
      setLoadError(json.error ?? "Could not load this lead.");
      return;
    }

    setLoadError(null);
    setData(json);
    setDraftText(json.draft?.finalText ?? json.draft?.draftText ?? "");
  }, [id]);

  useEffect(() => {
    loadLead();
  }, [loadLead]);

  async function handleApprove() {
    if (!data?.draft) return;
    setSubmitting("approve");
    setErrorMsg(null);
    try {
      await fetch(`/api/drafts/${data.draft.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ finalText: draftText }),
      });
      const res = await fetch(`/api/drafts/${data.draft.id}/approve`, { method: "POST" });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "approve failed");
      if (result.emailSent === false) {
        setErrorMsg(`Recorded in thread, but Gmail send failed: ${result.emailError ?? "unknown error"}`);
      }
      await loadLead();
    } catch {
      setErrorMsg("Something went wrong sending this. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleDismiss() {
    if (!data?.draft) return;
    setSubmitting("dismiss");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/drafts/${data.draft.id}/dismiss`, { method: "POST" });
      if (!res.ok) throw new Error("dismiss failed");
      await loadLead();
    } catch {
      setErrorMsg("Something went wrong dismissing this. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  async function handleStatusChange(status: string) {
    if (!data?.lead) return;
    setSubmitting("status");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/leads/${data.lead.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("status update failed");
      await loadLead();
    } catch {
      setErrorMsg("Couldn't update the lead's status. Try again.");
    } finally {
      setSubmitting(null);
    }
  }

  if (loadError) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-12">
        <Link href="/" className="font-data text-xs text-[#5B6472] hover:text-[#F4F1EA]">
          ← back to queue
        </Link>
        <p className="mt-6 text-sm text-[#FF4D4D]">{loadError}</p>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen px-6 py-10 md:px-12">
        <p className="font-data text-sm text-[#5B6472]">Loading lead…</p>
      </main>
    );
  }

  const { lead, messages, signal, draft } = data;
  const isLocked = draft?.status === "sent" || draft?.status === "dismissed";

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <Link href="/" className="font-data text-xs text-[#5B6472] hover:text-[#F4F1EA]">
        ← back to queue
      </Link>

      <header className="mt-4 mb-8 flex items-baseline justify-between border-b border-white/10 pb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{lead.name ?? "Unknown lead"}</h1>
          <p className="text-sm text-[#5B6472]">{lead.company} · {lead.email}</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-data rounded border border-white/10 px-2 py-1 text-[11px] tracking-wider text-[#5B6472] uppercase">
            {STATUS_LABEL[lead.status] ?? lead.status}
          </span>
          <div className="flex gap-1">
            <button
              onClick={() => handleStatusChange("won")}
              disabled={submitting !== null}
              className="font-data rounded border border-white/10 px-2 py-1 text-[10px] tracking-wider text-[#6EE7B7] uppercase transition hover:border-[#6EE7B7]/50 disabled:opacity-50"
            >
              Won
            </button>
            <button
              onClick={() => handleStatusChange("lost")}
              disabled={submitting !== null}
              className="font-data rounded border border-white/10 px-2 py-1 text-[10px] tracking-wider text-[#FF4D4D] uppercase transition hover:border-[#FF4D4D]/50 disabled:opacity-50"
            >
              Lost
            </button>
            <button
              onClick={() => handleStatusChange("cold")}
              disabled={submitting !== null}
              className="font-data rounded border border-white/10 px-2 py-1 text-[10px] tracking-wider text-[#5B6472] uppercase transition hover:text-[#F4F1EA] disabled:opacity-50"
            >
              Cold
            </button>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section>
          <h2 className="font-data mb-3 text-xs tracking-widest text-[#5B6472] uppercase">Thread</h2>
          <div className="flex flex-col gap-3">
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[90%] rounded-lg border px-4 py-3 ${
                  m.direction === "inbound"
                    ? "self-start border-white/10 bg-[#1A1D24]"
                    : "self-end border-[#6EE7B7]/20 bg-[#15201C]"
                }`}
              >
                <p className="font-data mb-1 text-[10px] tracking-wider text-[#5B6472] uppercase">
                  {m.direction} · {new Date(m.sentAt).toLocaleString()}
                </p>
                <p className="text-sm text-[#F4F1EA]">{m.bodyText}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-6">
          {signal && (
            <div className="rounded-lg border border-white/10 bg-[#1A1D24] p-5">
              <h2 className="font-data mb-3 text-xs tracking-widest text-[#5B6472] uppercase">AI Signal</h2>
              <p className={`font-data mb-2 text-sm font-semibold uppercase ${SENTIMENT_COLOR[signal.sentiment] ?? ""}`}>
                {signal.sentiment} · {Math.round(signal.confidence * 100)}% confidence
              </p>
              <p className="mb-3 text-sm text-[#A8ACB3]">{signal.summaryText}</p>
              <div className="flex flex-wrap gap-2">
                {signal.signalTags.map((tag) => (
                  <span key={tag} className="font-data rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-[#5B6472]">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {draft ? (
            <div className="rounded-lg border border-white/10 bg-[#1A1D24] p-5">
              <h2 className="font-data mb-3 text-xs tracking-widest text-[#5B6472] uppercase">Follow-up draft</h2>
              <textarea
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                disabled={isLocked}
                rows={6}
                className="w-full resize-none rounded-md border border-white/10 bg-[#0F1115] p-3 text-sm text-[#F4F1EA] outline-none focus-visible:border-[#F4D35E] disabled:opacity-50"
              />

              {draft.status === "sent" && <p className="mt-3 text-sm text-[#6EE7B7]">Sent.</p>}
              {draft.status === "dismissed" && <p className="mt-3 text-sm text-[#5B6472]">Dismissed.</p>}
              {errorMsg && <p className="mt-3 text-sm text-[#FF4D4D]">{errorMsg}</p>}

              {!isLocked && (
                <div className="mt-4 flex gap-3">
                  <button
                    onClick={handleApprove}
                    disabled={submitting !== null}
                    className="font-data rounded-md bg-[#6EE7B7] px-4 py-2 text-xs font-semibold tracking-wide text-[#0F1115] uppercase transition hover:opacity-90 disabled:opacity-50"
                  >
                    {submitting === "approve" ? "Sending…" : "Approve & send"}
                  </button>
                  <button
                    onClick={handleDismiss}
                    disabled={submitting !== null}
                    className="font-data rounded-md border border-white/10 px-4 py-2 text-xs tracking-wide text-[#5B6472] uppercase transition hover:text-[#F4F1EA] disabled:opacity-50"
                  >
                    {submitting === "dismiss" ? "Dismissing…" : "Dismiss"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-lg border border-white/10 bg-[#1A1D24] p-5 text-sm text-[#5B6472]">
              No draft yet for this lead.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
