"use client";

import { Anchor, ChevronRight, Clock, MapPin, Ship } from "lucide-react";

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
  /** Opens the shared stop-detail drawer with the clicked variant stop. */
  onStopClick: (stop: PortVariantStop) => void;
  sectionUi: TourProductSectionUiV1;
};

function VariantStopCard({
  stop,
  totalStops,
  onClick,
}: {
  stop: PortVariantStop;
  totalStops: number;
  onClick: () => void;
}) {
  return (
    <div className="relative pl-11">
      {stop.number < totalStops && (
        <div className="absolute left-[17.5px] top-[48px] bottom-0 w-px bg-gradient-to-b from-slate-300/60 to-transparent" />
      )}

      <div
        className="absolute left-0 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-medium tabular-nums tracking-[0.04em] ring-1 ring-white"
        style={{
          background: "linear-gradient(140deg, #ffffff 0%, #f1f5f9 100%)",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.06), 0 4px 12px -4px rgba(15,23,42,0.10), inset 0 0.5px 0 rgba(255,255,255,0.9)",
          color: "#334155",
        }}
      >
        {String(stop.number).padStart(2, "0")}
      </div>

      <div className="pb-3">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "group relative w-full text-left rounded-2xl p-3.5 transition-all duration-300 ease-out",
            "bg-white ring-1 ring-slate-900/[0.07]",
            "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.16)]",
            "hover:-translate-y-[1px] hover:ring-slate-900/[0.11]",
            "hover:shadow-[0_2px_4px_rgba(15,23,42,0.05),0_6px_14px_-2px_rgba(15,23,42,0.09),0_24px_48px_-14px_rgba(15,23,42,0.22)]",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                <Clock className="h-3 w-3" />
                <span className="font-medium text-slate-700">{stop.duration}</span>
              </div>
              <h3 className="mt-1 text-[15px] font-semibold text-slate-900 tracking-tight leading-snug">{stop.name}</h3>
              <span className="inline-block mt-1.5 px-2 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-50 rounded-md ring-1 ring-slate-900/[0.04]">
                {stop.category}
              </span>
              {stop.highlights && stop.highlights.length > 0 && (
                <p className="mt-2 flex items-start gap-2 text-[12px] leading-snug text-slate-500">
                  <span aria-hidden className="mt-[5px] h-1 w-1 flex-shrink-0 rounded-full bg-slate-400" />
                  <span className="line-clamp-1">{stop.highlights[0]}</span>
                </p>
              )}
            </div>
            <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors" />
          </div>
        </button>
      </div>
    </div>
  );
}

export function PortSelectorTimeline({
  routeVariants,
  selectedPortIndex,
  onPortChange,
  onStopClick,
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
            onClick={() => onStopClick(stop)}
          />
        ))}
      </div>
    </div>
  );
}
