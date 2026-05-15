"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { deriveEnStopName, deriveRegion } from "@/lib/tour-photo-overlay";

/**
 * Editorial overlays for tour-detail photos:
 *   - top-right: region label, sitting on a fluffy CUMULUS-shaped white cloud
 *     (inline SVG, not a regular pill)
 *   - bottom-right: stop name in English — Cormorant Garamond italic
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

// Cumulus silhouette — 4-lobe top, soft bottom edge. viewBox 120×38; stretches
// horizontally to fit any label length via preserveAspectRatio="none".
const CLOUD_PATH =
  "M 24 32 " +
  "Q 6 32 6 22 " +       // left lower curve
  "Q 6 14 16 13 " +      // left rise
  "Q 17 4 28 7 " +       // first puff
  "Q 34 0 44 5 " +       // second puff
  "Q 56 -1 64 5 " +      // third puff
  "Q 76 0 84 6 " +       // fourth puff
  "Q 100 6 104 16 " +    // shoulder
  "Q 118 18 112 28 " +   // right curve
  "Q 110 32 96 32 " +    // right base
  "L 24 32 Z";

function CloudBadge({
  label,
  textClass,
  pad,
}: {
  label: string;
  textClass: string;
  pad: { px: number; py: number };
}) {
  return (
    <span
      className="relative inline-flex items-center justify-center text-slate-800"
      style={{
        padding: `${pad.py}px ${pad.px}px`,
        filter:
          "drop-shadow(0 1px 2px rgba(15,23,42,0.16)) drop-shadow(0 6px 16px rgba(15,23,42,0.18))",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 120 38"
        aria-hidden
      >
        <path d={CLOUD_PATH} fill="#ffffff" />
      </svg>
      <span className={cn("relative z-10 uppercase font-semibold tracking-[0.18em]", textClass)}>
        {label}
      </span>
    </span>
  );
}

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

  // text size & inner padding for the cloud
  const cloud =
    size === "xs" ? { text: "text-[7px] tracking-[0.14em]", px: 7, py: 3 } :
    size === "sm" ? { text: "text-[9px] tracking-[0.16em]", px: 10, py: 4 } :
    size === "lg" ? { text: "text-[11.5px] tracking-[0.22em]", px: 18, py: 7 } :
    { text: "text-[10px] tracking-[0.18em]", px: 13, py: 5 };

  const stopSize =
    size === "xs" ? "text-[10px]" :
    size === "sm" ? "text-[12px]" :
    size === "lg" ? "text-[22px]" :
    "text-[15px]";

  // Outer inset gives space between overlay items and the photo edge.
  // Roughly doubled vs the previous version per the feedback.
  const insetClass =
    size === "xs" ? "p-1.5" :
    size === "sm" ? "p-3" :
    size === "lg" ? "p-6" :
    "p-4";

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-10", insetClass, className)}
      aria-hidden="true"
    >
      {/* top-right: region — fluffy cumulus cloud */}
      {!hideRegion && resolvedRegion ? (
        <span className="absolute right-0 top-0">
          <CloudBadge label={resolvedRegion} textClass={cloud.text} pad={{ px: cloud.px, py: cloud.py }} />
        </span>
      ) : null}

      {/* bottom-right: stop name — Cormorant Garamond italic, semibold */}
      {!hideStopName && resolvedName ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 italic text-white whitespace-nowrap",
            "drop-shadow-[0_2px_6px_rgba(0,0,0,0.78)]",
            stopSize,
          )}
          style={{
            fontFamily:
              "var(--font-editorial-serif), 'Cormorant Garamond', 'Playfair Display', Georgia, 'Times New Roman', serif",
            fontWeight: 600,
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
