"use client";

/**
 * Admin support inbox — list of escalated tickets.
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

type Ticket = {
  id: number;
  status: string;
  priority: string;
  escalation_reason: string;
  initial_summary: string | null;
  tour_slug: string | null;
  page_title: string | null;
  user_locale: string | null;
  unread_for_admin: boolean;
  telegram_notified: boolean;
  created_at: string;
  updated_at: string;
};

const ADMIN_TOKEN_KEY = "atc_admin_token";

async function api<T>(path: string): Promise<T> {
  const token = localStorage.getItem(ADMIN_TOKEN_KEY) ?? "";
  const r = await fetch(path, { headers: { "x-admin-token": token } });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export default function SupportInboxPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<{ open: number; unread: number }>({ open: 0, unread: 0 });
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") setHasToken(!!localStorage.getItem(ADMIN_TOKEN_KEY));
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const url = filter ? `/api/admin/support/tickets?status=${filter}` : "/api/admin/support/tickets";
      const r = await api<{ tickets: Ticket[]; counts: { open: number; unread: number } }>(url);
      setTickets(r.tickets);
      setCounts(r.counts);
    } catch (e) {
      alert(`로드 실패: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => { if (hasToken) load(); }, [hasToken, load]);

  if (!hasToken) {
    return (
      <div style={{ padding: 32, fontFamily: "system-ui" }}>
        <h1>Support Inbox (admin)</h1>
        <input type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="admin token" style={{ padding: 8, width: 320 }} />
        <button onClick={() => { localStorage.setItem(ADMIN_TOKEN_KEY, tokenInput.trim()); setHasToken(true); }} style={{ marginLeft: 8, padding: 8 }}>Set</button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 24, fontFamily: "system-ui" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h1 style={{ margin: 0 }}>Support Inbox</h1>
        <div style={{ fontSize: 13, color: "#666" }}>
          open: <b>{counts.open}</b> · unread: <b style={{ color: counts.unread > 0 ? "#c62828" : "#666" }}>{counts.unread}</b>
        </div>
      </header>
      <div style={{ marginBottom: 12 }}>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ padding: 6 }}>
          <option value="">All</option>
          {["open", "admin_reading", "awaiting_admin", "awaiting_user", "resolved", "closed"].map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <button onClick={load} style={{ marginLeft: 8, padding: 6 }}>↻</button>
      </div>
      {loading ? <div>loading…</div> : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead style={{ textAlign: "left", background: "#f5f5f5" }}>
            <tr>
              <th style={th}>#</th>
              <th style={th}>Status</th>
              <th style={th}>Reason</th>
              <th style={th}>Tour</th>
              <th style={th}>Page</th>
              <th style={th}>Locale</th>
              <th style={th}>Notif</th>
              <th style={th}>Updated</th>
              <th style={th}>Summary</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid #eee", fontWeight: t.unread_for_admin ? 700 : 400 }}>
                <td style={td}><Link href={`/admin/support/${t.id}`}>{t.id}</Link></td>
                <td style={td}>{t.status}</td>
                <td style={td}>{t.escalation_reason}</td>
                <td style={td} title={t.tour_slug ?? ""}>{t.tour_slug ?? "—"}</td>
                <td style={td}>{t.page_title ?? "—"}</td>
                <td style={td}>{t.user_locale ?? "—"}</td>
                <td style={td}>{t.telegram_notified ? "✓" : "—"}</td>
                <td style={td}>{new Date(t.updated_at).toLocaleString()}</td>
                <td style={td}>{(t.initial_summary ?? "").slice(0, 80)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const th: React.CSSProperties = { padding: 8, fontSize: 12, textTransform: "uppercase", color: "#666" };
const td: React.CSSProperties = { padding: 8 };
