"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Reform §12 V6 / U2 — the "how many of you?" control.
 *
 * A slim pill stepper (− N +) that sits directly above the tour-type cards.
 * Default 2, no gate (cards render regardless). Changing it is the core
 * intuitive mechanic of the reform: party drives the live price + dynamic
 * recommendation (wired in Wave 1). In Wave 0 it carries `party` forward into
 * the card links and fires `home_party_stepper_change`.
 *
 * Controlled: the parent owns `value` so the same party feeds every card.
 * Tap targets are ≥44px (h-11 w-11) per the visual-design acceptance criteria.
 */
const PARTY_MIN = 1;
const PARTY_MAX = 13; // mirrors MAX_AUTO_PAX (pricing-policy.ts) — beyond this is manual quote

export function PartyStepper({
  value,
  onChange,
  label,
  caption,
  decreaseAria,
  increaseAria,
}: {
  value: number;
  onChange: (next: number) => void;
  /** Field label, e.g. "여행 인원". */
  label: string;
  /** Helper line under the control, e.g. "2명 기준". */
  caption: string;
  decreaseAria: string;
  increaseAria: string;
}) {
  const clamp = (n: number) => Math.min(PARTY_MAX, Math.max(PARTY_MIN, n));
  const atMin = value <= PARTY_MIN;
  const atMax = value >= PARTY_MAX;

  const btn =
    "focus-ring flex h-11 w-11 flex-none items-center justify-center rounded-full border border-slate-200/80 bg-white text-slate-700 transition-colors duration-200 hover:border-slate-300 hover:bg-slate-50 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white disabled:hover:border-slate-200/80 motion-reduce:active:scale-100";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="flex items-center gap-3">
        <span className="text-caption font-semibold text-slate-700">{label}</span>
        <div
          className="flex items-center gap-1.5 rounded-full border border-slate-200/70 bg-slate-50 p-1"
          role="group"
          aria-label={label}
        >
          <button
            type="button"
            onClick={() => onChange(clamp(value - 1))}
            disabled={atMin}
            aria-label={decreaseAria}
            className={btn}
          >
            <Minus className="h-4 w-4" aria-hidden />
          </button>
          <span
            className="min-w-[2.5rem] text-center text-[1.05rem] font-semibold tabular-nums text-slate-900"
            aria-live="polite"
          >
            {value}
          </span>
          <button
            type="button"
            onClick={() => onChange(clamp(value + 1))}
            disabled={atMax}
            aria-label={increaseAria}
            className={cn(btn)}
          >
            <Plus className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>
      <p className="text-micro font-medium text-slate-500">{caption}</p>
    </div>
  );
}
