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

  /* 사용자 피드백 (2026-05-19): bento collage에서 글씨가 사진을 너무 많이 가림.
     "사진을 최소한으로 가리되 우측하단 구석에 깨알같이" + "펼쳤을때(lightbox)는 그대로".
     sm + md를 깨알 사이즈로 축소, xs + lg는 유지. inset도 같이 줄여 코너에 바짝. */
  const regionClass =
    size === "xs"
      ? "text-[7.5px] tracking-[0.2em]"
      : size === "sm"
        ? "text-[6.5px] tracking-[0.18em] leading-none"
        : size === "lg"
          ? "text-[11px] tracking-[0.26em]"
          : "text-[7.5px] tracking-[0.2em] leading-none";

  const stopClass =
    size === "xs"
      ? "text-[10px] tracking-[-0.005em]"
      : size === "sm"
        ? "text-[7.5px] tracking-[-0.005em] leading-none"
        : size === "lg"
          ? "text-[18px] tracking-[-0.015em]"
          : "text-[8.5px] tracking-[-0.008em] leading-none";

  const insetClass =
    size === "xs"
      ? "p-2"
      : size === "sm"
        ? "p-1.5"
        : size === "lg"
          ? "p-10"
          : "p-2";

  const showStopName = !hideStopName && resolvedName && size !== "xs";

  return (
    <div
      className={cn("pointer-events-none absolute inset-0 z-10", insetClass, className)}
      aria-hidden="true"
    >
      {/* top-right: region label — uppercase serif (Playfair Display) for editorial feel.
          잡지 화보 스타일 (사용자 요청 2026-05-19): SF Pro/Inter → Playfair Display. */}
      {!hideRegion && resolvedRegion ? (
        <span
          className={cn(
            "absolute right-0 top-0 uppercase font-normal text-white/95",
            regionClass,
          )}
          style={{
            fontFamily:
              "var(--font-tour-v2-serif), 'Playfair Display', Georgia, 'Times New Roman', serif",
            textShadow: "0 1px 4px rgba(0,0,0,0.55), 0 0 1px rgba(0,0,0,0.4)",
          }}
        >
          {resolvedRegion}
        </span>
      ) : null}

      {/* bottom-right: stop name — Playfair Display italic for editorial magazine feel.
          잡지 화보 스타일 (사용자 요청 2026-05-19): italic으로 art-direction 강화. */}
      {showStopName ? (
        <span
          className={cn(
            "absolute bottom-0 right-0 whitespace-nowrap italic font-normal text-white",
            stopClass,
          )}
          style={{
            fontFamily:
              "var(--font-tour-v2-serif), 'Playfair Display', Georgia, 'Times New Roman', serif",
            textShadow: "0 1px 4px rgba(0,0,0,0.6), 0 0 1px rgba(0,0,0,0.45)",
          }}
        >
          {resolvedName}
        </span>
      ) : null}
    </div>
  );
}
