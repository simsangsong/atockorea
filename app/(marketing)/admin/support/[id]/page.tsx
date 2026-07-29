"use client";

/**
 * Admin support ticket detail — chatbot history + page context + admin↔user thread.
 *
 * Auth: Supabase admin session from app/admin/layout.tsx (no more localStorage tokens).
 */
import { use, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

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
  session: {
    user_locale: string | null;
    first_seen_at: string;
    message_count: number;
  } | null;
  chat_history: ChatMsg[];
  support_thread: SupportMsg[];
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session } } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!session) throw new Error("not_authenticated");
  const r = await fetch(path, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.headers ?? {}),
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export default function TicketDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const r = await api<Detail>(`/api/admin/support/tickets/${id}`);
      setDetail(r);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const send = async (alsoResolve = false) => {
    if (!reply.trim()) return;
    try {
      await api(`/api/admin/support/tickets/${id}`, {
        method: "POST",
        body: JSON.stringify({
          content: reply,
          status: alsoResolve ? "resolved" : "awaiting_user",
        }),
      });
      setReply("");
      load();
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (error && !detail) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-800">
        {error}
      </div>
    );
  }
  if (!detail) return <div className="text-sm text-slate-500 py-12 text-center">loading…</div>;

  const t = detail.ticket;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <header>
        <h1 className="text-xl font-semibold text-slate-900">
          #{t.id} · {t.status} · {t.priority}
        </h1>
        <div className="text-sm text-slate-600 mt-1">
          Reason: <b>{t.escalation_reason}</b> · Locale: {t.user_locale ?? "—"} · Telegram:{" "}
          {t.telegram_notified ? "✓" : "—"} · Created: {new Date(t.created_at).toLocaleString()}
        </div>
        {t.tour_slug && (
          <div className="text-sm text-slate-700 mt-1">
            Tour: <code className="bg-slate-100 px-1 rounded">{t.tour_slug}</code>
          </div>
        )}
        {t.page_url && (
          <div className="text-sm text-slate-700 mt-1">
            Page:{" "}
            <a href={t.page_url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline">
              {t.page_title ?? t.page_url}
            </a>
          </div>
        )}
      </header>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-2">📋 Initial summary</h2>
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm">
          {t.initial_summary ?? t.initial_user_message}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-2">
          💬 Chatbot conversation ({detail.chat_history.length})
        </h2>
        <div className="flex flex-col gap-2">
          {detail.chat_history.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] p-3 rounded-xl text-sm ${
                m.role === "user"
                  ? "self-start bg-blue-50"
                  : "self-end bg-slate-100"
              } ${m.escalated ? "ring-2 ring-red-500" : ""}`}
            >
              <div className="text-xs text-slate-500 mb-1">
                {m.role} · {new Date(m.created_at).toLocaleTimeString()}
                {m.page_section && ` · ${m.page_section}`}
                {m.escalated && ` · ⚠️ ${m.escalation_reason}`}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-2">
          👤 Admin ↔ User thread ({detail.support_thread.length})
        </h2>
        <div className="flex flex-col gap-2">
          {detail.support_thread.map((m) => (
            <div
              key={m.id}
              className={`max-w-[80%] p-3 rounded-xl text-sm ${
                m.sender === "user" ? "self-start bg-orange-50" : "self-end bg-green-50"
              }`}
            >
              <div className="text-xs text-slate-500 mb-1">
                {m.sender} · {new Date(m.created_at).toLocaleTimeString()}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-base font-semibold text-slate-900 mb-2">Reply</h2>
        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={5}
          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm"
          placeholder="고객에게 보낼 답변…"
        />
        <div className="mt-2 flex gap-2">
          <button
            onClick={() => send(false)}
            className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700"
          >
            Send
          </button>
          <button
            onClick={() => send(true)}
            className="px-4 py-2 rounded-lg bg-green-600 text-white text-sm font-medium hover:bg-green-700"
          >
            Send + Resolve
          </button>
        </div>
      </section>
    </div>
  );
}
