"use client";

import { useMemo } from "react";
import { ChevronRight, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";
import type {
  PickupDropoffPoint,
  PickupDropoffSection,
} from "@/components/product-tour-static/_shared/pickupDropoffTypes";

type PickupDropoffCardsProps = {
  pickupDropoff?: PickupDropoffSection;
  sectionUi: TourProductSectionUiV1;
};

function formatTemplate(template: string, count: number): string {
  return template.replace("{count}", String(count));
}

function inferReturnBand(notes: string[] | string | undefined): string | null {
  if (!notes?.length) return null;
  // Some tour rows historically carry `notes` as a single string instead of
  // string[] — a latent crash that only surfaced once the page actually SSR'd.
  const joined = Array.isArray(notes) ? notes.join(" ") : String(notes);
  const match =
    joined.match(/Return usually runs around\s+([0-9]{1,2}:[0-9]{2}\s*[–-]\s*[0-9]{1,2}:[0-9]{2})/i) ??
    joined.match(/around\s+([0-9]{1,2}:[0-9]{2}\s*[–-]\s*[0-9]{1,2}:[0-9]{2})/i);
  return match?.[1] ?? null;
}

/**
 * W2.2 — the timeline ends carry SUMMARY NODES ONLY. The full pickup /
 * drop-off listings live once, in the canonical Pickup & Map section
 * (#pickup-dropoff); these nodes jump there (§F-8 grammar ④, single-source
 * rule §F-1). This also retires the accordion-in-accordion the old expandable
 * cards had (§F-4: nesting depth 0).
 *
 * The tiny map thumb reuses the EXACT static-map URL the pickup section
 * loads, so the browser cache serves it — no additional network request.
 */
function buildSummaryMapThumbUrl(
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
  pickupPoints.forEach((p) => {
    if (p.lat && p.lng) {
      const label = String(p.order).slice(0, 1);
      parts.push(`markers=color:0xC8956C%7Clabel:${label}%7C${p.lat},${p.lng}`);
    }
  });
  const pickupCoords = new Set(
    pickupPoints.filter((p) => p.lat && p.lng).map((p) => `${p.lat},${p.lng}`),
  );
  dropoffPoints.forEach((p) => {
    if (p.lat && p.lng && !pickupCoords.has(`${p.lat},${p.lng}`)) {
      parts.push(`markers=color:0x334155%7Clabel:R%7C${p.lat},${p.lng}`);
    }
  });
  return `/api/maps/static?${parts.join("&")}`;
}

function jumpToPickupSection(e: React.MouseEvent<HTMLAnchorElement>) {
  const target = document.getElementById("pickup-dropoff");
  if (target) {
    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

export function PickupOnlyCards({ pickupDropoff, sectionUi }: PickupDropoffCardsProps) {
  const pickupPoints = pickupDropoff?.departure ?? [];
  const dropoffPoints = pickupDropoff?.return ?? [];
  const mapThumb = useMemo(
    () => buildSummaryMapThumbUrl(pickupPoints, dropoffPoints),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pickupDropoff],
  );
  if (!pickupDropoff || pickupPoints.length === 0) return null;

  const first = pickupPoints[0];
  const isPort = (first?.type ?? "").toLowerCase() === "port";
  const title = isPort
    ? (sectionUi.pickupPortCardTitle ?? "Port pickup")
    : (sectionUi.pickupCardTitle ?? "Pickup");

  return (
    <div className="relative pl-12">
      <div className="absolute left-[19px] top-[52px] bottom-0 w-px bg-gradient-to-b from-border to-transparent" />
      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-white text-foreground shadow-lg ring-[3px] ring-white border border-border/70">
        <MapPin className="h-4.5 w-4.5" />
      </div>
      <div className="pb-5">
        <a
          href="#pickup-dropoff"
          onClick={jumpToPickupSection}
          className="flex w-full items-center gap-3 rounded-xl border border-border bg-white p-3 text-left shadow-premium transition-all duration-200 hover:shadow-premium-elevated sm:p-4"
        >
          {mapThumb ? (
            <span className="relative h-12 w-16 flex-shrink-0 overflow-hidden rounded-lg bg-slate-100 ring-1 ring-slate-900/5">
              {/* eslint-disable-next-line @next/next/no-img-element -- same static-map URL the pickup section loads; served from cache */}
              <img
                src={mapThumb}
                alt=""
                width={64}
                height={48}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            </span>
          ) : null}
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-xs text-muted-foreground">
              {first?.time ? <span className="font-semibold text-foreground">{first.time}</span> : null}
              {first?.time ? <span className="text-border">·</span> : null}
              <span className="truncate">
                {formatTemplate(sectionUi.pickupPointsTemplate ?? "{count} pickup points", pickupPoints.length)}
              </span>
            </span>
            <span className="mt-1 block text-base font-semibold tracking-tight text-foreground">{title}</span>
            <span className="mt-0.5 block text-[11px] font-medium text-muted-foreground underline decoration-slate-300 underline-offset-4">
              {sectionUi.pickupViewMapLabel ?? "Details & map"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-slate-400" aria-hidden />
        </a>
      </div>
    </div>
  );
}

export function DropoffOnlyCard({ pickupDropoff, sectionUi }: PickupDropoffCardsProps) {
  if (!pickupDropoff) return null;
  const dropoffPoints = pickupDropoff.return ?? [];
  if (dropoffPoints.length === 0) return null;
  const returnBand = inferReturnBand(pickupDropoff.notes);

  return (
    <div className="relative pl-12">
      <div className="absolute left-0 top-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#0E1A2D] text-white shadow-lg ring-[3px] ring-white">
        <MapPin className="h-4.5 w-4.5" />
      </div>
      <div className="pb-1">
        <a
          href="#pickup-dropoff"
          onClick={jumpToPickupSection}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border border-[#1D2A3D] bg-[#111D31] p-3 text-left shadow-premium transition-all duration-200 sm:p-4",
            "hover:border-[#2A3A52]",
          )}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 text-xs text-white/70">
              <span className="font-semibold text-white">~{returnBand ?? "17:30"}</span>
              <span>·</span>
              <span>{sectionUi.dropoffApproxLabel ?? "approx."}</span>
            </span>
            <span className="mt-1 block text-base font-semibold tracking-tight text-white">
              {sectionUi.dropoffCardTitle ?? "Drop-off"}
            </span>
            <span className="mt-1 inline-block rounded-md bg-white/10 px-2.5 py-0.5 text-[10px] font-medium text-white/75">
              {formatTemplate(sectionUi.dropoffLocationsTemplate ?? "{count} drop-off locations", dropoffPoints.length)}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 flex-shrink-0 text-white/60" aria-hidden />
        </a>
      </div>
    </div>
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
