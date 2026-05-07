"use client";

import { useState, type ComponentType } from "react";
import {
  AlarmClock,
  ArrowRight,
  BellRing,
  CheckCircle,
  ChevronDown,
  Clock3,
  Compass,
  Heart,
  MailCheck,
  MapPin,
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

/** Trust card theme keyed by icon — gradient pastel surface + colored icon ring, matching Seasonal variation cards. */
const TRUST_THEMES: Record<string, TrustTheme> = {
  "check-circle": {
    card: "bg-gradient-to-br from-emerald-50 via-white to-emerald-100/50",
    ring: "ring-emerald-100/70",
    iconRing: "bg-gradient-to-br from-emerald-100 to-emerald-200/60 ring-emerald-200/60",
    iconColor: "text-emerald-600",
  },
  route: {
    card: "bg-gradient-to-br from-sky-50 via-white to-sky-100/50",
    ring: "ring-sky-100/70",
    iconRing: "bg-gradient-to-br from-sky-100 to-sky-200/60 ring-sky-200/60",
    iconColor: "text-sky-600",
  },
  users: {
    card: "bg-gradient-to-br from-amber-50 via-white to-amber-100/50",
    ring: "ring-amber-100/70",
    iconRing: "bg-gradient-to-br from-amber-100 to-amber-200/70 ring-amber-200/60",
    iconColor: "text-amber-600",
  },
  "clock-3": {
    card: "bg-gradient-to-br from-orange-50 via-white to-orange-100/50",
    ring: "ring-orange-100/70",
    iconRing: "bg-gradient-to-br from-orange-100 to-orange-200/60 ring-orange-200/60",
    iconColor: "text-orange-600",
  },
  mountain: {
    card: "bg-gradient-to-br from-rose-50 via-white to-rose-100/50",
    ring: "ring-rose-100/70",
    iconRing: "bg-gradient-to-br from-rose-100 to-rose-200/60 ring-rose-200/60",
    iconColor: "text-rose-600",
  },
};

const TRUST_THEME_FALLBACK: TrustTheme = {
  card: "bg-gradient-to-br from-slate-50 via-white to-slate-100/40",
  ring: "ring-border/60",
  iconRing: "bg-gradient-to-br from-slate-100 to-slate-200/60 ring-border/60",
  iconColor: "text-slate-600",
};

type LucideIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

type StepTheme = {
  Icon: LucideIcon;
  ringBg: string;
  iconColor: string;
  spineFrom: string;
  eyebrow: string;
};

/** Match step phase from timing + title text across locales. Order matters: more specific first. */
function pickStepTheme(timing: string, title: string, fallbackIndex: number): StepTheme {
  const t = `${timing} ${title}`.toLowerCase();

  if (/confirm|confirmación|확인|예약\s?완료|予約.*完了|预订.*确认|預訂.*確認|after\s?booking/.test(t))
    return {
      Icon: MailCheck,
      ringBg: "bg-emerald-50/80 ring-emerald-100",
      iconColor: "text-emerald-600/80",
      spineFrom: "from-emerald-200/45",
      eyebrow: "text-emerald-700/85",
    };
  if (/12\s?hour|reminder|recordatori|리마인|事前|提前\s?12|前\s?12|pre[-\s]?depart/.test(t))
    return {
      Icon: BellRing,
      ringBg: "bg-amber-50/80 ring-amber-100",
      iconColor: "text-amber-600/80",
      spineFrom: "from-amber-200/40",
      eyebrow: "text-amber-700/85",
    };
  if (/night|noche|前夜|前夕|夜|밤|전날|hours?\s?before|final\s?pickup/.test(t))
    return {
      Icon: Moon,
      ringBg: "bg-indigo-50/80 ring-indigo-100",
      iconColor: "text-indigo-600/80",
      spineFrom: "from-indigo-200/40",
      eyebrow: "text-indigo-700/85",
    };
  if (/morning|day[-\s]?of|出発|当日|當日|아침|당일|mañana|departure/.test(t))
    return {
      Icon: Sunrise,
      ringBg: "bg-orange-50/80 ring-orange-100",
      iconColor: "text-orange-600/80",
      spineFrom: "from-orange-200/40",
      eyebrow: "text-orange-700/85",
    };
  if (/during|stop[-\s]?by|en\s?ruta|途中|沿途|투어\s?중|in[-\s]?tour|on[-\s]?route|guidance/.test(t))
    return {
      Icon: Compass,
      ringBg: "bg-sky-50/80 ring-sky-100",
      iconColor: "text-sky-600/80",
      spineFrom: "from-sky-200/40",
      eyebrow: "text-sky-700/85",
    };
  if (/after.*tour|post[-\s]?tour|follow[-\s]?up|마친\s?후|完了後|完成後|结束后|posterior|seguimiento/.test(t))
    return {
      Icon: Sparkles,
      ringBg: "bg-rose-50/80 ring-rose-100",
      iconColor: "text-rose-600/80",
      spineFrom: "from-rose-200/40",
      eyebrow: "text-rose-700/85",
    };

  // Generic fallback by position
  const fallbacks: StepTheme[] = [
    { Icon: MailCheck, ringBg: "bg-emerald-50/80 ring-emerald-100", iconColor: "text-emerald-600/80", spineFrom: "from-emerald-200/45", eyebrow: "text-emerald-700/85" },
    { Icon: BellRing, ringBg: "bg-amber-50/80 ring-amber-100", iconColor: "text-amber-600/80", spineFrom: "from-amber-200/40", eyebrow: "text-amber-700/85" },
    { Icon: Moon, ringBg: "bg-indigo-50/80 ring-indigo-100", iconColor: "text-indigo-600/80", spineFrom: "from-indigo-200/40", eyebrow: "text-indigo-700/85" },
    { Icon: Sunrise, ringBg: "bg-orange-50/80 ring-orange-100", iconColor: "text-orange-600/80", spineFrom: "from-orange-200/40", eyebrow: "text-orange-700/85" },
    { Icon: Compass, ringBg: "bg-sky-50/80 ring-sky-100", iconColor: "text-sky-600/80", spineFrom: "from-sky-200/40", eyebrow: "text-sky-700/85" },
    { Icon: Sparkles, ringBg: "bg-rose-50/80 ring-rose-100", iconColor: "text-rose-600/80", spineFrom: "from-rose-200/40", eyebrow: "text-rose-700/85" },
  ];
  return fallbacks[fallbackIndex % fallbacks.length] ?? fallbacks[0];
}

export type TourBookingSupportSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "bookingTrustItems" | "bookingSupportSteps" | "sectionUi"
>;

export function TourBookingSupportSection({ bookingTrustItems, bookingSupportSteps, sectionUi }: TourBookingSupportSectionProps) {
  /** Flow is core content; open by default so travelers see the sequence without an extra click. */
  const [showTimeline, setShowTimeline] = useState(true);
  const trustItems = bookingTrustItems ?? [];
  const supportSteps = bookingSupportSteps ?? [];
  const hasSupportSteps = supportSteps.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.bookingSupportTitle}</h2>
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
                "group relative overflow-hidden rounded-xl p-3 ring-1 transition-all duration-300",
                "shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_14px_-4px_rgba(0,0,0,0.07)]",
                "hover:-translate-y-[1px] hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_8px_20px_-4px_rgba(0,0,0,0.10)]",
                theme.card,
                theme.ring,
              )}
            >
              <span aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-white/65 to-transparent" />
              <div
                className={cn(
                  "relative mb-2 flex h-7 w-7 items-center justify-center rounded-full ring-1 transition-transform duration-300 group-hover:scale-[1.06]",
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
        <div className="card-premium overflow-hidden">
          <button
            type="button"
            onClick={() => setShowTimeline(!showTimeline)}
            className="w-full flex items-center justify-between p-5 text-left hover:bg-muted/20 transition-colors"
          >
            <div>
              <h3 className="text-sm font-semibold text-foreground">{sectionUi.bookingAfterTitle}</h3>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-prose">{sectionUi.bookingAfterSubtitle}</p>
            </div>
            <div
              className={cn(
                "flex-shrink-0 p-1.5 rounded-full transition-all duration-200",
                showTimeline ? "bg-primary/10 rotate-180" : "bg-muted/60",
              )}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-colors", showTimeline ? "text-primary" : "text-muted-foreground")}
              />
            </div>
          </button>

          <div className={cn("grid transition-all duration-300 ease-out", showTimeline ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
            <div className="overflow-hidden">
              <div className="border-t border-border/60 p-5 md:p-6">
                {/* Mobile: vertical flowchart with phase-icon spine */}
                <div className="md:hidden">
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
                          <p className={cn("text-[9.5px] font-semibold uppercase tracking-[0.14em]", theme.eyebrow)}>{step.timing}</p>
                          <p className="text-[14px] font-semibold text-foreground mt-0.5 leading-snug tracking-tight">{step.title}</p>
                          <p className="text-[12px] text-muted-foreground mt-1 leading-snug line-clamp-2">{step.detail}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* md+: left-to-right flow; scroll when many steps */}
                <div className="hidden md:block overflow-x-auto pb-0.5 [-webkit-overflow-scrolling:touch]">
                  <div className="flex min-w-0 items-stretch gap-2 md:min-w-min lg:gap-3">
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
        </div>
      ) : null}
    </div>
  );
}
