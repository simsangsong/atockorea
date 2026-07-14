"use client";

import { useState } from "react";
import Image from "next/image";
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
// EN + KO + ZH + JA pickup/departure category patterns
const PICKUP_STOP_RX = /pickup|departure|transit|hotel.*pickup|pick.up|픽업|出発|出発地|출발|接送|接机/i;
// Trailing return/drop-off pseudo-stop patterns (EN/ES/KO/JA/ZH). Fallback only — the
// authoritative signal is the `_role` marker on the stop; this catches legacy/unmarked data.
const DROPOFF_STOP_RX = /drop.?off|return|regreso|귀환|하차|복귀|帰路|帰還|帰港|戻|解散|返程|返回|下车|下車/i;

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

  // Elegant minimal card — pure white body with a refined hairline border and a layered drop
  // shadow (close + mid + diffused) that lets the card float without inner shadows.
  const accent = {
    bg: "bg-white",
    glow: "shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)] transition-all duration-200",
    glowHover: "hover:shadow-[0_2px_6px_rgba(0,0,0,0.06),0_8px_20px_-4px_rgba(0,0,0,0.09)] hover:-translate-y-px",
  };

  return (
    <div id={`tour-stop-${stop.number}`} className="relative -ml-2 scroll-mt-32 pl-9">
      {stop.number < totalStops && (
        <div className="absolute left-[16px] top-[48px] bottom-0 w-px bg-gradient-to-b from-slate-200/40 to-transparent" />
      )}

      <div
        className="absolute left-0 top-1.5 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-medium tabular-nums tracking-[0.04em] ring-1 ring-white"
        style={{
          background: "#ffffff",
          boxShadow:
            "0 1px 2px rgba(15,23,42,0.06), 0 4px 12px -4px rgba(15,23,42,0.10), inset 0 0.5px 0 rgba(255,255,255,0.9)",
          color: "#334155",
        }}
      >
        {String(stop.number).padStart(2, "0")}
      </div>

      <div className="pb-5">
        <button
          type="button"
          onClick={onClick}
          className={cn(
            // transition limited to GPU-composite-only props — `transition-all` was repainting
            // ring/border on every scroll-triggered repaint pass.
            "group relative w-full text-left rounded-2xl overflow-hidden transition-[transform,box-shadow] duration-300 ease-out",
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
                  className="tour-itinerary-preview-thumb relative flex-shrink-0 w-20 h-14 rounded-md overflow-hidden bg-slate-100 ring-1 ring-slate-900/5"
                  onContextMenu={(e) => e.preventDefault()}
                >
                  {/* next/image: the raw originals here are 450~670KB for an
                      80×56 thumb — the optimizer serves a ~5KB variant. */}
                  <Image
                    src={src}
                    alt=""
                    width={80}
                    height={56}
                    sizes="80px"
                    loading="lazy"
                    draggable={false}
                    onContextMenu={(e) => e.preventDefault()}
                    className="w-full h-full object-cover tour-photo-grade tour-photo-protected"
                  />
                  {/* No region badge / stop name overlay on timeline mini thumbs —
                      too small for either label to read cleanly. */}
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
                    <span className="text-[10px] font-medium text-slate-400 tracking-wide">
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
  locale?: "en" | "ko" | "ja" | "zh" | "zh-TW" | "es";
};

export function TourTimelineSection({
  itineraryStops,
  sectionUi,
  pickup_dropoff,
  routeVariants,
  selectedPortIndex = 0,
  onPortChange,
  locale = "en",
}: TourTimelineSectionProps) {
  const [drawerStop, setDrawerStop] = useState<TourStopDrawerStop | null>(null);
  const [internalPortIndex, setInternalPortIndex] = useState(0);
  const hasRouteVariants = Array.isArray(routeVariants) && routeVariants.length > 0;

  // Defensive: some Supabase rows historically stored deleted stops as literal
  // `null` instead of splicing them out of the array. Drop nulls/non-objects
  // up-front so downstream `stop.number` / `stop.name` accesses don't crash.
  const safeStops: readonly ItineraryStop[] = Array.isArray(itineraryStops)
    ? itineraryStops.filter((s): s is ItineraryStop => s != null && typeof s === "object")
    : [];

  // Pickup / return pseudo-stops are already rendered by the dedicated PickupOnlyCards
  // (above) and DropoffOnlyCard (below). Strip them from the numbered timeline so they
  // don't appear twice. The authoritative signal is the locale-independent `_role` marker;
  // the multilingual regex is a back-compat fallback for stops authored before the marker.
  const firstStop = safeStops[0];
  const lastStop = safeStops[safeStops.length - 1];
  const hasPickupCard =
    !hasRouteVariants && !!pickup_dropoff && (pickup_dropoff.departure?.length ?? 0) > 0;
  const hasDropoffCard =
    !hasRouteVariants && !!pickup_dropoff && (pickup_dropoff.return?.length ?? 0) > 0;
  const firstIsPickup =
    hasPickupCard &&
    !!firstStop &&
    (firstStop._role === "pickup" ||
      PICKUP_STOP_RX.test((firstStop.category ?? "") + " " + (firstStop.name ?? "")));
  const lastIsDropoff =
    hasDropoffCard &&
    !!lastStop &&
    lastStop !== firstStop &&
    (lastStop._role === "dropoff" ||
      DROPOFF_STOP_RX.test((lastStop.category ?? "") + " " + (lastStop.name ?? "")));
  let working: readonly ItineraryStop[] = safeStops;
  if (lastIsDropoff && working.length > 1) working = working.slice(0, -1);
  if (firstIsPickup && working.length > 1) working = working.slice(1);
  const displayStops =
    firstIsPickup || lastIsDropoff
      ? working.map((s, i) => ({ ...s, number: i + 1 }))
      : working;
  const total = displayStops.length;
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
          displayStops.map((stop) => (
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
        locale={locale}
      />
    </div>
  );
}
