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
    <div className="flex flex-col">
      <AIRecommendPanel
        region={region}
        pois={pois}
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
      {/* Map preview — wrapped in its own card chrome so it reads as a
          discrete sibling section to the AI panel + grid. Header bar carries
          a stop count + Reset view CTA. */}
      <section className="bg-slate-50 px-4 pb-5 md:px-6 md:pb-7">
        <div className="mx-auto max-w-7xl overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200">
          <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-5">
            <div>
              <p className="text-eyebrow">Map preview</p>
              <p className="text-caption text-slate-500">
                {pois.length} stops · {cart.length} in cart
              </p>
            </div>
            <button
              type="button"
              onClick={() => resetViewRef.current?.()}
              className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1.5 text-micro font-semibold text-slate-700 transition-colors duration-200 ease-out hover:bg-slate-200"
            >
              <RotateCcw className="h-3 w-3" aria-hidden />
              Reset view
            </button>
          </header>
          <div className="flex h-[60vh] min-h-[420px] flex-col md:h-[68vh] md:flex-row">
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
                resetViewRef={resetViewRef}
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
        </div>
      </section>
      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        cart={cart}
        region={region}
      />
    </div>
  );
}
