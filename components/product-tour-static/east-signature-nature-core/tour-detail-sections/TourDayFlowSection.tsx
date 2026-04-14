import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";

export type TourDayFlowSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "routeFlowStops" | "routePhases" | "routeShapeIntro" | "sectionUi"
>;

export function TourDayFlowSection({ routeFlowStops, routePhases, routeShapeIntro, sectionUi }: TourDayFlowSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{routeShapeIntro.title}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{routeShapeIntro.subtitle}</p>
      </div>

      <div className="card-premium p-4 overflow-x-auto scrollbar-hide">
        <div className="flex items-center gap-0.5 min-w-max">
          {routeFlowStops.map((stop, i) => (
            <div key={stop.id} className="flex items-center gap-0.5">
              <div className="flex flex-col items-center px-2">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-foreground text-white text-xs font-semibold shadow-md ring-2 ring-white">
                  {stop.id}
                </div>
                <span className="mt-1.5 text-[11px] font-medium text-foreground whitespace-nowrap">{stop.name}</span>
                <span className="text-[10px] text-muted-foreground">{stop.theme}</span>
              </div>
              {i < routeFlowStops.length - 1 && (
                <div className="flex items-center px-1 mt-[-20px]">
                  <div className="w-4 h-px bg-border" />
                  <ArrowRight className="h-3 w-3 text-muted-foreground/50" />
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5 mt-1">
        {routePhases.map((phase) => (
          <div
            key={phase.label}
            className={cn(
              "rounded-xl px-3 py-4 text-center border border-transparent transition-all duration-200 hover:shadow-premium hover:border-border/50",
              phase.bgClass,
            )}
          >
            <div className="flex items-center justify-center gap-1.5 mb-1.5">
              <div className={cn("w-1.5 h-1.5 rounded-full", phase.dotClass)} />
              <p className={cn("text-[10px] font-semibold tracking-wide", phase.textClass)}>{phase.label}</p>
            </div>
            <p className="text-xs font-medium text-foreground">
              {sectionUi.dayFlowStopsPrefix} {phase.range}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{phase.theme}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
