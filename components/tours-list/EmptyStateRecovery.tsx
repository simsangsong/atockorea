'use client';

import React from 'react';
import Link from 'next/link';

/**
 * Empty-state 3-action recovery (Phase 3.6–3.8 — B10). Replaces the old
 * single "reset" dead-end with three ways forward:
 *   (a) remove the single most-constraining filter (auto-detected by the page),
 *   (b) build a custom day in the itinerary builder,
 *   (c) reach a human via the concierge/support route.
 *
 * Site-native palette (B32): white surfaces + slate-900 primary action.
 */
interface EmptyStateRecoveryProps {
  title: string;
  hint: string;
  /** Most-constraining filter — when present, action (a) is offered. */
  suggestRemoveLabel?: string;
  onRemoveSuggested?: () => void;
  // Optional: omitted when the itinerary builder is hidden (Klook prep).
  builderHref?: string;
  builderCta?: string;
  conciergeHref: string;
  conciergeCta: string;
}

export function EmptyStateRecovery({
  title,
  hint,
  suggestRemoveLabel,
  onRemoveSuggested,
  builderHref,
  builderCta,
  conciergeHref,
  conciergeCta,
}: EmptyStateRecoveryProps) {
  return (
    <div className="mx-auto w-full max-w-xl px-5 py-12 text-center">
      <h2 className="text-[18px] font-bold tracking-[-0.01em] text-slate-900 sm:text-[20px]">
        {title}
      </h2>
      <p className="mt-2 text-[13.5px] text-slate-500">{hint}</p>

      <div className="mt-6 flex flex-col gap-2.5">
        {/* (a) Remove the single most-constraining filter (auto-detected). */}
        {suggestRemoveLabel && onRemoveSuggested ? (
          <button
            type="button"
            onClick={onRemoveSuggested}
            className="inline-flex h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 text-[14px] font-bold text-white shadow-[0_8px_24px_-10px_rgba(15,23,42,0.5)] transition hover:bg-slate-800"
          >
            {suggestRemoveLabel}
          </button>
        ) : null}

        {/* (b) Build a custom day — hidden when the builder is gated off. */}
        {builderHref && builderCta ? (
          <Link
            href={builderHref}
            className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-5 text-[14px] font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {builderCta}
            <span aria-hidden>→</span>
          </Link>
        ) : null}

        {/* (c) Concierge / human help. */}
        <Link
          href={conciergeHref}
          className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200/80 bg-white px-5 text-[14px] font-semibold text-slate-800 transition hover:border-slate-300 hover:bg-slate-50"
        >
          {conciergeCta}
          <span aria-hidden>→</span>
        </Link>
      </div>
    </div>
  );
}
