"use client";

import { useCallback, useState } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import { Building2, ChevronDown, Clock3, MapPin, Plane, ShoppingBag, Store, TrainFront } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  GOOGLE_MAPS_LOADER_ID,
  GOOGLE_MAPS_LOADER_VERSION,
  libraries as GOOGLE_MAPS_LIBRARIES,
} from "@/lib/google-maps";
import type { PickupDropoffPoint, PickupDropoffSection } from "./pickupDropoffTypes";
import type { TourProductSectionUiV1 } from "@/lib/tour-product/tourProductSectionUi";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

function pointIcon(type: string | undefined) {
  const t = (type ?? "").toLowerCase();
  if (t === "hotel") return Building2;
  if (t === "airport") return Plane;
  if (t === "shopping") return ShoppingBag;
  if (t === "market") return Store;
  if (t === "station") return TrainFront;
  return MapPin;
}

function computeCenter(points: PickupDropoffPoint[]): { lat: number; lng: number } {
  const valid = points.filter((p) => p.lat != null && p.lng != null);
  if (valid.length === 0) return { lat: 33.499, lng: 126.531 };
  const lat = valid.reduce((s, p) => s + p.lat!, 0) / valid.length;
  const lng = valid.reduce((s, p) => s + p.lng!, 0) / valid.length;
  return { lat, lng };
}

function computeZoom(points: PickupDropoffPoint[]): number {
  const valid = points.filter((p) => p.lat != null && p.lng != null);
  if (valid.length <= 1) return 14;
  const lats = valid.map((p) => p.lat!);
  const lngs = valid.map((p) => p.lng!);
  const latSpread = Math.max(...lats) - Math.min(...lats);
  const lngSpread = Math.max(...lngs) - Math.min(...lngs);
  const spread = Math.max(latSpread, lngSpread);
  if (spread > 0.3) return 11;
  if (spread > 0.1) return 12;
  if (spread > 0.05) return 13;
  return 14;
}

