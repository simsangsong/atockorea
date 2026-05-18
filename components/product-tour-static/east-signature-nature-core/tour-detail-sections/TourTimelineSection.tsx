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
// EN + KO + ZH + JA pickup/departure category patterns
const PICKUP_STOP_RX = /pickup|departure|transit|hotel.*pickup|pick.up|픽업|出発|出発地|출발|接送|接机/i;

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
    /* 사용자 보고 (2026-05-18 screenshot): -ml-2 + left-0 badge → 모바일 viewport 왼쪽 짤림. -ml-2 제거 + z-10 추가 (card 위로 stacking). */
    <div className="relative pl-9">
      {stop.number < totalStops && (
        <div className="absolute left-[18px] top-[48px] bottom-0 w-px bg-gradient-to-b from-slate-200/40 to-transparent" />
      )}

      <div
        className="absolute left-0 top-1.5 z-10 flex h-9 w-9 items-center justify-center rounded-full text-[12px] font-medium tabular-nums tracking-[0.04em] ring-1 ring-white"
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
          {/* Sprint 4.12 + §B-P3: 1장 cover 16:9 + frame ring (사진 영역 premium frame 신호) */}
          {photos.length > 0 && photos[0] && (
            <div
              className="relative w-full overflow-hidden bg-slate-100"
              style={{ aspectRatio: "16 / 9" }}
              onContextMenu={(e) => e.preventDefault()}
            >
              <img
                src={photos[0]}
                alt=""
                loading="lazy"
                decoding="async"
                draggable={false}
                onContextMenu={(e) => e.preventDefault()}
                className="absolute inset-0 h-full w-full object-cover tour-photo-grade tour-photo-protected"
              />
              <div aria-hidden className="pointer-events-none absolute inset-0 ring-1 ring-inset ring-black/[0.06]" />
            </div>
          )}

          {/* Header info */}
          <div className={cn("relative px-3.5 pb-3.5", photos.length > 0 ? "pt-3" : "pt-3.5")}>
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

  // If stop #1 is a pickup stop and a pickup_dropoff card already renders above,
  // strip it from the numbered timeline and renumber remaining stops from 1.
  const firstStop = itineraryStops[0];
  const firstIsPickup =
    !hasRouteVariants &&
    !!pickup_dropoff &&
    !!firstStop &&
    PICKUP_STOP_RX.test((firstStop.category ?? "") + " " + (firstStop.name ?? ""));
  const displayStops = firstIsPickup
    ? itineraryStops.slice(1).map((s, i) => ({ ...s, number: i + 1 }))
    : itineraryStops;
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
        <h2 className="text-title text-foreground">{sectionUi.itineraryTitle}</h2>
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
