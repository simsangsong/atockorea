"use client";

import { useState, type ComponentType } from "react";
import {
  AlertTriangle,
  Baby,
  Bus,
  Check,
  ChevronDown,
  Clock3,
  CloudRain,
  Compass,
  Footprints,
  Heart,
  Mountain,
  PersonStanding,
  Sparkles,
  Sun,
  Users,
  Wind,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

/**
 * `whyTourWorks.routeLogicSections[].icon` → Lucide.
 * East/Southwest: sun, mountain, wind. Jeju Grand Highlights: clock-3, mountain, wind.
 * Bus tours: bus, footprints, cloud-rain.
 */
const LOGIC_ICONS = {
  sun: Sun,
  mountain: Mountain,
  wind: Wind,
  "clock-3": Clock3,
  bus: Bus,
  footprints: Footprints,
  "cloud-rain": CloudRain,
} as const;

const ROUTE_LOGIC_ICON_FALLBACK = Sun;

type LucideIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

/** Pick a persona-evocative icon from free-text fit/non-fit copy across locales. */
function pickPersonaIcon(raw: string): LucideIcon {
  const t = raw.toLowerCase();

  // Stroller / baby / very young children → highest priority because they often co-mention "family"
  if (/stroller|유모차|ベビーカー|婴儿车|嬰兒車|cochecito/.test(t)) return Baby;
  if (/very young|young child|toddler|어린|유아|幼児|幼い|幼儿|幼兒|niños pequeños|niño pequeñ/.test(t)) return Baby;

  // Mobility / stairs / cave warnings
  if (/stair|cave|동굴|계단|階段|楼梯|樓梯|escaleras|cuevas/.test(t)) return AlertTriangle;
  if (/mobilit|wheelchair|휠체어|車いす|轮椅|輪椅|movilidad/.test(t)) return AlertTriangle;

  // Couples
  if (/couple|커플|커풀|カップル|情侣|情侶|pareja/.test(t)) return Heart;

  // Older / senior / elderly
  if (/older|senior|elderly|고령|노인|シニア|高齢|年配|长者|長者|老年|mayor|adulto mayor/.test(t)) return PersonStanding;

  // First-time visitor
  if (/first[-\s]?time|first[-\s]?visit|new to|처음|첫\s?방문|初めて|初次|首次|primera vez/.test(t)) return Sparkles;

  // Walking / hiking pace
  if (/walk|trek|hik|걷|보행|걸|歩|徒步|散步|步行|caminar|caminata/.test(t)) return Footprints;

  // Pace / full-day struggle
  if (/pace|full[-\s]?day|long day|페이스|속도|ペース|节奏|節奏|ritmo/.test(t)) return Clock3;

  // Family / adult family — keep AFTER stroller check above
  if (/famil|가족|家族|家庭|familia/.test(t)) return Users;

  // Outdoor / nature / mountain
  if (/mountain|hill|trail|산|언덕|코스|山|trilla|sendero/.test(t)) return Mountain;

  // Default
  return Compass;
}

export type TourFitSectionProps = Pick<EastSignatureNatureCoreDetailViewModel, "whyTourWorks" | "sectionUi">;

export function TourFitSection({ whyTourWorks, sectionUi }: TourFitSectionProps) {
  const [showLogic, setShowLogic] = useState(false);
  const [showLessIdeal, setShowLessIdeal] = useState(false);

  const lessIdealItems =
    (whyTourWorks as { lessIdealFor?: string[]; lessIdeal?: string[] }).lessIdealFor ?? whyTourWorks.lessIdeal ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{sectionUi.fitTitle}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed tracking-wide text-muted-foreground">{sectionUi.fitSubtitle}</p>
      </div>

      <div className="tour-fit-premium-card tour-why-tour-works-card relative overflow-hidden p-4 sm:p-5 rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        <span aria-hidden className="tour-fit-premium-card__sheen" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="tour-fit-column__badge tour-fit-column__badge--positive">
              <Check className="h-3 w-3" strokeWidth={2.75} />
            </div>
            <h3 className="tour-fit-micro-label">{sectionUi.fitBestForLabel}</h3>
          </div>
          <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
            {(whyTourWorks.bestFor ?? []).map((item, i) => {
              const Icon = pickPersonaIcon(item);
              return (
                <li
                  key={i}
                  className="flex items-start gap-2.5 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 ring-1 ring-emerald-100/70"
                >
                  <span className="mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-100/90 text-emerald-700">
                    <Icon className="h-3 w-3" strokeWidth={2} />
                  </span>
                  <span className="text-[12.5px] leading-snug text-foreground">{item}</span>
                </li>
              );
            })}
          </ul>

          {lessIdealItems.length > 0 && (
            <div className="mt-3 border-t border-border/50 pt-3">
              <button
                type="button"
                onClick={() => setShowLessIdeal((v) => !v)}
                aria-expanded={showLessIdeal}
                className="group flex w-full items-center justify-between gap-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <div className="tour-fit-column__badge tour-fit-column__badge--negative">
                    <X className="h-3 w-3" strokeWidth={2.75} />
                  </div>
                  <h3 className="tour-fit-micro-label">{sectionUi.fitLessIdealLabel}</h3>
                  <span className="text-[10.5px] font-medium tabular-nums text-muted-foreground">
                    {lessIdealItems.length}
                  </span>
                </div>
                <ChevronDown
                  className={cn(
                    "h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform duration-200",
                    showLessIdeal && "rotate-180",
                  )}
                  strokeWidth={2}
                />
              </button>

              <div
                className={cn(
                  "grid transition-[grid-template-rows] duration-300 ease-out",
                  showLessIdeal ? "mt-2.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="overflow-hidden">
                  <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                    {lessIdealItems.map((item, i) => {
                      const Icon = pickPersonaIcon(item);
                      return (
                        <li
                          key={i}
                          className="flex items-start gap-2.5 rounded-lg bg-muted/45 px-2.5 py-1.5 ring-1 ring-border/50"
                        >
                          <span className="mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-background text-muted-foreground ring-1 ring-border/60">
                            <Icon className="h-3 w-3" strokeWidth={1.9} />
                          </span>
                          <span className="text-[12.5px] leading-snug text-muted-foreground">{item}</span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="tour-fit-premium-card__note mt-4 pt-3">
          <p className="tour-fit-note text-muted-foreground">
            <span className="font-semibold text-foreground">{sectionUi.fitFamiliesPrefix}</span> {sectionUi.fitFamiliesText}
            <span className="font-semibold text-foreground">{sectionUi.fitSeniorsPrefix}</span> {sectionUi.fitSeniorsText}
          </p>
        </div>
      </div>

      <div className="tour-why-tour-works-card overflow-hidden rounded-[24px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        <button
          type="button"
          onClick={() => setShowLogic(!showLogic)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/20"
        >
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{sectionUi.fitRouteLogicTitle}</h3>
            <p className="mt-0.5 text-[11px] leading-snug tracking-wide text-muted-foreground">{sectionUi.fitRouteLogicSubtitle}</p>
          </div>
          <div
            className={cn(
              "flex-shrink-0 rounded-full p-1.5 transition-[transform,background-color] duration-200",
              showLogic ? "rotate-180 bg-primary/10" : "bg-muted/60",
            )}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-colors", showLogic ? "text-primary" : "text-muted-foreground")} />
          </div>
        </button>

        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", showLogic ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="tour-fit-route-logic-inner space-y-4 border-t border-border/60 p-4">
              {(whyTourWorks.routeLogicSections ?? []).map((section) => {
                const Icon =
                  LOGIC_ICONS[section.icon as keyof typeof LOGIC_ICONS] ?? ROUTE_LOGIC_ICON_FALLBACK;
                return (
                  <div key={section.title}>
                    <div className="mb-2 flex items-center gap-2">
                      <div className={cn("flex h-6 w-6 items-center justify-center rounded-lg", section.iconBg)}>
                        <Icon className={cn("h-3 w-3", section.iconColor)} />
                      </div>
                      <h4 className="text-[13px] font-semibold tracking-tight text-foreground">{section.title}</h4>
                    </div>
                    <div className="space-y-2 pl-8">
                      {(section.items ?? []).map((item, i) => (
                        <div key={i}>
                          <p className="text-[12.5px] font-medium leading-snug tracking-tight text-foreground">{item.label}</p>
                          <p className="tour-fit-note mt-0.5 text-muted-foreground">{item.detail}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
