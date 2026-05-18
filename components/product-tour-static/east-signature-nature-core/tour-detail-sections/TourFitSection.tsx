"use client";

import { type ComponentType } from "react";
import {
  AlertTriangle,
  Baby,
  Bus,
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

function pickPersonaIcon(raw: string): LucideIcon {
  const t = raw.toLowerCase();
  if (/stroller|유모차|ベビーカー|婴儿车|嬰兒車|cochecito/.test(t)) return Baby;
  if (/very young|young child|toddler|어린|유아|幼児|幼い|幼儿|幼兒|niños pequeños|niño pequeñ/.test(t)) return Baby;
  if (/stair|cave|동굴|계단|階段|楼梯|樓梯|escaleras|cuevas/.test(t)) return AlertTriangle;
  if (/mobilit|wheelchair|휠체어|車いす|轮椅|輪椅|movilidad/.test(t)) return AlertTriangle;
  if (/couple|커플|커풀|カップル|情侣|情侶|pareja/.test(t)) return Heart;
  if (/older|senior|elderly|고령|노인|シニア|高齢|年配|长者|長者|老年|mayor|adulto mayor/.test(t)) return PersonStanding;
  if (/first[-\s]?time|first[-\s]?visit|new to|처음|첫\s?방문|初めて|初次|首次|primera vez/.test(t)) return Sparkles;
  if (/walk|trek|hik|걷|보행|걸|歩|徒步|散步|步行|caminar|caminata/.test(t)) return Footprints;
  if (/pace|full[-\s]?day|long day|페이스|속도|ペース|节奏|節奏|ritmo/.test(t)) return Clock3;
  if (/famil|가족|家族|家庭|familia/.test(t)) return Users;
  if (/mountain|hill|trail|산|언덕|코스|山|trilla|sendero/.test(t)) return Mountain;
  return Compass;
}

export type TourFitSectionProps = Pick<EastSignatureNatureCoreDetailViewModel, "whyTourWorks" | "sectionUi">;

/**
 * Sprint 3.2: 3중 nested accordion 폐기 → 2-col flat (best left / less ideal right).
 *   - Best For accordion (open) 폐기 → 항상 펼침
 *   - Less Ideal nested accordion (showLessIdeal) 폐기 → 2-col 우측에 평면 표시
 *   - Route Logic accordion (showLogic) 폐기 → 항상 펼침
 *   §B accordion 8→2 binding (FAQ + Practical만 유지).
 */
export function TourFitSection({ whyTourWorks, sectionUi }: TourFitSectionProps) {
  const lessIdealItems =
    (whyTourWorks as { lessIdealFor?: string[]; lessIdeal?: string[] }).lessIdealFor ?? whyTourWorks.lessIdeal ?? [];
  const bestForItems = whyTourWorks.bestFor ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-title text-foreground">{sectionUi.fitTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.fitSubtitle}</p>
      </div>

      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        <div className="px-5 py-4">
          <p className="text-[15px] font-semibold tracking-tight text-foreground">
            {sectionUi.fitBestForLabel}
          </p>
          <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
            {bestForItems.length} traveler types
            {lessIdealItems.length > 0 && ` · ${lessIdealItems.length} less ideal`}
          </p>
        </div>

        <div className="border-t border-slate-200/70 bg-white px-4 pt-4 pb-3 sm:px-5">
          <div className="grid gap-x-5 gap-y-4 sm:grid-cols-2">
            {/* Best For — left column */}
            <div>
              <p className="mb-2 text-eyebrow text-[var(--success-soft-text)]">
                {sectionUi.fitBestForLabel}
              </p>
              <ul className="grid grid-cols-1 gap-1.5">
                {bestForItems.map((item, i) => {
                  const Icon = pickPersonaIcon(item);
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-2.5 py-2 ring-1 ring-slate-200/70"
                    >
                      <span className="mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-white text-foreground ring-1 ring-slate-200/70">
                        <Icon className="h-3 w-3" strokeWidth={2} />
                      </span>
                      <span className="text-[12.5px] leading-snug text-foreground">{item}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            {/* Less Ideal — right column (always visible, 2-col flat) */}
            {lessIdealItems.length > 0 && (
              <div>
                <p className="mb-2 flex items-center gap-1.5 text-eyebrow text-muted-foreground">
                  <X className="h-3 w-3 text-muted-foreground" strokeWidth={2.5} />
                  {sectionUi.fitLessIdealLabel}
                </p>
                <ul className="grid grid-cols-1 gap-1.5">
                  {lessIdealItems.map((item, i) => {
                    const Icon = pickPersonaIcon(item);
                    return (
                      <li
                        key={i}
                        className="flex items-start gap-2.5 rounded-lg bg-white px-2.5 py-2 ring-1 ring-slate-200/60"
                      >
                        <span className="mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-50 text-muted-foreground ring-1 ring-slate-200/60">
                          <Icon className="h-3 w-3" strokeWidth={1.9} />
                        </span>
                        <span className="text-[12.5px] leading-snug text-muted-foreground">{item}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Families / Seniors note */}
        <div className="border-t border-slate-200/60 bg-slate-50 px-4 py-3 sm:px-5">
          <p className="text-[11.5px] leading-relaxed text-muted-foreground">
            <span className="font-semibold text-foreground">{sectionUi.fitFamiliesPrefix}</span>{" "}
            {sectionUi.fitFamiliesText}
            <span className="font-semibold text-foreground">{sectionUi.fitSeniorsPrefix}</span>{" "}
            {sectionUi.fitSeniorsText}
          </p>
        </div>
      </div>

      {/* Route logic — Sprint 3.2: accordion 폐기, 항상 펼침 */}
      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        <div className="p-4">
          <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{sectionUi.fitRouteLogicTitle}</h3>
          <p className="mt-0.5 text-[11px] leading-snug tracking-wide text-muted-foreground">{sectionUi.fitRouteLogicSubtitle}</p>
        </div>
        <div className="space-y-4 border-t border-border/60 p-4">
          {(whyTourWorks.routeLogicSections ?? []).map((section) => {
            const Icon = LOGIC_ICONS[section.icon as keyof typeof LOGIC_ICONS] ?? ROUTE_LOGIC_ICON_FALLBACK;
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
                      <p className="text-[11.5px] leading-relaxed text-muted-foreground mt-0.5">{item.detail}</p>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
