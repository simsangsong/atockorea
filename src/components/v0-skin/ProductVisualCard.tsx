"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type ProductVisualCardProps = {
  /** Background image URL — parent is responsible for CDN/domain allowlist if using Next/Image elsewhere */
  imageUrl: string;
  imageAlt?: string;
  badge?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Optional list area — parent renders rows (e.g. with Check icons) */
  bullets?: ReactNode;
  /** Primary action area — Link or button from parent */
  footer?: ReactNode;
  compact?: boolean;
  className?: string;
};

/**
 * Image + HeroPremium-style dusk (teal/navy) overlay + bottom content stack. No prices or CTA logic.
 */
export function ProductVisualCard({
  imageUrl,
  imageAlt = "",
  badge,
  title,
  description,
  bullets,
  footer,
  compact = false,
  className,
}: ProductVisualCardProps) {
  return (
    <div
      className={cn(
        "v0-card-image-shell relative",
        compact ? "min-h-[13rem]" : "min-h-[24rem] sm:min-h-[24rem]",
        className,
      )}
    >
      <div
        className="absolute inset-0 bg-cover bg-center [filter:saturate(0.88)_contrast(1.1)_brightness(0.74)_hue-rotate(6deg)]"
        style={{ backgroundImage: `url('${imageUrl}')` }}
        aria-hidden
      />
      {/* HeroPremium 피처 카드와 동일 계열 필터 — 약 10% 연하게 + 은은한 그린 보강 */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_110%_85%_at_50%_38%,rgba(35,90,98,0.38)_0%,rgba(20,55,68,0.2)_45%,transparent_68%)] mix-blend-soft-light"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(200deg,rgba(6,14,28,0.74)_0%,rgba(15,35,55,0.32)_38%,transparent_62%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_100%_70%_at_88%_8%,rgba(12,28,48,0.5)_0%,transparent_52%)]"
        aria-hidden
      />
      {/* 살짝 초록 스며듦 (teal → emerald) */}
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(155deg,rgba(22,78,58,0.16)_0%,transparent_48%,rgba(18,62,52,0.12)_100%)] mix-blend-soft-light"
        aria-hidden
      />
      <div className="pointer-events-none absolute inset-0 bg-slate-900/32 mix-blend-multiply" aria-hidden />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_120%_55%_at_50%_100%,rgba(190,130,95,0.08)_0%,transparent_48%)] mix-blend-soft-light"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(5,12,24,0.87)_0%,rgba(12,40,52,0.52)_26%,rgba(18,55,62,0.29)_46%,transparent_74%)]"
        aria-hidden
      />
      {/* 반투명 유리 — 살짝 블러 (위 레이어 위에) */}
      <div
        className="pointer-events-none absolute inset-0 bg-white/[0.08] backdrop-blur-[11.4px] backdrop-saturate-150 sm:backdrop-blur-[15.2px]"
        aria-hidden
      />
      <div
        className={cn(
          "relative z-[1] flex h-full min-h-[inherit] flex-col justify-end text-white",
          compact ? "p-4" : "p-5",
        )}
      >
        {imageAlt ? <span className="sr-only">{imageAlt}</span> : null}
        {badge != null ? <div className="inline-flex w-fit">{badge}</div> : null}
        <div
          className={cn(
            "mt-3 font-black leading-[1.02] text-white",
            compact ? "text-[1.35rem]" : "text-[1.65rem] sm:text-[1.85rem]",
          )}
        >
          {title}
        </div>
        {description ? (
          <div
            className={cn(
              "mt-2 max-w-[18rem] whitespace-pre-line text-slate-200",
              compact ? "text-[11px] leading-5" : "text-[12px] leading-5",
            )}
          >
            {description}
          </div>
        ) : null}
        {bullets ? (
          <div className={cn("mt-4 space-y-2", compact ? "text-[11px]" : "text-[12px]")}>{bullets}</div>
        ) : null}
        {footer ? <div className={cn("mt-5 w-full", compact ? "" : "")}>{footer}</div> : null}
      </div>
    </div>
  );
}
