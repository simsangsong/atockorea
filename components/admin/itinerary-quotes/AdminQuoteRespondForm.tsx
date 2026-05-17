"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  quoteId: string;
}

/**
 * Single-form ops response surface — types in a manual amount (KRW) + notes,
 * POSTs to /api/admin/itinerary-quotes/[id]/respond. On success, refreshes
 * the page so the readonly response panel renders.
 */
export default function AdminQuoteRespondForm({ quoteId }: Props) {
  const router = useRouter();
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const value = Number(amount.replace(/[^0-9]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Enter a positive KRW amount.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/itinerary-quotes/${quoteId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ manual_amount_krw: value, notes: notes.trim() || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error || `HTTP ${res.status}`);
        setSubmitting(false);
        return;
      }
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">
          Manual amount (KRW)
        </span>
        <input
          type="text"
          inputMode="numeric"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="e.g. 350000"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-slate-700">
          Notes (saved to precedent memory)
        </span>
        <textarea
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Why this price? Any caveat (peak season, custom request, etc.)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-200"
        />
      </label>
      {error ? (
        <p className="rounded-md bg-rose-50 px-3 py-2 text-xs text-rose-700 ring-1 ring-rose-100">{error}</p>
      ) : null}
      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
      >
        {submitting ? "Sending..." : "Send response + record precedent"}
      </button>
    </form>
  );
}
