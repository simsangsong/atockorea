"use client";

import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { GlassPanel } from "./GlassPanel";

export type PlannerModalShellProps = {
  children: ReactNode;
  className?: string;
  /** Root wrapper (centering + padding) */
  rootClassName?: string;
  /** Glass panel container */
  panelClassName?: string;
  /** Optional slot for close control — parent supplies button + handler */
  topRight?: ReactNode;
  /** Dimmed backdrop behind panel (click target for parent-driven close) */
  showBackdrop?: boolean;
  backdropClassName?: string;
  onBackdropClick?: () => void;
  /**
   * `modal` — full-viewport fixed layer (V0 default). `inline` — glass panel in document flow (e.g. under site Header).
   */
  layout?: "modal" | "inline";
  /**
   * Modal stack order. Default matches V0 planner (`100`). Keep above BottomNav (`50`). Ignored when `layout="inline"`.
   */
  zIndex?: number;
};

/**
 * Centered glass panel (V0 PlannerView chrome). No steps or API — children only.
 */
export function PlannerModalShell({
  children,
  className,
  rootClassName,
  panelClassName,
  topRight,
  showBackdrop = false,
  backdropClassName,
  onBackdropClick,
  layout = "modal",
  zIndex = 100,
}: PlannerModalShellProps) {
  const zStyle: CSSProperties = layout === "modal" ? { zIndex } : {};

  if (layout === "inline") {
    return (
      <div className={cn("relative z-0 w-full", rootClassName, className)} role="presentation">
        <GlassPanel
          variant="default"
          className={cn(
            "v0-planner-panel v0-planner-panel--inline relative z-[1] flex w-full max-w-none flex-col",
            panelClassName,
          )}
        >
          {topRight ? (
            <div className="absolute right-4 top-4 z-[2] sm:right-6 sm:top-6">{topRight}</div>
          ) : null}
          {children}
        </GlassPanel>
      </div>
    );
  }

  return (
    <div
      className={cn("fixed inset-0 flex items-center justify-center px-4", rootClassName, className)}
      style={zStyle}
      role="presentation"
    >
      {showBackdrop ? (
        <div
          role="presentation"
          className={cn("absolute inset-0 z-0 bg-black/20", backdropClassName)}
          onClick={onBackdropClick}
        />
      ) : null}
      <GlassPanel
        variant="default"
        className={cn(
          "v0-planner-panel relative z-[1] flex max-h-[85vh] w-full max-w-xl flex-col",
          panelClassName,
        )}
      >
        {topRight ? <div className="absolute right-6 top-6 z-[2]">{topRight}</div> : null}
        {children}
      </GlassPanel>
    </div>
  );
}
