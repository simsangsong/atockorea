"use client";

import { useMemo, useState } from "react";
import {
  Building2,
  ChevronDown,
  Clock3,
  MapPin,
  Plane,
  ShoppingBag,
  Store,
  TrainFront,
} from "lucide-react";

import { cn } from "@/lib/utils";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import type { PickupDropoffPoint, PickupDropoffSection } from "@/components/product-tour-static/_shared/pickupDropoffTypes";

type PickupDropoffCardsProps = {
  pickupDropoff?: PickupDropoffSection;
  sectionUi: TourProductSectionUiV1;
};

type PointAccordionProps = {
  point: PickupDropoffPoint;
  expandedOrder: number | null;
  setExpandedOrder: (order: number | null) => void;
};

function formatTemplate(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function inferReturnBand(notes: string[] | string | undefined): string | null {
  if (!notes?.length) return null;
  // Some tour rows (e.g. jeju-cruise-shore-excursion-small-group-tour) carry
  // `notes` as a single string instead of string[] — a latent crash that only
  // surfaced once the page actually SSR'd (the useSearchParams CSR bailout
  // used to swallow it at build time).
  const joined = Array.isArray(notes) ? notes.join(" ") : String(notes);
  const match =
    joined.match(/Return usually runs around\s+([0-9]{1,2}:[0-9]{2}\s*[–-]\s*[0-9]{1,2}:[0-9]{2})/i) ??
    joined.match(/around\s+([0-9]{1,2}:[0-9]{2}\s*[–-]\s*[0-9]{1,2}:[0-9]{2})/i);
  return match?.[1] ?? null;
}

function pointTypeIcon(type: string | undefined) {
  const t = (type ?? "").toLowerCase();
  if (t === "hotel") return Building2;
  if (t === "airport") return Plane;
  if (t === "shopping") return ShoppingBag;
  if (t === "market") return Store;
  if (t === "station") return TrainFront;
  return MapPin;
}

function PointAccordion({ point, expandedOrder, setExpandedOrder }: PointAccordionProps) {
  const isExpanded = expandedOrder === point.order;
  const Icon = pointTypeIcon(point.type);

  return (
    <div className="rounded-lg border border-border/70 bg-white">
      <button
        type="button"
        onClick={() => setExpandedOrder(isExpanded ? null : point.order)}
        className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
      >
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {point.time ? <span className="font-semibold text-foreground">{point.time}</span> : null}
            {point.time ? <span className="text-border">·</span> : null}
            <span className="truncate">{point.name}</span>
          </div>
        </div>
        <span
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full bg-muted/60 transition-transform",
            isExpanded ? "rotate-180 bg-primary/10" : "",
          )}
        >
          <ChevronDown className={cn("h-3.5 w-3.5", isExpanded ? "text-primary" : "text-muted-foreground")} />
        </span>
      </button>

      <div className={cn("grid transition-all duration-200", isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="border-t border-border/70 px-3.5 py-3 text-xs text-muted-foreground">
            <div className="flex items-start gap-2.5">
              <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-foreground">{point.name}</p>
                {point.note ? <p>{point.note}</p> : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PickupCard({
  pickupPoints,
  sectionUi,
  isExpanded,
  onToggle,
}: {
  pickupPoints: PickupDropoffPoint[];
  sectionUi: TourProductSectionUiV1;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const first = pickupPoints[0];
  const last = pickupPoints[pickupPoints.length - 1];
  const range = first?.time && last?.time ? `${first.time} – ${last.time}` : first?.time ?? "";

  return (
    <div className="relative pl-12">
      <div className="absolute left-[19px] top-[52px] bottom-0 w-px bg-gradient-to-b from-border to-transparent" />
      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-foreground shadow-lg ring-[3px] ring-white border border-border/70">
        <MapPin className="h-4.5 w-4.5" />
      </div>
      <div className="pb-5">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full rounded-xl border border-border bg-white p-4 text-left transition-all duration-200",
            isExpanded ? "rounded-b-none border-b-transparent shadow-none" : "shadow-premium hover:shadow-premium-elevated",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{range}</span>
                <span className="text-border">·</span>
                <span>{formatTemplate(sectionUi.pickupPointsTemplate ?? "{count} pickup points", pickupPoints.length)}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold tracking-tight text-foreground">{sectionUi.pickupCardTitle ?? "Pickup"}</h3>
            </div>
            <div className={cn("mt-1 rounded-full p-1.5 transition-all duration-200", isExpanded ? "rotate-180 bg-primary/10" : "bg-muted/60")}>
              <ChevronDown className={cn("h-4 w-4", isExpanded ? "text-primary" : "text-muted-foreground")} />
            </div>
          </div>
        </button>

        <div className={cn("grid transition-all duration-300 ease-out", isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="rounded-b-xl border border-t-0 border-border bg-white p-4 shadow-premium">
              <div className="space-y-2.5">
                {pickupPoints.map((point) => (
                  <PointAccordion
                    key={`pickup-${point.order}-${point.name}`}
                    point={point}
                    expandedOrder={expandedOrder}
                    setExpandedOrder={setExpandedOrder}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function DropoffCard({
  dropoffPoints,
  notes,
  sectionUi,
  isExpanded,
  onToggle,
}: {
  dropoffPoints: PickupDropoffPoint[];
  notes?: string[];
  sectionUi: TourProductSectionUiV1;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const lastPoint = dropoffPoints[dropoffPoints.length - 1];
  const returnBand = useMemo(() => inferReturnBand(notes), [notes]);

  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#0E1A2D] text-white shadow-lg ring-[3px] ring-white">
        <MapPin className="h-4.5 w-4.5" />
      </div>
      <div className="pb-1">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full rounded-xl border border-[#1D2A3D] bg-[#111D31] p-4 text-left transition-all duration-200",
            isExpanded ? "rounded-b-none shadow-none" : "shadow-premium",
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-white/70">
                <span className="font-semibold text-white">~{returnBand ?? "17:30"}</span>
                <span>·</span>
                <span>{sectionUi.dropoffApproxLabel ?? "approx."}</span>
              </div>
              <h3 className="mt-2 text-base font-semibold tracking-tight text-white">{sectionUi.dropoffCardTitle ?? "Drop-off"}</h3>
              <span className="mt-2 inline-block rounded-md bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/75">
                {formatTemplate(sectionUi.dropoffLocationsTemplate ?? "{count} drop-off locations", dropoffPoints.length)}
              </span>
            </div>
            <div className={cn("mt-1 rounded-full p-1.5 transition-all duration-200", isExpanded ? "rotate-180 bg-white/20" : "bg-white/10")}>
              <ChevronDown className="h-4 w-4 text-white/90" />
            </div>
          </div>
        </button>

        <div className={cn("grid transition-all duration-300 ease-out", isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
          <div className="overflow-hidden">
            <div className="rounded-b-xl border border-t-0 border-[#1D2A3D] bg-[#111D31] p-4 shadow-premium">
              <div className="space-y-2.5">
                {dropoffPoints.map((point) => (
                  <div key={`dropoff-${point.order}-${point.name}`} className="rounded-lg border border-white/15 bg-white/5">
                    <button
                      type="button"
                      onClick={() => setExpandedOrder(expandedOrder === point.order ? null : point.order)}
                      className="flex w-full items-center justify-between gap-3 px-3.5 py-2.5 text-left"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-xs text-white/75">
                          <span className="truncate">{point.name}</span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          "flex h-6 w-6 items-center justify-center rounded-full bg-white/10 transition-transform",
                          expandedOrder === point.order ? "rotate-180 bg-white/20" : "",
                        )}
                      >
                        <ChevronDown className="h-3.5 w-3.5 text-white/90" />
                      </span>
                    </button>
                    <div
                      className={cn(
                        "grid transition-all duration-200",
                        expandedOrder === point.order ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="border-t border-white/15 px-3.5 py-3 text-xs text-white/75">
                          <div className="flex items-start gap-2.5">
                            <Clock3 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-white/85" />
                            <div className="space-y-1">
                              <p className="text-white/95">{point.name}</p>
                              {point.note ? <p>{point.note}</p> : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t border-white/15 pt-3 text-sm text-white/70">
                {sectionUi.dropoffReturnNote ?? "Return to pickup points available on request"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PickupOnlyCards({ pickupDropoff, sectionUi }: PickupDropoffCardsProps) {
  const [pickupExpanded, setPickupExpanded] = useState(false);

  if (!pickupDropoff) return null;
  const pickupPoints = pickupDropoff.departure ?? [];
  if (pickupPoints.length === 0) return null;

  return (
    <PickupCard
      pickupPoints={pickupPoints}
      sectionUi={sectionUi}
      isExpanded={pickupExpanded}
      onToggle={() => setPickupExpanded((v) => !v)}
    />
  );
}

export function DropoffOnlyCard({ pickupDropoff, sectionUi }: PickupDropoffCardsProps) {
  const [dropoffExpanded, setDropoffExpanded] = useState(false);

  if (!pickupDropoff) return null;
  const dropoffPoints = pickupDropoff.return ?? [];
  if (dropoffPoints.length === 0) return null;

  return (
    <DropoffCard
      dropoffPoints={dropoffPoints}
      notes={pickupDropoff.notes}
      sectionUi={sectionUi}
      isExpanded={dropoffExpanded}
      onToggle={() => setDropoffExpanded((v) => !v)}
    />
  );
}

/** @deprecated Use PickupOnlyCards + DropoffOnlyCard for split layout */
export function PickupDropoffCards({ pickupDropoff, sectionUi }: PickupDropoffCardsProps) {
  return (
    <>
      <PickupOnlyCards pickupDropoff={pickupDropoff} sectionUi={sectionUi} />
      <DropoffOnlyCard pickupDropoff={pickupDropoff} sectionUi={sectionUi} />
    </>
  );
}
