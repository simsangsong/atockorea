"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GoogleMap, InfoWindow, Polyline, useLoadScript } from "@react-google-maps/api";
import { MarkerClusterer } from "@googlemaps/markerclusterer";
import { useTranslations } from "@/lib/i18n";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import {
  buildPhotoPinContent,
  haversineMeters,
  setPhotoPinState,
} from "@/lib/itinerary-builder/photo-pin";
import { useActiveStop } from "@/lib/itinerary-builder/active-stop";
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
  const { activeKey, setActive } = useActiveStop();

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

  // V2 Phase 2 — photo-pin marker system (production). Three-tier:
  //   • out-of-cart → 14px slate dot
  //   • in-cart     → 56px round photo + amber seq badge + slate tail
  //   • hover       → 64px (1.14×) with amber halo (toggled on mouseenter)
  //
  // Pin offset clustering: when two in-cart photos sit within 80m, the
  // second is offset 28px clockwise via marker collisionBehavior + a
  // small CSS translate so faces stay readable at city zoom.
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

    // Pre-compute pixel-offsets for in-cart pins that overlap. We do this
    // for the in-cart subset only — out-of-cart 14px dots tolerate overlap
    // because they don't carry identity.
    const inCartPois = (cart ?? [])
      .map((k) => pois.find((p) => p.poi_key === k))
      .filter((p): p is MatchPoiRow => !!p);
    const pinOffsets = new Map<string, { x: number; y: number }>();
    for (let i = 1; i < inCartPois.length; i++) {
      for (let j = 0; j < i; j++) {
        const d = haversineMeters(
          { lat: inCartPois[i].lat, lng: inCartPois[i].lng },
          { lat: inCartPois[j].lat, lng: inCartPois[j].lng }
        );
        if (d < 80) {
          // Already-offset pin j contributes; add a 28px clockwise step
          const prior = pinOffsets.get(inCartPois[j].poi_key) ?? { x: 0, y: 0 };
          pinOffsets.set(inCartPois[i].poi_key, {
            x: prior.x + 28,
            y: prior.y - 14,
          });
          break;
        }
      }
    }

    const markers = pois.map((poi) => {
      const seq = cartIndex.get(poi.poi_key);
      const inCart = seq != null;
      const content = buildPhotoPinContent({
        imageUrl: inCart ? poi.default_image_url || poi.images?.[0] || null : null,
        seq: inCart && seq != null ? seq : null,
        state: inCart ? "cart" : "out",
        nameEn: poi.name_en,
      });

      // Apply offset (if this pin overlaps an earlier in-cart pin)
      const offset = pinOffsets.get(poi.poi_key);
      if (offset) {
        content.style.transform = `translate(${offset.x}px, ${offset.y}px)`;
        // Make the offset element catch its own pointer events; the parent
        // AdvancedMarkerElement container otherwise treats the visual shift
        // as off-anchor and can mis-handle clicks.
      }

      // Hover → toggle state (CSS transition handles size + halo) + fire
      // the bi-sync setActive so the matching timeline card highlights.
      // Skip mouseenter sync for out-of-cart 14px dots (no visual cart
      // counterpart to highlight). data-poi attribute lets the active-key
      // effect below find this element by key.
      content.dataset.poi = poi.poi_key;
      if (inCart) {
        content.addEventListener("mouseenter", () => {
          setPhotoPinState(content, "hover");
          setActive(poi.poi_key, "map");
        });
        content.addEventListener("mouseleave", () => {
          setPhotoPinState(content, "cart");
          setActive(null, "map");
        });
      }

      const marker = new google.maps.marker.AdvancedMarkerElement({
        position: { lat: poi.lat, lng: poi.lng },
        content,
        title: poi.name_en,
      });
      marker.addListener("gmp-click", () => {
        setSelected(poi);
        map.panTo({ lat: poi.lat, lng: poi.lng });
        if (inCart) {
          setActive(poi.poi_key, "map");
          // Scroll the matching timeline card into view. The card has
          // data-poi-card={poi_key} (set in ResultTimeline).
          const card = document.querySelector(
            `[data-poi-card="${poi.poi_key}"]`
          );
          if (card && "scrollIntoView" in card) {
            // V-R5 + a11y: instant scroll under prefers-reduced-motion;
            // smooth otherwise.
            const reduce =
              typeof window !== "undefined" &&
              window.matchMedia &&
              window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            (card as HTMLElement).scrollIntoView({
              behavior: reduce ? "auto" : "smooth",
              block: "center",
            });
          }
        }
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

  // V2 Phase 4 — react to external activeKey changes (timeline hover/
  // click). For in-cart markers, swap data-state to "hover" when their
  // key matches activeKey, back to "cart" otherwise. Out-of-cart dots
  // ignored — they have no hover variant.
  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const el = marker.content as HTMLElement | null;
      if (!el) return;
      const poiKey = el.dataset.poi;
      // Only touch in-cart photo pins (those have data-state cart/hover).
      const currentState = el.dataset.state;
      if (currentState !== "cart" && currentState !== "hover") return;
      const shouldHover = poiKey != null && poiKey === activeKey;
      setPhotoPinState(el, shouldHover ? "hover" : "cart");
    });
  }, [activeKey]);

  // V2 Phase 2 — auto-fitBounds always-on (promoted from spike gate).
  //   • 0 POIs: do nothing, leave the initial region center.
  //   • 1 POI:  pan + zoom 13.
  //   • 2+:     fitBounds with rail-aware padding.
  // Right rail on lg+ takes 400px + 24px gap, so we pad-right harder on
  // desktop so the polyline doesn't crowd the rail edge.
  useEffect(() => {
    if (!map || !cart || cart.length === 0) return;
    const byKey = new Map(pois.map((p) => [p.poi_key, p]));
    const inCartPois = cart.map((k) => byKey.get(k)).filter((p): p is MatchPoiRow => !!p);
    if (inCartPois.length === 0) return;

    if (inCartPois.length === 1) {
      map.panTo({ lat: inCartPois[0].lat, lng: inCartPois[0].lng });
      const z = map.getZoom();
      if (typeof z !== "number" || z < 13) map.setZoom(13);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    inCartPois.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    map.fitBounds(
      bounds,
      isMobile
        ? { top: 32, right: 24, bottom: 80, left: 24 }
        : { top: 64, right: 64, bottom: 64, left: 64 }
    );
  }, [map, cart, pois]);

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
              // V2 Phase 2 — amber route line. Visually consistent with the
              // photo-pin sequence badges. Gradient stroke + animated dash
              // offset deferred to Phase 11 (canvas Polyline doesn't natively
              // gradient; needs SVG overlay layer which we don't budget here).
              strokeColor: "#f59e0b",
              strokeOpacity: 0.9,
              strokeWeight: 4,
              geodesic: true,
              icons: [
                {
                  icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 },
                  offset: "0",
                  repeat: "14px",
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
