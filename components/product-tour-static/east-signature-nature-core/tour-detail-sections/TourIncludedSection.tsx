"use client";

import { useState } from "react";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticalAccordionItem } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

export type TourIncludedSectionProps = {
  practicalAccordionItems: readonly PracticalAccordionItem[];
  sectionUi: TourProductSectionUiV1;
};

// Matches opening "not included" / "excluded" markers in EN · KO · ZH · ZH-TW · JA · ES
// Matches "not included" openers in EN · KO · ZH · ZH-TW · JA · ES
const NOT_INCLUDED_RX =
  /^(not included|excluded|excludes|not include|excl\.|does not include|불포함|미포함|不含|不包含|费用不含|含まれないもの|no incluye|no incluido|excluido)/i;

export function TourIncludedSection({ practicalAccordionItems }: TourIncludedSectionProps) {
  const [open, setOpen] = useState(false);

  const item = practicalAccordionItems.find(
    (i) => i.variant === "included" || i.id === "inclusions",
  );
  if (!item || !item.content?.length) return null;

  let includedItems: readonly string[];
  let excludedItems: readonly string[];

  if (item.variant === "included") {
    const splitAt = item.includedCount ?? 5;
    includedItems = item.content.slice(0, splitAt);
    excludedItems = item.content.slice(splitAt);
  } else {
    includedItems = item.content.filter((c) => !NOT_INCLUDED_RX.test(c.trim()));
    excludedItems = item.content.filter((c) => NOT_INCLUDED_RX.test(c.trim()));
  }

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

      {/* Sprint 2.6: emerald/rose wash 카드 → white card + semantic icon color only (§8.8 Apple/Klook 패턴) */}
      <div
        className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]"
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors hover:bg-slate-50"
        >
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              {item.title ?? "What's Included"}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              {includedItems.length} included · {excludedItems.length} not included
            </p>
          </div>
          <div
            className={cn(
              "flex-shrink-0 rounded-full p-1.5 transition-[transform,background-color] duration-200",
              open ? "rotate-180 bg-slate-100" : "bg-slate-100/60",
            )}
          >
            <ChevronDown
              className={cn("h-3.5 w-3.5 transition-colors", open ? "text-foreground" : "text-muted-foreground")}
              strokeWidth={2}
            />
          </div>
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            {/* Included — semantic green icon only (§2.1 success token) */}
            <div className="border-t border-slate-200/70 bg-white px-4 pt-4 pb-3 sm:px-5">
              <div className="mb-3 flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-soft-bg)] ring-1 ring-[var(--success)]/20">
                  <Check className="h-3 w-3 text-[var(--success)]" strokeWidth={2.5} />
                </span>
                <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[var(--success-soft-text)]">
                  Included
                </p>
              </div>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {includedItems.map((line, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/70"
                  >
                    <Check className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                    <span className="text-[13px] leading-snug text-foreground">{line}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Not included — semantic red icon only (§2.1 danger token) */}
            {excludedItems.length > 0 && (
              <div className="border-t border-slate-200/55 bg-white px-4 py-4 sm:px-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger-soft-bg)] ring-1 ring-[var(--danger)]/20">
                    <X className="h-3 w-3 text-[var(--danger)]" strokeWidth={2.5} />
                  </span>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.10em] text-[var(--danger-soft-text)]">
                    Not included
                  </p>
                </div>
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {excludedItems.map((line, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/60"
                    >
                      <X className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-[var(--danger)]/70" strokeWidth={2.5} />
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
