"use client";

import { useCallback } from "react";
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
  const { cart, add, remove, has } = useCart();

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
        onGetQuote={handleGetQuote}
        getQuoteEnabled={false}
      />
    </div>
  );
}
