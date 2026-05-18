"use client";

import { Fragment, useMemo, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Building2,
  Bus,
  CheckCircle2,
  ChevronDown,
  Navigation,
  Plane,
  ShoppingBag,
  Store,
  TrainFront,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  PickupDropoffPoint,
  PickupDropoffSection,
} from "@/components/product-tour-static/_shared/pickupDropoffTypes";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

type LucideIcon = ComponentType<{ className?: string; strokeWidth?: number }>;

function pointTypeIcon(type: string | undefined): LucideIcon {
  const t = (type ?? "").toLowerCase();
  if (t === "hotel") return Building2;
  if (t === "airport") return Plane;
  if (t === "shopping") return ShoppingBag;
  if (t === "market") return Store;
  if (t === "station") return TrainFront;
  return MapPin;
}

function inferReturnBand(notes: string[] | undefined): string | null {
  if (!notes?.length) return null;
  const joined = notes.join(" ");
  const match =
    joined.match(/around\s+([0-9]{1,2}:[0-9]{2}\s*[–-]\s*[0-9]{1,2}:[0-9]{2})/i) ?? null;
  return match?.[1] ?? null;
}

function buildStaticMapUrl(
  pickupPoints: PickupDropoffPoint[],
  dropoffPoints: PickupDropoffPoint[],
): string | null {
  const allPoints = [...pickupPoints, ...dropoffPoints];
  if (!allPoints.some((p) => p.lat && p.lng)) return null;

  const parts: string[] = [
    "size=600x280",
    "scale=2",
    "maptype=roadmap",
    "style=feature:poi%7Cvisibility:off",
    "style=feature:transit%7Cvisibility:off",
    "style=feature:road.arterial%7Celement:labels.icon%7Cvisibility:off",
  ];

  // Copper markers for pickup points
  pickupPoints.forEach((p) => {
    if (p.lat && p.lng) {
      const label = String(p.order).slice(0, 1);
      parts.push(`markers=color:0xC8956C%7Clabel:${label}%7C${p.lat},${p.lng}`);
    }
  });

  // Dark markers for unique return (dropoff) points not already in pickup
  const pickupCoords = new Set(
    pickupPoints.filter((p) => p.lat && p.lng).map((p) => `${p.lat},${p.lng}`),
  );
  dropoffPoints.forEach((p) => {
    if (p.lat && p.lng && !pickupCoords.has(`${p.lat},${p.lng}`)) {
      parts.push(`markers=color:0x334155%7Clabel:R%7C${p.lat},${p.lng}`);
    }
  });

  // Proxy through our API route so the server-side key is used (avoids browser referrer restrictions)
  return `/api/maps/static?${parts.join("&")}`;
}

export type TourPickupDropoffSectionProps = {
  pickup_dropoff?: PickupDropoffSection;
  sectionUi: TourProductSectionUiV1;
};

