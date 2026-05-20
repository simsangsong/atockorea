'use client';

import React from 'react';

export type CatalogueViewMode = 'editorial' | 'compact';

/**
 * Results meta strip (Phase 4.0, ported from Phase 3.4) — sits above the grid.
 * Shows the active sort label + a quiet curator line on the left, and the
 * Editorial ↔ Compact view toggle on the right.
 *
 * NOTE: the total result count ("X of N") is intentionally omitted — the
 * catalogue does not advertise its tour count anywhere (2026-05-20 direction).
 * Site-native palette (B32): white surfaces + slate-900 active toggle.
 */
interface ResultsMetaStripProps {
  sortLabel: string;
  view: CatalogueViewMode;
  onViewChange: (v: CatalogueViewMode) => void;
  editorialLabel: string;
  compactLabel: string;
  viewAriaLabel: string;
}

export function ResultsMetaStrip({
  sortLabel,
  view,
  onViewChange,
  editorialLabel,
  compactLabel,
  viewAriaLabel,
}: ResultsMetaStripProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1320px] items-center justify-between gap-3 px-3 pb-1 pt-3 sm:px-4">
      <span className="min-w-0 truncate text-[12.5px] font-medium text-slate-500">{sortLabel}</span>

      <div
        role="radiogroup"
        aria-label={viewAriaLabel}
        className="inline-flex shrink-0 items-center gap-0.5 rounded-xl border border-slate-200/80 bg-white/70 p-0.5"
      >
        <ViewButton
          active={view === 'editorial'}
          onClick={() => onViewChange('editorial')}
          label={editorialLabel}
        >
          {/* 3-up grid icon */}
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <rect x="3" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
            <rect x="14" y="3" width="7" height="7" rx="1.5" strokeWidth={2} />
            <rect x="3" y="14" width="7" height="7" rx="1.5" strokeWidth={2} />
            <rect x="14" y="14" width="7" height="7" rx="1.5" strokeWidth={2} />
          </svg>
        </ViewButton>
        <ViewButton
          active={view === 'compact'}
          onClick={() => onViewChange('compact')}
          label={compactLabel}
        >
          {/* list/rows icon */}
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" aria-hidden>
            <rect x="3" y="4" width="18" height="6" rx="1.5" strokeWidth={2} />
            <rect x="3" y="14" width="18" height="6" rx="1.5" strokeWidth={2} />
          </svg>
        </ViewButton>
      </div>
    </div>
  );
}

function ViewButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      aria-label={label}
      title={label}
      onClick={onClick}
      className={
        active
          ? 'inline-flex h-8 items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 text-[11px] font-semibold text-white transition'
          : 'inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[11px] font-medium text-slate-500 transition hover:bg-white hover:text-slate-900'
      }
    >
      {children}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
