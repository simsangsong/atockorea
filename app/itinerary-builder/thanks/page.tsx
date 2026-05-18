import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Mail, Clock, Coins, Search, Send } from "lucide-react";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import { createServerClient } from "@/lib/supabase";

export const metadata: Metadata = {
  title: "Itinerary request received | AtoC Korea",
  description: "We've got your custom itinerary request — auto-quote or manual response within 24 hours.",
};

interface QuoteRow {
  id: string;
  status: "auto_quoted" | "pending_manual" | "responded" | "closed" | "cancelled";
  auto_quote_amount_krw: number | null;
  auto_quote_breakdown: Record<string, unknown> | null;
  region: string;
  track: "private" | "cruise";
}

async function loadQuote(quoteId: string): Promise<QuoteRow | null> {
  if (!/^[0-9a-f-]{36}$/i.test(quoteId)) return null;
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("tour_quote_requests")
    .select("id, status, auto_quote_amount_krw, auto_quote_breakdown, region, track")
    .eq("id", quoteId)
    .maybeSingle();
  if (error) {
    console.error("[thanks/loadQuote]", error);
    return null;
  }
  return (data as QuoteRow | null) ?? null;
}

function fmtKrw(n: number): string {
  return `₩${n.toLocaleString()}`;
}

function BreakdownRows({ breakdown }: { breakdown: Record<string, unknown> }) {
  const get = (k: string) => (typeof breakdown[k] === "number" ? (breakdown[k] as number) : 0);
  const rows: { label: string; value: number }[] = [];
  rows.push({ label: "Base", value: get("base_krw") });
  if (get("vehicle_tier_krw") > 0) {
    const lbl = typeof breakdown.vehicle_tier_label === "string" ? (breakdown.vehicle_tier_label as string) : "Vehicle";
    rows.push({ label: `Vehicle (${lbl})`, value: get("vehicle_tier_krw") });
  }
  if (get("duration_surcharge_krw") > 0)
    rows.push({ label: "Extra hours", value: get("duration_surcharge_krw") });
  if (get("distance_surcharge_krw") > 0)
    rows.push({ label: "Extra distance", value: get("distance_surcharge_krw") });
  if (get("poi_surcharge_krw") > 0)
    rows.push({ label: "Extra stops", value: get("poi_surcharge_krw") });
  if (get("language_premium_krw") > 0) {
    const lang = typeof breakdown.language === "string" ? breakdown.language : "";
    rows.push({ label: `Language premium (${lang})`, value: get("language_premium_krw") });
  }
  const total = get("total_krw");
  return (
    <dl className="space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-baseline justify-between text-body">
          <dt className="text-slate-600">{r.label}</dt>
          <dd className="font-semibold text-slate-900">{fmtKrw(r.value)}</dd>
        </div>
      ))}
      <div className="flex items-baseline justify-between border-t border-amber-200 pt-2 text-h3">
        <dt className="font-bold text-slate-900">Total</dt>
        <dd className="font-bold text-amber-700">{fmtKrw(total)}</dd>
      </div>
    </dl>
  );
}

