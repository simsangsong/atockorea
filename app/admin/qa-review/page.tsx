"use client";

/**
 * Q&A 3-second review UI — admin presses one key per item:
 *   ✓ approve (T)   ✗ reject (F)   ✎ needs edit (E)   skip (→)
 * Also keyboard: T=true, F=false, E=edit, →=next, ←=prev
 *
 * Auth: relies on the Supabase admin session established by app/admin/layout.tsx.
 * The previous localStorage admin-token flow was removed because it was XSS-prone
 * and the matching server-side `if (!t) return true` opened the API to anonymous access.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type QAPair = {
  id: number;
  source: string;
  question: string;
  answer: string;
  question_locale: string;
  answer_locale: string;
  category: string | null;
  tour_slug: string | null;
  tags: string[];
  review_status: string;
  is_active: boolean;
  updated_at: string;
};

type Counts = Record<string, number>;

async function authedFetch(path: string, init?: RequestInit): Promise<Response> {
  const { data: { session } } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!session) throw new Error("not_authenticated");
  return fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const r = await authedFetch(path, init);
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export default function QaReviewPage() {
  const [pairs, setPairs] = useState<QAPair[]>([]);
  const [counts, setCounts] = useState<Counts>({});
  const [filterStatus, setFilterStatus] = useState<string>("draft");
  const [idx, setIdx] = useState(0);
  const [editing, setEditing] = useState(false);
  const [editAnswer, setEditAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const startRef = useRef<number>(Date.now());

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api<{ pairs: QAPair[]; counts: Counts }>(
        `/api/admin/qa-pairs?status=${filterStatus}&limit=100`
      );
      setPairs(r.pairs);
      setCounts(r.counts);
      setIdx(0);
      startRef.current = Date.now();
    } catch (e) {
      setError(`로드 실패: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const current = pairs[idx];
  const _elapsed = useMemo(() => 0, [idx]);

  const act = useCallback(
    async (action: "true" | "false" | "needs_edit", body?: { answer?: string }) => {
      if (!current) return;
      const elapsedSec = Math.round((Date.now() - startRef.current) / 1000);
      try {
        await api(`/api/admin/qa-pairs/${current.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action, ...(body ?? {}) }),
        });
        setEditing(false);
        setEditAnswer("");
        if (idx + 1 < pairs.length) {
          setIdx(idx + 1);
          startRef.current = Date.now();
        } else {
          await load();
        }
        if (process.env.NODE_ENV === "development") {
          console.log(`reviewed #${current.id} → ${action} (${elapsedSec}s)`);
        }
      } catch (e) {
        setError(`Action failed: ${(e as Error).message}`);
      }
    },
    [current, idx, pairs.length, load]
  );

  useEffect(() => {
    if (editing) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "t" || e.key === "T" || e.key === "ArrowUp") { e.preventDefault(); act("true"); }
      else if (e.key === "f" || e.key === "F" || e.key === "ArrowDown") { e.preventDefault(); act("false"); }
      else if (e.key === "e" || e.key === "E") {
        e.preventDefault();
        setEditing(true);
        setEditAnswer(current?.answer ?? "");
      }
      else if (e.key === "ArrowRight") { e.preventDefault(); if (idx + 1 < pairs.length) setIdx(idx + 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); if (idx > 0) setIdx(idx - 1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing, current, idx, pairs.length, act]);

  return (
    <div className="max-w-4xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Q&A Review</h1>
        <div className="flex items-center gap-2">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm"
          >
            {["draft", "needs_edit", "approved", "rejected", "true", "false", "all"].map((s) => (
              <option key={s} value={s}>{s} ({counts[s] ?? 0})</option>
            ))}
          </select>
          <button
            onClick={load}
            className="px-3 py-1.5 rounded-lg border border-slate-200 text-sm hover:bg-slate-50"
          >
            ↻ Reload
          </button>
        </div>
      </header>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-sm text-slate-500 py-12 text-center">loading…</div>
      ) : !current ? (
        <div className="text-sm text-slate-500 py-12 text-center">
          No items in this status. Try a different filter or load some Q&As.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="text-xs text-slate-500 mb-2">
            #{current.id} · {idx + 1} / {pairs.length} · source: {current.source} · status: {current.review_status}
            {current.tour_slug ? ` · ${current.tour_slug}` : ""}
            {current.category ? ` · ${current.category}` : ""}
          </div>
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-1">Q ({current.question_locale}):</div>
            <div className="text-base font-semibold text-slate-900">{current.question}</div>
          </div>
          <div className="mb-4">
            <div className="text-xs text-slate-500 mb-1">A ({current.answer_locale}):</div>
            {editing ? (
              <textarea
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                rows={6}
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
              />
            ) : (
              <div className="text-sm whitespace-pre-wrap leading-relaxed text-slate-800">
                {current.answer}
              </div>
            )}
          </div>

          {editing ? (
            <div className="flex gap-2">
              <button
                onClick={() => act("true", { answer: editAnswer })}
                className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
              >
                ✓ Save & Approve
              </button>
              <button
                onClick={() => { setEditing(false); setEditAnswer(""); }}
                className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm hover:bg-slate-300"
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => act("true")} className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700">✓ True (T)</button>
              <button onClick={() => act("false")} className="px-4 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">✗ False (F)</button>
              <button onClick={() => { setEditing(true); setEditAnswer(current.answer); }} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700">✎ Edit (E)</button>
              <button onClick={() => idx + 1 < pairs.length && setIdx(idx + 1)} className="px-4 py-2 rounded-lg bg-slate-200 text-slate-700 text-sm hover:bg-slate-300">→ Skip</button>
            </div>
          )}

          <div className="mt-4 text-xs text-slate-400">
            ↑/T = approve · ↓/F = reject · E = edit · ←/→ = navigate · 3초 안에 결정 권장
          </div>
        </div>
      )}

      <footer className="mt-4 text-xs text-slate-500">
        counts: {Object.entries(counts).map(([s, n]) => `${s}=${n}`).join(", ")}
      </footer>
    </div>
  );
}
