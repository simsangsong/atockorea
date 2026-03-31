'use client';

import { Orbitron } from 'next/font/google';

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['700', '800'],
  display: 'swap',
});

/**
 * Small “AI” chip for planner text areas — white surface, tech display font, gradient lettering.
 */
export function AiPlannerBadge() {
  return (
    <span
      className={`${orbitron.className} pointer-events-none absolute top-3 right-3 inline-flex items-center justify-center rounded-lg border border-cyan-200/90 bg-white px-2.5 py-1.5 shadow-[0_2px_10px_rgba(15,23,42,0.07)] ring-1 ring-slate-200/70`}
      aria-hidden
    >
      <span className="bg-gradient-to-r from-cyan-600 via-blue-700 to-indigo-700 bg-clip-text text-[11px] font-extrabold uppercase tracking-[0.32em] text-transparent">
        AI
      </span>
    </span>
  );
}
