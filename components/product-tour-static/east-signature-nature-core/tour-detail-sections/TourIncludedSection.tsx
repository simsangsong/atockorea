"use client";

import { useState } from "react";
import { Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PracticalAccordionItem } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

export type TourIncludedSectionProps = {
  practicalAccordionItems: readonly PracticalAccordionItem[];
  sectionUi: TourProductSectionUiV1;
};

// Matches opening "not included" / "excluded" markers in EN · KO · ZH · ZH-TW · JA · ES
const NOT_INCLUDED_RX =
  /^(not included|excluded|excludes|not include|excl\.|does not include|불포함|미포함|不含|不包含|费用不含|含まれないもの|no incluye|no incluido|excluido)/i;

/**
 * Sprint 5.2 (§B-P4 1차 visible scope 재정의): 5 → 3 core visible.
 *   Included list 1차 핵심만 노출, 나머지는 underlined "Show all" reveal.
 */
const VISIBLE_LIMIT = 3;

export function TourIncludedSection({ practicalAccordionItems }: TourIncludedSectionProps) {
  /**
   * Sprint 5.2 (§B-P4+P6): core 3 visible + "Show all" reveal + Excluded grid → inline prose.
   *   Sprint 3.3에서 "5 + Show all" 패턴 도입했으나 5+excluded grid 누적 시 단조 텍스트.
   *   3 core + 우측 underlined Show all + bottom inline prose Excluded로 editorial 압축.
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

      {/* Sprint 5.2 (§B-P6): premium card frame — bg + ring + shadow-card + inner top highlight + hover lift. */}
      <div
        className={cn(
          "group relative overflow-hidden rounded-[20px] bg-white",
          "ring-1 ring-slate-200/70",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.10)]",
          "transition-[transform,box-shadow] duration-300 ease-out",
          "hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_20px_-4px_rgba(15,23,42,0.12)]",
        )}
      >
        {/* §B-P6 (3): inner top highlight (top 1/3 white/65 gradient) */}
        <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />

        <div className="relative px-5 py-4">
          <p className="text-[15px] font-semibold tracking-tight text-foreground">
            {item.title ?? "What's Included"}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            {includedItems.length} included · {excludedItems.length} not included
          </p>
        </div>

        {/* Included core 3 (or all if ≤3) — semantic green icon only */}
        <div className="relative border-t border-slate-200/70 bg-white px-4 pt-4 pb-3 sm:px-5">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--success-soft-bg)] ring-1 ring-[var(--success)]/20">
                <Check className="h-3 w-3 text-[var(--success)]" strokeWidth={2.5} />
              </span>
              <p className="text-eyebrow text-[var(--success-soft-text)]">
                Included
              </p>
            </div>
            {overflow && (
              <button
                type="button"
                onClick={() => setShowAll((v) => !v)}
                aria-expanded={showAll}
                className="text-[12.5px] font-semibold text-[var(--primary)] underline decoration-[1.5px] underline-offset-[3px] hover:opacity-80 transition-opacity"
              >
                {showAll ? "Show less" : `Show all ${includedItems.length}`}
              </button>
            )}
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
        </div>

        {/* Not included — inline prose 1줄 (Sprint 5.2: grid 폐기, editorial inline) */}
        {excludedItems.length > 0 && (
          <div className="relative border-t border-slate-200/55 bg-slate-50/60 px-4 py-3 sm:px-5">
            <p className="flex items-start gap-2 text-[12.5px] leading-relaxed text-muted-foreground">
              <X className="mt-[2px] h-3.5 w-3.5 flex-shrink-0 text-[var(--danger)]/70" strokeWidth={2.5} />
              <span>
                <span className="font-semibold text-foreground">Not included:</span>{" "}
                {excludedItems.join(" · ")}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
