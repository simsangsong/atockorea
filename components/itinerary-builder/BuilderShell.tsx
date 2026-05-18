"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw } from "lucide-react";
import { useCart } from "@/lib/itinerary-builder/cart";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import POICatalogMap from "./POICatalogMap";
import CartPanel from "./CartPanel";
import QuoteModal from "./QuoteModal";
import AIRecommendPanel from "./AIRecommendPanel";
import POICatalogGrid from "./POICatalogGrid";
import TimelineSpike from "./_spike/TimelineSpike";

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
  // V2 redesign Phase 0 spike gate (still used in Phase 1 for `?spike=1`
  // additive previews like <TimelineSpike />).
  const isSpike = searchParams?.get("spike") === "1";
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [focusedPoiKey, setFocusedPoiKey] = useState<string | null>(null);
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

  const handleGetQuote = useCallback(() => {
    if (cart.length === 0) return;
    setQuoteOpen(true);
  }, [cart.length]);

  return (
    <>
      {/* Two-column hero band — sticky map (left) + interaction rail (right).
          The rail holds only the surfaces that benefit from sticky proximity
          to the map: AI matcher + cart actions. The full POI catalog grid
          lives BELOW this band as a full-width section — see §C 2026-05-18
          for the rationale (a 400px rail can't host a 3-4 col card grid
          cleanly, and the grid is secondary browsing once the map is the
          primary canvas). */}
      <section className="bg-slate-50 pb-6 md:pb-8">
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:flex lg:items-start lg:gap-6 lg:px-8">
          {/* Map column — sticky on both mobile (top 16) and lg+ (top 20).
              On <lg the column has no width constraint; on lg+ it grows
              to fill the remaining space next to the 400px right rail. */}
          <div className="sticky top-16 z-20 -mx-4 mb-4 md:mx-0 lg:top-20 lg:z-10 lg:mb-0 lg:min-w-0 lg:flex-1 lg:self-start">
            <div className="relative h-[40vh] min-h-[260px] overflow-hidden bg-white shadow-md ring-1 ring-slate-200 md:rounded-2xl lg:h-[calc(100vh-7rem)]">
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

          {/* Right rail (lg+) — AI matcher + cart panel. Renders in normal
              flow below the sticky map on <lg. 400px fixed width on lg+. */}
          <div className="lg:w-[400px] lg:flex-shrink-0 lg:overflow-y-auto lg:self-stretch">
            <AIRecommendPanel
              region={region}
              pois={pois}
              onAccept={acceptRecommendation}
              onFocusPoi={focusPoi}
            />
            <CartPanel
              cart={cart}
              pois={pois}
              onRemove={remove}
              onReorder={reorder}
              onGetQuote={handleGetQuote}
              getQuoteEnabled={true}
              cruiseBudgetMinutes={cruiseBudgetMinutes}
              onFocusPoi={focusPoi}
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
      />

      {/* V2 redesign Phase 0 spike — throwaway timeline preview at the
          very bottom. Active only when `?spike=1`. Phase 3 will replace
          this (and CartPanel) with the real ResultTimeline. */}
      {isSpike ? <TimelineSpike cart={cart} pois={pois} /> : null}

      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        cart={cart}
        region={region}
      />
    </>
  );
}
