"use client";

import { useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/itinerary-builder/cart";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import POICatalogMap from "./POICatalogMap";
import CartPanel from "./CartPanel";
import QuoteModal from "./QuoteModal";
import AIRecommendPanel from "./AIRecommendPanel";
import POICatalogGrid from "./POICatalogGrid";

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  center: { lat: number; lng: number; zoom: number };
  mapId: string;
  apiKey: string;
}

/**
 * Client shell that owns the cart state (URL-param backed) and composes
 * the map + cart-panel layout. Desktop = map + right side panel. Mobile =
 * full-bleed map + floating bottom-sheet handle.
 */
export default function BuilderShell({ region, pois, center, mapId, apiKey }: Props) {
  const { cart, add, remove, reorder, has, clear } = useCart();
  const searchParams = useSearchParams();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [focusedPoiKey, setFocusedPoiKey] = useState<string | null>(null);

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
    <div className="flex flex-col">
      <AIRecommendPanel
        region={region}
        onAccept={acceptRecommendation}
        onFocusPoi={focusPoi}
      />
      {/* POI cards grid — primary surface (photos in bulk) */}
      <POICatalogGrid
        pois={pois}
        cart={cart}
        onAdd={add}
        onRemove={remove}
        onFocus={focusPoi}
      />
      {/* Map below — preview canvas. Desktop: side-by-side with cart;
          Mobile: full-width map + floating cart handle. */}
      <div className="flex h-[60vh] min-h-[420px] flex-col border-t border-slate-200 md:h-[68vh] md:flex-row">
        <div className="relative flex-1 overflow-hidden">
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
          />
        </div>
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
      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        cart={cart}
        region={region}
      />
    </div>
  );
}
