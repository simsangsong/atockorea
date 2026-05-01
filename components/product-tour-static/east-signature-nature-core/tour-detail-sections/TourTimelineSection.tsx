"use client";

import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItineraryStop } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import { PickupOnlyCards, DropoffOnlyCard } from "@/components/product-tour-static/_shared/pickup-dropoff/PickupDropoffCards";
import { PortSelectorTimeline } from "@/components/product-tour-static/_shared/route-variants/PortSelectorTimeline";
import type { PortRouteVariant, PortVariantStop } from "@/components/product-tour-static/_shared/route-variants/routeVariantTypes";
import {
  TourStopDetailDrawer,
  type TourStopDrawerStop,
} from "@/components/product-tour-static/_shared/TourStopDetailDrawer";

function StopCard({
  stop,
  totalStops,
  onClick,
}: {
  stop: ItineraryStop;
  totalStops: number;
  onClick: () => void;
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
          onClick={onClick}
          className={cn(
            "w-full text-left rounded-xl bg-white border border-border p-4 transition-all duration-200",
            "shadow-premium hover:shadow-premium-elevated hover:border-primary/10",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{stop.time}</span>
                <span className="text-border">·</span>
                <span>{stop.duration}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold text-foreground tracking-tight">{stop.name}</h3>
              <span className="inline-block mt-2 px-2.5 py-0.5 text-[10px] font-medium text-muted-foreground bg-muted/80 rounded-md">
                {stop.category}
              </span>
              {/* First-highlight teaser, color/weight only — no italic */}
              {stop.highlights && stop.highlights.length > 0 && (
                <p className="mt-2.5 flex items-start gap-2 text-[12.5px] leading-snug text-muted-foreground">
                  <span aria-hidden className="mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                  <span className="line-clamp-1">{stop.highlights[0]}</span>
                </p>
              )}
            </div>
            <div className="flex flex-shrink-0 flex-col items-end gap-2">
              {stop.image && (
                <div className="h-14 w-14 overflow-hidden rounded-lg ring-1 ring-border/40 shadow-premium">
                  <img
                    src={stop.image}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover"
                  />
                </div>
              )}
              <div className="rounded-full bg-muted/60 p-1.5">
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
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
