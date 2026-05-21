"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader } from "@googlemaps/js-api-loader";
import { createRoot, type Root } from "react-dom/client";
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
import {
  GOOGLE_MAPS_LOADER_VERSION,
  libraries as GOOGLE_MAPS_LIBRARIES,
} from "@/lib/google-maps";
import POIInfoWindowContent from "./POIInfoWindowContent";

const CONTAINER_STYLE = {
  width: "100%",
  height: "100%",
} as const;

/**
 * Detach an AdvancedMarkerElement from the map. Setting `map = null` makes the
 * Maps SDK call `getRootNode()` on the marker's content element; when the
 * MarkerClusterer has already removed the marker (or React unmounted its DOM),
 * that element is detached and the setter throws "Cannot read properties of
 * undefined (reading 'getRootNode')". The marker is being torn down anyway, so
 * swallow it rather than crash the region page.
 */
function detachMarker(m: google.maps.marker.AdvancedMarkerElement): void {
  try {
    if (m && "map" in m) m.map = null;
  } catch {
    // already detached — safe to ignore
  }
}

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  center: { lat: number; lng: number; zoom: number };
  mapId: string;
  apiKey: string;
  /** Phase 4a wiring — cart state owned by parent (`BuilderShell`). */
  cart?: string[];
  /** R4 — AI-matched stops to PREVIEW on the map before they're adopted into
   *  the cart. Rendered as soft-amber "preview" photo-pins + a lighter route
   *  line + auto-fit, only while the cart is still empty. */
  previewKeys?: string[] | null;
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
  previewKeys,
  onAdd,
  onRemove,
  hasInCart,
  focusedPoiKey,
  resetViewRef,
}: Props) {
  const t = useTranslations("itineraryBuilder.map");
  const { activeKey, setActive } = useActiveStop();

  // Imperative Google Maps load — the @react-google-maps/api <GoogleMap> +
  // useJsApiLoader wrapper is unstable on React 19 / Next 16: it re-injects the
  // <script> repeatedly (10+ tags), `isLoaded` stalls, and the map never
  // instantiates (.gm-style absent → blank map). We load via the official
  // @googlemaps/js-api-loader and create the map ourselves.
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [selected, setSelected] = useState<MatchPoiRow | null>(null);
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  // StrictMode-safe one-shot guard so the map is created exactly once even
  // though React dev double-invokes effects.
  const mapInitStartedRef = useRef(false);
  const clustererRef = useRef<MarkerClusterer | null>(null);
  const markersRef = useRef<google.maps.marker.AdvancedMarkerElement[]>([]);
  // Imperative InfoWindow (the wrapper <InfoWindow> needs the <GoogleMap>
  // context we no longer use). Renders the React content into a detached root.
  const infoWindowRef = useRef<google.maps.InfoWindow | null>(null);
  const infoRootRef = useRef<Root | null>(null);
  const infoDivRef = useRef<HTMLDivElement | null>(null);
  // Route line drawn IMPERATIVELY (not via the @react-google-maps <Polyline>
  // component, whose setAt-on-update crashes the GoogleMap subtree on React 19
  // / Next 16 and blanks the whole map).
  const polylineRef = useRef<google.maps.Polyline | null>(null);

  const initialCenter = useMemo(() => ({ lat: center.lat, lng: center.lng }), [center.lat, center.lng]);

  // R4 — "route" = the adopted cart if any, otherwise the AI preview (so the
  // map shows the suggested day BEFORE the user presses Apply). previewMode is
  // true only while the cart is empty and a preview exists.
  const cartActive = !!cart && cart.length > 0;
  const previewMode = !cartActive && (previewKeys?.length ?? 0) > 0;

  // Polyline path: route POIs (cart or preview) in order. Empty when < 2.
  const polylinePath = useMemo(() => {
    const keys = cartActive ? cart! : previewKeys ?? [];
    if (keys.length < 2) return [];
    const byKey = new Map(pois.map((p) => [p.poi_key, p]));
    return keys
      .map((k) => byKey.get(k))
      .filter((p): p is MatchPoiRow => !!p)
      .map((p) => ({ lat: p.lat, lng: p.lng }));
  }, [cartActive, cart, previewKeys, pois]);

  // Imperative route polyline — created/updated on the loaded map directly,
  // bypassing the @react-google-maps <Polyline> wrapper (React-19 setAt crash
  // that blanked the map). Recreated on each path/preview change; torn down on
  // unmount via handleMapUnmount.
  useEffect(() => {
    if (!map || polylinePath.length < 2) {
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      return;
    }
    const line =
      polylineRef.current ??
      new google.maps.Polyline({
        geodesic: true,
        // Amber dotted route line — matches the photo-pin sequence badges.
        icons: [
          { icon: { path: "M 0,-1 0,1", strokeOpacity: 1, scale: 3 }, offset: "0", repeat: "14px" },
        ],
      });
    line.setOptions({
      path: polylinePath,
      strokeColor: "#f59e0b",
      strokeOpacity: previewMode ? 0.5 : 0.9,
      strokeWeight: 4,
      map,
    });
    polylineRef.current = line;
    return () => {
      line.setMap(null);
      polylineRef.current = null;
    };
  }, [map, polylinePath, previewMode]);

  // Load Maps + Marker libs via the official loader, then create the map ONCE.
  // StrictMode double-invokes effects in dev; we guard with a ref (not a
  // cancellation flag) so the async creation always completes — a cancellation
  // race was leaving `isLoaded` stuck and the map uncreated.
  useEffect(() => {
    if (mapInitStartedRef.current || !mapDivRef.current) return;
    mapInitStartedRef.current = true;
    const loader = new Loader({
      apiKey,
      version: GOOGLE_MAPS_LOADER_VERSION,
      libraries: GOOGLE_MAPS_LIBRARIES as ("places" | "marker")[],
    });
    Promise.all([loader.importLibrary("maps"), loader.importLibrary("marker")])
      .then(([{ Map }]) => {
        const div = mapDivRef.current;
        if (!div) return;
        const m = new Map(div, {
          center: initialCenter,
          zoom: center.zoom,
          mapId: mapId || undefined,
          disableDefaultUI: false,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true,
          tilt: 0,
          heading: 0,
          gestureHandling: "greedy",
        });
        setMap(m);
        setIsLoaded(true);
      })
      .catch((err) => {
        console.warn("[POICatalogMap] Google Maps load failed", err);
        setLoadError(true);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Imperative InfoWindow open/close driven by `selected` (pin click).
  useEffect(() => {
    if (!map) return;
    if (!selected || typeof selected.lat !== "number" || typeof selected.lng !== "number") {
      infoWindowRef.current?.close();
      return;
    }
    if (!infoWindowRef.current) {
      infoWindowRef.current = new google.maps.InfoWindow({
        pixelOffset: new google.maps.Size(0, -34),
      });
      infoWindowRef.current.addListener("closeclick", () => setSelected(null));
    }
    if (!infoDivRef.current) {
      infoDivRef.current = document.createElement("div");
      infoRootRef.current = createRoot(infoDivRef.current);
    }
    infoRootRef.current?.render(
      <POIInfoWindowContent
        poi={selected}
        inCart={hasInCart?.(selected.poi_key) ?? false}
        onAdd={onAdd ? () => onAdd(selected.poi_key) : undefined}
        onRemove={onRemove ? () => onRemove(selected.poi_key) : undefined}
      />
    );
    infoWindowRef.current.setContent(infoDivRef.current);
    infoWindowRef.current.setPosition({ lat: selected.lat, lng: selected.lng });
    infoWindowRef.current.open(map);
  }, [map, selected, hasInCart, onAdd, onRemove]);

  // Tear down the InfoWindow + its React root on unmount.
  useEffect(() => {
    return () => {
      infoWindowRef.current?.close();
      const root = infoRootRef.current;
      infoRootRef.current = null;
      if (root) setTimeout(() => root.unmount(), 0);
    };
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
    try {
      clustererRef.current?.clearMarkers();
    } catch {
      // clearMarkers can throw if the clusterer is mid-teardown — ignore.
    }
    markersRef.current.forEach(detachMarker);
    markersRef.current = [];

    // R4 — sequence source = the adopted cart if any, else the AI preview keys.
    const routeKeys = cartActive ? cart! : previewKeys ?? [];
    const baseState: "cart" | "preview" = previewMode ? "preview" : "cart";
    const seqIndex = new Map(routeKeys.map((k, i) => [k, i + 1]));

    // Pre-compute pixel-offsets for route pins that overlap. We do this for the
    // route subset only — out-of-route 14px dots tolerate overlap because they
    // don't carry identity.
    const routePois = routeKeys
      .map((k) => pois.find((p) => p.poi_key === k))
      .filter((p): p is MatchPoiRow => !!p);
    const pinOffsets = new Map<string, { x: number; y: number }>();
    for (let i = 1; i < routePois.length; i++) {
      for (let j = 0; j < i; j++) {
        const d = haversineMeters(
          { lat: routePois[i].lat, lng: routePois[i].lng },
          { lat: routePois[j].lat, lng: routePois[j].lng }
        );
        if (d < 80) {
          // Already-offset pin j contributes; add a 28px clockwise step
          const prior = pinOffsets.get(routePois[j].poi_key) ?? { x: 0, y: 0 };
          pinOffsets.set(routePois[i].poi_key, {
            x: prior.x + 28,
            y: prior.y - 14,
          });
          break;
        }
      }
    }

    // V2 Phase 12+ resilience — wrap marker creation in try/catch so a
    // partial Google Maps API failure (e.g. RefererNotAllowedMapError,
    // quota exceeded, library partially loaded) degrades gracefully
    // instead of crashing the whole region page. Each pin is built
    // independently; one bad pin doesn't kill the rest.
    const markers: google.maps.marker.AdvancedMarkerElement[] = [];
    for (const poi of pois) {
      try {
      const seq = seqIndex.get(poi.poi_key);
      const inRoute = seq != null;
      const content = buildPhotoPinContent({
        imageUrl: inRoute ? poi.default_image_url || poi.images?.[0] || null : null,
        seq: inRoute && seq != null ? seq : null,
        state: inRoute ? baseState : "out",
        nameEn: poi.name_en,
      });
      // Remember the resting state so hover/active toggles return to it.
      content.dataset.base = inRoute ? baseState : "out";

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
      if (inRoute) {
        content.addEventListener("mouseenter", () => {
          setPhotoPinState(content, "hover");
          setActive(poi.poi_key, "map");
        });
        content.addEventListener("mouseleave", () => {
          setPhotoPinState(content, baseState);
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
        try {
          map.panTo({ lat: poi.lat, lng: poi.lng });
        } catch {
          // panTo fails when the map instance is in a broken state; the
          // InfoWindow still opens via setSelected so the user gets info.
        }
        if (inRoute) {
          setActive(poi.poi_key, "map");
          // Scroll the matching timeline card into view (data-poi-card set in
          // ResultTimeline). In preview mode there is no card yet → null.
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
      markers.push(marker);
      } catch (err) {
        console.warn("[POICatalogMap] marker build failed for", poi.poi_key, err);
      }
    }

    if (markers.length === 0) {
      console.warn("[POICatalogMap] zero markers built — likely a Google Maps API failure (referer / quota / network).");
      return;
    }

    markersRef.current = markers;
    try {
      clustererRef.current = new MarkerClusterer({ map, markers });
    } catch (err) {
      console.warn("[POICatalogMap] MarkerClusterer init failed; markers rendered without clustering.", err);
      markers.forEach((m) => (m.map = map));
    }

    return () => {
      try {
        clustererRef.current?.clearMarkers();
      } catch {
        // ignore — clusterer may be mid-teardown
      }
      clustererRef.current = null;
      markers.forEach(detachMarker);
      markersRef.current = [];
    };
  }, [map, pois, cart, previewKeys, cartActive, previewMode]);

  // V2 Phase 4 — react to external activeKey changes (timeline hover/
  // click). For in-cart markers, swap data-state to "hover" when their
  // key matches activeKey, back to "cart" otherwise. Out-of-cart dots
  // ignored — they have no hover variant.
  useEffect(() => {
    markersRef.current.forEach((marker) => {
      const el = marker.content as HTMLElement | null;
      if (!el) return;
      const poiKey = el.dataset.poi;
      // Only touch route photo pins (cart or preview). Out-of-route dots have
      // no hover variant. dataset.base records the resting state to return to.
      const base = el.dataset.base;
      if (base !== "cart" && base !== "preview") return;
      const shouldHover = poiKey != null && poiKey === activeKey;
      setPhotoPinState(el, shouldHover ? "hover" : (base as "cart" | "preview"));
    });
  }, [activeKey]);

  // V2 Phase 2 — auto-fitBounds always-on (promoted from spike gate).
  //   • 0 POIs: do nothing, leave the initial region center.
  //   • 1 POI:  pan + zoom 13.
  //   • 2+:     fitBounds with rail-aware padding.
  // Right rail on lg+ takes 400px + 24px gap, so we pad-right harder on
  // desktop so the polyline doesn't crowd the rail edge.
  useEffect(() => {
    if (!map) return;
    // Fit to the adopted cart if any, else to the AI preview (so the suggested
    // day is framed on the map before the user presses Apply).
    const keys = cartActive ? cart! : previewKeys ?? [];
    if (keys.length === 0) return;
    const byKey = new Map(pois.map((p) => [p.poi_key, p]));
    const routePois = keys.map((k) => byKey.get(k)).filter((p): p is MatchPoiRow => !!p);
    if (routePois.length === 0) return;

    if (routePois.length === 1) {
      map.panTo({ lat: routePois[0].lat, lng: routePois[0].lng });
      const z = map.getZoom();
      if (typeof z !== "number" || z < 13) map.setZoom(13);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    routePois.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    const isMobile = typeof window !== "undefined" && window.innerWidth < 768;
    map.fitBounds(
      bounds,
      isMobile
        ? { top: 32, right: 24, bottom: 80, left: 24 }
        : { top: 64, right: 64, bottom: 64, left: 64 }
    );
  }, [map, cart, previewKeys, cartActive, pois]);

  // Outer container always renders with explicit dimensions so the page
  // doesn't collapse when Google Maps JS is still loading or fails. Inner
  // content swaps between loading / error / map.
  const containerClasses =
    "relative h-[70vh] min-h-[420px] w-full md:h-full md:min-h-[600px]";

  return (
    <div className={containerClasses} data-region={region}>
      {/* Google map mounts here imperatively — must always be in the DOM so the
          loader effect can attach to it. */}
      <div ref={mapDivRef} style={CONTAINER_STYLE} />
      {loadError ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 p-6 text-center backdrop-blur">
          <div>
            <p className="text-h3 text-slate-900">{t("errorTitle")}</p>
            <p className="mt-1 text-body text-slate-600">{t("errorBody")}</p>
          </div>
        </div>
      ) : !isLoaded ? (
        <div className="absolute inset-0 flex items-center justify-center bg-white/60 backdrop-blur">
          <p className="text-body text-slate-500">{t("loadingLabel")}</p>
        </div>
      ) : null}
    </div>
  );
}
