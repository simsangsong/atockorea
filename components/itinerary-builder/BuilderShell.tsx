"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCart } from "@/lib/itinerary-builder/cart";
import { ActiveStopProvider } from "@/lib/itinerary-builder/active-stop";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import POICatalogMap from "./POICatalogMap";
import ResultTimeline from "./ResultTimeline";
import QuoteModal from "./QuoteModal";
import AIRecommendPanel from "./AIRecommendPanel";
import POICatalogGrid from "./POICatalogGrid";
import POIDetailModal from "./POIDetailModal";

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  center: { lat: number; lng: number; zoom: number };
  mapId: string;
  apiKey: string;
}

/**
 * V2 redesign Phase 1 — sticky map + scrollable result rail.
 *
 * **lg+ (≥1024px):** two-column grid (`minmax(0,1fr)_400px`). Left column
 * holds the map card chrome and sticks at `top-20` so it stays in viewport
 * while the right rail (AI panel → catalog grid → cart panel → spike
 * timeline) scrolls beneath the page chrome. Map height fills the column
 * via `lg:h-[calc(100vh-7rem)]` for a magazine-style read-mostly canvas.
 *
 * **<lg:** vertical stack. Map sticks to the top of the viewport at
 * `top-16 h-[40vh] z-20` so the user always sees their selection's
 * geographic context while scrolling AI/catalog/cart in normal flow.
 *
 * The "Map preview" header bar is dropped (Phase 1 §F task — the eyebrow
 * label read internal; implicit hierarchy is cleaner). Reset View moves
 * to a floating pill button anchored to the map's bottom-right corner.
 *
 * Cart URL state, drag-to-reorder, AI focus-pin sync, cruise time budget,
 * and quote modal flow are all preserved exactly.
 */
