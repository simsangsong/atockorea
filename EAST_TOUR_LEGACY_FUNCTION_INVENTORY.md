# East tour detail — legacy function inventory (controlled migration)

**Scope:** The **legacy** East Signature small-group experience rendered when `/tour/[id]` serves the join tour and **`LegacyEastSmallGroupTourPage`** → **`SmallGroupTourDetailTemplateLegacy`** (not `EastSmallGroupTourV2Page`).  
**Out of scope for “legacy page” internals:** V2 shell, classic bus/private layouts in `app/tour/[id]/page.tsx`, and `TourDetailTemplateView` join path.

**Rule reminder:** This document is inspection-only — no wiring moves, no business-logic moves, no deletions.

---

## Entry graph (how legacy East is reached)

| Layer | Responsibility |
|--------|----------------|
| `app/tour/[id]/page.tsx` | Client fetch `GET /api/tours/{id}?locale=…`, `adaptTourDetailResponse`, branch `tour.type === 'join'`, build `smallGroupContent`, choose legacy vs V2 vs generic small-group. |
| `LegacyEastSmallGroupTourPage` | Thin re-export of props into `SmallGroupTourDetailTemplateLegacy`. |
| `SmallGroupTourDetailTemplateLegacy` | Composes all legacy sections, desktop booking rail, mobile sheet, sticky price bar. |

---

## 1. Product data loading

**Where**

- **Fetch:** `app/tour/[id]/page.tsx` — `fetch(\`${origin}/api/tours/${tourId}?locale=${apiLocale}\`)`, `cache: 'no-store'`, `AbortController` on id/locale change.
- **Locale for API:** If app locale is default, prefers `?locale=` from URL (middleware); otherwise uses `useI18n().locale`.
- **Adapter:** `adaptTourDetailResponse(data, routeForAdapter)` from `src/lib/adapters/tours-adapter.ts`.
- **Route segment override:** Before adapt, if `pathname` matches East slug segment but `tourId` param does not, passes **URL segment** as `routeForAdapter` so slug coercion still works (`extractTourRouteSegmentFromPathname`, `matchesEastSignatureSlugSegment` in `src/lib/east-signature-nature-core-match.ts`).
- **East coercion in adapter:** `shouldCoerceEastSignatureNatureCoreJoin(routeTourId, dbSlug, title)` forces `type: 'join'`, fixes missing `slug` from route, sets default `whyThisFitsYou` / `whoThisIsBestFor` when previous type was not join, `pickup.joinAvailable: true`.
- **Detail content:** `buildSmallGroupDetailContent(tour)` in `components/tour/small-group/smallGroupDetailContent.ts` → `applySmallGroupProductOverlay` → **`mergeEastSignatureNatureCoreContent`** (`products/eastSignatureNatureCore.ts` + `eastSignatureDetailPageLayer.ts`) for curated hero copy, route stops, FAQs, related cards, trust copy, etc., while **price, pickup points, rating, gallery from API** still flow from `tour`.

**Dependencies**

- `TourDetailViewModel` / Zod parse at end of adapter.
- East matchers shared: `east-signature-nature-core-match.ts` (used by page, adapter, middleware/site gate elsewhere).

---

## 2. Pricing logic

| Concern | Location | Behavior |
|---------|-----------|----------|
| Listed unit (KRW) | `tour.price`, `tour.originalPrice`, `tour.priceType` | From API via adapter; passed into sidebar/mobile sheet. |
| Currency display | Parent `formatPrice` from `useCurrencyOptional()` | `app/tour/[id]/page.tsx` passes `formatPrice` into legacy template for related tours and sticky bar (non–East-anchor paths). |
| **East marketing anchor (sticky bar)** | `SmallGroupTourDetailTemplateLegacy` | If `isEastSignatureNatureCoreTour(tour)`: sticky “from” line uses **USD 58** and KRW = `convertToKRW(58)` (fallback rate 1350 if no context). **Does not replace** DB price inside `EnhancedBookingSidebar` for booking math. |
| Date-aware unit | `EnhancedBookingSidebar` / `SmallGroupMobileBookingSheet` | Availability response can supply `price` / `priceOverride`; guest multiplier for `person` tours. |
| Discount toggle | Sidebar & sheet | `applyDiscount` default true; base price uses discounted `tour.price` when `originalPrice` > `tour.price`. |
| Jeju private-car hack | Sidebar & sheet | `isJejuPrivateCarTour(title)` forces a fixed preview total (e.g. 350000) — **not** East-specific but lives in shared booking components. |

