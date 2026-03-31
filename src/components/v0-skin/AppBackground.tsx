"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AppBackgroundProps = {
  /** Main content — rendered above page chrome */
  children?: ReactNode;
  className?: string;
  /** Inner content wrapper (e.g. z-index tweaks); default keeps `relative z-10` */
  contentClassName?: string;
};

/**
 * V0 app shell: viewport canvas is on `body.v0-global-bg` (see `v0-skin.css`).
 * This wrapper only provides layout + typography scope — no duplicate photo layers.
 */
export function AppBackground({ children, className, contentClassName }: AppBackgroundProps) {
  return (
    <div
      className={cn(
        "v0-app-root relative isolate min-h-screen overflow-x-hidden font-sans selection:bg-blue-100",
        className,
      )}
    >
      <div className={cn("relative z-10", contentClassName)}>{children}</div>
    </div>
  );
}
