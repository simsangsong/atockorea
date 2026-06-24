"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { RotateCcw, ShieldAlert, ArrowRight } from "lucide-react";
import { useCart } from "@/lib/itinerary-builder/cart";
import { ActiveStopProvider } from "@/lib/itinerary-builder/active-stop";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import type { RegionSlug } from "@/lib/itinerary-builder/regions";
import { localizePoiRow, normalizeBuilderLocale } from "@/lib/itinerary-builder/locale-content";
import { useI18n, useTranslations } from "@/lib/i18n";
import { homeBtnPrimary } from "@/lib/home/home-button-classes";
import {
  jejuZone,
  quote,
  tierForLocale,
  type CruisePort,
  type JejuPickupZone,
  type PricingTrack,
} from "@/lib/quote-engine/pricing-policy";
import POICatalogMap from "./POICatalogMap";
import ResultTimeline from "./ResultTimeline";
import QuoteModal from "./QuoteModal";
import POICatalogGrid from "./POICatalogGrid";
import POIDetailModal from "./POIDetailModal";
import PlannerTopRail from "./PlannerTopRail";
import LivePriceCard from "./LivePriceCard";
import CategoryFilterBar, { poiGroup } from "./CategoryFilterBar";
import AIRecommendPanel from "./AIRecommendPanel";
import { tourCluster, cartAddDecision, cartHasJejuEastMix } from "@/lib/itinerary-builder/clusters";
import type { PoiCategoryGroup } from "@/lib/itinerary-match-engine/poi-taxonomy";

interface Props {
  region: RegionSlug;
  pois: MatchPoiRow[];
  center: { lat: number; lng: number; zoom: number };
  mapId: string;
  apiKey: string;
  /**
   * Phase 11 D27/D30/D31 — controls layout chrome and URL routing.
   *  - "page" (default): mounted on `/itinerary-builder` (legacy / fallback);
   *    sticky map + sticky rail compete with the site header at top-16.
   *  - "home": mounted inside HomeV2Page → no sticky map (map scrolls with
   *    the section), no sticky rail (PlannerTopRail's `placement="home"`
   *    drops the sticky and uses a labeled mobile trigger). POICatalogGrid
   *    is hidden — the builder shares the page with many other sections,
   *    and the full catalog browse belongs on a dedicated route.
   */
  placement?: "page" | "home";
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
export default function BuilderShell({ region, pois, center, mapId, apiKey, placement = "page" }: Props) {
  const { locale } = useI18n();
  const { cart, add, remove, reorder, has } = useCart();
  const searchParams = useSearchParams();
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [focusedPoiKey, setFocusedPoiKey] = useState<string | null>(null);
  // Phase B — AI matcher preview: highlight matched pins on the map while the
  // recommendation is in flight (ResultTimeline takes over once it applies).
  const [previewKeys, setPreviewKeys] = useState<string[] | null>(null);
  // R1 — single shared detail drawer for BOTH the timeline and the catalog
  // grid (RR2/RR-R3). Lifted here so there is exactly one modal instance.
  const [detailPoi, setDetailPoi] = useState<MatchPoiRow | null>(null);
  // Category filter — deterministic, client-side facet over the catalog grid
  // (replaces the AI matcher). Empty = show all. See CategoryFilterBar.
  const [selectedGroups, setSelectedGroups] = useState<Set<PoiCategoryGroup>>(new Set());
  const resetViewRef = useRef<(() => void) | null>(null);

  // Bump key tracker so repeated clicks on the same POI re-open its InfoWindow
  const focusPoi = useCallback((key: string) => {
    // Set to null first to force the useEffect in POICatalogMap to refire
    setFocusedPoiKey(null);
    requestAnimationFrame(() => setFocusedPoiKey(key));
  }, []);

  const toggleGroup = useCallback((group: PoiCategoryGroup) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }, []);
  const clearGroups = useCallback(() => setSelectedGroups(new Set()), []);

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
  const isDmz = matcherTrack === "dmz";
  const isCruise = matcherTrack === "cruise";
  const dmzT = useTranslations("itineraryBuilder.dmz");
  const cartT = useTranslations("itineraryBuilder.cart");
  const activeLocale = normalizeBuilderLocale(searchParams?.get("locale")) ?? locale;
  const localizedPois = useMemo(
    () => pois.map((poi) => localizePoiRow(poi, activeLocale)),
    [activeLocale, pois]
  );

