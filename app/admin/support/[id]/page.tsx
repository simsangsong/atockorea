"use client";

/**
 * Admin support ticket detail — chat history (chatbot) + page context + admin↔user thread.
 */
import { use, useCallback, useEffect, useState } from "react";

type ChatMsg = {
  id: number;
  message_index: number;
  role: "user" | "assistant" | "system";
  content: string;
  tour_slug: string | null;
  page_url: string | null;
  page_title: string | null;
  page_section: string | null;
  model: string | null;
  created_at: string;
  escalated: boolean;
  escalation_reason: string | null;
};

type SupportMsg = {
  id: number;
  message_index: number;
  sender: "user" | "admin" | "system";
  content: string;
  attachments: unknown[];
  read_at: string | null;
  created_at: string;
};

type Ticket = {
  id: number;
  status: string;
  priority: string;
  escalation_reason: string;
  initial_summary: string | null;
  initial_user_message: string;
  tour_slug: string | null;
  page_url: string | null;
  page_title: string | null;
  user_locale: string | null;
  telegram_notified: boolean;
  created_at: string;
  updated_at: string;
};

type Detail = {
  ticket: Ticket;
  session: { user_locale: string | null; first_seen_at: string; message_count: number } | null;
  chat_history: ChatMsg[];
  support_thread: SupportMsg[];
};

const ADMIN_TOKEN_KEY = "atc_admin_token";

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  const r = await fetch(path, {
    ...init,
    headers: { ...(init?.headers ?? {}), "x-admin-token": token, "Content-Type": "application/json" },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export default function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [resolving, setResolving] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setHasToken(!!localStorage.getItem(ADMIN_TOKEN_KEY));
  }, []);

  const load = useCallback(async () => {
    try {
      const r = await api<Detail>(`/api/admin/support/tickets/${id}`);
      setDetail(r);
    } catch (e) { alert((e as Error).message); }
  }, [id]);

  useEffect(() => { if (hasToken) load(); }, [hasToken, load]);

  const send = async (alsoResolve = false) => {
    if (!reply.trim()) return;
    try {
      await api(`/api/admin/support/tickets/${id}`, {
        method: "POST",
        body: JSON.stringify({ content: reply, status: alsoResolve ? "resolved" : "awaiting_user" }),
      });
      setReply("");
      load();
    } catch (e) { alert((e as Error).message); }
  };

  if (!hasToken) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Ticket #{id}</h1>
        <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="admin token" style={{ padding: 8, width: 320 }} />
        <button onClick={() => { localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.trim()); setHasToken(true); }} style={{ marginLeft: 8, padding: 8 }}>Set</button>
      </div>
    );
  }
  if (!detail) return <div style={{ padding: 32 }}>loading…</div>;

  const t = detail.ticket;

  return (
    <div style={{ maxWidth: 980, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>#{t.id} · {t.status} · {t.priority}</h1>
        <div style={{ fontSize: 13, color: "#666", marginTop: 6 }}>
          Reason: <b>{t.escalation_reason}</b> · Locale: {t.user_locale ?? "—"} · Telegram: {t.telegram_notified ? "✓" : "—"} · Created: {new Date(t.created_at).toLocaleString()}
        </div>
        {t.tour_slug && <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>Tour: <code>{t.tour_slug}</code></div>}
        {t.page_url && (
          <div style={{ fontSize: 13, color: "#444", marginTop: 4 }}>
            Page: <a href={t.page_url} target="_blank" rel="noreferrer">{t.page_title ?? t.page_url}</a>
          </div>
        )}
      </header>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>📋 Initial summary</h2>
        <div style={{ padding: 12, background: "#fff8e1", borderRadius: 8 }}>{t.initial_summary ?? t.initial_user_message}</div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>💬 Chatbot conversation ({detail.chat_history.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {detail.chat_history.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.role === "user" ? "flex-start" : "flex-end",
              maxWidth: "80%",
              padding: 10,
              borderRadius: 12,
              background: m.role === "user" ? "#e3f2fd" : "#f1f1f1",
              border: m.escalated ? "2px solid #c62828" : "none",
            }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                {m.role} · {new Date(m.created_at).toLocaleTimeString()}
                {m.page_section && ` · ${m.page_section}`}
                {m.escalated && ` · ⚠️ ${m.escalation_reason}`}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>👤 Admin ↔ User thread ({detail.support_thread.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {detail.support_thread.map((m) => (
            <div key={m.id} style={{
              alignSelf: m.sender === "user" ? "flex-start" : "flex-end",
              maxWidth: "80%",
              padding: 10,
              borderRadius: 12,
              background: m.sender === "user" ? "#fff3e0" : "#e8f5e9",
            }}>
              <div style={{ fontSize: 11, color: "#888", marginBottom: 4 }}>
                {m.sender} · {new Date(m.created_at).toLocaleTimeString()}
              </div>
              <div style={{ whiteSpace: "pre-wrap" }}>{m.content}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Reply</h2>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={5}
          style={{ width: "100%", padding: 12, fontFamily: "inherit", fontSize: 15, borderRadius: 8, border: "1px solid #ccc" }}
          placeholder="고객에게 보낼 답변…"
        />
        <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
          <button onClick={() => send(false)} style={btn("#1976d2")}>Send</button>
          <button onClick={() => send(true)} style={btn("#1d8348")}>Send + Resolve</button>
        </div>
      </section>
    </div>
  );
}

function btn(bg: string): React.CSSProperties {
  return { padding: "10px 18px", background: bg, color: "white", border: "none", borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: "pointer" };
}
