'use client';

import React from 'react';
import { ACCENT, mapContextToAccent } from '@/lib/tours-hub-accents';

/**
 * Contextual vignette band (Phase 3.2/3.3) — appears only when the catalogue is
 * filtered to a strong context (a destination or a feature), inheriting the hub's
 * 7-accent promise (B6): Jeju→volcano teal, Busan→harbor indigo, Seoul→palace,
 * Cruise→ocean, UNESCO→temple, Seasonal→blossom, else→signature amber.
 *
 * The base page stays site-native (white + slate); the accent here is a
 * *contextual highlight* (a gradient rule + tinted eyebrow), not a base-tone
 * change — so it honors both B6 (accent promise) and B32 (site-native base).
 */
interface ContextualVignetteBandProps {
  /** Active destination value ("all" = none). */
  destination: string;
  /** Active features CSV ("" = none). */
  features: string;
  /** Localized context label to display (city / feature name). */
  contextLabel: string;
  /** "Curated for {context}" localized line. */
  line: string;
  /** Reset link label. */
  resetLabel: string;
  onReset: () => void;
}

export function ContextualVignetteBand({
  destination,
  features,
  contextLabel,
  line,
  resetLabel,
  onReset,
}: ContextualVignetteBandProps) {
  const hasContext = destination !== 'all' || features.trim() !== '';
  if (!hasContext) return null;

  const accent = mapContextToAccent({ destination, features });
  const tokens = ACCENT[accent];

  return (
    <div className="mx-auto w-full max-w-5xl px-3 pt-3 sm:px-4">
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/70 bg-white/70 px-4 py-3 backdrop-blur-sm sm:px-5">
        {/* Accent gradient rule down the left edge (contextual highlight). */}
        <span className={`absolute inset-y-0 left-0 w-1 ${tokens.line}`} aria-hidden />
        <div className="flex items-center justify-between gap-3 pl-2">
          <div className="min-w-0">
            <span className={`block text-[10px] font-bold uppercase tracking-[0.2em] ${tokens.eyebrow}`}>
              {contextLabel}
            </span>
            <span className="mt-0.5 block truncate text-[12.5px] text-slate-500">{line}</span>
          </div>
          <button
            type="button"
            onClick={onReset}
            className={`shrink-0 text-[12px] font-semibold underline-offset-4 hover:underline ${tokens.seeAll}`}
          >
            {resetLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
