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

  // Directional-light pearl pillow — brightened pearl/slate gradient, sharp white inset edge on
  // top+left, diffused cool-shadow inset on bottom+right, and an offset bottom-right outer drop
  // so the card reads as lit from the upper-left while staying noticeably lighter than cream.
  const accent = {
    bg: "bg-gradient-to-br from-white via-[#f7f9fc] to-[#e6ecf3]",
    glow: "shadow-[inset_12px_12px_48px_rgba(255,255,255,0.98),inset_-4px_-4px_12px_rgba(30,41,59,0.10),0_3px_6px_rgba(30,41,59,0.05),8px_32px_64px_-20px_rgba(30,41,59,0.22)]",
    glowHover: "hover:shadow-[inset_12px_12px_54px_rgba(255,255,255,1),inset_-4px_-4px_14px_rgba(30,41,59,0.14),0_5px_10px_rgba(30,41,59,0.07),12px_48px_88px_-20px_rgba(30,41,59,0.30)]",
  };

  return (
    <div className="relative pl-12">
      {stop.number < totalStops && (
        <div className="absolute left-[19px] top-[52px] bottom-0 w-px bg-gradient-to-b from-border/60 to-transparent" />
      )}

      <div
        className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-semibold tabular-nums tracking-[0.02em] ring-[3px] ring-white"
        style={{
          background:
            "radial-gradient(circle at 30% 25%, #ffffff 0%, #f1f5f9 55%, #c8d2e0 100%)",
          boxShadow:
            "inset 0 2px 3px rgba(255,255,255,0.9), inset 0 -3px 5px rgba(51,65,85,0.18), 0 2px 4px rgba(51,65,85,0.10), 0 8px 18px -4px rgba(51,65,85,0.18)",
          color: "#1e293b",
          textShadow: "0 1px 1px rgba(15,23,42,0.12)",
        }}
      >
        {String(stop.number).padStart(2, "0")}
      </div>

      <div className="pb-5">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            "group relative w-full text-left rounded-[22px] overflow-hidden transition-all duration-500 ease-out",
            accent.bg,
            accent.glow,
            "hover:-translate-y-[3px]",
            accent.glowHover,
          )}
        >
          {/* Spot photos first — filled from English POI name search in authoring JSON */}
          {photos.length > 0 && (
            <div className="relative flex gap-1.5 px-4 pt-4 pb-2 overflow-x-auto scrollbar-hide">
              {photos.map((src, i) => (
                <div
                  key={`${src}-${i}`}
                  className="flex-shrink-0 w-24 h-16 rounded-lg overflow-hidden bg-muted ring-1 ring-border/40 shadow-[0_1px_2px_rgba(26,35,50,0.04),0_4px_10px_-4px_rgba(26,35,50,0.16)]"
                >
                  <img
                    src={src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Header info */}
          <div className={cn("relative px-4 pb-4", photos.length > 0 ? "pt-2" : "pt-4 pb-4")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {stop.time && <span className="font-semibold text-foreground tabular-nums">{stop.time}</span>}
                  {stop.time && stop.duration && <span className="text-border">·</span>}
                  {stop.duration && <span className="tabular-nums">{stop.duration}</span>}
                </div>
                <h3 className="mt-1.5 text-base font-semibold text-foreground tracking-tight">{stop.name}</h3>
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  {stop.category && (
                    <span className="inline-block px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/80 rounded-md">
                      {stop.category}
                    </span>
                  )}
                  {showTicketsIncluded && (
                    <span className="inline-block px-2.5 py-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded-md ring-1 ring-primary/15">
                      {ticketsIncludedLabel ?? "Tickets included"}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-muted/40 transition-all duration-200 group-hover:bg-primary/10">
                <ChevronRight className="h-4 w-4 text-muted-foreground/60 group-hover:text-primary transition-colors" />
              </div>
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
