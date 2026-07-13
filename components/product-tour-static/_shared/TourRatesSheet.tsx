"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { EastSignatureNatureCoreDetailViewModel } from "@/components/product-tour-static/east-signature-nature-core/eastSignatureNatureCoreDetailViewModel";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import { cn } from "@/lib/utils";

export type TourRatesSheetProps = {
  open: boolean;
  onClose: () => void;
  pricingTiers: NonNullable<EastSignatureNatureCoreDetailViewModel["pricingTiers"]>;
  sectionUi?: TourProductSectionUiV1;
};

/**
 * The single rate-card surface (§F-8 grammar ② — reference tables live in a
 * sheet, opened from the fixed price entry points). Bottom sheet on mobile,
 * centered modal on sm+. The table stays mounted (visibility-hidden when
 * closed) so the full rate matrix survives the DOM round-trip check, and the
 * open/close animation is pure CSS — no new motion library work.
 */
export function TourRatesSheet({ open, onClose, pricingTiers, sectionUi }: TourRatesSheetProps) {
  const title = sectionUi?.ratesSheetTitle ?? "Rate card";
  const groupSizeLabel = sectionUi?.ratesGroupSizeLabel ?? "Group size";
  const priceLabel = sectionUi?.ratesPriceLabel ?? "Price";
  const perUnitLabel = (sectionUi?.ratesPerUnitTemplate ?? "Per {unit}").replace(
    "{unit}",
    pricingTiers.unit,
  );
  const availabilityNote =
    sectionUi?.ratesAvailabilityNote ?? "Pick a date and group size to confirm the live total.";

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn("fixed inset-0 z-[70]", open ? "" : "pointer-events-none")}
    >
      <div
        role="presentation"
        onClick={onClose}
        className={cn(
          "absolute inset-0 bg-black/25 backdrop-blur-[2px] transition-[opacity,visibility] duration-[250ms]",
          open ? "opacity-100" : "invisible opacity-0",
        )}
      />
      <div className="absolute inset-x-0 bottom-0 sm:inset-0 sm:flex sm:items-center sm:justify-center sm:p-6 pointer-events-none">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className={cn(
            "pointer-events-auto w-full rounded-t-3xl bg-white shadow-[0_-16px_48px_rgba(26,35,50,0.16)] sm:max-w-lg sm:rounded-3xl sm:shadow-[0_24px_64px_rgba(26,35,50,0.22)]",
            "transition-[transform,opacity,visibility] duration-[280ms] ease-[cubic-bezier(0.16,1,0.3,1)]",
            open ? "translate-y-0 opacity-100" : "invisible translate-y-full opacity-0 sm:translate-y-4",
          )}
        >
          <div className="flex max-h-[min(72vh,560px)] flex-col overflow-hidden rounded-t-3xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-2 border-b border-border/60 px-4 pb-3 pt-4 sm:px-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {perUnitLabel}
                </p>
                <h2 className="text-sm font-semibold text-foreground">{title}</h2>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                aria-label="Close"
              >
                <X className="h-4 w-4" strokeWidth={2} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3 sm:px-5 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
              <div className="overflow-x-auto rounded-xl border border-slate-200/70 scrollbar-none">
                <table className="w-full min-w-max text-[13px]">
                  <thead className="bg-slate-100/70 text-[10.5px] uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">{groupSizeLabel}</th>
                      {pricingTiers.durations.map((d) => (
                        <th key={d} className="px-3 py-2 text-right font-semibold">
                          {pricingTiers.durations.length === 1 ? priceLabel : d}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {pricingTiers.tiers.map((tr) => (
                      <tr key={tr.paxLabel} className="border-t border-slate-100">
                        <td className="px-3 py-2 font-medium text-foreground">{tr.paxLabel}</td>
                        {pricingTiers.durations.map((d) => {
                          const v = tr.prices[d];
                          return (
                            <td key={d} className="px-3 py-2 text-right tabular-nums text-foreground">
                              {typeof v === "number" ? `$${v}` : "—"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pricingTiers.extraPerPaxAbove ? (
                <p className="mt-2 text-[11.5px] text-muted-foreground">
                  {(sectionUi?.ratesExtraPaxTemplate ?? "{pax}+ guests: +${amount} per extra guest")
                    .replace("{pax}", String(pricingTiers.extraPerPaxAbove.anchorPax + 1))
                    .replace("{amount}", String(pricingTiers.extraPerPaxAbove.perPaxAdd))}
                </p>
              ) : null}
              <p className="mt-2 text-[11.5px] text-muted-foreground">{availabilityNote}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
