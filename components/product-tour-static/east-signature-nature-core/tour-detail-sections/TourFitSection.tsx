"use client";

import { useState } from "react";
import { ChevronDown, Sun, Mountain, Wind, Clock3, Check, X, Bus, Footprints, CloudRain } from "lucide-react";
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

export type TourFitSectionProps = Pick<EastSignatureNatureCoreDetailViewModel, "whyTourWorks" | "sectionUi">;

export function TourFitSection({ whyTourWorks, sectionUi }: TourFitSectionProps) {
  const [showLogic, setShowLogic] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-[17px] font-semibold tracking-[-0.02em] text-foreground">{sectionUi.fitTitle}</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed tracking-wide text-muted-foreground">{sectionUi.fitSubtitle}</p>
      </div>

      <div className="tour-fit-premium-card card-premium tour-why-tour-works-card relative overflow-hidden p-5 sm:p-6">
        <span aria-hidden className="tour-fit-premium-card__sheen" />
        <div className="tour-fit-premium-grid grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-0 relative">
          <div className="tour-fit-column tour-fit-column--positive">
            <div className="flex items-center gap-2 mb-3">
              <div className="tour-fit-column__badge tour-fit-column__badge--positive">
                <Check className="h-3 w-3" strokeWidth={2.75} />
              </div>
              <h3 className="tour-fit-micro-label">{sectionUi.fitBestForLabel}</h3>
            </div>
            <ul className="space-y-2">
              {whyTourWorks.bestFor.map((item, i) => (
                <li key={i} className="tour-fit-list-text flex items-start gap-2.5 text-foreground">
                  <span aria-hidden className="tour-fit-bullet tour-fit-bullet--positive mt-[7px]" />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="tour-fit-column tour-fit-column--negative">
            <div className="flex items-center gap-2 mb-3">
              <div className="tour-fit-column__badge tour-fit-column__badge--negative">
                <X className="h-3 w-3" strokeWidth={2.75} />
              </div>
              <h3 className="tour-fit-micro-label">{sectionUi.fitLessIdealLabel}</h3>
            </div>
            <ul className="space-y-2">
              {whyTourWorks.lessIdeal.map((item, i) => (
                <li key={i} className="tour-fit-list-text flex items-start gap-2.5 text-muted-foreground">
                  <span aria-hidden className="tour-fit-bullet tour-fit-bullet--negative mt-[7px]" />
                  <span className="flex-1">{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="tour-fit-premium-card__note mt-5 pt-4">
          <p className="tour-fit-note text-muted-foreground">
            <span className="font-semibold text-foreground">{sectionUi.fitFamiliesPrefix}</span> {sectionUi.fitFamiliesText}
            <span className="font-semibold text-foreground">{sectionUi.fitSeniorsPrefix}</span> {sectionUi.fitSeniorsText}
          </p>
        </div>
      </div>

      <div className="card-premium tour-why-tour-works-card overflow-hidden">
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
              "flex-shrink-0 rounded-full p-1.5 transition-all duration-200",
              showLogic ? "rotate-180 bg-primary/10" : "bg-muted/60",
            )}
          >
            <ChevronDown className={cn("h-3.5 w-3.5 transition-colors", showLogic ? "text-primary" : "text-muted-foreground")} />
          </div>
        </button>

        <div className={cn("grid transition-all duration-300 ease-out", showLogic ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="tour-fit-route-logic-inner space-y-4 border-t border-border/60 p-4">
              {whyTourWorks.routeLogicSections.map((section) => {
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
                      {section.items.map((item, i) => (
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
