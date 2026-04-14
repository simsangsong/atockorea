"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Wordmark + mark core — deep navy */
const BRAND_PRIMARY = "#161E2A";
/** Secondary wordmark — same family, higher contrast than previous gray wash */
const BRAND_WORDMARK_KOREA = "#3A4656";
/** Tertiary line — restrained, editorial */
const BRAND_TAGLINE_MUTED = "#5A6570";
/** Dark header: Korea lifted from primary for legibility without going flat gray */
const BRAND_WORDMARK_KOREA_ON_DARK = "#A8B4C0";
const BRAND_TAGLINE_ON_DARK = "#8E99A5";

const TAGLINE = "Curated Korea, Direct";

export type LogoProps = {
  className?: string;
  /** `onDark`: light strokes/text for sign-in and other dark headers */
  variant?: "default" | "onDark";
  /** Header-style lockup: single-line wordmark, no tagline, tighter mark */
  compact?: boolean;
};

export default function Logo({
  className = "w-auto h-10 sm:h-12",
  variant = "default",
  compact = false,
}: LogoProps) {
  const rawId = useId().replace(/:/g, "");
  const clipId = `${rawId}-markClip`;
  const gradOuterId = `${rawId}-outerDepth`;
  const gradLineId = `${rawId}-lineAir`;
  const gradOuterStrokeId = `${rawId}-outerRing`;

  /** Slightly squarer than typical app icons; inner radius tracks outer for one system */
  const outerRx = 9.5;
  const innerRx = 4.85;
  /** Finer strokes read more “luxury app” than heavy double-frame */
  const innerStrokeW = compact ? 0.92 : 0.98;
  const chevronStrokeW = compact ? 1.38 : 1.48;

  const isDark = variant === "onDark";
  const outerFill = isDark ? "none" : `url(#${gradOuterId})`;
  const outerStroke = isDark ? `url(#${gradOuterStrokeId})` : "none";
  const outerStrokeW = isDark ? 1.28 : 0;
  const lineStroke = isDark ? "rgba(255,255,255,0.9)" : `url(#${gradLineId})`;

  return (
    <div
      className={cn(
        "flex items-center",
        compact ? "gap-1.5 sm:gap-2 md:gap-2" : "gap-2 sm:gap-2.5 md:gap-3",
        className
      )}
    >
      <div className="relative flex-shrink-0">
        <svg
          width="40"
          height="40"
          className={cn(
            "flex-shrink-0",
            compact
              ? "h-7 w-7 sm:h-8 sm:w-8 md:h-9 md:w-9"
              : "h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10"
          )}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden
        >
          <defs>
            <clipPath id={clipId}>
              <rect x="1" y="1" width="38" height="38" rx={outerRx} />
            </clipPath>
            {/* Subtle depth on the outer body only — no extra layers */}
            <linearGradient id={gradOuterId} x1="6" y1="3" x2="36" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#283548" />
              <stop offset="42%" stopColor={BRAND_PRIMARY} />
              <stop offset="100%" stopColor="#0f141c" />
            </linearGradient>
            {/* Hairline light falloff on strokes: reads as inset highlight */}
            <linearGradient id={gradLineId} x1="10" y1="11" x2="30" y2="29" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255,255,255,0.98)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.76)" />
            </linearGradient>
            <linearGradient id={gradOuterStrokeId} x1="2" y1="2" x2="38" y2="38" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="rgba(255,255,255,0.94)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.78)" />
            </linearGradient>
          </defs>

          {/* Outer frame — filled navy (light bg) or outline (dark bg) */}
          <rect
            x="1"
            y="1"
            width="38"
            height="38"
            rx={outerRx}
            fill={outerFill}
            stroke={outerStroke}
            strokeWidth={outerStrokeW}
          />

          {/* Inner geometric frame + upward mark */}
          <g clipPath={`url(#${clipId})`}>
            <rect
              x="9.5"
              y="9.5"
              width="21"
              height="21"
              rx={innerRx}
              fill="none"
              stroke={lineStroke}
              strokeWidth={innerStrokeW}
              opacity={isDark ? 0.98 : 1}
            />
            <path
              d="M14.5 25.5 L20 16.2 L25.5 25.5"
              fill="none"
              stroke={lineStroke}
              strokeWidth={chevronStrokeW}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={isDark ? 1 : 1}
            />
          </g>
        </svg>
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col justify-center",
          compact ? "gap-0 translate-y-0" : "gap-px sm:gap-0.5 md:gap-1 max-sm:translate-y-[2px] sm:translate-y-0"
        )}
      >
        <div
          className={cn(
            "flex min-w-0 items-baseline whitespace-nowrap",
            compact ? "gap-0.5 leading-none" : "gap-1 leading-[1.1] sm:leading-[1.2]"
          )}
        >
          <span
            className={cn(
              compact
                ? "text-[16px] font-semibold tracking-[-0.045em] sm:text-[17px] md:text-[18px]"
                : "text-[17px] font-semibold tracking-[-0.045em] sm:text-[19px] md:text-[21px] lg:text-[23px]",
              isDark && "text-white"
            )}
            style={!isDark ? { color: BRAND_PRIMARY } : undefined}
          >
            AtoC
          </span>
          <span
            className={cn(
              compact
                ? "text-[13px] font-normal tracking-[-0.02em] sm:text-[14px] md:text-[15px]"
                : "text-[14px] font-normal tracking-[-0.022em] sm:text-[15px] md:text-[16px] lg:text-[17px]"
            )}
            style={{ color: isDark ? BRAND_WORDMARK_KOREA_ON_DARK : BRAND_WORDMARK_KOREA }}
          >
            Korea
          </span>
        </div>
        {!compact ? (
          <p
            className="whitespace-nowrap text-[10px] font-medium uppercase leading-tight tracking-[0.12em] md:text-[10.5px] md:tracking-[0.1em]"
            style={{
              color: isDark ? BRAND_TAGLINE_ON_DARK : BRAND_TAGLINE_MUTED,
              opacity: isDark ? 0.9 : 0.82,
            }}
          >
            {TAGLINE}
          </p>
        ) : null}
      </div>
    </div>
  );
}
