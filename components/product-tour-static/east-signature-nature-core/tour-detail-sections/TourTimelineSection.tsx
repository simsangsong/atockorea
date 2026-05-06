"use client";

import { useState } from "react";
import { Clock, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItineraryStop } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";
import { PickupOnlyCards, DropoffOnlyCard } from "@/components/product-tour-static/_shared/pickup-dropoff/PickupDropoffCards";
import { PortSelectorTimeline } from "@/components/product-tour-static/_shared/route-variants/PortSelectorTimeline";
import type { PortRouteVariant, PortVariantStop } from "@/components/product-tour-static/_shared/route-variants/routeVariantTypes";
import {
  TourStopDetailDrawer,
  type TourStopDrawerStop,
} from "@/components/product-tour-static/_shared/TourStopDetailDrawer";

const FREE_ADMISSION_PATTERNS = /\bfree\b|무료|à la carte|included|포함/i;

function StopCard({
  stop,
  totalStops,
  onClick,
  ticketsIncludedLabel,
}: {
  stop: ItineraryStop;
  totalStops: number;
  onClick: () => void;
  ticketsIncludedLabel?: string;
}) {
  const photos = stop.images && stop.images.length > 0
    ? stop.images
    : stop.image
      ? [stop.image]
      : [];
  const admission = stop.visitBasics?.admission;
  const showTicketsIncluded = !!admission && !FREE_ADMISSION_PATTERNS.test(admission);

  // Elegant minimal card — pure white surface with hairline ring + a single soft drop. No
  // neumorphic gradient inside the body; depth comes from a quiet ring + low-opacity shadow that
  // tightens slightly on hover. Reads premium and compact rather than puffy.
  const accent = {
    bg: "bg-white",
    glow: "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_6px_20px_-10px_rgba(15,23,42,0.10)] ring-1 ring-slate-900/[0.06]",
    glowHover: "hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_12px_28px_-10px_rgba(15,23,42,0.14)] hover:ring-slate-900/[0.10]",
  };

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
            "group relative w-full text-left rounded-2xl overflow-hidden transition-all duration-300 ease-out",
            accent.bg,
            accent.glow,
            "hover:-translate-y-[1px]",
            accent.glowHover,
          )}
        >
          {/* Spot photos first — filled from English POI name search in authoring JSON */}
          {photos.length > 0 && (
            <div className="relative flex gap-1.5 px-3.5 pt-3.5 pb-1.5 overflow-x-auto scrollbar-hide">
              {photos.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="flex-shrink-0 w-20 h-14 rounded-md overflow-hidden bg-muted ring-1 ring-slate-900/5"
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Header info */}
          <div className={cn("relative px-3.5 pb-3.5", photos.length > 0 ? "pt-2" : "pt-3.5")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Clock className="h-3 w-3" />
                  {stop.time && <span className="font-medium text-slate-700 tabular-nums">{stop.time}</span>}
                  {stop.time && stop.duration && <span className="text-slate-300">·</span>}
                  {stop.duration && <span className="tabular-nums">{stop.duration}</span>}
                </div>
                <h3 className="mt-1 text-[15px] font-semibold text-slate-900 tracking-tight leading-snug">{stop.name}</h3>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  {stop.category && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-medium text-slate-500 bg-slate-50 rounded-md ring-1 ring-slate-900/[0.04]">
                      {stop.category}
                    </span>
                  )}
                  {showTicketsIncluded && (
                    <span className="inline-block px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/[0.06] rounded-md ring-1 ring-primary/15">
                      {ticketsIncludedLabel ?? "Tickets included"}
                    </span>
                  )}
                </div>
              </div>
              <ChevronRight className="h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400 group-hover:text-slate-600 transition-colors" />
            </div>
          </div>
        </button>
      </div>
    </div>
  );
}

export type TourTimelineSectionProps = Pick<
  EastSignatureNatureCoreDetailViewModel,
  "itineraryStops" | "sectionUi" | "pickup_dropoff"
> & {
  routeVariants?: readonly PortRouteVariant[];
  selectedPortIndex?: number;
  onPortChange?: (index: number) => void;
};

export function TourTimelineSection({
  itineraryStops,
  sectionUi,
  pickup_dropoff,
  routeVariants,
  selectedPortIndex = 0,
  onPortChange,
}: TourTimelineSectionProps) {
  const [drawerStop, setDrawerStop] = useState<TourStopDrawerStop | null>(null);
  const [internalPortIndex, setInternalPortIndex] = useState(0);
  const total = itineraryStops.length;
  const hasRouteVariants = Array.isArray(routeVariants) && routeVariants.length > 0;
  const effectivePortIndex = onPortChange ? selectedPortIndex : internalPortIndex;

  const handlePortChange = (index: number) => {
    setDrawerStop(null);
    if (onPortChange) {
      onPortChange(index);
    } else {
      setInternalPortIndex(index);
    }
  };

  const handleVariantStopClick = (stop: PortVariantStop) => {
    setDrawerStop(stop);
  };

  return (
    <div className="space-y-7">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">{sectionUi.itineraryTitle}</h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{sectionUi.itinerarySubtitle}</p>
      </div>

      <div>
        <PickupOnlyCards pickupDropoff={pickup_dropoff} sectionUi={sectionUi} />
        {hasRouteVariants ? (
          <PortSelectorTimeline
            routeVariants={routeVariants!}
            selectedPortIndex={effectivePortIndex}
            onPortChange={handlePortChange}
            onStopClick={handleVariantStopClick}
            sectionUi={sectionUi}
          />
        ) : (
          itineraryStops.map((stop) => (
            <StopCard
              key={stop.number}
              stop={stop}
              totalStops={total}
              onClick={() => setDrawerStop(stop)}
              ticketsIncludedLabel={sectionUi.ticketsIncludedLabel}
            />
          ))
        )}
        <DropoffOnlyCard pickupDropoff={pickup_dropoff} sectionUi={sectionUi} />
      </div>

      <TourStopDetailDrawer
        stop={drawerStop}
        open={drawerStop !== null}
        onClose={() => setDrawerStop(null)}
        sectionUi={sectionUi}
      />
    </div>
  );
}
