"use client";

import { Anchor, ChevronDown, Clock, Footprints, MapPin, Ship, Ticket } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import type {
  PortRouteVariant,
  PortVariantStop,
} from "@/components/product-tour-static/_shared/route-variants/routeVariantTypes";

export type PortSelectorTimelineProps = {
  routeVariants: readonly PortRouteVariant[];
  selectedPortIndex: number;
  onPortChange: (index: number) => void;
  expandedStopNumber: number | null;
  onToggleStop: (stopNumber: number) => void;
  sectionUi: TourProductSectionUiV1;
};

function VariantStopCard({
  stop,
  totalStops,
  isExpanded,
  onToggle,
  sectionUi,
}: {
  stop: PortVariantStop;
  totalStops: number;
  isExpanded: boolean;
  onToggle: () => void;
  sectionUi: TourProductSectionUiV1;
}) {
  return (
    <div className="relative pl-12">
      {stop.number < totalStops && (
        <div className="absolute left-[19px] top-[52px] bottom-0 w-px bg-gradient-to-b from-border to-transparent" />
      )}

      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-white text-sm font-semibold shadow-lg ring-[3px] ring-white">
        {String(stop.number).padStart(2, "0")}
      </div>

      <div className="pb-5">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full text-left rounded-xl bg-white border border-border p-4 transition-all duration-200",
            isExpanded
              ? "rounded-b-none border-b-transparent shadow-none"
              : "shadow-premium hover:shadow-premium-elevated hover:border-primary/10",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="font-semibold text-foreground">{stop.duration}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-foreground tracking-tight">{stop.name}</h3>
              <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/80 rounded-md">
                {stop.category}
              </span>
            </div>
            <div
              className={cn(
                "flex-shrink-0 mt-1 p-1.5 rounded-full transition-all duration-200",
                isExpanded ? "bg-primary/10 rotate-180" : "bg-muted/60",
              )}
            >
              <ChevronDown
                className={cn("h-4 w-4 transition-colors", isExpanded ? "text-primary" : "text-muted-foreground")}
              />
            </div>
          </div>
        </button>

        <div className={cn("grid transition-all duration-300 ease-out", isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="rounded-b-xl border border-t-0 border-border bg-white shadow-premium">
              <div className="p-5 space-y-6">
                <p className="text-sm text-foreground leading-relaxed">{stop.description}</p>

                <div>
                  <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">
                    {sectionUi.stopHighlightsHeading}
                  </h4>
                  <ul className="grid grid-cols-1 gap-2">
                    {stop.highlights.map((highlight, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-t border-border/80 pt-5">
                  <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">
                    {sectionUi.stopVisitBasicsHeading}
                  </h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex items-start gap-2.5">
                      <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground">{sectionUi.stopVisitHoursLabel}</p>
                        <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.hours}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Ticket className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground">{sectionUi.stopVisitAdmissionLabel}</p>
                        <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.admission}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <Footprints className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-muted-foreground">{sectionUi.stopVisitWalkingLabel}</p>
                        <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.walking}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2.5">
                      <div className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 text-center text-[10px] font-bold">
                        X
                      </div>
                      <div>
                        <p className="text-muted-foreground">{sectionUi.stopVisitClosedLabel}</p>
                        <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.closed}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PortSelectorTimeline({
  routeVariants,
  selectedPortIndex,
  onPortChange,
  expandedStopNumber,
  onToggleStop,
  sectionUi,
}: PortSelectorTimelineProps) {
  const safeIndex = Math.min(Math.max(selectedPortIndex, 0), Math.max(routeVariants.length - 1, 0));
  const selected = routeVariants[safeIndex];
  if (!selected) return null;
  const totalStops = selected.stops.length;

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-border bg-white p-4 shadow-premium">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <Ship className="h-3.5 w-3.5 text-primary" />
          <span>{sectionUi.portSelectorEyebrow ?? "Choose your docking port"}</span>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {routeVariants.map((variant, index) => {
            const isActive = index === safeIndex;
            return (
              <button
                key={variant.variant_id}
                type="button"
                onClick={() => onPortChange(index)}
                className={cn(
                  "group flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-all duration-200",
                  isActive
                    ? "border-transparent bg-foreground text-white shadow-premium-elevated"
                    : "border-border bg-white text-foreground hover:border-primary/30 hover:shadow-premium",
                )}
              >
                <span
                  className={cn(
                    "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full",
                    isActive ? "bg-white/10 text-white" : "bg-muted/70 text-foreground",
                  )}
                >
                  <Anchor className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold tracking-tight">{variant.title}</p>
                  {variant.dockingPort?.name ? (
                    <p
                      className={cn(
                        "mt-1 truncate text-xs",
                        isActive ? "text-white/80" : "text-muted-foreground",
                      )}
                    >
                      {variant.dockingPort.name}
                    </p>
                  ) : null}
                </div>
              </button>
            );
          })}
        </div>

        {(selected.dockingPort?.meetingPoint || selected.dockingPort?.pickupWindow) && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
            {selected.dockingPort?.meetingPoint ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-muted-foreground">
                <MapPin className="h-3 w-3 text-primary" />
                {selected.dockingPort.meetingPoint}
              </span>
            ) : null}
            {selected.dockingPort?.pickupWindow ? (
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-2.5 py-1 text-muted-foreground">
                <Clock className="h-3 w-3 text-primary" />
                {selected.dockingPort.pickupWindow}
              </span>
            ) : null}
          </div>
        )}

        {selected.summary ? (
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{selected.summary}</p>
        ) : null}
      </div>

      <div>
        {selected.stops.map((stop) => (
          <VariantStopCard
            key={`${selected.variant_id}-${stop.number}`}
            stop={stop}
            totalStops={totalStops}
            isExpanded={expandedStopNumber === stop.number}
            onToggle={() => onToggleStop(stop.number)}
            sectionUi={sectionUi}
          />
        ))}
      </div>
    </div>
  );
}
