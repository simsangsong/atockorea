"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import type { PracticalAccordionItem } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

export type TourIncludedSectionProps = {
  practicalAccordionItems: readonly PracticalAccordionItem[];
  sectionUi: TourProductSectionUiV1;
};

// Matches opening "not included" / "excluded" markers in EN · KO · ZH · ZH-TW · JA · ES
const NOT_INCLUDED_RX =
  /^(not included|excluded|excludes|not include|excl\.|does not include|불포함|미포함|不含|不包含|费用不含|含まれないもの|no incluye|no incluido|excluido)/i;

const VISIBLE_LIMIT = 5;

export function TourIncludedSection({ practicalAccordionItems }: TourIncludedSectionProps) {
  /**
   * Sprint 3.3: accordion 해제 → 5개 always visible + Show all link (§8.8 Klook 표준).
   * Excluded list는 항상 노출 (보통 ≤5 항목).
   */
  const [showAll, setShowAll] = useState(false);

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

  const overflow = includedItems.length > VISIBLE_LIMIT;
  const visibleIncluded = showAll || !overflow ? includedItems : includedItems.slice(0, VISIBLE_LIMIT);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title text-foreground">
          {item.title ?? "What's Included"}
        </h2>
        {item.preview && (
          <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.preview}</p>
        )}
      </div>

      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        <div className="px-5 py-4">
          <p className="text-[15px] font-semibold tracking-tight text-foreground">
            {item.title ?? "What's Included"}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            {includedItems.length} included · {excludedItems.length} not included
          </p>
        </div>

        {/* Included — semantic green icon only */}
        <div className="border-t border-slate-200/70 bg-white px-4 pt-4 pb-3 sm:px-5">
          <div className="mb-3 flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-soft-bg)] ring-1 ring-[var(--success)]/20">
              <Check className="h-3 w-3 text-[var(--success)]" strokeWidth={2.5} />
            </span>
            <p className="text-eyebrow text-[var(--success-soft-text)]">
              Included
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {visibleIncluded.map((line, i) => (
              <li
                key={i}
                className="flex items-start gap-2.5 rounded-xl bg-white px-3 py-2.5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] ring-1 ring-slate-200/70"
              >
                <Check className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-[var(--success)]" strokeWidth={2.5} />
                <span className="text-[13px] leading-snug text-foreground">{line}</span>
              </li>
            ))}
          </ul>
          {overflow && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              aria-expanded={showAll}
              className="mt-3 text-[12.5px] font-semibold text-[var(--primary)] underline decoration-[1.5px] underline-offset-[3px] hover:opacity-80 transition-opacity"
            >
              {showAll ? "Show less" : `Show all ${includedItems.length}`}
            </button>
          )}
        </div>

        {/* Not included — semantic red icon only */}
        {excludedItems.length > 0 && (
          <div className="border-t border-slate-200/55 bg-white px-4 py-4 sm:px-5">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--danger-soft-bg)] ring-1 ring-[var(--danger)]/20">
                <X className="h-3 w-3 text-[var(--danger)]" strokeWidth={2.5} />
              </span>
              <p className="text-eyebrow text-[var(--danger-soft-text)]">
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
  );
}