  // Category-filtered view for the catalog grid (empty selection = all). The
  // map keeps every pin for geographic context; only the browse list filters.
  const filteredPois = useMemo(() => {
    if (selectedGroups.size === 0) return localizedPois;
    return localizedPois.filter((poi) => selectedGroups.has(poiGroup(poi)));
  }, [localizedPois, selectedGroups]);

  // Phase 10.3 D17 — live price lifted from QuoteModal into the shell so the
  // PlannerTopRail's LivePriceCard and the QuoteModal both render the SAME
  // number. Both call this single `pricing-policy.quote()` invocation.
  const cartPois = useMemo(() => {
    const byKey = new Map(localizedPois.map((p) => [p.poi_key, p]));
    return cart.map((k) => byKey.get(k)).filter((p): p is MatchPoiRow => !!p);
  }, [cart, localizedPois]);

  // Booked duration in hours (URL `duration`/`hours`, default 8) — used for the
  // timeline footer's "drive time > 60% of tour" warning.
  const tourDurationHours = (() => {
    const raw = Number(searchParams?.get("duration") ?? searchParams?.get("hours") ?? 8);
    return Number.isFinite(raw) && raw > 0 ? raw : 8;
  })();

  // Phase C — day-trip clustering. POIs from incompatible clusters can't share
  // one cart: Seoul/Busan areas hard-block, Jeju East mixing warns (+surcharge).
  const cartClusters = useMemo(() => cartPois.map((p) => tourCluster(p)), [cartPois]);
  const blockedKeys = useMemo(() => {
    const blocked = new Set<string>();
    if (cartPois.length === 0) return blocked;
    for (const poi of localizedPois) {
      if (cart.includes(poi.poi_key)) continue;
      if (cartAddDecision(cartClusters, tourCluster(poi)) === "block") blocked.add(poi.poi_key);
    }
    return blocked;
  }, [localizedPois, cart, cartPois.length, cartClusters]);
  const jejuEastMix = useMemo(() => cartHasJejuEastMix(cartClusters), [cartClusters]);

  const addGuarded = useCallback(
    (key: string) => {
      const poi = localizedPois.find((p) => p.poi_key === key);
      if (poi && cartAddDecision(cartClusters, tourCluster(poi)) === "block") return;
      add(key);
    },
    [add, cartClusters, localizedPois],
  );

  const livePrice = useMemo(() => {
    const sp = searchParams;
    const track: PricingTrack = (sp?.get("track") as PricingTrack) || "private";
    const guideLanguage = sp?.get("lang") || locale;
    const date = sp?.get("date") || null;
    const paxRaw = Number(sp?.get("party") ?? 2);
    const pax = Number.isFinite(paxRaw) && paxRaw > 0 ? Math.round(paxRaw) : 2;
    const durationRaw = Number(sp?.get("duration") ?? sp?.get("hours") ?? 8);
    const durationHours = Number.isFinite(durationRaw) && durationRaw > 0 ? durationRaw : 8;
    const pickup = (sp?.get("pickup") as JejuPickupZone) || "city";
    const cruisePort = sp?.get("port") === "jeju_port" ? "jeju_port" : "gangjeong";

    const poiRegions = cartPois.map((p) => p.region);
    const jejuPoiZones =
      region === "jeju" ? cartPois.map((p) => jejuZone(p.lat, p.lng)) : undefined;

    return quote({
      track,
      region,
      guideLanguageTier: tierForLocale(guideLanguage),
      durationHours,
      pax,
      requestedDate: date,
      jejuPickupZone: region === "jeju" && track !== "cruise" && track !== "dmz" ? pickup : null,
      cruisePort: (track === "cruise" && region === "jeju" ? (cruisePort as CruisePort) : null),
      poiRegions,
      jejuPoiZones,
    });
  }, [searchParams, region, locale, cartPois]);

  const handleGetQuote = useCallback(() => {
    if (cart.length === 0) return;
    setQuoteOpen(true);
  }, [cart.length]);