export default function BuilderShell({ region, pois, center, mapId, apiKey }: Props) {
  const { cart, add, remove, reorder, has, clear } = useCart();
  const searchParams = useSearchParams();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [focusedPoiKey, setFocusedPoiKey] = useState<string | null>(null);
  // R1 — single shared detail drawer for BOTH the timeline and the catalog
  // grid (RR2/RR-R3). Lifted here so there is exactly one modal instance.
  const [detailPoi, setDetailPoi] = useState<MatchPoiRow | null>(null);
  const resetViewRef = useRef<(() => void) | null>(null);

  // Bump key tracker so repeated clicks on the same POI re-open its InfoWindow
  const focusPoi = useCallback((key: string) => {
    // Set to null first to force the useEffect in POICatalogMap to refire
    setFocusedPoiKey(null);
    requestAnimationFrame(() => setFocusedPoiKey(key));
  }, []);

  const acceptRecommendation = useCallback(
    (poiKeys: string[]) => {
      // Replace the cart with the recommended sequence
      clear();
      // Defer the bulk-add so the URL state has a chance to clear first
      requestAnimationFrame(() => {
        reorder(poiKeys);
      });
    },
    [clear, reorder]
  );

  // Phase 4b — cruise track time budget: if `?track=cruise&hours=N` is set,
  // CartPanel renders the budget + warning when total exceeds.
  const cruiseBudgetMinutes = useMemo(() => {
    if (!searchParams) return null;
    if (searchParams.get("track") !== "cruise") return null;
    const hours = Number(searchParams.get("hours"));
    if (!Number.isFinite(hours) || hours <= 0) return null;
    return Math.round(hours * 60);
  }, [searchParams]);
  const matcherTrack = searchParams?.get("track") ?? null;
  const matcherOrigin = searchParams?.get("origin") ?? null;

  const handleGetQuote = useCallback(() => {
    if (cart.length === 0) return;
    setQuoteOpen(true);
  }, [cart.length]);

  return (
    <ActiveStopProvider>
      {/* Two-column hero band — sticky map (left) + interaction rail (right).
          The rail holds only the surfaces that benefit from sticky proximity
          to the map: AI matcher + cart actions. The full POI catalog grid
          lives BELOW this band as a full-width section — see §C 2026-05-18
          for the rationale (a 400px rail can't host a 3-4 col card grid
          cleanly, and the grid is secondary browsing once the map is the
          primary canvas). */}
      <section className="pb-6 md:pb-8">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:flex lg:items-start lg:gap-6 lg:px-8">
          {/* Map column — sticky on both mobile (top 16) and lg+ (top 20).
              On <lg the column has no width constraint; on lg+ it grows
              to fill the remaining space next to the 400px right rail. */}
          <div className="sticky top-16 z-20 -mx-4 mb-4 md:mx-0 lg:top-20 lg:z-10 lg:mb-0 lg:min-w-0 lg:flex-1 lg:self-start">
            <div className="relative h-[40vh] min-h-[260px] overflow-hidden border border-white/80 bg-white/85 shadow-[0_16px_40px_-24px_rgba(15,23,42,0.30)] backdrop-blur md:rounded-2xl lg:h-[calc(100vh-7rem)]">
              {/* Floating Reset View — bottom-right of the map. Replaces
                  the old "Map preview · N stops · M in cart" header bar. */}
              <button
                type="button"
                onClick={() => resetViewRef.current?.()}
                className="absolute bottom-3 right-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-micro font-semibold text-slate-700 shadow-md ring-1 ring-slate-200 backdrop-blur transition-colors duration-200 ease-out hover:bg-white hover:ring-slate-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                aria-label="Reset map view"
              >
                <RotateCcw className="h-3 w-3" aria-hidden />
                Reset view
              </button>
              <POICatalogMap
                region={region}
                pois={pois}
                center={center}
                mapId={mapId}
                apiKey={apiKey}
                cart={cart}
                onAdd={add}
                onRemove={remove}
                hasInCart={has}
                focusedPoiKey={focusedPoiKey}
                resetViewRef={resetViewRef}
              />
            </div>
          </div>

          {/* Right rail (lg+) — AI matcher + result timeline. On <lg the rail
              falls to normal flow below the sticky-top map. Phase 3 replaced
              the old `<CartPanel>` (with its mobile bottom-sheet variant)
              with `<ResultTimeline>`, which is always-visible: scrolls
              normally on mobile, sticks alongside the map on lg+. */}
          <div className="lg:w-[400px] lg:flex-shrink-0 lg:overflow-y-auto lg:self-stretch">
            <AIRecommendPanel
              region={region}
              pois={pois}
              onAccept={acceptRecommendation}
              onOpenDetail={setDetailPoi}
              track={matcherTrack}
              origin={matcherOrigin}
            />
            <ResultTimeline
              cart={cart}
              pois={pois}
              onRemove={remove}
              onReorder={reorder}
              onGetQuote={handleGetQuote}
              cruiseBudgetMinutes={cruiseBudgetMinutes}
              onOpenDetail={setDetailPoi}
            />
          </div>
        </div>
      </section>

      {/* POI catalog grid — full-width browse below the map+rail band.
          Stays here because the grid's responsive 1/2/3/4-col layout needs
          page-width breathing room; cramming it into a 400px rail breaks
          the card density home v2 set as the reference. */}
      <POICatalogGrid
        pois={pois}
        cart={cart}
        onAdd={add}
        onRemove={remove}
        onFocus={focusPoi}
        onOpenDetail={setDetailPoi}
      />

      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        cart={cart}
        region={region}
        pois={pois}
      />

      {/* R1 — one shared detail drawer for the timeline + the catalog grid.
          onAdd/onFocus close it; onRemove keeps it open (inCart recomputes). */}
      {detailPoi ? (
        <POIDetailModal
          poi={detailPoi}
          inCart={has(detailPoi.poi_key)}
          onClose={() => setDetailPoi(null)}
          onAdd={() => {
            add(detailPoi.poi_key);
            setDetailPoi(null);
          }}
          onRemove={() => {
            remove(detailPoi.poi_key);
          }}
          onFocus={() => {
            focusPoi(detailPoi.poi_key);
            setDetailPoi(null);
          }}
        />
      ) : null}
    </ActiveStopProvider>
  );
}
