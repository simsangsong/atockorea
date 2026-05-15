"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { deriveEnStopName, deriveRegion } from "@/lib/tour-photo-overlay";

/**
 * Editorial overlays for tour-detail photos:
 *   - top-right: region label sitting on a fluffy CUMULUS cloud
 *     (inline SVG with light-blue gradient + outline + soft highlight)
 *   - bottom-right: stop name in English — Cormorant Garamond italic
 *
 * The whole overlay is pointer-events: none so it never blocks photo clicks.
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

// Cumulus silhouette in a 200×110 viewBox: 5 puffy lobes on top, soft
// undulating underside. Drawn with cubic curves for smooth roundness.
const CLOUD_PATH =
  "M 22 88 " +
  "C 6 88 2 72 12 60 " +     // left side rising from base
  "C 4 48 18 32 36 38 " +    // left puff
  "C 36 18 66 14 78 32 " +   // second puff (upper-left)
  "C 84 8 128 6 136 28 " +   // top center puff (biggest)
  "C 152 18 180 26 178 48 " + // upper-right puff
  "C 196 52 196 76 178 82 " + // right side falling
  "C 180 96 158 102 144 92 " + // small under-bump (right)
  "C 142 105 116 106 108 95 " + // bottom waves
  "C 100 108 70 106 68 92 " +
  "C 55 104 34 100 22 88 Z";

function CloudBadge({
  label,
  textClass,
  pad,
}: {
  label: string;
  textClass: string;
  pad: { px: number; py: number };
}) {
  // React.useId so each instance gets unique gradient IDs (defs are global).
  const uid = React.useId().replace(/:/g, "");
  const gradFill = `cb-grad-${uid}`;
  const gradHi = `cb-hi-${uid}`;
  const gradStroke = `cb-stroke-${uid}`;

  return (
    <span
      className="relative inline-flex items-center justify-center"
      style={{
        padding: `${pad.py}px ${pad.px}px`,
        filter:
          "drop-shadow(0 2px 4px rgba(15,23,42,0.14)) drop-shadow(0 10px 24px rgba(15,23,42,0.20))",
      }}
    >
      <svg
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="none"
        viewBox="0 0 200 110"
        aria-hidden
      >
        <defs>
          {/* Body: light blue at bottom, brighter white near the top of the puffs */}
          <linearGradient id={gradFill} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="55%" stopColor="#f1f8ff" />
            <stop offset="100%" stopColor="#b9dcef" />
          </linearGradient>
          {/* Stroke: stronger blue at edges (esp. underside) for definition */}
          <linearGradient id={gradStroke} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a4cee5" />
            <stop offset="100%" stopColor="#5fa1c8" />
          </linearGradient>
          {/* Soft white highlight over the upper-middle puffs */}
          <radialGradient id={gradHi} cx="0.5" cy="0.32" r="0.55">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.85" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </radialGradient>
        </defs>
        {/* Main cloud body */}
        <path
          d={CLOUD_PATH}
          fill={`url(#${gradFill})`}
          stroke={`url(#${gradStroke})`}
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {/* Glossy highlight overlay */}
        <path d={CLOUD_PATH} fill={`url(#${gradHi})`} />
      </svg>
      <span
        className={cn(
          "relative z-10 uppercase font-semibold tracking-[0.18em] text-sky-900",
          textClass,
        )}
        style={{ textShadow: "0 1px 0 rgba(255,255,255,0.5)" }}
      >
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

  const cloud =
    size === "xs" ? { text: "text-[7px] tracking-[0.14em]", px: 8, py: 4 } :
    size === "sm" ? { text: "text-[9px] tracking-[0.16em]", px: 12, py: 5 } :
    size === "lg" ? { text: "text-[12px] tracking-[0.22em]", px: 22, py: 9 } :
    { text: "text-[10px] tracking-[0.18em]", px: 15, py: 7 };

  const stopSize =
    size === "xs" ? "text-[10px]" :
    size === "sm" ? "text-[12px]" :
    size === "lg" ? "text-[22px]" :
    "text-[15px]";

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
      {/* top-right: region — fluffy SVG cumulus cloud */}
      {!hideRegion && resolvedRegion ? (
        <span className="absolute right-0 top-0">
          <CloudBadge
            label={resolvedRegion}
            textClass={cloud.text}
            pad={{ px: cloud.px, py: cloud.py }}
          />
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
