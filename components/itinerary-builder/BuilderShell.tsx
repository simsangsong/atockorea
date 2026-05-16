"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { useCart } from "@/lib/itinerary-builder/cart";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import POICatalogMap from "./POICatalogMap";
import CartPanel from "./CartPanel";

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
  const { cart, add, remove, reorder, has } = useCart();
  const searchParams = useSearchParams();

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
    // Phase 4d wires the quote modal + POST /api/itinerary/quote here.
    // Phase 4a leaves this as a no-op so the button is reachable but inert.
    console.info("[BuilderShell] Get quote clicked. Cart:", cart);
  }, [cart]);

  return (
    <div className="flex h-[78vh] min-h-[600px] flex-col md:flex-row">
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
        />
      </div>
      <CartPanel
        cart={cart}
        pois={pois}
        onRemove={remove}
        onReorder={reorder}
        onGetQuote={handleGetQuote}
        getQuoteEnabled={false}
        cruiseBudgetMinutes={cruiseBudgetMinutes}
      />
    </div>
  );
}