---

## 3. Date / calendar behavior

- **Library:** `react-datepicker` in `EnhancedBookingSidebar` and `SmallGroupMobileBookingSheet`.
- **Disabled dates:** `GET /api/tours/{id}/availability/range?days=90` → build `disabledDates` when `!available` or `availableSpots === 0`.
- **On date change:** Notifies parent via `onDateSelect` (page holds `timelineSelectedDate`); **legacy East template does not render a booking timeline section** — state is held for consistency / possible future use and sidebar callback only.
- **Timezone:** Date strings use `toISOString().split('T')[0]` for API query params (UTC date edge cases possible).

---

## 4. Availability logic

- **Per selection:** `GET /api/tours/{id}/availability?date=YYYY-MM-DD&guests=N` (sidebar on effect; sheet on effect + confirm re-fetch).
- **State:** `availability`, `checkingAvailability`, `availabilityError`; mobile sheet also surfaces `reason` (e.g. operational rules) and `canAccommodate`.
- **Guest cap:** Increments blocked if `guestCount > availableSpots` when availability loaded.

---

## 5. Booking CTA logic

| Surface | Behavior |
|---------|----------|
| Desktop | Primary flow inside `EnhancedBookingSidebar` — fills `sessionStorage` key `bookingData`, `router.push(\`/tour/${id}/checkout\`)` (see sidebar implementation). |
| Mobile sticky bar | Fixed `bottom-16`, `z-[60]`, opens `SmallGroupMobileBookingSheet`. |
| Mobile sheet | Validates pickup (if points exist), date, re-checks availability, builds `bookingData` (tourId, date ISO, guests, pickup id, optional `pickupAreaLabel` from map, total, availability snapshot), `sessionStorage`, `router.push(checkoutPath)`. |
| Checkout path | `checkoutPath = \`/tour/${encodeURIComponent(String(tour.id))}/checkout\`` — **uses numeric/string id**, not slug. |

**Contract:** Checkout expects **`bookingData` in `sessionStorage`** — shared with sidebar; any migration must preserve shape or add an adapter at checkout.

---

## 6. Itinerary rendering logic

- **Data:** `content.routeStops` from `buildSmallGroupDetailContent` → `mapTourToRouteStopCards(tour)` (`mapTourToRouteStops.ts`), **after** filtering pickup-like rows via `isPickupItem` heuristics (EN/KO/Zh patterns + `pickupPoints` name match).
- **East overlay:** `mergeEastSignatureNatureCoreContent` can replace/enrich stops from `EAST_DETAILPAGE_ROUTE_STOPS` when API itinerary is thin.
- **UI:** `SmallGroupCollapsibleItinerarySection` — **collapsed by default**, expand/collapse local state, condensed list + `SmallGroupRouteTimelineSection` for expanded detail.
- **Scan helpers:** `itineraryScanHelpers.ts` (placeholders, chip labels).

---

## 7. Pickup / meeting logic

- **Data:** `tour.pickupPoints` (adapter normalizes id, name, address, lat, lng, pickup_time), `tour.pickup.areaLabel` for display/analytics defaults.
- **Hero:** `pickupAreaLabel={tour.pickup?.areaLabel}` on `SmallGroupHeroSection`.
- **Desktop:** `EnhancedBookingSidebar` — pickup selection state, map icon patterns.
- **Mobile sheet:** Dropdown of points; optional **`HotelMapPicker`** — on confirm, **haversine** `nearestPickupPoint`, sets selection + optional `pickupMapDetail` label merged into `pickupAreaLabel` in `bookingData`.