function PickupPointCard({
  point,
  index,
  isSelected,
  onClick,
  directionsLabel,
}: {
  point: PickupDropoffPoint;
  index: number;
  isSelected: boolean;
  onClick: () => void;
  directionsLabel: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const Icon = pointIcon(point.type);

  return (
    <div
      className={cn(
        "rounded-xl border transition-all duration-200",
        isSelected
          ? "border-primary/30 shadow-[0_2px_12px_-4px_rgba(0,0,0,0.12)] ring-1 ring-primary/20"
          : "border-border/60 shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]",
        "bg-white overflow-hidden",
      )}
    >
      {/* Card header */}
      <button
        type="button"
        onClick={() => { onClick(); setExpanded((v) => !v); }}
        className="flex w-full items-start gap-3 p-3.5 text-left"
      >
        {/* Number badge */}
        <div
          className={cn(
            "mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-bold tabular-nums",
            isSelected ? "bg-primary text-white" : "bg-slate-100 text-slate-600",
          )}
        >
          {index + 1}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            {point.time && (
              <>
                <Clock3 className="h-3 w-3" />
                <span className="font-semibold text-slate-700 tabular-nums">{point.time}</span>
                <span className="text-slate-300">·</span>
              </>
            )}
            <Icon className="h-3 w-3" />
          </div>
          <p className="mt-0.5 text-[13.5px] font-semibold text-slate-900 leading-snug">{point.name}</p>
          {point.locationDetail && !expanded && (
            <p className="mt-0.5 text-[11px] text-slate-400 line-clamp-1">{point.locationDetail}</p>
          )}
        </div>

        <div className={cn("mt-1 flex-shrink-0 rounded-full p-1 transition-transform duration-200 bg-muted/50", expanded && "rotate-180")}>
          <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
        </div>
      </button>

      {/* Expanded detail */}
      <div className={cn("grid transition-all duration-200", expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="overflow-hidden">
          <div className="border-t border-border/50 px-3.5 py-3 space-y-2">
            {point.photo && (
              <div className="rounded-lg overflow-hidden h-28 w-full">
                <img src={point.photo} alt={point.name} className="h-full w-full object-cover" loading="lazy" />
              </div>
            )}
            {point.locationDetail && (
              <p className="text-[12px] text-slate-600 leading-relaxed">{point.locationDetail}</p>
            )}
            {point.note && (
              <p className="text-[11.5px] text-muted-foreground leading-relaxed">{point.note}</p>
            )}
            {point.lat != null && point.lng != null && (
              <a
                href={`https://maps.google.com/?q=${point.lat},${point.lng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[11.5px] text-primary font-medium hover:underline"
              >
                <MapPin className="h-3 w-3" />
                {directionsLabel}
              </a>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

type TourPickupMapSectionProps = {
  pickupDropoff?: PickupDropoffSection;
  sectionUi: TourProductSectionUiV1;
};

export function TourPickupMapSection({ pickupDropoff, sectionUi }: TourPickupMapSectionProps) {
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });

  const onMapLoad = useCallback((m: google.maps.Map) => setMap(m), []);
  const onMapUnmount = useCallback(() => setMap(null), []);

  if (!pickupDropoff) return null;
  const points = pickupDropoff.departure ?? [];
  const validPoints = points.filter((p) => p.lat != null && p.lng != null);
  if (points.length === 0) return null;

  const center = computeCenter(points);
  const zoom = computeZoom(points);

  const handlePointClick = (idx: number) => {
    setSelectedIdx(selectedIdx === idx ? null : idx);
    const p = points[idx];
    if (map && p.lat != null && p.lng != null) {
      map.panTo({ lat: p.lat, lng: p.lng });
      map.setZoom(15);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-foreground tracking-tight">
          {sectionUi.pickupMapTitle ?? "Pickup locations"}
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">
          {sectionUi.pickupMapSubtitle ?? "Tap a stop on the map or below for directions."}
        </p>
      </div>

      {/* Map */}
      <div className="overflow-hidden rounded-2xl shadow-[0_1px_2px_rgba(0,0,0,0.03),0_4px_12px_-2px_rgba(0,0,0,0.055)]">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: "100%", height: "260px" }}
            center={center}
            zoom={zoom}
            onLoad={onMapLoad}
            onUnmount={onMapUnmount}
            options={{
              disableDefaultUI: true,
              zoomControl: true,
              streetViewControl: false,
              mapTypeControl: false,
              fullscreenControl: false,
              styles: MAP_STYLE,
            }}
          >
            {validPoints.map((p, i) => (
              <Marker
                key={`marker-${i}`}
                position={{ lat: p.lat!, lng: p.lng! }}
                label={{
                  text: String(p.order),
                  color: selectedIdx === i ? "#ffffff" : "#ffffff",
                  fontSize: "12px",
                  fontWeight: "bold",
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 14,
                  fillColor: selectedIdx === i ? "#0ea5e9" : "#1e40af",
                  fillOpacity: 1,
                  strokeColor: "#ffffff",
                  strokeWeight: 2,
                }}
                onClick={() => handlePointClick(i)}
              />
            ))}
          </GoogleMap>
        ) : (
          <div className="flex h-[260px] items-center justify-center bg-slate-100">
            <span className="text-sm text-slate-400">Loading map…</span>
          </div>
        )}
      </div>

      {/* Pickup point detail cards */}
      <div className="space-y-2.5">
        {points.map((point, i) => (
          <PickupPointCard
            key={`pickup-card-${i}`}
            point={point}
            index={i}
            isSelected={selectedIdx === i}
            onClick={() => handlePointClick(i)}
            directionsLabel={sectionUi.pickupMapDirectionsLabel ?? "View on Google Maps"}
          />
        ))}
      </div>
    </div>
  );
}
