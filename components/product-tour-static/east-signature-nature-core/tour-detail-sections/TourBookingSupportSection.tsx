"use client";

import { type ComponentType } from "react";
import {
  BellRing,
  CheckCircle,
  Clock3,
  Compass,
  MailCheck,
  Moon,
  Mountain,
  Route,
  ShieldCheck,
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

/** Per-icon accent — the 5-hue assignment survives W2.5 (§B: only the grid
 *  LAYOUT was retired; step/trust hues are preserved). */
const TRUST_ICON_COLORS: Record<string, string> = {
  "check-circle": "text-emerald-600",
  route: "text-sky-600",
  users: "text-amber-600",
  "clock-3": "text-orange-600",
  mountain: "text-rose-600",
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

/**
 * W2.5 — the old boxed accordion + 3-col trust grid + desktop card row are
 * retired (LAYOUT only): every step keeps its count, copy (timing/title/
 * detail) and per-phase hue on a single slim stepline, open by default —
 * zero clicks to read (§F-3 conviction tier).
 *
 * W4.4 — the trust-item copy moves into the "Operated by AtoC Korea" card
 * below the stepline (not a new top-level section).
 */
export function TourBookingSupportSection({ bookingTrustItems, bookingSupportSteps, sectionUi }: TourBookingSupportSectionProps) {
  const trustItems = bookingTrustItems ?? [];
  const supportSteps = bookingSupportSteps ?? [];
  const hasSupportSteps = supportSteps.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.bookingSupportTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed max-w-prose">{sectionUi.bookingAfterSubtitle}</p>
      </div>

      {hasSupportSteps ? (
        <div className="max-w-prose">
          {supportSteps.map((step, i) => {
            const theme = pickStepTheme(step.timing ?? "", step.title ?? "", i);
            const StepIcon = theme.Icon;
            return (
              <div key={`${i}-${step.title}`} className="flex items-stretch gap-3">
                <div className="flex w-6 flex-shrink-0 flex-col items-center pt-[2px]">
                  <div
                    className={cn(
                      "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full ring-1",
                      theme.ringBg,
                    )}
                  >
                    <StepIcon className={cn("h-3 w-3", theme.iconColor)} strokeWidth={1.7} />
                  </div>
                  {i < supportSteps.length - 1 ? (
                    <div className={cn("min-h-[0.5rem] w-px flex-1 self-center bg-gradient-to-b to-border/25", theme.spineFrom)} />
                  ) : null}
                </div>
                <div className={cn("min-w-0 flex-1", i < supportSteps.length - 1 ? "pb-3.5" : "pb-0")}>
                  <p className="leading-snug">
                    <span className={cn("text-[9.5px] font-semibold uppercase tracking-[0.14em]", theme.eyebrow)}>{step.timing}</span>
                  </p>
                  <p className="mt-0.5 text-[13.5px] font-semibold leading-snug tracking-tight text-foreground">{step.title}</p>
                  <p className="mt-0.5 text-[12px] leading-snug text-muted-foreground">{step.detail}</p>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-[12px] leading-relaxed text-muted-foreground">{sectionUi.bookingSupportEmptyHint}</p>
      )}

      {/* W4.4 — direct-operation trust card (absorbs the old trust-grid copy). */}
      {trustItems.length > 0 ? (
        <div className="rounded-2xl border border-border/70 bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-emerald-600" strokeWidth={2} aria-hidden />
            <h3 className="text-[13.5px] font-semibold tracking-tight text-foreground">
              {sectionUi.operatedByTitle ?? "Operated by AtoC Korea"}
            </h3>
          </div>
          <ul className="mt-2.5 space-y-1.5">
            {trustItems.map((item) => {
              const Icon = TRUST_ICONS[item.icon as keyof typeof TRUST_ICONS] ?? DEFAULT_TRUST_ICON;
              const color = TRUST_ICON_COLORS[item.icon ?? ""] ?? "text-slate-600";
              return (
                <li key={item.title} className="flex items-center gap-2 text-[12.5px] font-medium text-foreground">
                  <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} strokeWidth={1.9} aria-hidden />
                  {item.title}
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
