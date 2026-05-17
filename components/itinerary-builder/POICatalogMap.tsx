"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, InfoWindow, Polyline, useLoadScript } from "@react-google-maps/api";
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
  /** Phase 4a wiring — cart state owned by parent (`BuilderShell`). */
  cart?: string[];
  onAdd?: (key: string) => void;
  onRemove?: (key: string) => void;
  hasInCart?: (key: string) => boolean;
  /** Phase 7 — when set, map pans to this POI and opens its InfoWindow. */
  focusedPoiKey?: string | null;
  /** Phase E — expose reset-view to parent (BuilderShell's map header bar). */
  resetViewRef?: React.MutableRefObject<(() => void) | null>;
}

export default function POICatalogMap({
  region,
  pois,
  center,
  mapId,
  apiKey,
  cart,
  onAdd,
  onRemove,
  hasInCart,
  focusedPoiKey,
  resetViewRef,
}: Props) {
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

  // Polyline path: cart POIs in order. Empty when cart < 2 items.
  const polylinePath = useMemo(() => {
    if (!cart || cart.length < 2) return [];
    const byKey = new Map(pois.map((p) => [p.poi_key, p]));
    return cart
      .map((k) => byKey.get(k))
      .filter((p): p is MatchPoiRow => !!p)
      .map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [cart, pois]);

  const handleMapLoad = useCallback((m: google.maps.Map) => {
    setMap(m);
  }, []);

  /** Reset view back to region centroid + initial zoom. Exposed to parent
   * via the small floating button below the map header. */
  const handleResetView = useCallback(() => {
    if (!map) return;
    map.panTo({ lat: center.lat, lng: center.lng });
    map.setZoom(center.zoom);
    setSelected(null);
  }, [map, center.lat, center.lng, center.zoom]);

  // Expose reset-view to parent so the BuilderShell map header bar can wire it.
  useEffect(() => {
    if (!resetViewRef) return;
    resetViewRef.current = handleResetView;
    return () => {
      if (resetViewRef.current === handleResetView) resetViewRef.current = null;
    };
  }, [resetViewRef, handleResetView]);

  const handleMapUnmount = useCallback(() => {
    setMap(null);
    clustererRef.current?.clearMarkers();
    clustererRef.current = null;
    markersRef.current = [];
  }, []);

  // Phase 7 — external focus (AIRecommendPanel chip or CartPanel row click)
  useEffect(() => {
    if (!focusedPoiKey || !map || !pois.length) return;
    const poi = pois.find((p) => p.poi_key === focusedPoiKey);
    if (!poi) return;
    setSelected(poi);
    map.panTo({ lat: poi.lat, lng: poi.lng });
    const z = map.getZoom();
    if (typeof z === "number" && z < 12) map.setZoom(12);
  }, [focusedPoiKey, map, pois]);

  // Build AdvancedMarkerElement instances + clusterer when map + pois (or
  // cart membership) change. In-cart POIs get amber pins with a 1-indexed
  // cart-order glyph; out-of-cart POIs get the default slate pin.
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

    const cartIndex = new Map((cart ?? []).map((k, i) => [k, i + 1]));

    const markers = pois.map((poi) => {
      const seq = cartIndex.get(poi.poi_key);
      const inCart = seq != null;
      const pin = new google.maps.marker.PinElement({
        background: inCart ? "#f59e0b" : "#0f172a",
        borderColor: "#ffffff",
        glyph: inCart ? String(seq) : undefined,
        glyphColor: inCart ? "#ffffff" : "#fbbf24",
        scale: inCart ? 1.15 : 1.0,
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
  }, [map, pois, cart]);

  // Outer container always renders with explicit dimensions so the page
  // doesn't collapse when Google Maps JS is still loading or fails. Inner
  // content swaps between loading / error / map.
  const containerClasses =
    "relative h-[70vh] min-h-[420px] w-full md:h-full md:min-h-[600px]";

  if (loadError) {
    return (
      <div className={containerClasses + " flex items-center justify-center bg-slate-50 p-6 text-center"} data-region={region}>
        <div>
          <p className="text-h3 text-slate-900">{t("errorTitle")}</p>
          <p className="mt-1 text-body text-slate-600">{t("errorBody")}</p>
        </div>
      </div>
    );
  }
  if (!isLoaded) {
    return (
      <div className={containerClasses + " flex items-center justify-center bg-slate-50"} data-region={region}>
        <p className="text-body text-slate-500">{t("loadingLabel")}</p>
      </div>
    );
  }

  return (
    <div className={containerClasses} data-region={region}>
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
        {polylinePath.length >= 2 ? (
          <Polyline
            path={polylinePath}
            options={{
              strokeColor: "#0f172a",
              strokeOpacity: 0.85,
              strokeWeight: 3,
              geodesic: true,
              icons: [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                  offset: "0",
                  repeat: "12px",
                },
              ],
            }}
          />
        ) : null}
        {selected ? (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => setSelected(null)}
            options={{
              pixelOffset: typeof window !== "undefined" ? new google.maps.Size(0, -34) : undefined,
            }}
          >
            <POIInfoWindowContent
              poi={selected}
              inCart={hasInCart?.(selected.poi_key) ?? false}
              onAdd={onAdd ? () => onAdd(selected.poi_key) : undefined}
              onRemove={onRemove ? () => onRemove(selected.poi_key) : undefined}
            />
          </InfoWindow>
        ) : null}
      </GoogleMap>
    </div>
  );
}
