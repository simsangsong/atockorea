"use client";

import { useState } from "react";
import { Check, ChevronDown, Package, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticalAccordionItem } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

export type TourIncludedSectionProps = {
  practicalAccordionItems: readonly PracticalAccordionItem[];
  sectionUi: TourProductSectionUiV1;
};

export function TourIncludedSection({ practicalAccordionItems }: TourIncludedSectionProps) {
  const [open, setOpen] = useState(false);

  const item = practicalAccordionItems.find((i) => i.variant === "included");
  if (!item || !item.content?.length) return null;

  const splitAt = item.includedCount ?? 5;
  const includedItems = item.content.slice(0, splitAt);
  const excludedItems = item.content.slice(splitAt);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {item.title ?? "What's Included"}
        </h2>
        {item.preview && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.preview}</p>
        )}
      </div>

      <div
        className={cn(
          "overflow-hidden rounded-2xl",
          "ring-1 ring-emerald-900/[0.10]",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.14)]",
        )}
      >
        {/* ── Header / trigger ── */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="group flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left"
          style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <Package className="h-4 w-4 flex-shrink-0 text-white/90" strokeWidth={1.8} />
            <span className="text-[12.5px] font-semibold tracking-wide text-white truncate">
              Tour Package Contents
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="rounded-full bg-white/20 px-2 py-0.5 text-[10.5px] font-semibold text-white">
              {includedItems.length} included
            </span>
            <ChevronDown
              className={cn(
                "h-4 w-4 text-white/80 transition-transform duration-300",
                open && "rotate-180",
              )}
              strokeWidth={2}
            />
          </div>
        </button>

        {/* ── Collapsible content ── */}
        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            {/* Included items */}
            <div className="bg-white px-5 pt-4 pb-3">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-100 ring-1 ring-emerald-200/60">
                  <Check className="h-3 w-3 text-emerald-600" strokeWidth={2.5} />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-emerald-700">
                  Included
                </p>
              </div>
              <ul className="space-y-2.5">
                {includedItems.map((line, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <Check className="mt-[3px] h-3.5 w-3.5 flex-shrink-0 text-emerald-500" strokeWidth={2.5} />
                    <span className="text-[13px] leading-snug text-foreground">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not-included */}
            {excludedItems.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-rose-50 ring-1 ring-rose-200/60">
                    <X className="h-3 w-3 text-rose-500" strokeWidth={2.5} />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-rose-600/80">
                    Not included
                  </p>
                </div>
                <ul className="space-y-2.5">
                  {excludedItems.map((line, i) => (
                    <li key={i} className="flex items-start gap-2.5">
                      <X className="mt-[3px] h-3.5 w-3.5 flex-shrink-0 text-rose-400/70" strokeWidth={2.5} />
                      <span className="text-[13px] leading-snug text-muted-foreground">{line}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