---

## 8. FAQ behavior

- **Items:** `content.faqs` — API `tour.faqs` merged/overridden by East layer (`getEastDetailPageFaqs`).
- **UI:** `SmallGroupFaqSection` — partitions into top “decision” FAQs + “more”; ranking uses `decisionRank` and `keywordTier` fallback; Radix accordion shared classes from `sg-dp-accordion-shared.ts`.
- **Chrome:** Section subtitles from `content.templateSectionChrome` (East template constants).

---

## 9. Reviews logic

- **No** `TourReviewsSection` on legacy East page.
- **Trust block:** `SmallGroupBookWithConfidenceSection` — editorial **`trustReviews`** from `resolveEditorialPresentation(content)` / East editorial payload, plus **`aggregateRating` / `reviewCount` from `tour`** (API). Folding/snippet logic is local to the section.

---

## 10. Gallery logic

- **Base:** `galleryUrlsFromTour` in `buildSmallGroupDetailContent` (from `tour.images` / fallbacks).
- **East:** `mergeEastSignatureNatureCoreContent` uses API gallery if non-empty; else fallback **`EAST_DETAILPAGE_HERO_IMAGE`**.
- **UI:** `SmallGroupHeroSection` consumes `content.hero.galleryImageUrls` (carousel/lightbox behavior inside that component).

---

## 11. Weather logic

- **Anchor:** `resolveTourWeatherAnchor({ slug, city })` (`lib/weather/tour-weather-anchor.ts`); legacy East also special-cases KO label when coords near `WEATHER_ANCHOR_EAST_SEONGSAN`.
- **UI:** `SmallGroupTourConditionsSupport` → `TourWeatherSection` (`appearance="premium"`, `collapseAuxiliaryByDefault`).
- **API:** Client `fetch(\`/api/weather/forecast?lat=&lon=&area=&locale=\`)` — Open-Meteo pipeline in `TourWeatherSection`.

---

## 12. Notices / trust blocks

- **Quick snapshot / at-a-glance:** `resolveEditorialPresentation(content)` drives `SmallGroupQuickSnapshotSection` cards (`ed.atAGlance`).
- **Route narrative:** `SmallGroupWhyTourWorksMergedSection` — ideal/not ideal, flow reasons, `whyOrderWorks` copy.
- **Practical:** `SmallGroupPracticalInfoSection` — `content.practicalBlocks`, `practicalIntro` from tour overview snippet.
- **Book with confidence:** trust points, reviews, after-booking steps (`ed.afterSteps`).
- **Related:** `SmallGroupRelatedToursSection` — `content.relatedTours` from East layer (`getEastDetailPageRelatedTours`); empty state copy when no cards.

---

## 13. Route params / slug dependency

- **`useParams().id`:** Drives fetch URL and checkout path encoding.
- **Pathname segment:** Used to fix adapter route when slug in URL is East but param differs (edge cases).
- **Identification:** `isEastSignatureNatureCoreTour(tour)` uses `shouldCoerceEastSignatureNatureCoreJoin(undefined, tour.slug, tour.title)` — **legacy page does not pass route id into this call** (only tour fields); URL-based coercion already applied in adapter.
- **Middleware / site gate:** `isPublicEastSignatureTourDetailPathForSiteGate` (same match module) — global, not template-local.

---

## 14. SEO metadata / structured data

- **Server layout:** `app/tour/[id]/layout.tsx` — `generateMetadata` and JSON-LD via `fetchActiveTourForLayout` (Supabase `tours` row by UUID or slug), `generateSEOMetadata` / `generateStructuredData` from `lib/seo.ts`. Uses `accept-language` for title/description locale **independently** of client i18n.
- **Client title:** `page.tsx` `useEffect` sets `document.title` from loaded tour (overrides/can diverge briefly from server meta).

---

## 15. Analytics

