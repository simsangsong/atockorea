"use client";

/**
 * Q&A 3-second review UI — admin presses one key per item:
 *   ✓ approve (T)   ✗ reject (F)   ✎ needs edit (E)   skip (→)
 * Also keyboard: T=true, F=false, E=edit, →=next, ←=prev
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

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

const ADMIN_TOKEN_KEY = "atc_admin_token";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem(ADMIN_TOKEN_KEY) ?? "" : "";
  const r = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
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
  const [tokenInput, setTokenInput] = useState("");
  const [hasToken, setHasToken] = useState(false);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (typeof window !== "undefined") {
      setHasToken(!!localStorage.getItem(ADMIN_TOKEN_KEY));
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await api<{ pairs: QAPair[]; counts: Counts }>(`/api/admin/qa-pairs?status=${filterStatus}&limit=100`);
      setPairs(r.pairs);
      setCounts(r.counts);
      setIdx(0);
      startRef.current = Date.now();
    } catch (e) {
      alert(`로드 실패: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => {
    if (hasToken) load();
  }, [hasToken, load]);

  const current = pairs[idx];
  const elapsed = useMemo(() => 0, [idx]);

  const act = useCallback(
    async (action: "true" | "false" | "needs_edit", body?: { answer?: string }) => {
      if (!current) return;
      const elapsedSec = Math.round((Date.now() - startRef.current) / 1000);
      try {
        await api(`/api/admin/qa-pairs/${current.id}`, {
          method: "PATCH",
          body: JSON.stringify({ action, ...(body ?? {}) }),
        });
        // advance
        setEditing(false);
        setEditAnswer("");
        if (idx + 1 < pairs.length) {
          setIdx(idx + 1);
          startRef.current = Date.now();
        } else {
          await load();
        }
        console.log(`reviewed #${current.id} → ${action} (${elapsedSec}s)`);
      } catch (e) {
        alert(`Action failed: ${(e as Error).message}`);
      }
    },
    [current, idx, pairs.length, load]
  );

  // Keyboard shortcuts
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

  if (!hasToken) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Q&A Review (admin)</h1>
        <p>Set the admin token (matches <code>ADMIN_SUPPORT_API_TOKEN</code> on the server).</p>
        <input
          type="password"
          placeholder="admin token"
          value={tokenInput}
          onChange={(e) => setTokenInput(e.target.value)}
          style={{ padding: 8, width: 320 }}
        />
        <button
          onClick={() => {
            if (typeof window !== "undefined") localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.trim());
            setHasToken(true);
          }}
          style={{ marginLeft: 8, padding: 8 }}
        >Set</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Q&A Review</h1>
        <div>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} style={{ padding: 6 }}>
            {["draft", "needs_edit", "approved", "rejected", "true", "false", "all"].map((s) => (
              <option key={s} value={s}>{s} ({counts[s] ?? 0})</option>
            ))}
          </select>
          <button onClick={load} style={{ marginLeft: 8, padding: 6 }}>↻ Reload</button>
        </div>
      </header>

      {loading ? (
        <div>loading…</div>
      ) : !current ? (
        <div>No items in this status. Try a different filter or load some Q&As.</div>
      ) : (
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 24, background: "#fafafa" }}>
          <div style={{ fontSize: 12, color: "#777", marginBottom: 8 }}>
            #{current.id} · {idx + 1} / {pairs.length} · source: {current.source} · status: {current.review_status}
            {current.tour_slug ? ` · ${current.tour_slug}` : ""}
            {current.category ? ` · ${current.category}` : ""}
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>Q ({current.question_locale}):</div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{current.question}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 13, color: "#888", marginBottom: 4 }}>A ({current.answer_locale}):</div>
            {editing ? (
              <textarea
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                rows={6}
                style={{ width: "100%", padding: 12, fontSize: 16, fontFamily: "inherit" }}
              />
            ) : (
              <div style={{ fontSize: 16, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{current.answer}</div>
            )}
          </div>

          {editing ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => act("true", { answer: editAnswer })} style={btn("#1d8348")}>✓ Save & Approve</button>
              <button onClick={() => { setEditing(false); setEditAnswer(""); }} style={btn("#888")}>Cancel</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button onClick={() => act("true")} style={btn("#1d8348")}>✓ True (T)</button>
              <button onClick={() => act("false")} style={btn("#c62828")}>✗ False (F)</button>
              <button onClick={() => { setEditing(true); setEditAnswer(current.answer); }} style={btn("#2e5cab")}>✎ Edit (E)</button>
              <button onClick={() => idx + 1 < pairs.length && setIdx(idx + 1)} style={btn("#888")}>→ Skip</button>
            </div>
          )}

          <div style={{ marginTop: 16, fontSize: 12, color: "#999" }}>
            ↑/T = approve · ↓/F = reject · E = edit · ←/→ = navigate · 3초 안에 결정 권장
          </div>
        </div>
      )}

      <footer style={{ marginTop: 16, fontSize: 12, color: "#777" }}>
        counts: {Object.entries(counts).map(([s, n]) => `${s}=${n}`).join(", ")}
      </footer>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return { padding: "10px 16px", background: bg, color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" };
}