  // DMZ is a fixed-price-by-pax product — no POI building. Short-circuit the
  // map/cart builder and show a product panel that opens the quote modal in
  // DMZ mode (the modal prices by party size). Phase 9 §F task 9g.
  if (isDmz) {
    return (
      <ActiveStopProvider>
        <PlannerTopRail region={region} placement={placement} />
        <section className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16 lg:px-8">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_16px_40px_-24px_rgba(15,23,42,0.30)]">
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900 px-6 py-8 md:px-10 md:py-10">
              <p className="mb-2 inline-flex items-center gap-1.5 text-eyebrow text-amber-300">
                <ShieldAlert className="h-3.5 w-3.5" aria-hidden />
                DMZ
              </p>
              <h1 className="text-h3 text-white">{dmzT("title")}</h1>
            </div>
            <div className="space-y-5 px-6 py-7 md:px-10 md:py-9">
              <p className="text-sm leading-relaxed text-slate-600">{dmzT("body")}</p>
              <LivePriceCard price={livePrice} isJeju={false} />
              {livePrice.autoQuotable ? (
                <button
                  type="button"
                  onClick={() => setQuoteOpen(true)}
                  className={`${homeBtnPrimary} group mt-2 inline-flex items-center justify-center gap-2 shadow-md hover:gap-3`}
                >
                  예약하기 · 카드 등록
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <a
                  href="mailto:contact@atockorea.com?subject=DMZ%20group%20quote%20request"
                  className={`${homeBtnPrimary} group mt-2 inline-flex items-center justify-center gap-2 shadow-md hover:gap-3 text-center`}
                >
                  맞춤 견적 문의 · contact@atockorea.com
                </a>
              )}
            </div>
          </div>
        </section>
        <QuoteModal
          open={quoteOpen}
          onClose={() => setQuoteOpen(false)}
          cart={[]}
          region={region}
          pois={localizedPois}
          price={livePrice}
        />
      </ActiveStopProvider>
    );
  }

  const isHome = placement === "home";
  // Phase 11 D27/D30 — on `placement="home"` the map is NOT sticky (it
  // scrolls with the section) so the user reaches the rest of the home
  // page without fighting a viewport-locked map. lg height also bounded so
  // we don't punch a `100vh - 7rem` hole into the home compositions.
  const mapColumnClass = isHome
    ? "-mx-4 mb-4 md:mx-0 lg:mb-0 lg:min-w-0 lg:flex-1 lg:self-start"
    : "sticky top-16 z-20 -mx-4 mb-4 md:mx-0 lg:top-20 lg:z-10 lg:mb-0 lg:min-w-0 lg:flex-1 lg:self-start";
  // Phase 15 — premium map frame. Replaces the plain `border border-white/80`
  // with a mint glow ring + layered outer shadow + inset white highlight
  // that matches the builder's other floating cards (LivePriceCard,
  // EmptyState, AIRecommendPanel). The map content itself is still rendered
  // by the Google Maps Map ID (vector); for a fully restyled palette the
  // user would create a new Map ID in Google Cloud Console and swap
  // NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID — code-only changes can't override the
  // map renderer when a Map ID is set (inline `styles` is ignored).
  const mapInnerClass = isHome
    ? "relative h-[42vh] min-h-[280px] overflow-hidden bg-white/85 ring-1 ring-emerald-100/40 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_24px_56px_-22px_rgba(15,23,42,0.24),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur md:rounded-2xl lg:h-[560px]"
    : "relative h-[40vh] min-h-[260px] overflow-hidden bg-white/85 ring-1 ring-emerald-100/40 shadow-[0_2px_10px_rgba(15,23,42,0.05),0_28px_64px_-22px_rgba(15,23,42,0.26),inset_0_1px_0_rgba(255,255,255,0.92)] backdrop-blur md:rounded-2xl lg:h-[calc(100vh-7rem)]";

