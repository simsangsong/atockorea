"use client";

import { useState } from "react";
import { ChevronDown, Sun, Mountain, Wind, Check, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

const LOGIC_ICONS = {
  sun: Sun,
  mountain: Mountain,
  wind: Wind,
} as const;

export type TourFitSectionProps = Pick<EastSignatureNatureCoreDetailViewModel, "whyTourWorks" | "sectionUi">;

export function TourFitSection({ whyTourWorks, sectionUi }: TourFitSectionProps) {
  const [showLogic, setShowLogic] = useState(false);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground">{sectionUi.fitTitle}</h2>
        <p className="mt-1 text-[12px] leading-snug tracking-wide text-muted-foreground">{sectionUi.fitSubtitle}</p>
      </div>

      <div className="card-premium tour-why-tour-works-card space-y-4 p-4">
        <div className="grid grid-cols-2 gap-5">
          <div>
            <h3 className="tour-fit-micro-label mb-2">{sectionUi.fitBestForLabel}</h3>
            <ul className="space-y-1.5">
              {whyTourWorks.bestFor.map((item, i) => (
                <li key={i} className="tour-fit-list-text flex items-start gap-2 text-foreground">
                  <div className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-emerald-50/90">
                    <Check className="h-2 w-2 text-emerald-600" strokeWidth={2.5} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="tour-fit-micro-label mb-2">{sectionUi.fitLessIdealLabel}</h3>
            <ul className="space-y-1.5">
              {whyTourWorks.lessIdeal.map((item, i) => (
                <li key={i} className="tour-fit-list-text flex items-start gap-2 text-muted-foreground">
                  <div className="mt-0.5 flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full bg-slate-50/90">
                    <X className="h-2 w-2 text-slate-400" strokeWidth={2.5} />
                  </div>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-border/60 pt-3">
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
                const Icon = LOGIC_ICONS[section.icon];
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
