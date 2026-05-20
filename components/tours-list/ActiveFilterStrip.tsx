'use client';

import React from 'react';
import { LIST_ACTIVE_FILTER_CHIP_CLS, LIST_CLEAR_ALL_CLS } from '@/lib/tours-list-tokens';

/**
 * Active-filter dismissible chip strip (Phase 2.8 — B5 binding). Sits directly
 * below the filter rail and externalizes whatever filters are currently applied
 * so the user has a control surface (the old design hid active state inside the
 * selects). Each chip removes only its own filter; "Clear all" resets everything.
 *
 * Site-native palette (B32): translucent-white chips with neutral slate text,
 * an × affordance, and a slate "Clear all" link. Renders nothing when no
 * filters are active (so it never adds empty vertical space).
 */
export interface ActiveFilterChip {
  /** Stable key (filter id). */
  key: string;
  /** Localized label, e.g. "Jeju" or "Private" or "₩50,000–₩120,000". */
  label: string;
  /** Removes just this filter. */
  onRemove: () => void;
}

interface ActiveFilterStripProps {
  chips: ReadonlyArray<ActiveFilterChip>;
  onClearAll: () => void;
  /** Localized "Clear all" text. */
  clearAllLabel: string;
  /** aria-label for the strip region. */
  ariaLabel: string;
  /** aria-label prefix for a chip's remove button, e.g. "Remove filter". */
  removeAriaLabel: string;
}

export function ActiveFilterStrip({
  chips,
  onClearAll,
  clearAllLabel,
  ariaLabel,
  removeAriaLabel,
}: ActiveFilterStripProps) {
  if (chips.length === 0) return null;

  return (
    <div
      aria-label={ariaLabel}
      className="border-b border-slate-200/55 bg-white/55 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-1.5 px-3 py-2 sm:px-4">
        {chips.map((chip) => (
          <span key={chip.key} className={LIST_ACTIVE_FILTER_CHIP_CLS}>
            {chip.label}
            <button
              type="button"
              aria-label={`${removeAriaLabel}: ${chip.label}`}
              onClick={chip.onRemove}
              className="-mr-0.5 ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200/70 hover:text-slate-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-900/30"
            >
              <svg className="h-2.5 w-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </span>
        ))}

        {chips.length > 1 ? (
          <button type="button" onClick={onClearAll} className={`ml-1 ${LIST_CLEAR_ALL_CLS}`}>
            {clearAllLabel}
          </button>
        ) : null}
      </div>
    </div>
  );
}
