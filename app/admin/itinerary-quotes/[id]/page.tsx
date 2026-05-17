import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerClient } from "@/lib/supabase";
import AdminQuoteRespondForm from "@/components/admin/itinerary-quotes/AdminQuoteRespondForm";

interface QuoteRow {
  id: string;
  status: string;
  region: string;
  track: "private" | "cruise";
  party_size: number | null;
  requested_date: string | null;
  contact_name: string | null;
  contact_email: string;
  language: string | null;
  notes: string | null;
  locale: string | null;
  intake: Record<string, unknown>;
  poi_keys: string[];
  auto_quote_amount_krw: number | null;
  auto_quote_breakdown: Record<string, unknown> | null;
  manual_quote_amount_krw: number | null;
  manual_quote_response: Record<string, unknown> | null;
  manual_responded_at: string | null;
  precedent_quote_id: string | null;
  source_url: string | null;
  created_at: string;
}

interface PrecedentRow {
  id: string;
  manual_amount_krw: number;
  notes: string | null;
  created_at: string;
}

export const dynamic = "force-dynamic";

export default async function AdminQuoteDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

  const supabase = createServerClient();
  const { data: quote, error } = await supabase
    .from("tour_quote_requests")
    .select(
      "id, status, region, track, party_size, requested_date, contact_name, contact_email, language, notes, locale, intake, poi_keys, auto_quote_amount_krw, auto_quote_breakdown, manual_quote_amount_krw, manual_quote_response, manual_responded_at, precedent_quote_id, source_url, created_at"
    )
    .eq("id", id)
    .maybeSingle();
  if (error || !quote) notFound();
  const q = quote as QuoteRow;

  // POI names
  const { data: poiRows } = await supabase
    .from("match_pois")
    .select("poi_key, name_en, name_ko")
    .in("poi_key", q.poi_keys);
  const nameByKey = new Map(
    (poiRows ?? []).map((r) => [
      r.poi_key as string,
      { en: r.name_en as string, ko: r.name_ko as string | null },
    ])
  );

  // Precedent (if any)
  let precedent: PrecedentRow | null = null;
  if (q.precedent_quote_id) {
    const { data: precedentRow } = await supabase
      .from("quote_memory")
      .select("id, manual_amount_krw, notes, created_at")
      .eq("id", q.precedent_quote_id)
      .maybeSingle();
    precedent = (precedentRow as PrecedentRow | null) ?? null;
  }

  const readonly = q.status === "responded" || q.status === "closed" || q.status === "cancelled";

  return (
    <div className="p-6">
      <div className="mb-4 text-sm">
        <Link href="/admin/itinerary-quotes" className="text-slate-500 hover:text-slate-900">
          ← All quote requests
        </Link>
      </div>

      <header className="mb-6">
        <h1 className="text-xl font-bold text-slate-900">
          {q.region} / {q.track}{" "}
          <span className="text-sm font-normal text-slate-500">
            · {new Date(q.created_at).toLocaleString()}
          </span>
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          ID: <code className="rounded bg-slate-100 px-1.5 py-0.5">{q.id}</code> · status:{" "}
          <span className="font-semibold text-slate-700">{q.status}</span>
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Left: request details */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Request details
          </h2>
          <dl className="space-y-2 text-sm">
            <Field label="Contact" value={`${q.contact_name ?? "—"} <${q.contact_email}>`} />
            <Field label="Party size" value={q.party_size?.toString() ?? "—"} />
            <Field label="Requested date" value={q.requested_date ?? "—"} />
            <Field label="Language" value={q.language ?? "—"} />
            <Field label="Locale" value={q.locale ?? "—"} />
            {q.intake.hours ? <Field label="Hours" value={String(q.intake.hours)} /> : null}
            {q.intake.ship ? <Field label="Ship" value={String(q.intake.ship)} /> : null}
            {q.notes ? <Field label="Notes" value={q.notes} /> : null}
            {q.source_url ? (
              <Field
                label="Source URL"
                value={
                  <a href={q.source_url} className="text-amber-700 underline">
                    Open in builder
                  </a>
                }
              />
            ) : null}
          </dl>
        </section>

        {/* Right: stops + auto-quote (if any) */}
        <section className="rounded-lg border border-slate-200 bg-white p-5">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
            Stops ({q.poi_keys.length})
          </h2>
          <ol className="space-y-1 text-sm text-slate-700">
            {q.poi_keys.map((k, i) => {
              const n = nameByKey.get(k);
              return (
                <li key={k} className="flex items-baseline gap-2">
                  <span className="text-slate-400">{i + 1}.</span>
                  <span>
                    {n?.en ?? k}{" "}
                    {n?.ko ? <span className="text-xs text-slate-500">({n.ko})</span> : null}
                  </span>
                </li>
              );
            })}
          </ol>
          {q.auto_quote_amount_krw != null ? (
            <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-800 ring-1 ring-emerald-100">
              <strong>Auto-quoted:</strong> ₩{q.auto_quote_amount_krw.toLocaleString()}
            </div>
          ) : null}
          {precedent ? (
            <div className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-xs text-sky-800 ring-1 ring-sky-100">
              <strong>Precedent:</strong> ~₩{precedent.manual_amount_krw.toLocaleString()} ·{" "}
              {new Date(precedent.created_at).toLocaleDateString()}
              {precedent.notes ? ` · ${precedent.notes}` : ""}
            </div>
          ) : null}
        </section>
      </div>

      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
          {readonly ? "Response" : "Send manual response"}
        </h2>
        {readonly ? (
          <div className="space-y-2 text-sm text-slate-700">
            <p>
              <strong>Amount:</strong> ₩{q.manual_quote_amount_krw?.toLocaleString() ?? "—"}
            </p>
            <p className="text-xs text-slate-500">
              Responded at {q.manual_responded_at ? new Date(q.manual_responded_at).toLocaleString() : "—"}
            </p>
            {q.manual_quote_response ? (
              <pre className="overflow-x-auto rounded bg-slate-50 p-3 text-xs">
                {JSON.stringify(q.manual_quote_response, null, 2)}
              </pre>
            ) : null}
          </div>
        ) : (
          <AdminQuoteRespondForm quoteId={q.id} />
        )}
      </section>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className="w-32 flex-shrink-0 text-xs font-semibold uppercase tracking-wide text-slate-500">
        {label}
      </dt>
      <dd className="text-slate-900">{value}</dd>
    </div>
  );
}
