'use client';

import React from 'react';

/**
 * Sort control rendered as an inline segmented control (Phase 2.5) — replaces
 * the admin-style `<select>`. Site-native palette (B32): active segment is
 * slate-900 / white (matches the landing matcher chips), inactive is muted
 * slate on a translucent track. Horizontally scrollable on narrow widths so it
 * never forces the rail to overflow.
 *
 * Generic over the option value so the page keeps its `SortFilter` union type.
 */
export interface SortSegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SortSegmentedProps<T extends string> {
  value: T;
  options: ReadonlyArray<SortSegmentedOption<T>>;
  onChange: (value: T) => void;
  ariaLabel: string;
  /** Optional title shown on the active segment (e.g. the "popular" hint). */
  activeTitle?: string;
  className?: string;
}

export function SortSegmented<T extends string>({
  value,
  options,
  onChange,
  ariaLabel,
  activeTitle,
  className,
}: SortSegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex h-11 shrink-0 items-center gap-0.5 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white/60 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.92)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${className ?? ''}`}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            title={active ? activeTitle : undefined}
            onClick={() => onChange(opt.value)}
            className={
              active
                ? 'inline-flex h-full shrink-0 items-center rounded-xl bg-slate-900 px-2.5 text-[12px] font-semibold text-white shadow-[0_2px_8px_-3px_rgba(15,23,42,0.4)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30'
                : 'inline-flex h-full shrink-0 items-center rounded-xl px-2.5 text-[12px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/20'
            }
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
