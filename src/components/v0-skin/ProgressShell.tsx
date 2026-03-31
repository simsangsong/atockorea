"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ProgressShellProps = {
  /** 0–100 inclusive */
  value: number;
  max?: number;
  className?: string;
  /** Area above the bar (title, step label) — from parent/i18n */
  header?: ReactNode;
  trackClassName?: string;
  fillClassName?: string;
};

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Horizontal progress track + fill (V0 planner step bar). Visual only — `value` from parent state.
 */
export function ProgressShell({
  value,
  max = 100,
  className,
  header,
  trackClassName,
  fillClassName,
}: ProgressShellProps) {
  const pct = max <= 0 ? 0 : clamp((value / max) * 100, 0, 100);

  return (
    <div className={cn("w-full", className)}>
      {header ? <div className="mb-4 text-center">{header}</div> : null}
      <div className={cn("v0-progress-track", trackClassName)}>
        <div
          className={cn("v0-progress-fill", fillClassName)}
          style={{ width: `${pct}%` }}
          role="progressbar"
          aria-valuenow={Math.round(pct)}
          aria-valuemin={0}
          aria-valuemax={100}
        />
      </div>
    </div>
  );
}
