"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PlannerStepId = "01" | "02" | "03";

type PlannerStepPillProps = {
  step: PlannerStepId;
  children: ReactNode;
  className?: string;
};

/**
 * Step row: white pill, numbered sky badge, navy title (custom tour form).
 */
export function PlannerStepPill({ step, children, className }: PlannerStepPillProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 items-center gap-3 rounded-full border border-slate-200/90 bg-white px-3 py-2.5 shadow-[0_2px_10px_rgba(15,23,42,0.07)]",
        className,
      )}
      role="group"
    >
      <span
        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-sky-100 text-[11px] font-bold tabular-nums text-blue-700"
        aria-hidden
      >
        {step}
      </span>
      <span className="min-w-0 text-left text-sm font-bold leading-snug text-[#0a1f44]">{children}</span>
    </div>
  );
}
