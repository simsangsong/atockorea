"use client";

import { useCallback } from "react";
import { GoogleMap, Marker, useJsApiLoader } from "@react-google-maps/api";
import {
  GOOGLE_MAPS_LOADER_ID,
  GOOGLE_MAPS_LOADER_VERSION,
  libraries as GOOGLE_MAPS_LIBRARIES,
} from "@/lib/google-maps";
import type { PickupDropoffPoint } from "./pickupDropoffTypes";

const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";

const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { featureType: "poi", elementType: "labels", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

/**
 * The actual Google Maps canvas — split out of TourPickupMapSection so it can be
 * `dynamic(ssr:false)` code-split and mounted only when the map scrolls into view.
 * Importing this file is what pulls the ~150KB `@react-google-maps/api` + Maps JS
 * SDK, so it must stay out of the tour-product page's initial bundle (C1).
 */
export function TourPickupMapCanvas({
  center,
  zoom,
  validPoints,
  selectedIdx,
  onPointClick,
  onMapChange,
}: {
  center: { lat: number; lng: number };
  zoom: number;
  validPoints: PickupDropoffPoint[];
  selectedIdx: number | null;
  onPointClick: (idx: number) => void;
  onMapChange: (map: google.maps.Map | null) => void;
}) {
  const { isLoaded } = useJsApiLoader({
    id: GOOGLE_MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
    version: GOOGLE_MAPS_LOADER_VERSION,
  });

  const onMapLoad = useCallback((m: google.maps.Map) => onMapChange(m), [onMapChange]);
  const onMapUnmount = useCallback(() => onMapChange(null), [onMapChange]);

  if (!isLoaded) {
    return (
      <div className="flex h-[260px] items-center justify-center bg-slate-100">
        <span className="text-sm text-slate-400">Loading map…</span>
      </div>
    );
  }

  return (
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
            color: "#ffffff",
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
          onClick={() => onPointClick(i)}
        />
      ))}
    </GoogleMap>
  );
}
