"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type HomeV2SectionEyebrowDot = "navy" | "muted" | "live";

type HomeV2SectionEyebrowProps = {
  children: ReactNode;
  className?: string;
  /** Status dot: brand navy, neutral slate, or pulsing sky (loading). */
  dot?: HomeV2SectionEyebrowDot;
};

const dotClass: Record<HomeV2SectionEyebrowDot, string> = {
  navy: "bg-home-v2-navy-800/80",
  muted: "bg-slate-500",
  live: "animate-pulse bg-sky-500",
};

/**
 * Shared section kicker — uses `hv2-eyebrow-pill` / `hv2-eyebrow-text` from `globals.css`.
 */
export function HomeV2SectionEyebrow({ children, className, dot = "navy" }: HomeV2SectionEyebrowProps) {
  return (
    <div className={cn("hv2-eyebrow-pill mb-3", className)}>
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotClass[dot])} aria-hidden />
      <span className="hv2-eyebrow-text">{children}</span>
    </div>
  );
}
