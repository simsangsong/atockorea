"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { deriveEnStopName, deriveRegion } from "@/lib/tour-photo-overlay";

/**
 * Minimal photo-overlay labels — Apple-grade restraint:
 *   - top-right:   region label, plain uppercase white text with a soft drop
 *                  shadow. No cloud badge, no pill, no SVG decoration.
 *   - bottom-right: stop name in Inter, medium weight (not italic, not a
 *                  display serif). Tight tracking. Drop shadow for legibility.
 *
 * The container is pointer-events: none so it never blocks photo clicks.
 */
export type TourPhotoOverlayProps = {
  src?: string | null;
  region?: string | null;
  stopName?: string | null;
  /**
   * Size variant — defaults to `md`.
   *   xs: timeline-card mini thumbs (80×56) — region only, stop name hidden
   *   sm: drawer hero, gallery bento tiles
   *   md: gallery bento hero
   *   lg: lightbox / full-screen
   */
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
  /** Skip the region label (drawer hero already has a number pill). */
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

  const regionClass =
    size === "xs"
      ? "text-[7.5px] tracking-[0.2em]"
      : size === "sm"
        ? "text-[8.5px] tracking-[0.22em]"
        : size === "lg"
          ? "text-[11px] tracking-[0.26em]"
          : "text-[9.5px] tracking-[0.22em]";

  const stopClass =
    size === "xs"
      ? "text-[10px] tracking-[-0.005em]"
      : size === "sm"
        ? "text-[12px] tracking-[-0.008em]"
        : size === "lg"
          ? "text-[18px] tracking-[-0.015em]"
          : "text-[13px] tracking-[-0.01em]";

  const insetClass =
    size === "xs"
      ? "p-2"
      : size === "sm"
        ? "p-3"
        : size === "lg"
          ? "p-10"
          : "p-4";

  const showStopName = !hideStopName && resolvedName && size !== "xs";

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-10", insetClass, className)}
      aria-hidden="true"
    >
      {/* top-right: region label — plain uppercase white text. No background,
          no border, no SVG. Drop shadow keeps it legible on any photo. */}
      {!hideRegion && resolvedRegion ? (
        <span
          className={cn(
            "absolute right-0 top-0 uppercase font-medium text-white/95",
            regionClass,
          )}
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Display', var(--font-sans), Inter, system-ui, sans-serif",
            textShadow: "0 1px 4px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.4)",
          }}
        >
          {resolvedRegion}
        </span>
      ) : null}

      {/* bottom-right: stop name — Inter medium, no italic. Hierarchy from
          size + tight tracking + drop shadow only. */}
      {showStopName ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 whitespace-nowrap font-medium text-white",
            stopClass,
          )}
          style={{
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'SF Pro Display', var(--font-sans), Inter, system-ui, sans-serif",
            textShadow: "0 1px 4px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.45)",
          }}
        >
          {resolvedName}
        </span>
      ) : null}
    </div>
  );
}
