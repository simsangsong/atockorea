"use client";

import { useState } from "react";
import { Clock, ChevronDown, Camera, Lightbulb, Ticket, Bath, Car, Footprints } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ItineraryStop } from "@/components/product-tour-static/_shared/tourProductDetailSectionTypes";
import type { EastSignatureNatureCoreDetailViewModel } from "../eastSignatureNatureCoreDetailViewModel";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import { PickupOnlyCards, DropoffOnlyCard } from "@/components/product-tour-static/_shared/pickup-dropoff/PickupDropoffCards";
import { PortSelectorTimeline } from "@/components/product-tour-static/_shared/route-variants/PortSelectorTimeline";
import type { PortRouteVariant } from "@/components/product-tour-static/_shared/route-variants/routeVariantTypes";

function StopCard({
  stop,
  totalStops,
  isExpanded,
  onToggle,
  sectionUi,
}: {
  stop: ItineraryStop;
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
          onClick={onToggle}
          className={cn(
            "w-full text-left rounded-xl bg-white border border-border p-4 transition-all duration-200",
            isExpanded ? "rounded-b-none border-b-transparent shadow-none" : "shadow-premium hover:shadow-premium-elevated hover:border-primary/10",
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
            </div>
            <div
              className={cn(
                "flex-shrink-0 mt-1 p-1.5 rounded-full transition-all duration-200",
                isExpanded ? "bg-primary/10 rotate-180" : "bg-muted/60",
              )}
            >
              <ChevronDown className={cn("h-4 w-4 transition-colors", isExpanded ? "text-primary" : "text-muted-foreground")} />
            </div>
          </div>
        </button>

        <div className={cn("grid transition-all duration-300 ease-out", isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="rounded-b-xl border border-t-0 border-border bg-white shadow-premium">
              <div className="relative h-48 overflow-hidden">
                <img src={stop.image} alt={stop.name} className="h-full w-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#1A2332]/35 via-[#1A2332]/5 to-transparent" />
                <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-white/95 backdrop-blur-sm px-3 py-1.5 text-xs font-medium text-foreground shadow-md">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                  {stop.duration}
                </div>
              </div>

              <div className="p-5 space-y-6">
                <p className="text-sm text-foreground leading-relaxed">{stop.description}</p>

                <div>
                  <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">{sectionUi.stopHighlightsHeading}</h4>
                  <ul className="grid grid-cols-1 gap-2">
                    {(stop.highlights ?? []).map((highlight, i) => (
                      <li key={i} className="flex items-start gap-2.5 text-sm text-foreground">
                        <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-accent" />
                        {highlight}
                      </li>
                    ))}
                  </ul>
                </div>

                {Array.isArray(stop.timeUsed) && stop.timeUsed.length > 0 && (
                  <div className="rounded-xl bg-mist-blue/70 border border-border/40 p-4">
                    <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">{sectionUi.stopTimeUsedHeading}</h4>
                    <div className="flex items-start gap-2">
                      {stop.timeUsed.map((step, i) => (
                        <div key={i} className="flex-1 text-center">
                          <div className="w-6 h-6 mx-auto mb-2 rounded-full bg-white text-primary text-[11px] font-semibold flex items-center justify-center shadow-sm border border-border/50">
                            {i + 1}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-snug">{step}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex items-start gap-3 rounded-xl bg-sand-blush/80 border border-accent/15 px-4 py-3.5">
                  <Lightbulb className="h-4 w-4 text-accent flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-foreground leading-relaxed">{stop.whyOnRoute}</p>
                </div>

                {(stop.visitBasics || stop.convenience) && (
                  <div className="border-t border-border/80 pt-5 space-y-4">
                    {stop.visitBasics && (
                      <div>
                        <h4 className="text-xs font-semibold text-foreground tracking-wide mb-3">{sectionUi.stopVisitBasicsHeading}</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          {stop.visitBasics.hours && (
                            <div className="flex items-start gap-2.5">
                              <Clock className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground">{sectionUi.stopVisitHoursLabel}</p>
                                <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.hours}</p>
                              </div>
                            </div>
                          )}
                          {stop.visitBasics.admission && (
                            <div className="flex items-start gap-2.5">
                              <Ticket className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground">{sectionUi.stopVisitAdmissionLabel}</p>
                                <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.admission}</p>
                              </div>
                            </div>
                          )}
                          {stop.visitBasics.walking && (
                            <div className="flex items-start gap-2.5">
                              <Footprints className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-muted-foreground">{sectionUi.stopVisitWalkingLabel}</p>
                                <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.walking}</p>
                              </div>
                            </div>
                          )}
                          {stop.visitBasics.closed && (
                            <div className="flex items-start gap-2.5">
                              <div className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0 text-center text-[10px] font-bold">X</div>
                              <div>
                                <p className="text-muted-foreground">{sectionUi.stopVisitClosedLabel}</p>
                                <p className="text-foreground font-medium mt-0.5">{stop.visitBasics.closed}</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {stop.convenience && (stop.convenience.restroom || stop.convenience.parking) && (
                      <div className="flex gap-5 text-xs border-t border-border/60 pt-4">
                        {stop.convenience.restroom && (
                          <div className="flex items-center gap-2">
                            <Bath className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{stop.convenience.restroom}</span>
                          </div>
                        )}
                        {stop.convenience.parking && (
                          <div className="flex items-center gap-2">
                            <Car className="h-4 w-4 text-muted-foreground" />
                            <span className="text-foreground">{stop.convenience.parking}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {stop.smartNotes && (stop.smartNotes.photo || stop.smartNotes.tip) && (
                  <div className="border-t border-border/80 pt-5 space-y-3">
                    <h4 className="text-xs font-semibold text-foreground tracking-wide">{sectionUi.stopSmartNotesHeading}</h4>
                    <div className="space-y-2.5">
                      {stop.smartNotes.photo && (
                        <div className="flex items-start gap-2.5">
                          <Camera className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{sectionUi.stopSmartNotesPhotoPrefix}</span>{" "}
                            {stop.smartNotes.photo}
                          </p>
                        </div>
                      )}
                      {stop.smartNotes.tip && (
                        <div className="flex items-start gap-2.5">
                          <Lightbulb className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
                          <p className="text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{sectionUi.stopSmartNotesTipPrefix}</span>{" "}
                            {stop.smartNotes.tip}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
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
  const [expandedStop, setExpandedStop] = useState<number | null>(null);
  const [internalPortIndex, setInternalPortIndex] = useState(0);
  const total = itineraryStops.length;
  const hasRouteVariants = Array.isArray(routeVariants) && routeVariants.length > 0;
  const effectivePortIndex = onPortChange ? selectedPortIndex : internalPortIndex;
  const handlePortChange = (index: number) => {
    setExpandedStop(null);
    if (onPortChange) {
      onPortChange(index);
    } else {
      setInternalPortIndex(index);
    }
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
            expandedStopNumber={expandedStop}
            onToggleStop={(stopNumber) =>
              setExpandedStop((prev) => (prev === stopNumber ? null : stopNumber))
            }
            sectionUi={sectionUi}
          />
        ) : (
          itineraryStops.map((stop) => (
            <StopCard
              key={stop.number}
              stop={stop}
              totalStops={total}
              isExpanded={expandedStop === stop.number}
              onToggle={() => setExpandedStop(expandedStop === stop.number ? null : stop.number)}
              sectionUi={sectionUi}
            />
          ))
        )}
        <DropoffOnlyCard pickupDropoff={pickup_dropoff} sectionUi={sectionUi} />
      </div>
    </div>
  );
}
