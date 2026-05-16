"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, InfoWindow, useLoadScript } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useTranslations } from "@/lib/i18n";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import POIInfoWindowContent from "./POIInfoWindowContent";

const LIBRARIES: ("places" | "marker")[] = ["places", "marker"];

const CONTAINER_STYLE = {
  width: "100%",
  height: "100%",
} as const;

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  center: { lat: number; lng: number; zoom: number };
  mapId: string;
  apiKey: string;
}

export default function POICatalogMap({ region, pois, center, mapId, apiKey }: Props) {
  const t = useTranslations("itineraryBuilder.map");
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: apiKey,
    libraries: LIBRARIES,
    version: "weekly",
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [selected, setSelected] = useState<MatchPoiRow | null>(null);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);

  const initialCenter = useMemo(() => ({ lat: center.lat, lng: center.lng }), [center.lat, center.lng]);

  const handleMapLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  const handleMapUnmount = useCallback(() => {
    setMap(null);
    clustererRef.current?.clearMarkers();
    clustererRef.current = null;
    markersRef.current = [];
  }, []);

  // Build AdvancedMarkerElement instances + clusterer when map + pois ready.
  useEffect(() => {
    if (!map || !pois.length) return;
    if (!("marker" in google.maps) || !google.maps.marker?.AdvancedMarkerElement) {
      console.warn("[POICatalogMap] marker library not loaded — falling back is not implemented.");
      return;
    }

    // Tear down prior clusterer + markers (in case of hot-reload or pois change)
    clustererRef.current?.clearMarkers();
    markersRef.current.forEach((m) => {
      if ("map" in m) m.map = null;
    });
    markersRef.current = [];

    const markers = pois.map((poi) => {
      const pin = new google.maps.marker.PinElement({
        background: "#0f172a",
        borderColor: "#ffffff",
        glyphColor: "#fbbf24",
        scale: 1.0,
      });
      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: poi.lat, lng: poi.lng },
        content: pin.element,
        title: poi.name_en,
      });
      marker.addListener("gmp-click", () => {
        setSelected(poi);
        map.panTo({ lat: poi.lat, lng: poi.lng });
      });
      return marker;
    });

    markersRef.current = markers;
    clustererRef.current = new MarkerClusterer({ map, markers });

    return () => {
      clustererRef.current?.clearMarkers();
      clustererRef.current = null;
      markers.forEach((m) => (m.map = null));
      markersRef.current = [];
    };
  }, [map, pois]);

  if (loadError) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center p-6 text-center md:aspect-[16/8]">
        <div>
          <p className="text-base font-semibold text-slate-900">{t("errorTitle")}</p>
          <p className="mt-1 text-sm text-slate-600">{t("errorBody")}</p>
        </div>
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className="flex aspect-[16/10] items-center justify-center md:aspect-[16/8]">
        <p className="text-sm text-slate-500">{t("loadingLabel")}</p>
      </div>
    );
  }

  return (
    <div
      className="relative h-[70vh] min-h-[420px] w-full md:h-[78vh] md:min-h-[600px]"
      data-region={region}
    >
      <GoogleMap
        mapContainerStyle={CONTAINER_STYLE}
        center={initialCenter}
        zoom={center.zoom}
        onLoad={handleMapLoad}
        onUnmount={handleMapUnmount}
        options={{
          mapId: mapId || undefined,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          // Top-down clarity for itinerary planning (tilt/rotation OFF per Map ID config + here).
          tilt: 0,
          heading: 0,
          gestureHandling: "greedy",
        }}
      >
        {selected ? (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
            options={{
              pixelOffset: typeof window !== "undefined" ? new google.maps.Size(0, -34) : undefined,
            }}
          >
            <POIInfoWindowContent poi={selected} />
          </InfoWindow>
        ) : null}
      </GoogleMap>
    </div>
  );
}
