"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { deriveEnStopName, deriveRegion } from "@/lib/tour-photo-overlay";

/**
 * Editorial overlays for tour-detail photos:
 *   - top-right: region label, white "cloud" pill (Jeju / Busan / Seoul / …)
 *       — dark text floating on a soft white cloud (not glass)
 *   - bottom-right: stop name in English, italic Cormorant Garamond
 *
 * Drop this absolutely-positioned inside any image container. The component
 * itself is pointer-events: none so it never blocks clicks on the photo.
 */
export type TourPhotoOverlayProps = {
  src?: string | null;
  region?: string | null;
  stopName?: string | null;
  /**
   * Size variant — defaults to `md`.
   *   xs: timeline-card mini thumbs (80×56)
   *   sm: drawer hero, gallery bento tiles
   *   md: gallery bento hero
   *   lg: lightbox / full-screen
   */
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** Skip the region pill (e.g. drawer hero already has a number pill). */
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

  // Region pill — white cloud feel (not glass): solid white-ish bg, soft
  // floating shadow, dark text on top so it reads cleanly.
  const regionSize =
    size === "xs" ? "text-[7px] tracking-[0.16em] px-1 py-[1px]" :
    size === "sm" ? "text-[8.5px] tracking-[0.18em] px-1.5 py-[1.5px]" :
    size === "lg" ? "text-[10.5px] tracking-[0.22em] px-2.5 py-0.5" :
    "text-[9px] tracking-[0.2em] px-2 py-0.5";

  const stopSize =
    size === "xs" ? "text-[9px]" :
    size === "sm" ? "text-[11px]" :
    size === "lg" ? "text-[20px]" :
    "text-[14px]";

  const insetClass =
    size === "xs" ? "p-1" :
    size === "sm" ? "p-1.5" :
    size === "lg" ? "p-4" :
    "p-2";

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-10", insetClass, className)}
      aria-hidden="true"
    >
      {/* top-right: region — soft white cloud pill */}
      {!hideRegion && resolvedRegion ? (
        <span
          className={cn(
            "absolute right-0 top-0 inline-flex items-center rounded-full uppercase font-medium text-slate-700",
            "bg-white/95",
            // Multi-layer shadow: short close shadow + diffused glow ≈ floating cloud
            "shadow-[inset_0_0_0_1px_rgba(255,255,255,0.7),0_1px_3px_-1px_rgba(15,23,42,0.18),0_8px_22px_-6px_rgba(15,23,42,0.22)]",
            regionSize,
          )}
        >
          {resolvedRegion}
        </span>
      ) : null}

      {/* bottom-right: stop name — Cormorant Garamond italic */}
      {!hideStopName && resolvedName ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 italic text-white whitespace-nowrap",
            "drop-shadow-[0_2px_6px_rgba(0,0,0,0.75)]",
            stopSize,
          )}
          style={{
            fontFamily: "var(--font-editorial-serif), 'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontWeight: 500,
            letterSpacing: "0.012em",
            textShadow: "0 1px 2px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.4)",
          }}
        >
          {resolvedName}
        </span>
      ) : null}
    </div>
  );
}
