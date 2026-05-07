"use client";

import { Fragment, useState, type ComponentType } from "react";
import {
  ArrowRight,
  Building2,
  Bus,
  CheckCircle2,
  ChevronDown,
  Clock3,
  Navigation,
  Plane,
  ShoppingBag,
  Store,
  TrainFront,
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

export type TourPickupDropoffSectionProps = {
  pickup_dropoff?: PickupDropoffSection;
  sectionUi: TourProductSectionUiV1;
};

export function TourPickupDropoffSection({
  pickup_dropoff,
  sectionUi,
}: TourPickupDropoffSectionProps) {
  const [expandedOrder, setExpandedOrder] = useState<number | null>(null);

  if (!pickup_dropoff) return null;
  const pickupPoints = pickup_dropoff.departure ?? [];
  const dropoffPoints = pickup_dropoff.return ?? [];
  if (pickupPoints.length === 0 && dropoffPoints.length === 0) return null;

  const firstPickup = pickupPoints[0];
  const lastPickup = pickupPoints[pickupPoints.length - 1];
  const range = firstPickup?.time && lastPickup?.time ? `${firstPickup.time} – ${lastPickup.time}` : firstPickup?.time ?? "";
  const returnBand = inferReturnBand(pickup_dropoff.notes);
  const lastDropoff = dropoffPoints[dropoffPoints.length - 1];

  const routeDepartsText = lastPickup?.time
    ? (sectionUi.pickupRouteDepartsTemplate ?? "Route departs after final pickup at {time}").replace(
        "{time}",
        lastPickup.time,
      )
    : null;

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

      {/* Pickup card — premium-minimal shell, copper accents preserved on the badges only. */}
      {pickupPoints.length > 0 && (
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl",
            "bg-white",
            "ring-1 ring-slate-900/[0.07]",
            "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_4px_10px_-2px_rgba(15,23,42,0.06),0_18px_36px_-14px_rgba(15,23,42,0.16)]",
          )}
        >
          {/* Pickup header strip */}
          <div className="relative flex items-center justify-between gap-3 border-b border-stone-200/50 px-4 py-3 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-white shadow-[0_4px_12px_-4px_rgba(200,149,108,0.50)]"
                style={{
                  background:
                    "linear-gradient(135deg, #d4a37e 0%, #c8956c 50%, #a67751 100%)",
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
          <ul className="relative divide-y divide-stone-200/45">
            {pickupPoints.map((point) => {
              const isExpanded = expandedOrder === point.order;
              const Icon = pointTypeIcon(point.type);
              return (
                <li key={`pickup-${point.order}-${point.name}`}>
                  <button
                    type="button"
                    onClick={() => setExpandedOrder(isExpanded ? null : point.order)}
                    aria-expanded={isExpanded}
                    className="group flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/40 sm:px-5"
                  >
                    <span
                      className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums text-white shadow-[0_3px_10px_-3px_rgba(200,149,108,0.45)]"
                      style={{
                        background:
                          "linear-gradient(135deg, #d4a37e 0%, #c8956c 50%, #a67751 100%)",
                      }}
                    >
                      {point.order}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] font-medium text-foreground">{point.name}</p>
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
                        <div className="flex items-start gap-2.5 rounded-lg bg-white/65 px-3 py-2.5 ring-1 ring-stone-200/55">
                          <Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-rose-500/85" strokeWidth={2} />
                          <div className="min-w-0 space-y-0.5">
                            <p className="text-[12px] font-medium text-foreground">{point.name}</p>
                            {point.note ? (
                              <p className="text-[11.5px] leading-relaxed text-muted-foreground">{point.note}</p>
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

          {/* Departs indicator */}
          {routeDepartsText && (
            <div className="relative flex items-center gap-1.5 border-t border-stone-200/50 bg-white/35 px-4 py-2.5 text-[11.5px] text-muted-foreground sm:px-5">
              <ArrowRight className="h-3.5 w-3.5 flex-shrink-0 text-rose-500/85" strokeWidth={2.2} />
              <span>{routeDepartsText.split(lastPickup!.time!).map((part, idx, arr) => (
                <Fragment key={idx}>
                  {part}
                  {idx < arr.length - 1 && (
                    <span className="font-semibold tabular-nums text-foreground">{lastPickup!.time}</span>
                  )}
                </Fragment>
              ))}</span>
            </div>
          )}
        </div>
      )}

      {/* Drop-off card — dark luxury surface */}
      {dropoffPoints.length > 0 && (
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl ring-1 ring-[#1f2c44]/60",
            "shadow-[0_3px_8px_rgba(12,22,34,0.18),0_18px_38px_-16px_rgba(12,22,34,0.40)]",
          )}
          style={{
            background:
              "linear-gradient(135deg, #111d31 0%, #0c1622 55%, #0a1320 100%)",
          }}
        >
          <span
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
            style={{
              background:
                "linear-gradient(180deg, rgba(255,255,255,0.07) 0%, transparent 100%)",
            }}
          />

          <div className="relative flex items-center justify-between gap-3 px-4 py-3.5 sm:px-5">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur-sm">
                <Navigation className="h-4 w-4 text-white" strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="text-[13px] font-semibold tracking-tight text-white">
                  {lastDropoff?.name ?? sectionUi.dropoffCardTitle ?? "Drop-off"}
                </p>
                <p className="text-[10.5px] text-white/60">
                  {lastDropoff?.note ? lastDropoff.note.split(".")[0] : "Approximate"}
                </p>
              </div>
            </div>
            <div className="flex-shrink-0 text-right">
              <p className="text-[13px] font-bold tabular-nums text-white sm:text-[13.5px]">
                ~{returnBand ?? lastDropoff?.time ?? "17:30"}
              </p>
              <p className="text-[9.5px] uppercase tracking-[0.12em] text-white/50">
                {sectionUi.dropoffApproxLabel ?? "approx."}
              </p>
            </div>
          </div>

          {/* Return options pills — one per drop-off point */}
          {dropoffPoints.length > 0 && (
            <div className="relative border-t border-white/10 px-4 py-3 sm:px-5">
              <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.14em] text-white/50">
                {sectionUi.dropoffReturnHeading ?? "Return available to"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {dropoffPoints.map((p) => {
                  const short = p.name.split(/\s+(?:Hotel|International|Traditional|Duty)/)[0];
                  return (
                    <span
                      key={`return-${p.order}`}
                      className="inline-flex items-center rounded-full bg-white/10 px-2.5 py-1 text-[10.5px] font-medium text-white/90 ring-1 ring-white/15 backdrop-blur-sm"
                    >
                      {short}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Trust footer */}
      <div className="flex items-center justify-center gap-2 pt-1">
        <CheckCircle2 className="h-4 w-4 text-rose-500/85" strokeWidth={2} />
        <span className="text-[12.5px] text-muted-foreground">
          {sectionUi.pickupTrustFooter ?? "Hotel pickup included · No extra charge"}
        </span>
      </div>
    </div>
  );
}