export default async function ItineraryBuilderThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ quote_id?: string }>;
}) {
  const { quote_id } = await searchParams;
  const quote = quote_id ? await loadQuote(quote_id) : null;

  const isAuto = quote?.status === "auto_quoted" && quote.auto_quote_amount_krw != null;
  const breakdown = quote?.auto_quote_breakdown ?? null;

  return (
    <SitePageShell>
      <main className="min-h-screen bg-slate-50">
        <section className="section-py-sm px-4 md:px-6">
          <div className="mx-auto max-w-xl">
            {isAuto ? (
              <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-7 py-7 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/95">
                    <Coins className="h-6 w-6 text-slate-900" aria-hidden />
                  </div>
                  <p className="mb-1 text-eyebrow text-amber-300">Your quote is ready</p>
                  <h1 className="text-display text-white">
                    {fmtKrw(quote!.auto_quote_amount_krw as number)}
                  </h1>
                  <p className="mt-2 text-body text-slate-300">
                    Auto-priced from your selected stops + duration. Reply to the confirmation email to book.
                  </p>
                </div>
                <div className="px-7 py-6">
                  {breakdown ? (
                    <div className="rounded-lg bg-amber-50/60 px-5 py-4 ring-1 ring-amber-100">
                      <p className="mb-2 text-eyebrow text-amber-800">Breakdown</p>
                      <BreakdownRows breakdown={breakdown} />
                    </div>
                  ) : null}
                  <ul className="mt-5 space-y-2 text-body text-slate-700">
                    <li className="flex items-start gap-3">
                      <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
                      <span>Confirmation email sent with full breakdown.</span>
                    </li>
                    <li className="flex items-start gap-3">
                      <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
                      <span>Quote held for 7 days. Reply by email to confirm + receive a booking link.</span>
                    </li>
                  </ul>
                  {quote_id ? (
                    <p className="mt-5 text-micro text-slate-400">
                      Reference: <code className="rounded bg-slate-100 px-1.5 py-0.5">{quote_id}</code>
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
                    <Link
                      href="/itinerary-builder"
                      className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-caption font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                    >
                      Plan another day
                    </Link>
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-caption font-bold text-white hover:bg-slate-800"
                    >
                      Back to home
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
                {/* V2 Phase 10 — pending variant now mirrors the auto-quoted
                    hero (slate→amber dark gradient) so both branches of the
                    thanks page feel equally premium. Resolves audit §J.15. */}
                <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-7 pt-7 pb-7 text-center md:px-10 md:pt-9 md:pb-8">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/95">
                    <Clock className="h-6 w-6 text-slate-900" aria-hidden />
                  </div>
                  <p className="mb-1 text-eyebrow text-amber-300">Itinerary request received</p>
                  <h1 className="text-display text-white">
                    We&apos;ll come back within 24h
                  </h1>
                  <p className="mx-auto mt-2 max-w-md text-body text-slate-300">
                    Your request is a bit outside our auto-quote range. Our team is reviewing and will reply by
                    email with a custom price.
                  </p>
                </div>
                {/* Status timeline — Submitted ✓ / Reviewing 🕒 / Quote sent */}
                <div className="px-7 pt-5 md:px-10 md:pt-6">
                  <ol className="grid grid-cols-3 gap-2 text-center">
                    <li className="flex flex-col items-center gap-1.5">
                      <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-[12px] font-bold text-white shadow-[0_0_0_3px_rgba(251,191,36,0.18)]">✓</span>
                      <span className="text-micro font-semibold text-slate-900">Submitted</span>
                    </li>
                    <li className="flex flex-col items-center gap-1.5">
                      <span aria-hidden className="flex h-7 w-7 animate-pulse items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                        <Clock className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="text-micro font-semibold text-slate-700">Reviewing</span>
                    </li>
                    <li className="flex flex-col items-center gap-1.5">
                      <span aria-hidden className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[12px] font-bold text-slate-400 ring-1 ring-slate-200">3</span>
                      <span className="text-micro font-semibold text-slate-400">Quote sent</span>
                    </li>
                  </ol>
                  <div className="mx-auto mt-3 h-0.5 max-w-[80%] bg-gradient-to-r from-amber-500 via-slate-300 to-slate-200" aria-hidden />
                </div>
                <div className="px-7 py-6 md:px-10">
                  <p className="mb-3 text-eyebrow !text-slate-500">What happens next?</p>
                  <ol className="space-y-3">
                    <li className="flex items-start gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-caption font-bold text-amber-800">
                        1
                      </span>
                      <div className="min-w-0">
                        <p className="text-caption font-bold text-slate-900">Confirmation email sent</p>
                        <p className="text-micro text-slate-500">
                          Check spam if you don&apos;t see it in a few minutes.
                        </p>
                      </div>
                      <Mail className="ml-auto mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
                    </li>
                    <li className="flex items-start gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-caption font-bold text-amber-800">
                        2
                      </span>
                      <div className="min-w-0">
                        <p className="text-caption font-bold text-slate-900">Our team reviews your route</p>
                        <p className="text-micro text-slate-500">
                          We check logistics, pickup, and timing for your party size.
                        </p>
                      </div>
                      <Search className="ml-auto mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
                    </li>
                    <li className="flex items-start gap-3 rounded-lg bg-slate-50 px-3.5 py-2.5 ring-1 ring-slate-100">
                      <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-amber-100 text-caption font-bold text-amber-800">
                        3
                      </span>
                      <div className="min-w-0">
                        <p className="text-caption font-bold text-slate-900">Personalized quote by email</p>
                        <p className="text-micro text-slate-500">
                          Reply to adjust party size, date, or stops anytime.
                        </p>
                      </div>
                      <Send className="ml-auto mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
                    </li>
                  </ol>
                  {quote_id ? (
                    <p className="mt-5 text-micro text-slate-400">
                      Reference: <code className="rounded bg-slate-100 px-1.5 py-0.5">{quote_id}</code>
                    </p>
                  ) : null}
                  <div className="mt-6 flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
                    <Link
                      href="/"
                      className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-caption font-bold text-white transition-colors hover:bg-slate-800"
                    >
                      Back to home
                    </Link>
                    <Link
                      href="/itinerary-builder"
                      className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-caption font-bold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                    >
                      Plan another day
                    </Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>
      </main>
    </SitePageShell>
  );
}
