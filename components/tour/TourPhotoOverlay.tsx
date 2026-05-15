"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { deriveEnStopName, deriveRegion } from "@/lib/tour-photo-overlay";

/**
 * Editorial overlays for tour-detail photos:
 *   - top-left: region label, white "cloud" pill (Jeju / Busan / Seoul / …)
 *   - bottom-right: stop name in English, italic serif, magazine style
 *
 * Drop this absolutely-positioned inside any image container. The component
 * itself is pointer-events: none so it never blocks clicks on the photo.
 */
export type TourPhotoOverlayProps = {
  src?: string | null;
  region?: string | null;
  stopName?: string | null;
  /** Size variant — defaults to `md`. Use `sm` on cards/thumbnails. */
  size?: "sm" | "md" | "lg";
  className?: string;
  /** If true, top-left region is omitted (e.g. drawer hero already has a number pill). */
  hideRegion?: boolean;
  hideStopName?: boolean;
};

export function TourPhotoOverlay({
  src,
  region,
  stopName,
  size = "md",
  className,
  hideRegion,
  hideStopName,
}: TourPhotoOverlayProps) {
  const resolvedRegion = region ?? deriveRegion(src);
  const resolvedName = stopName ?? deriveEnStopName(src);

  if (!resolvedRegion && !resolvedName) return null;

  const regionSize =
    size === "sm" ? "text-[8px] tracking-[0.18em] px-1.5 py-[1px]" :
    size === "lg" ? "text-[11px] tracking-[0.22em] px-2.5 py-0.5" :
    "text-[9.5px] tracking-[0.2em] px-2 py-0.5";

  const stopSize =
    size === "sm" ? "text-[11px]" :
    size === "lg" ? "text-[18px]" :
    "text-[14px]";

  const insetClass =
    size === "sm" ? "p-1" :
    size === "lg" ? "p-3" :
    "p-2";

  return (
    <div className={cn("pointer-events-none absolute inset-0 z-10", insetClass, className)} aria-hidden="true">
      {/* top-left: region (white cloud pill) */}
      {!hideRegion && resolvedRegion ? (
        <span
          className={cn(
            "absolute left-0 top-0 inline-flex items-center rounded-full uppercase font-light text-white",
            "bg-white/22 backdrop-blur-md ring-1 ring-white/30",
            "shadow-[0_2px_8px_-2px_rgba(0,0,0,0.35)] drop-shadow-[0_1px_3px_rgba(0,0,0,0.35)]",
            regionSize,
          )}
          style={{ left: undefined, top: undefined }}
        >
          {resolvedRegion}
        </span>
      ) : null}

      {/* bottom-right: stop name (magazine italic serif) */}
      {!hideStopName && resolvedName ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 italic text-white whitespace-nowrap",
            "drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]",
            stopSize,
          )}
          style={{
            fontFamily: "'Cormorant Garamond','Playfair Display',Georgia,'Times New Roman',serif",
            letterSpacing: "0.02em",
            textShadow: "0 1px 2px rgba(0,0,0,0.5)",
          }}
        >
          {resolvedName}
        </span>
      ) : null}
    </div>
  );
}

/* TourPhotoOverlay is rendered absolutely INSIDE a container that already
   positions the photo. The wrapping container should set `position: relative`
   and use `onContextMenu={preventDefault}` for right-click suppression. */
