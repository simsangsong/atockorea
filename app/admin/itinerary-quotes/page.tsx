import Link from "next/link";
import { createServerClient } from "@/lib/supabase";

interface QuoteListItem {
  id: string;
  status: string;
  region: string;
  track: string;
  party_size: number | null;
  contact_name: string | null;
  contact_email: string;
  poi_keys: string[];
  auto_quote_amount_krw: number | null;
  manual_quote_amount_krw: number | null;
  precedent_quote_id: string | null;
  created_at: string;
}

const STATUS_BADGE: Record<string, string> = {
  pending_manual: "bg-amber-100 text-amber-800",
  auto_quoted: "bg-emerald-100 text-emerald-800",
  responded: "bg-sky-100 text-sky-800",
  closed: "bg-slate-100 text-slate-600",
  cancelled: "bg-rose-100 text-rose-700",
};

export const dynamic = "force-dynamic";

export default async function AdminItineraryQuotesPage() {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tour_quote_requests")
    .select(
      "id, status, region, track, party_size, contact_name, contact_email, poi_keys, auto_quote_amount_krw, manual_quote_amount_krw, precedent_quote_id, created_at"
    )
    .order("created_at", { ascending: false })
    .limit(100);

  const rows = (data ?? []) as QuoteListItem[];

  return (
    <div className="p-6">
      <header className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Itinerary Quote Requests</h1>
          <p className="text-sm text-slate-500">
            Custom itinerary builder submissions. Pending-manual rows need your reply; auto-quoted ones already emailed a price.
          </p>
        </div>
      </header>

      {error ? (
        <p className="rounded-md bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-rose-200">
          Failed to load: {error.message}
        </p>
      ) : rows.length === 0 ? (
        <p className="rounded-md bg-slate-50 px-4 py-3 text-sm text-slate-600">No quote requests yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Created</th>
                <th className="px-4 py-3">Region / Track</th>
                <th className="px-4 py-3">Pax</th>
                <th className="px-4 py-3">Contact</th>
                <th className="px-4 py-3">Stops</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => {
                const amt = r.manual_quote_amount_krw ?? r.auto_quote_amount_krw;
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(r.created_at).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-900">
                      {r.region} <span className="text-slate-400">/</span> {r.track}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.party_size ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="text-slate-900">{r.contact_name ?? "—"}</div>
                      <div className="text-xs text-slate-500">{r.contact_email}</div>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{r.poi_keys.length}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold ${STATUS_BADGE[r.status] ?? "bg-slate-100 text-slate-600"}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">
                      {amt ? `₩${amt.toLocaleString()}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/admin/itinerary-quotes/${r.id}`}
                        className="rounded-md bg-slate-900 px-3 py-1 text-xs font-bold text-white hover:bg-slate-800"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
