"use client";

import { Info, Sparkles } from "lucide-react";
import { useTranslations } from "@/lib/i18n";
import type {
  PriceLine,
  PriceResult,
} from "@/lib/quote-engine/pricing-policy";

interface Props {
  price: PriceResult;
  /** Jeju gets an extra "single region only" notice (§6). */
  isJeju: boolean;
  /** Compact variant — drops the eyebrow and bottom note for embedding inside
   *  the QuoteModal where the eyebrow is already in the modal hero. */
  compact?: boolean;
}

const KRW = (n: number) => `₩${n.toLocaleString()}`;

/**
 * Always-visible live-price card for the unified planner (Phase 10.3 D17/D24).
 *
 * Extracted verbatim from `QuoteModal.tsx` lines 363-408 so that the planner
 * shell + the booking modal render the SAME price strip and i18n keys —
 * single source of truth for price presentation. The price object itself is
 * computed once in `BuilderShell` via the Phase 9 `pricing-policy.quote()`
 * module and passed in as a prop.
 */
export default function LivePriceCard({ price, isJeju, compact = false }: Props) {
  const t = useTranslations("itineraryBuilder.quote");

  function lineLabel(line: PriceLine): string {
    const meta = line.meta ?? {};
    switch (line.code) {
      case "base":
        return t("pricing.lines.base", { hours: Number(meta.hours ?? price.inputs.durationHours) });
      case "pax_tier":
        if (meta.vehicle === "van") return t("pricing.lines.van");
        return meta.peak ? t("pricing.lines.solatiPeak") : t("pricing.lines.solati");
      case "region":
        return t("pricing.lines.region");
      case "jeju_cross_region":
        return t("pricing.lines.jejuCrossRegion");
      case "jeju_pickup":
        return t("pricing.lines.jejuPickup", {
          zone: t(`pricing.pickupZones.${meta.zone ?? "city"}`),
        });
      case "dmz_base":
        return t("pricing.lines.dmzBase", { pax: Number(meta.pax ?? price.inputs.pax) });
      case "cruise_excursion":
        return t("pricing.lines.cruiseExcursion");
      case "gangjeong_port":
        return t("pricing.lines.gangjeongPort");
      default:
        return line.code;
    }
  }

  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-card border border-amber-200/80 bg-gradient-to-br from-amber-50/80 via-white to-amber-50/40 p-4 shadow-[0_1px_2px_rgba(245,158,11,0.06),0_12px_28px_-18px_rgba(245,158,11,0.30)]">
        {/* Premium hairline rail at the top echoes the AIRecommendPanel
            accent above — unified card-style language. */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-300/80 to-transparent"
        />
        {!compact ? (
          <p className="mb-2.5 inline-flex items-center gap-1.5 text-eyebrow !text-amber-800">
            <Sparkles className="h-3 w-3" aria-hidden />
            {t("pricing.title")}
          </p>
        ) : null}
        {price.autoQuotable ? (
          <>
            <ul className="space-y-1.5">
              {price.lines.map((line) => (
                <li
                  key={line.code}
                  className="flex items-baseline justify-between gap-3 text-caption"
                >
                  <span className="text-slate-600">{lineLabel(line)}</span>
                  <span className="font-semibold text-slate-800 tabular-nums">
                    {KRW(line.amount)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex items-baseline justify-between border-t border-amber-200/80 pt-3">
              <span className="text-caption font-bold tracking-tight text-slate-900">
                {t("pricing.total")}
              </span>
              <span className="text-h3 font-bold tabular-nums text-slate-900">
                {KRW(price.total)}
              </span>
            </div>
            {!compact ? (
              <p className="mt-1.5 text-micro leading-relaxed text-slate-500">
                {t("pricing.estimateNote")}
              </p>
            ) : null}
          </>
        ) : (
          <div className="flex items-start gap-2">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-700" aria-hidden />
            <div>
              <p className="text-caption font-bold text-slate-800">
                {t("pricing.manualTitle")}
              </p>
              <p className="mt-0.5 text-micro text-slate-600">
                {t("pricing.manualNote")}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Not-included + Jeju single-region notices (§5, §6 of pricing policy)
          — soft callouts inside a white card with a hairline ring, echoing
          the rest of the rail's white-on-amber composition. */}
      <div className="space-y-2 rounded-card border border-slate-200/70 bg-white px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.03)]">
        <p className="flex items-start gap-1.5 text-micro leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" aria-hidden />
          {t("pricing.notIncluded")}
        </p>
        {isJeju ? (
          <p className="flex items-start gap-1.5 text-micro leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-amber-500" aria-hidden />
            {t("pricing.jejuSingleRegion")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