  return (
    <ActiveStopProvider>
      <PlannerTopRail region={region} placement={placement} />
      {/* Two-column hero band — sticky map (left) + interaction rail (right).
          The rail holds only the surfaces that benefit from sticky proximity
          to the map: AI matcher + cart actions. The full POI catalog grid
          lives BELOW this band as a full-width section — see §C 2026-05-18
          for the rationale (a 400px rail can't host a 3-4 col card grid
          cleanly, and the grid is secondary browsing once the map is the
          primary canvas). */}
      <section className={isHome ? "pt-4 pb-6 md:pt-5 md:pb-8" : "pb-6 md:pb-8"}>
        <div className="mx-auto max-w-7xl px-4 md:px-6 lg:flex lg:items-start lg:gap-6 lg:px-8">
          {/* Map column — sticky on the page placement; on the home embed
              the map flows with the section so the user can scroll past it. */}
          <div className={mapColumnClass}>
            <div className={mapInnerClass}>
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
                pois={localizedPois}
                center={center}
                mapId={mapId}
                apiKey={apiKey}
                cart={cart}
                previewKeys={previewKeys}
                onAdd={addGuarded}
                onRemove={remove}
                hasInCart={has}
                focusedPoiKey={focusedPoiKey}
                resetViewRef={resetViewRef}
              />
              {/* Phase 15.1 — premium map glaze. The map tiles render via a
                  Google vector Map ID, so a code-only palette is impossible
                  (inline `styles` are ignored with a Map ID). Instead a
                  pointer-events-none overlay lays a soft top sheen + corner
                  vignette + inset hairline highlight over the tiles — the
                  cheap, pin-safe way to make the canvas read editorial rather
                  than raw Google. Sits above tiles (z-10) but below the
                  floating Reset button (z-20), and the vignette stays at the
                  edges so the route pins in the centre are never dimmed. */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 z-10 md:rounded-2xl"
                style={{
                  background:
                    "radial-gradient(120% 78% at 50% 0%, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0) 24%), radial-gradient(135% 120% at 50% 118%, rgba(15,23,42,0.16) 0%, rgba(15,23,42,0) 46%)",
                  boxShadow:
                    "inset 0 0 0 1px rgba(255,255,255,0.5), inset 0 1px 0 rgba(255,255,255,0.7), inset 0 -44px 64px -44px rgba(15,23,42,0.32)",
                }}
              />
            </div>
          </div>

          {/* Right rail (lg+) — AI matcher + result timeline. On <lg the rail
              falls to normal flow below the sticky-top map. Phase 3 replaced
              the old `<CartPanel>` (with its mobile bottom-sheet variant)
              with `<ResultTimeline>`, which is always-visible: scrolls
              normally on mobile, sticks alongside the map on lg+. */}
          <div className="lg:w-[400px] lg:flex-shrink-0 lg:overflow-y-auto lg:self-stretch">
            {/* Phase 10.3 — always-visible live price (cart-aware) so users see
                the number before clicking "Get quote". Same component, same
                inputs the QuoteModal renders → one number, one truth. */}
            <div className="mb-4 px-4 pt-4 md:px-0">
              <LivePriceCard price={livePrice} isJeju={region === "jeju"} isCruise={isCruise} />
            </div>
            {/* Phase B — AI recommendation, reusing the preserved matcher.
                Replaces the "let a guide plan it" empty-cart CTA: the AI
                proposes a sequence and applies it straight into the cart.
                The category filter (in the catalog grid below) stays for
                manual browsing. */}
            <div className="mb-4 px-4 md:px-0">
              <AIRecommendPanel
                region={region}
                pois={localizedPois}
                onAccept={(keys) => reorder(keys)}
                onPreview={setPreviewKeys}
                track={searchParams?.get("track")}
              />
            </div>
            {jejuEastMix ? (
              <p className="mb-4 mx-4 rounded-md bg-amber-50 px-3 py-2 text-micro font-semibold text-amber-800 ring-1 ring-amber-200 md:mx-0">
                {cartT("jejuEastMixNotice")}
              </p>
            ) : null}
            <ResultTimeline
              cart={cart}
              pois={localizedPois}
              onRemove={remove}
              onReorder={reorder}
              onGetQuote={handleGetQuote}
              cruiseBudgetMinutes={cruiseBudgetMinutes}
              durationMinutes={tourDurationHours * 60}
              onOpenDetail={setDetailPoi}
              autoQuotable={livePrice.autoQuotable}
            />
          </div>
        </div>
      </section>

      {/* POI catalog grid — only on the legacy `/itinerary-builder` page
          placement. On the home embed the builder shares the page with many
          other sections and a 80-card grid here would dominate the home
          scroll. (Future: spin out a dedicated `/itinerary-builder/browse`
          route if standalone catalog browsing is needed again.) */}
      {!isHome ? (
        <POICatalogGrid
          pois={filteredPois}
          cart={cart}
          onAdd={addGuarded}
          onRemove={remove}
          onFocus={focusPoi}
          onOpenDetail={setDetailPoi}
          blockedKeys={blockedKeys}
          filterSlot={
            <CategoryFilterBar
              pois={localizedPois}
              selected={selectedGroups}
              onToggle={toggleGroup}
              onClear={clearGroups}
            />
          }
        />
      ) : null}

      <QuoteModal
        open={quoteOpen}
        onClose={() => setQuoteOpen(false)}
        cart={cart}
        region={region}
        pois={localizedPois}
        price={livePrice}
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
