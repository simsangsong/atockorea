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
      {/* Phase 11 D29 — near-white mint surface + glow ring */}
      <div className="rounded-card bg-emerald-50/30 ring-1 ring-emerald-100/40 p-4 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_22px_50px_-20px_rgba(15,23,42,0.20),inset_0_1px_0_rgba(255,255,255,0.9)] transition-shadow duration-300 ease-out hover:shadow-[0_4px_14px_rgba(15,23,42,0.06),0_30px_64px_-20px_rgba(15,23,42,0.26),inset_0_1px_0_rgba(255,255,255,0.95)]">
        {!compact ? (
          <p className="mb-2.5 inline-flex items-center gap-1.5 text-eyebrow text-slate-500">
            <Sparkles className="h-3 w-3 text-emerald-600" aria-hidden />
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
            <div className="mt-3 flex items-baseline justify-between border-t border-emerald-200/40 pt-3">
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
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-500" aria-hidden />
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
          — borderless mint card matching the price card above. Floats on the
          stone-50 page background; no amber accents (user direction 2026-05-29).
          Phase 11 D29 — near-white shade + glow ring. */}
      <div className="space-y-2 rounded-card bg-emerald-50/25 ring-1 ring-emerald-100/40 px-3.5 py-3 shadow-[0_1px_4px_rgba(15,23,42,0.04),0_12px_30px_-18px_rgba(15,23,42,0.14),inset_0_1px_0_rgba(255,255,255,0.9)]">
        <p className="flex items-start gap-1.5 text-micro leading-relaxed text-slate-600">
          <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" aria-hidden />
          {t("pricing.notIncluded")}
        </p>
        {isJeju ? (
          <p className="flex items-start gap-1.5 text-micro leading-relaxed text-slate-600">
            <Info className="mt-0.5 h-3 w-3 flex-shrink-0 text-slate-400" aria-hidden />
            {t("pricing.jejuSingleRegion")}
          </p>
        ) : null}
      </div>
    </div>
  );
}
