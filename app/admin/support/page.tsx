"use client";

/**
 * Admin support inbox — list of escalated tickets.
 *
 * Auth: relies on the Supabase admin session from app/admin/layout.tsx.
 * Old localStorage admin-token flow removed (XSS-prone + matched the
 * server-side backdoor that allowed unauthenticated access).
 */
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { SavedViews } from "@/components/admin/SavedViews";
import { useUrlFilters } from "@/lib/admin/useUrlFilters";

const FILTER_DEFAULTS = { status: "" };

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

async function api<T>(path: string): Promise<T> {
  const { data: { session } } = (await supabase?.auth.getSession()) ?? { data: { session: null } };
  if (!session) throw new Error("not_authenticated");
  const r = await fetch(path, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    credentials: "include",
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return (await r.json()) as T;
}

export default function SupportInboxPage() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [counts, setCounts] = useState<{ open: number; unread: number }>({ open: 0, unread: 0 });
  const { filters, setFilter, setFilters } = useUrlFilters(FILTER_DEFAULTS);
  const filtersAreDefault = filters.status === "";
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const url = filters.status
        ? `/api/admin/support/tickets?status=${encodeURIComponent(filters.status)}`
        : "/api/admin/support/tickets";
      const r = await api<{ tickets: Ticket[]; counts: { open: number; unread: number } }>(url);
      setTickets(r.tickets);
      setCounts(r.counts);
    } catch (e) {
      setError(`로드 실패: ${(e as Error).message}`);
    } finally {
      setLoading(false);
    }
  }, [filters.status]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-6xl mx-auto">
      <header className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-semibold text-slate-900">Support Inbox</h1>
        <div className="text-sm text-slate-600">
          open: <b>{counts.open}</b> · unread:{" "}
          <b className={counts.unread > 0 ? "text-red-600" : "text-slate-600"}>{counts.unread}</b>
        </div>
      </header>

      {error && (
        <div className="mb-3 bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="mb-3 flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <select
            value={filters.status}
            onChange={(e) => setFilter("status", e.target.value)}
            aria-label="상태 필터"
            className="min-h-11 rounded-lg border border-admin-border bg-admin-surface px-3 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All</option>
            {["open", "admin_reading", "awaiting_admin", "awaiting_user", "resolved", "closed"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button
            onClick={load}
            aria-label="새로고침"
            className="inline-flex min-h-11 items-center rounded-lg border border-admin-border px-3 text-sm text-slate-600 transition-colors hover:bg-admin-surface-hover"
          >
            ↻
          </button>
        </div>
        {/* U-8 saved views — bookmark the status filter (S-U2 spread). */}
        <SavedViews
          storageKey="admin:support:saved-views"
          currentFilters={filters}
          isDefault={filtersAreDefault}
          onApply={(viewFilters) => setFilters({ ...FILTER_DEFAULTS, ...viewFilters })}
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        {loading ? (
          <div className="text-sm text-slate-500 py-12 text-center">loading…</div>
        ) : tickets.length === 0 ? (
          <div className="text-sm text-slate-500 py-12 text-center">No tickets</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Reason</th>
                <th className="px-3 py-2">Tour</th>
                <th className="px-3 py-2">Page</th>
                <th className="px-3 py-2">Locale</th>
                <th className="px-3 py-2">Notif</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Summary</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((t) => (
                <tr
                  key={t.id}
                  className={`border-t border-slate-100 ${t.unread_for_admin ? "font-semibold" : ""}`}
                >
                  <td className="px-3 py-2">
                    <Link href={`/admin/support/${t.id}`} className="text-blue-600 hover:underline">
                      {t.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2">{t.status}</td>
                  <td className="px-3 py-2">{t.escalation_reason}</td>
                  <td className="px-3 py-2" title={t.tour_slug ?? ""}>{t.tour_slug ?? "—"}</td>
                  <td className="px-3 py-2">{t.page_title ?? "—"}</td>
                  <td className="px-3 py-2">{t.user_locale ?? "—"}</td>
                  <td className="px-3 py-2">{t.telegram_notified ? "✓" : "—"}</td>
                  <td className="px-3 py-2 text-slate-500">
                    {new Date(t.updated_at).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 text-slate-600">
                    {(t.initial_summary ?? "").slice(0, 80)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
