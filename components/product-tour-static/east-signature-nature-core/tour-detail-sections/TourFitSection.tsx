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

export function TourFitSection({ whyTourWorks, sectionUi }: TourFitSectionProps) {
  const [open, setOpen] = useState(false);
  const [showLessIdeal, setShowLessIdeal] = useState(false);
  const [showLogic, setShowLogic] = useState(false);

  const lessIdealItems =
    (whyTourWorks as { lessIdealFor?: string[]; lessIdeal?: string[] }).lessIdealFor ?? whyTourWorks.lessIdeal ?? [];
  const bestForItems = whyTourWorks.bestFor ?? [];

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{sectionUi.fitTitle}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed tracking-wide text-muted-foreground">{sectionUi.fitSubtitle}</p>
      </div>

      {/* ── Best For — Route Logic style, amber tint ── */}
      <div
        className="overflow-hidden rounded-[20px] shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]"
        style={{ background: "#fdf8f2" }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="flex w-full items-center justify-between px-5 py-4 text-left transition-colors"
          style={{ ["--hover-bg" as string]: "rgba(200,149,108,0.07)" }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(200,149,108,0.07)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "")}
        >
          <div>
            <p className="text-[15px] font-semibold tracking-tight text-foreground">
              {sectionUi.fitBestForLabel}
            </p>
            <p className="mt-0.5 text-[12.5px] leading-snug text-muted-foreground">
              {bestForItems.length} traveler types
              {lessIdealItems.length > 0 && ` · ${lessIdealItems.length} less ideal`}
            </p>
          </div>
          <div
            className={cn(
              "flex-shrink-0 rounded-full p-1.5 transition-[transform,background-color] duration-200",
              open ? "rotate-180" : "bg-muted/60",
            )}
            style={open ? { background: "rgba(200,149,108,0.18)" } : {}}
          >
            <ChevronDown
              className="h-3.5 w-3.5 transition-colors"
              style={{ color: open ? "#b07d55" : undefined }}
              strokeWidth={2}
            />
          </div>
        </button>

        <div
          className={cn(
            "grid transition-[grid-template-rows] duration-300 ease-out",
            open ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
          )}
        >
          <div className="overflow-hidden">
            <div className="border-t px-4 pt-4 pb-3 sm:px-5" style={{ borderColor: "rgba(200,149,108,0.20)", background: "#fdf4e8" }}>
              <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                {bestForItems.map((item, i) => {
                  const Icon = pickPersonaIcon(item);
                  return (
                    <li
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg px-2.5 py-2"
                      style={{
                        background: "rgba(200,149,108,0.07)",
                        boxShadow: "inset 0 0 0 1px rgba(200,149,108,0.16)",
                      }}
                    >
                      <span
                        className="mt-[1px] flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full"
                        style={{ background: "rgba(200,149,108,0.15)", color: "#b07d55" }}
                      >
                        <Icon className="h-3 w-3" strokeWidth={2} />
                      </span>
                      <span className="text-[12.5px] leading-snug text-foreground">{item}</span>
                    </li>
                  );
                })}
              </ul>

              {/* Less Ideal */}
              {lessIdealItems.length > 0 && (
                <div className="mt-3 border-t pt-3" style={{ borderColor: "rgba(200,149,108,0.15)" }}>
                  <button
                    type="button"
                    onClick={() => setShowLessIdeal((v) => !v)}
                    aria-expanded={showLessIdeal}
                    className="flex w-full items-center justify-between gap-2 text-left"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200/70">
                        <X className="h-3 w-3 text-slate-400" strokeWidth={2.75} />
                      </span>
                      <span className="text-[11px] font-semibold uppercase tracking-[0.10em] text-muted-foreground">
                        {sectionUi.fitLessIdealLabel}
                      </span>
                      <span className="text-[10.5px] font-medium tabular-nums text-muted-foreground/70">
                        {lessIdealItems.length}
                      </span>
                    </div>
                    <ChevronDown
                      className={cn("h-4 w-4 flex-shrink-0 text-muted-foreground/50 transition-transform duration-200", showLessIdeal && "rotate-180")}
                      strokeWidth={2}
                    />
                  </button>

                  <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", showLessIdeal ? "mt-2.5 grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0")}>
                    <div className="overflow-hidden">
                      <ul className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {lessIdealItems.map((item, i) => {
                          const Icon = pickPersonaIcon(item);
                          return (
                            <li key={i} className="flex items-start gap-2.5 rounded-lg bg-muted/45 px-2.5 py-2 ring-1 ring-border/50">
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

            {/* Families / Seniors note */}
            <div className="border-t px-4 py-3 sm:px-5" style={{ borderColor: "rgba(200,149,108,0.18)", background: "rgba(200,149,108,0.06)" }}>
              <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">{sectionUi.fitFamiliesPrefix}</span>{" "}
                {sectionUi.fitFamiliesText}
                <span className="font-semibold text-foreground">{sectionUi.fitSeniorsPrefix}</span>{" "}
                {sectionUi.fitSeniorsText}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Route logic — unchanged white. Hidden when no sections are authored
            (e.g. private-charter products that drop the route-selection logic). ── */}
      {(whyTourWorks.routeLogicSections?.length ?? 0) > 0 && (
      <div className="overflow-hidden rounded-[20px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        <button
          type="button"
          onClick={() => setShowLogic(!showLogic)}
          className="flex w-full items-center justify-between p-4 text-left transition-colors hover:bg-muted/20"
        >
          <div>
            <h3 className="text-[13px] font-semibold tracking-tight text-foreground">{sectionUi.fitRouteLogicTitle}</h3>
            <p className="mt-0.5 text-[11px] leading-snug tracking-wide text-muted-foreground">{sectionUi.fitRouteLogicSubtitle}</p>
          </div>
          <div className={cn("flex-shrink-0 rounded-full p-1.5 transition-[transform,background-color] duration-200", showLogic ? "rotate-180 bg-primary/10" : "bg-muted/60")}>
            <ChevronDown className={cn("h-3.5 w-3.5 transition-colors", showLogic ? "text-primary" : "text-muted-foreground")} />
          </div>
        </button>

        <div className={cn("grid transition-[grid-template-rows] duration-300 ease-out", showLogic ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
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
      </div>
      )}
    </div>
  );
}
