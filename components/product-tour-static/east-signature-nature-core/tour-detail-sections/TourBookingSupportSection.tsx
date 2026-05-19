"use client";

import { Fragment, useState, type ComponentType } from "react";
import {
  ArrowRight,
  BellRing,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Clock3,
  Compass,
  MailCheck,
  Moon,
  Mountain,
  Route,
  Sparkles,
  Sunrise,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

/**
 * `bookingTrustItems[].icon` → Lucide. East/Southwest: check-circle, route, users.
 * Jeju Grand Highlights: clock-3, mountain, users.
 */
const TRUST_ICONS = {
  "check-circle": CheckCircle,
  route: Route,
  users: Users,
  "clock-3": Clock3,
  mountain: Mountain,
} as const;

const DEFAULT_TRUST_ICON = CheckCircle;

type TrustTheme = {
  card: string;
  ring: string;
  iconRing: string;
  iconColor: string;
};

/*
 * 사용자 지시 (2026-05-18) §B-P8: Booking Support Trust 3-grid 실험 카드 —
 *   연한 민트 + 모던 메탈 + 디지털 科技感.
 *   Sprint 2.10 (1색 neutral) 대신 mint gradient + 4-layer 메탈 sheen + 코너 cyan halo (sci-fi 깊이).
 */
const TRUST_THEME_SHARED: TrustTheme = {
  card: "bg-gradient-to-br from-emerald-50/70 via-white to-teal-50/40",
  ring: "ring-teal-100/55",
  iconRing: "bg-white/80 ring-teal-200/50",
  iconColor: "text-foreground",
};
const TRUST_THEMES: Record<string, TrustTheme> = {
  "check-circle": TRUST_THEME_SHARED,
  route: TRUST_THEME_SHARED,
  users: TRUST_THEME_SHARED,
  "clock-3": TRUST_THEME_SHARED,
  mountain: TRUST_THEME_SHARED,
};

const TRUST_THEME_FALLBACK: TrustTheme = TRUST_THEME_SHARED;

type LucideIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

type StepTheme = {
  Icon: LucideIcon;
  ringBg: string;
  iconColor: string;
  spineFrom: string;
  eyebrow: string;
};

/*
 * Sprint 2.10: 6색 step phase → 1색 neutral. icon shape (MailCheck/BellRing/
 * Moon/Sunrise/Compass/Sparkles)이 phase 차별화, 색은 단일.
 */
const STEP_NEUTRAL: Omit<StepTheme, "Icon"> = {
  ringBg: "bg-slate-50 ring-slate-200/70",
  iconColor: "text-foreground/80",
  spineFrom: "from-slate-200/55",
  eyebrow: "text-muted-foreground",
};

/** Match step phase from timing + title text across locales. Order matters: more specific first. */
function pickStepTheme(timing: string, title: string, fallbackIndex: number): StepTheme {
  const t = `${timing} ${title}`.toLowerCase();

  if (/confirm|confirmación|확인|예약\s?완료|予約.*完了|预订.*确认|預訂.*確認|after\s?booking/.test(t))
    return { Icon: MailCheck, ...STEP_NEUTRAL };
  if (/12\s?hour|reminder|recordatori|리마인|事前|提前\s?12|前\s?12|pre[-\s]?depart/.test(t))
    return { Icon: BellRing, ...STEP_NEUTRAL };
  if (/night|noche|前夜|前夕|夜|밤|전날|hours?\s?before|final\s?pickup/.test(t))
    return { Icon: Moon, ...STEP_NEUTRAL };
  if (/morning|day[-\s]?of|出発|当日|當日|아침|당일|mañana|departure/.test(t))
    return { Icon: Sunrise, ...STEP_NEUTRAL };
  if (/during|stop[-\s]?by|en\s?ruta|途中|沿途|투어\s?중|in[-\s]?tour|on[-\s]?route|guidance/.test(t))
    return { Icon: Compass, ...STEP_NEUTRAL };
  if (/after.*tour|post[-\s]?tour|follow[-\s]?up|마친\s?후|完了後|完成後|结束后|posterior|seguimiento/.test(t))
    return { Icon: Sparkles, ...STEP_NEUTRAL };

  // Generic fallback by position
  const fallbacks: StepTheme[] = [
    { Icon: MailCheck, ...STEP_NEUTRAL },
    { Icon: BellRing, ...STEP_NEUTRAL },
    { Icon: Moon, ...STEP_NEUTRAL },
    { Icon: Sunrise, ...STEP_NEUTRAL },
    { Icon: Compass, ...STEP_NEUTRAL },
    { Icon: Sparkles, ...STEP_NEUTRAL },
  ];
  return fallbacks[fallbackIndex % fallbacks.length] ?? fallbacks[0];
}

export type TourBookingSupportSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "bookingTrustItems" | "bookingSupportSteps" | "sectionUi"
>;

export function TourBookingSupportSection({ bookingTrustItems, bookingSupportSteps, sectionUi }: TourBookingSupportSectionProps) {
  /**
   * Sprint 5.1 (§B-P4 1차 visible scope 재정의): default-closed.
   * 6-step timeline = 2차 정보 (mobile vertical 600px+ text wall). Trust 3-grid가
   * 1차 신뢰 신호 역할; 6-step은 §B-P5 미리보기 1줄 + §B-P6 4-layer hierarchy + 6 phase
   * icon row inline + underlined reveal으로 재구성.
   */
  const [showTimeline, setShowTimeline] = useState(false);
  const trustItems = bookingTrustItems ?? [];
  const supportSteps = bookingSupportSteps ?? [];
  const hasSupportSteps = supportSteps.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-title text-foreground">{sectionUi.bookingSupportTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.bookingSupportSubtitle}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {trustItems.map((item) => {
          const Icon = TRUST_ICONS[item.icon as keyof typeof TRUST_ICONS] ?? DEFAULT_TRUST_ICON;
          const theme = TRUST_THEMES[item.icon as keyof typeof TRUST_THEMES] ?? TRUST_THEME_FALLBACK;
          return (
            <div
              key={item.title}
              className={cn(
                "group relative overflow-hidden rounded-xl p-3 ring-1 transition-[transform,box-shadow] duration-300 ease-out",
                /* mint shadow tier — single soft + tech-tinted depth (cyan glow) */
                "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_14px_-4px_rgba(15,23,42,0.07),0_10px_28px_-12px_rgba(20,184,166,0.18)]",
                "hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_20px_-4px_rgba(15,23,42,0.10),0_18px_36px_-14px_rgba(20,184,166,0.30)]",
                theme.card,
                theme.ring,
              )}
            >
              {/* (1) inner top white sheen — polished edge */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/80 to-transparent" />
              {/* (2) diagonal metal sheen — soft cross-surface reflection */}
              <span aria-hidden className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/40 via-transparent to-teal-200/10" />
              {/* (3) bottom subtle mint shading — curve illusion */}
              <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-teal-200/14 to-transparent" />
              {/* (4) hairline top edge — polished metal edge */}
              <span aria-hidden className="pointer-events-none absolute top-0 inset-x-[10%] h-px bg-gradient-to-r from-transparent via-white/85 to-transparent" />
              {/* (5 sci-fi) bottom-right cyan halo blur — 科技感 holographic depth */}
              <span aria-hidden className="pointer-events-none absolute -bottom-6 -right-6 h-16 w-16 rounded-full bg-cyan-200/22 blur-2xl" />
              {/* (6 sci-fi) horizontal hairline tech accent — precision blade */}
              <span aria-hidden className="pointer-events-none absolute top-[58%] left-[12%] right-[12%] h-px bg-gradient-to-r from-transparent via-teal-300/30 to-transparent" />
              <div
                className={cn(
                  "relative mb-2 flex h-7 w-7 items-center justify-center rounded-full ring-1 transition-transform duration-300 group-hover:scale-[1.06]",
                  "shadow-[inset_0_1px_0_rgba(255,255,255,0.85)]",
                  theme.iconRing,
                )}
              >
                <Icon className={cn("h-3.5 w-3.5", theme.iconColor)} strokeWidth={1.8} />
              </div>
              <h3 className="relative text-[12px] font-semibold tracking-tight text-foreground leading-snug">{item.title}</h3>
            </div>
          );
        })}
      </div>

      {hasSupportSteps ? (
        /* Sprint 5.1 (§B-P4+P5+P6): default-closed + 4-layer hierarchy + 6 phase icon row + underlined reveal. */
        <div
          className={cn(
            "group relative overflow-hidden rounded-2xl bg-white",
            "ring-1 ring-slate-200/70",
            "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_12px_-4px_rgba(15,23,42,0.10)]",
            "transition-[transform,box-shadow] duration-300 ease-out",
            "hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(15,23,42,0.06),0_8px_20px_-4px_rgba(15,23,42,0.12)]",
          )}
        >
          {/* §B-P6 (3): inner top highlight (top 1/3 white/65 gradient) */}
          <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />

          <button
            type="button"
            onClick={() => setShowTimeline((v) => !v)}
            aria-expanded={showTimeline}
            aria-label={sectionUi.bookingAfterTitle}
            className="relative block w-full text-left p-5 sm:p-6"
          >
            {/* §B-P6 (1) layer 1: title */}
            <h3 className="text-[15px] font-semibold tracking-tight text-foreground leading-snug">
              {sectionUi.bookingAfterTitle}
            </h3>
            {/* §B-P6 (1) layer 2: preview prose (편집된 editorial subtitle) */}
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted-foreground">
              {sectionUi.bookingAfterSubtitle}
            </p>

            {/* §B-P6 (4) layer 3: 6 phase icon row inline (sequence visible without expand) */}
            <div className="mt-3.5 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
              {supportSteps.map((step, i) => {
                const phaseTheme = pickStepTheme(step.timing ?? "", step.title ?? "", i);
                const PhaseIcon = phaseTheme.Icon;
                return (
                  <Fragment key={`closed-phase-${i}`}>
                    <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 ring-1 ring-slate-200/70 transition-transform duration-300 group-hover:scale-[1.05]">
                      <PhaseIcon className="h-3 w-3 text-foreground/80" strokeWidth={1.7} />
                    </span>
                    {i < supportSteps.length - 1 ? (
                      <ChevronRight aria-hidden className="h-3 w-3 flex-shrink-0 text-muted-foreground/40" strokeWidth={1.7} />
                    ) : null}
                  </Fragment>
                );
              })}
            </div>

            {/* §B-P5 (2) layer 4: underlined chevron as reveal affordance (i18n-safe, no text) */}
            <div className="mt-4 flex items-center justify-end border-t border-slate-200/60 pt-3">
              <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-[var(--primary)] underline decoration-[1.5px] underline-offset-[3px] group-hover:opacity-80 transition-opacity">
                <ChevronDown
                  className={cn(
                    "h-4 w-4 transition-transform duration-200",
                    showTimeline && "rotate-180",
                  )}
                  strokeWidth={2}
                />
              </span>
            </div>
          </button>

          {/* §B-P5 (4) + §B-P11 (Sprint 5.9): book-page cascade reveal.
              Container = grid-rows 360ms ease-out-quint (CSS .book-cascade);
              children = 480ms unfold with 60ms stagger (top-pivot rotateX -6°);
              CSS-only via [data-state], reduced-motion CSS fallback. */}
          <div
            className="relative book-cascade"
            data-state={showTimeline ? "open" : "closed"}
          >
            <div className="border-t border-border/60 p-5 md:p-6">
                {/* Mobile: vertical flowchart with phase-icon spine */}
                <div className="md:hidden book-cascade-list">
                  {supportSteps.map((step, i) => {
                    const theme = pickStepTheme(step.timing ?? "", step.title ?? "", i);
                    const StepIcon = theme.Icon;
                    return (
                      <div key={`m-${i}-${step.title}`} className="flex items-stretch gap-3">
                        <div className="flex w-7 flex-shrink-0 flex-col items-center pt-[3px]">
                          <div
                            className={cn(
                              "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-1",
                              theme.ringBg,
                            )}
                          >
                            <StepIcon className={cn("h-3 w-3", theme.iconColor)} strokeWidth={1.7} />
                          </div>
                          {i < supportSteps.length - 1 ? (
                            <div className={cn("min-h-[0.5rem] flex-1 w-px self-center bg-gradient-to-b to-border/25", theme.spineFrom)} />
                          ) : null}
                        </div>
                        <div className={cn("min-w-0 flex-1", i < supportSteps.length - 1 ? "pb-4" : "pb-0")}>
                          <p className={cn("text-eyebrow", theme.eyebrow)}>{step.timing}</p>
                          <p className="text-[14px] font-semibold text-foreground mt-0.5 leading-snug tracking-tight">{step.title}</p>
                          <p className="text-[12px] text-muted-foreground mt-1 leading-snug line-clamp-2">{step.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* md+: left-to-right flow; scroll when many steps */}
                <div className="hidden md:block overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                  <div className="flex min-w-0 items-stretch gap-2 md:min-w-min lg:gap-3 book-cascade-list">
                    {supportSteps.map((step, i) => {
                      const theme = pickStepTheme(step.timing ?? "", step.title ?? "", i);
                      const StepIcon = theme.Icon;
                      return (
                        <div key={`d-${i}-${step.title}`} className="flex min-w-0 items-stretch">
                          <div className="flex w-[min(100%,17.5rem)] min-w-[12rem] sm:min-w-[13rem] flex-col rounded-xl border border-border/50 bg-gradient-to-b from-background via-background to-muted/15 p-4 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_8px_22px_-12px_rgba(26,35,50,0.14)]">
                            <div className="mb-2 flex items-start gap-2">
                              <span
                                className={cn(
                                  "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full ring-1",
                                  theme.ringBg,
                                )}
                              >
                                <StepIcon className={cn("h-3 w-3", theme.iconColor)} strokeWidth={1.7} />
                              </span>
                              <p className={cn("min-w-0 flex-1 text-[9.5px] font-semibold uppercase leading-tight tracking-[0.14em] pt-[5px]", theme.eyebrow)}>
                                {step.timing}
                              </p>
                            </div>
                            <p className="text-[14px] font-semibold text-foreground leading-snug tracking-tight">{step.title}</p>
                            <p className="mt-1.5 text-[12px] text-muted-foreground leading-snug line-clamp-2">{step.detail}</p>
                          </div>
                          {i < supportSteps.length - 1 ? (
                            <div className="flex w-5 flex-shrink-0 items-center justify-center self-center text-muted-foreground/40 sm:w-6">
                              <ArrowRight className="h-4 w-4" aria-hidden />
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