- On successful tour load: `analytics.detailViewed(viewModel.type, viewModel.pickup?.areaLabel ?? 'Unknown')` in `page.tsx`.
- Implementation: `src/design/analytics.ts` — currently `console.log` placeholder `trackEvent`.

---

## 16. Locale / i18n

- **Copy:** `useTranslations` / `useI18n` throughout template sections and booking UI (`messages/*.json`).
- **API content:** `locale` query on tour fetch; adapter leaves localized strings as returned by API.
- **Weather:** `useI18n().locale` passed to forecast API query.
- **East sticky KO label:** `weatherForecastAreaLabel` branch for Korean when near Seongsan anchor.

---

## 17. Auth / session dependency

- **Legacy East template:** No Supabase/auth gate; booking relies on **`sessionStorage`**, not logged-in session.
- **Header/Footer:** Rendered from `page.tsx`; `Header` may load auth for global nav — **not East-specific** (no coupling in `SmallGroupTourDetailTemplateLegacy`).

---

## 18. Sticky action logic (legacy)

- **Subnav:** `SmallGroupStickySectionNav` — scroll-spy / anchor links (section IDs such as `sg-itinerary`, `sg-conditions`, `sg-booking-support`, etc.).
- **Mobile bottom bar:** Fixed **`bottom-16`** to sit above **`BottomNav`** (`h-16`) from parent page when legacy path is active; shows price + **Book now** → opens sheet.
- **Desktop booking rail:** `aside` with `sticky top-8` wrapping `EnhancedBookingSidebar`.
- **Spacer:** Bottom spacer div for safe area + sticky + nav.

---

## Grouping (migration buckets)

### Presentational only

- Section layouts: `SmallGroupRouteFlowStripSection`, `SmallGroupWhyTourWorksMergedSection`, `SmallGroupPracticalInfoSection`, `SmallGroupQuickSnapshotSection` (given frozen props).
- `SmallGroupRelatedToursSection` / `SmallGroupFaqSection` **UI shell** (accordion, cards) — assuming FAQ/related **data** is still supplied externally.
- `SmallGroupHeroSection` **visual** behavior for given `hero` props.
- `SmallGroupStickySectionNav` **if** section id contract unchanged.
- Trust **layout** in `SmallGroupBookWithConfidenceSection` (folding, typography).

### UI state only

- Itinerary expand/collapse (`SmallGroupCollapsibleItinerarySection`).
- Mobile booking sheet open/close, overlay animation, body scroll lock.
- `TourWeatherSection` auxiliary disclosure state.
- FAQ accordion open state (Radix).
- Local state in `EnhancedBookingSidebar` / sheet: selected date, guests, pickup, promo, discount toggle, loading flags.

### API-connected

- Tour detail fetch + `adaptTourDetailResponse` + East coercion.
- `GET .../availability` and `.../availability/range`.
- `GET /api/weather/forecast`.
- Supabase fetch in `app/tour/[id]/layout.tsx` for meta/JSON-LD.

### Shared / global

- `useCurrencyOptional` / `CurrencyProvider` behavior.
- `useI18n` / `useTranslations`.
- `analytics.*` helper.
- `east-signature-nature-core-match` (middleware, adapter, page, product merge).
- `sessionStorage` `bookingData` contract with checkout route.
- `react-datepicker` CSS imports.

### Migrate early (low coupling, clear boundaries)

- **Static East editorial layer:** `eastSignatureDetailPageLayer.ts` strings, route stop definitions, template chrome — **pure data** once `TourDetailViewModel` is stable.
- **Weather block:** Single forecast endpoint + coords from `resolveTourWeatherAnchor` — **adapter-friendly** (`lat/lon/label` in, UI out).
- **Itinerary presentation** given **already-built** `routeStops[]` (no pickup filtering in UI).
- **FAQ ranking/partition** helpers (`partitionFaqItems`) if FAQ list is passed in.
- **Hero gallery** driving props only (no booking).

### Migrate later (high coupling or duplicate logic)