export function TourPickupDropoffSection({
  pickup_dropoff,
  sectionUi,
}: TourPickupDropoffSectionProps) {
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);
  const [mapError, setMapError] = useState(false);

  if (!pickup_dropoff) return null;
  const pickupPoints = pickup_dropoff.departure ?? [];
  const dropoffPoints = pickup_dropoff.return ?? [];
  if (pickupPoints.length === 0 && dropoffPoints.length === 0) return null;

  const firstPickup = pickupPoints[0];
  const lastPickup = pickupPoints[pickupPoints.length - 1];
  const range =
    firstPickup?.time && lastPickup?.time
      ? `${firstPickup.time} – ${lastPickup.time}`
      : firstPickup?.time ?? "";
  const returnBand = inferReturnBand(pickup_dropoff.notes);
  const lastDropoff = dropoffPoints[dropoffPoints.length - 1];

  const routeDepartsText =
    lastPickup?.time
      ? (sectionUi.pickupRouteDepartsTemplate ?? "Route departs after final pickup at {time}").replace(
          "{time}",
          lastPickup.time,
        )
      : null;

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const mapUrl = useMemo(
    () => buildStaticMapUrl(pickupPoints, dropoffPoints),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickup_dropoff],
  );

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-foreground">
          {sectionUi.pickupDropoffTitle ?? "Pickup & Drop-off"}
        </h2>
        <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
          {sectionUi.pickupDropoffSubtitle ?? "Hotel pickup included. Tap any location for details."}
        </p>
      </div>

      {/* Unified pickup + drop-off card */}
      <div
        className={cn(
          "overflow-hidden rounded-2xl",
          "bg-white",
          "ring-1 ring-slate-900/[0.07]",
          "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.16)]",
        )}
      >
        {/* Google Static Map — shows all pickup pins; hidden if API returns error */}
        {mapUrl && !mapError && (
          <div className="relative w-full overflow-hidden bg-slate-100" style={{ aspectRatio: "600/280" }}>
            <img
              src={mapUrl}
              alt="Pickup and drop-off map"
              width={600}
              height={180}
              loading="lazy"
              decoding="async"
              onError={() => setMapError(true)}
              className="h-full w-full object-cover"
            />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-white to-transparent" />
          </div>
        )}

        {/* ── PICKUP SECTION ── */}
        {pickupPoints.length > 0 && (
          <>
            {/* Pickup header strip */}
            <div className="flex items-center justify-between gap-3 border-b border-stone-200/50 px-4 py-3 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span
                  className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-white shadow-[0_4px_12px_-4px_rgba(15,23,42,0.30)]"
                  style={{
                    background: undefined,
                  }}
                >
                  <Bus className="h-4 w-4" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight text-foreground">
                    {sectionUi.pickupCardTitle ?? "Pickup"}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">
                    {pickupPoints.length} locations
                  </p>
                </div>
              </div>
              {range && (
                <p className="flex-shrink-0 text-[12.5px] font-bold tabular-nums text-foreground sm:text-[13px]">
                  {range}
                </p>
              )}
            </div>

            {/* Pickup rows */}
            <ul className="divide-y divide-stone-200/45">
              {pickupPoints.map((point) => {
                const isExpanded = expandedOrder === point.order;
                const Icon = pointTypeIcon(point.type);
                return (
                  <li key={`pickup-${point.order}-${point.name}`}>
                    <button
                      type="button"
                      onClick={() => setExpandedOrder(isExpanded ? null : point.order)}
                      aria-expanded={isExpanded}
                      className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-stone-50/60 sm:px-5"
                    >
                      <span
                        className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-foreground text-[11px] font-bold tabular-nums text-white shadow-[0_3px_10px_-3px_rgba(15,23,42,0.28)]"
                        style={{
                          background: undefined,
                        }}
                      >
                        {point.order}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-foreground">
                          {point.name}
                        </p>
                        {point.type ? (
                          <p className="mt-0.5 text-[10.5px] uppercase tracking-[0.08em] text-muted-foreground">
                            {point.type}
                          </p>
                        ) : null}
                      </div>
                      {point.time ? (
                        <span className="flex-shrink-0 text-[13px] font-semibold tabular-nums text-foreground">
                          {point.time}
                        </span>
                      ) : null}
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 flex-shrink-0 text-muted-foreground/60 transition-transform duration-200 group-hover:text-foreground/70",
                          isExpanded && "rotate-180 text-foreground/80",
                        )}
                        strokeWidth={2.25}
                      />
                    </button>

                    <div
                      className={cn(
                        "grid transition-all duration-300 ease-out",
                        isExpanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                      )}
                    >
                      <div className="overflow-hidden">
                        <div className="px-4 pb-3.5 sm:px-5">
                          <div className="flex items-start gap-2.5 rounded-lg bg-stone-50/70 px-3 py-2.5 ring-1 ring-stone-200/55">
                            <Icon
                              className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-foreground"
                              strokeWidth={2}
                            />
                            <div className="min-w-0 space-y-0.5">
                              <p className="text-[12px] font-medium text-foreground">{point.name}</p>
                              {point.note ? (
                                <p className="text-[11.5px] leading-relaxed text-muted-foreground">
                                  {point.note}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Route-departs footer */}
            {routeDepartsText && (
              <div className="flex items-center gap-1.5 border-t border-stone-200/50 bg-stone-50/40 px-4 py-2.5 text-[11.5px] text-muted-foreground sm:px-5">
                <ArrowRight
                  className="h-3.5 w-3.5 flex-shrink-0 text-foreground"
                  strokeWidth={2.2}
                />
                <span>
                  {routeDepartsText.split(lastPickup!.time!).map((part, idx, arr) => (
                    <Fragment key={idx}>
                      {part}
                      {idx < arr.length - 1 && (
                        <span className="font-semibold tabular-nums text-foreground">
                          {lastPickup!.time}
                        </span>
                      )}
                    </Fragment>
                  ))}
                </span>
              </div>
            )}
          </>
        )}

        {/* ── DROP-OFF SECTION — Sprint 2.5: dark gradient strip → light card (pickup과 동일 형태) ── */}
        {dropoffPoints.length > 0 && (
          <div className="relative overflow-hidden border-t border-stone-200/70 bg-white">
            <div className="flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 ring-1 ring-slate-200">
                  <Navigation className="h-4 w-4 text-slate-700" strokeWidth={1.9} />
                </span>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold tracking-tight text-foreground">
                    {sectionUi.dropoffCardTitle ?? "Drop-off"}
                  </p>
                  <p className="text-[10.5px] text-muted-foreground">
                    {lastDropoff?.note ? lastDropoff.note.split(".")[0] : "Approximate"}
                  </p>
                </div>
              </div>
              <div className="flex-shrink-0 text-right">
                <p className="text-[13px] font-bold tabular-nums text-foreground sm:text-[13.5px]">
                  ~{returnBand ?? lastDropoff?.time ?? "17:30"}
                </p>
                <p className="text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">
                  {sectionUi.dropoffApproxLabel ?? "approx."}
                </p>
              </div>
            </div>

            {/* Return-to pills */}
            <div className="border-t border-stone-200/50 px-4 py-3 sm:px-5">
              <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                {sectionUi.dropoffReturnHeading ?? "Return available to"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dropoffPoints.map((p) => {
                  const short = p.name.split(/\s+(?:Hotel|International|Traditional|Duty)/)[0];
                  return (
                    <span
                      key={`return-${p.order}`}
                      className="inline-flex items-center rounded-full bg-slate-50 px-2.5 py-1 text-[10.5px] font-medium text-slate-700 ring-1 ring-slate-200"
                    >
                      {short}
                    </span>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Trust footer */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <CheckCircle2 className="h-4 w-4 text-foreground" strokeWidth={2} />
        <span className="text-[12.5px] text-muted-foreground">
          {sectionUi.pickupTrustFooter ?? "Hotel pickup included · No extra charge"}
        </span>
      </div>
    </div>
  );
}
