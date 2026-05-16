import Link from "next/link";
import type { Metadata } from "next";
import { CheckCircle2, Mail, Clock } from "lucide-react";
import { SitePageShell } from "@/src/components/layout/SitePageShell";

export const metadata: Metadata = {
  title: "Itinerary request received | AtoC Korea",
  description: "We've got your custom itinerary request — we'll respond within 24 hours.",
};

export default async function ItineraryBuilderThanksPage({
  searchParams,
}: {
  searchParams: Promise<{ quote_id?: string }>;
}) {
  const { quote_id } = await searchParams;

  return (
    <SitePageShell>
      <main className="min-h-screen bg-slate-50">
        <section className="px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16">
          <div className="mx-auto max-w-xl">
            <div className="rounded-2xl bg-white p-7 text-center shadow-md ring-1 ring-slate-200 md:p-10">
              <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" aria-hidden />
              </div>
              <p className="mb-2 text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
                Itinerary request received
              </p>
              <h1 className="mb-3 text-2xl font-bold text-slate-900 md:text-3xl">
                We&apos;ll respond within 24 hours
              </h1>
              <p className="mx-auto mb-6 max-w-md text-sm text-slate-600">
                Our team is reviewing your stops + logistics. A custom quote will land in your inbox
                within the next 24 hours (often faster for cruise dates).
              </p>

              <ul className="mx-auto mb-6 max-w-sm space-y-3 text-left text-sm text-slate-700">
                <li className="flex items-start gap-3">
                  <Mail className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
                  <span>Confirmation email sent — check spam if you don&apos;t see it.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Clock className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
                  <span>Reply to that email to tweak anything — party size, date, or stops.</span>
                </li>
              </ul>

              {quote_id ? (
                <p className="mb-6 text-[11px] text-slate-400">
                  Reference: <code className="rounded bg-slate-100 px-1.5 py-0.5">{quote_id}</code>
                </p>
              ) : null}

              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-center">
                <Link
                  href="/"
                  className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-slate-800"
                >
                  Back to home
                </Link>
                <Link
                  href="/itinerary-builder"
                  className="inline-flex items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-50"
                >
                  Plan another day
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>
    </SitePageShell>
  );
}
