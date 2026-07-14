"use client";

import { cn } from "@/lib/utils";

export type SegmentedToggleOption<V extends string> = {
  value: V;
  label: string;
};

/**
 * §F-8 grammar ③ — THE shared in-section segmented toggle. Used by the
 * itinerary Standard|Sample switch (W2.4) and the Practical seasons segment
 * (W3.5). New in-section view switches must reuse this component instead of
 * inventing another control.
 */
export function SegmentedToggle<V extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  className,
}: {
  options: readonly SegmentedToggleOption<V>[];
  value: V;
  onChange: (v: V) => void;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full bg-stone-100/90 p-1 ring-1 ring-slate-900/[0.05]",
        className,
      )}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              "rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition-colors duration-200",
              active
                ? "bg-white text-foreground shadow-[0_1px_2px_rgba(15,23,42,0.08),0_2px_6px_-2px_rgba(15,23,42,0.12)]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