- **Full booking path:** `EnhancedBookingSidebar` + `SmallGroupMobileBookingSheet` together (duplicated availability + range + validation + `sessionStorage` + checkout navigation).
- **East USD 58 sticky pricing** intertwined with `isEastSignatureNatureCoreTour` and currency context — needs a single **pricing view-model** if V2 and legacy diverge.
- **Pickup + map flow:** `HotelMapPicker`, haversine nearest point, `bookingData.pickupAreaLabel` rules.
- **Page-level fetch + adapter + `buildSmallGroupDetailContent` pipeline** — central orchestration; touching it affects all join tours.
- **SEO layout vs client title** — two sources of truth for metadata.

---

## Safest logic to migrate first

1. **Curated East content** (`mergeEastSignatureNatureCoreContent` inputs/outputs and `eastSignatureDetailPageLayer`) — deterministic, testable, no network.
2. **Itinerary cards from `routeStops`** — migrate rendering-only once stop list is produced by the same builder.
3. **Weather section** — isolated `/api/weather/forecast` + anchor resolver; easy to wrap in a thin props interface.
4. **FAQ accordion UI** — with FAQ array passed as props (no API inside section).

---

## Logic that is too coupled / needs adapter extraction

1. **Booking dual surface:** Sidebar and mobile sheet **duplicate** availability, range fetch, guest limits, and `bookingData` shape — extract a **`useTourBookingDraft`** (or server actions later) that both surfaces call, plus a typed **`BookingDraft`** shared with checkout.
2. **East identification:** Split across **URL matchers**, **adapter coercion**, and **`isEastSignatureNatureCoreTour`** — consolidate a **`resolveEastSignatureContext({ routeSegment, tour })`** used by page, overlay, and pricing.
3. **Pricing truth vs marketing:** DB `tour.price` vs **USD 58 sticky** vs availability overrides — needs an explicit **`displayPrice` vs `chargeableUnit`** model to avoid drift at checkout.
4. **`adaptTourDetailResponse`:** Large, join/private/bus inference + East coercion + Zod — any new page shell should consume **`TourDetailViewModel`** only through this boundary, not raw API types.
5. **Checkout `sessionStorage` contract:** Fragile cross-route dependency — document schema or version key before UI migration.

---

## Primary file index (legacy East)

| File | Role |
|------|------|
| `app/tour/[id]/page.tsx` | Fetch, adapt, branch, `buildSmallGroupDetailContent`, analytics, shell (Header/Footer/BottomNav). |
| `app/tour/[id]/layout.tsx` | Server SEO + JSON-LD. |
| `components/tour-detail/east/legacy/LegacyEastSmallGroupTourPage.tsx` | Wrapper. |
| `components/tour/small-group/SmallGroupTourDetailTemplateLegacy.tsx` | Composition, sticky bar, East USD anchor, booking rail/sheet. |
| `components/tour/small-group/smallGroupDetailContent.ts` | `buildSmallGroupDetailContent`. |
| `components/tour/small-group/applyProductContentOverlay.ts` | Product overlay dispatch. |
| `components/tour/small-group/products/eastSignatureNatureCore.ts` | East merge + `isEastSignatureNatureCoreTour`. |
| `components/tour/small-group/products/eastSignatureDetailPageLayer.ts` | East editorial assets/copy. |
| `components/tour/small-group/mapTourToRouteStops.ts` | Itinerary → route cards + pickup filter. |
| `src/lib/adapters/tours-adapter.ts` | `adaptTourDetailResponse` + East coercion. |
| `src/lib/east-signature-nature-core-match.ts` | Slug/title matchers, pathname helpers. |
| `components/tour/EnhancedBookingSidebar.tsx` | Desktop booking + availability + checkout handoff. |
| `components/tour/small-group/SmallGroupMobileBookingSheet.tsx` | Mobile booking + map pickup + handoff. |
| `components/tour-detail-template/TourWeatherSection.tsx` | Forecast fetch + UI. |
| `lib/weather/tour-weather-anchor.ts` | Coordinates/labels for weather. |

---

*Generated for controlled migration planning; behavior described reflects repository state at documentation time.*
