# Tour Product EN Content Fix Plan - 2026-05-23

## Scope

- Locale: `en`
- Public target: 33 consumer-visible `/tour-product/[slug]` pages
- Excluded from public target but discovered: `seoul-seoraksan-national-park-sokcho-beach-day-trip` is still present in static/DB data, but blocked from consumer surfaces.
- This plan is based on the content and live-render audit from this session. It is a planning document only.

## Priority Order

1. Fix customer-facing price, booking, and availability contradictions.
2. Fix cruise pickup/dropoff and port-route rendering defects.
3. Soften risky guarantee/refund/passport language.
4. Clean visible copy defects, typos, leaked internal phrasing, and EN locale polish.
5. Verify live pages, recommendations, JSON-LD, checkout totals, and availability after changes.

## P0 - Price, Booking, Availability

### Files To Edit

| File | Issue | Plan |
|---|---|---|
| `components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json` | Empty `price.amountLabel`, empty `catalog_card.priceLabel`, seasonal window already passed, `$0` appears in recommendations. | Decide whether product is closed until next season or active with real price. If closed, remove from recommendations/bookable flow and label next season. If active, set real USD price and seasonal rules. |
| `components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json` | Same as above: empty price fields, 2026 spring dates passed, `$0` recommendation cards. | Same treatment as plum/cherry product. |
| `app/api/tours/[id]/availability/route.ts` | Inventory missing means default available, so off-season seasonal tours can be booked on any future date. | Add product/date gating for seasonal tours, or require inventory rows for seasonal products instead of falling back to default capacity. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourRecommendationsSection.tsx` | Displays `$0` when recommendation `listPriceUsd` is 0. | Hide invalid-price recommendation cards or show "Season not open" / "Check availability" instead of `$0`. |
| `lib/tour-product/eastSignatureCheckoutContext.ts` | Converts any non-`group` price type to `person`; DB has `vehicle`. | Preserve `vehicle` in checkout context and downstream booking payloads. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourDesktopBookingCard.tsx` | Estimated total multiplies by guests when checkout price type is incorrectly `person`. | Treat `vehicle` like fixed/group price; show `/ vehicle`, not per-person total. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourStickyBookingBar.tsx` | Same vehicle-price risk as desktop card. | Apply the same `vehicle` handling. |
| `app/api/bookings/route.ts` | Booking total currently checks only `price_type === 'person'`; other values become fixed total. Needs explicit `vehicle` support/validation. | Confirm intended DB enum, then make calculation explicit for `person`, `group`, `vehicle`. |
| `app/checkout/page.tsx` | Checkout total uses `tour.price_type === 'person' ? price * guests : price`. | Keep behavior if `vehicle` is fixed, but make labels and validation explicit. |
| `app/cart/page.tsx` | Cart display types are `person | group`; `vehicle` may show inconsistently. | Extend UI type labels to support `vehicle`. |

### Data To Align

These are not filesystem files, but must be changed with the file edits above:

- `public.tours.price`, `public.tours.original_price`, `public.tours.price_type`
- `public.tour_product_pages.price_amount_label`, `price_per`, `detail_payload.price`, `detail_payload.catalog_card.priceLabel`
- `public.tour_product_offers.amount_minor`, default offer rows
- `public.product_inventory` or equivalent seasonal availability source

Known mismatches:

- `east-signature-nature-core`: page/catalog says `$59`, checkout/offer says `$69`.
- `jeju-cherry-blossom-tour-east-route`: page/catalog says `$59`, checkout/offer says `$69`.
- `jeju-eastern-unesco-spots-day-tour`: page/catalog says `$59`, checkout/offer says `$69`.
- `jeju-grand-highlights-loop`: page/catalog says `$79`, checkout/offer says `$69`.
- `jeju-hydrangea-festival-tour-east-route`: page/catalog says `$59`, checkout/offer says `$69`.
- `jeju-hydrangea-festival-tour-southwest-route`: page/catalog says `$59`, checkout/offer says `$69`.
- `jeju-southern-top-unesco-spots-tour`: page/catalog says `$59`, checkout/offer says `$69`.
- `jeju-west-south-full-day-authentic-tour`: page/catalog says `$59`, checkout/offer says `$69`.
- `southwest-hallasan-osulloc-aewol`: page/catalog says `$59`, checkout/offer says `$69`.

## P1 - Cruise Pickup, Dropoff, Route Variants

### Files To Edit

| File | Issue | Plan |
|---|---|---|
| `components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json` | Cruise product shows hotel/airport pickup cards (`Ocean Suites`, airport, LOTTE City, Shilla Duty Free). Gangjeong route exists under `itinerary_variants`, but renderer expects `routeVariants`. "route route" typo. Included list mixes exclusions. | Replace pickup/dropoff with cruise-terminal-specific entries. Convert/duplicate real port variants into `routeVariants`. Separate included and not included. Fix typo. |
| `components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json` | Same Jeju cruise issues as bus tour. Also visible "similar local route" wording. | Same as bus tour, with small-group wording. |
| `components/product-tour-static/_shared/tourProductFullPageJsonTypes.ts` | View-model keys include `routeVariants`, not `itinerary_variants`. | Either keep schema as-is and migrate JSON, or add safe backwards-compatible mapping. Prefer migrating JSON if only Jeju cruise uses populated variants. |
| `components/product-tour-static/_shared/buildTourProductViewModelFromJson.ts` | Copies only keys in `TOUR_PRODUCT_VIEW_MODEL_KEYS`. | If using backwards-compatible route variant mapping, add it here. |
| `lib/tour-product/loadTourProductPage.ts` | Supabase payload only forwards `routeVariants`. | Same mapping decision as above for DB-loaded pages. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourTimelineSection.tsx` | Renders pickup/dropoff cards before route variants; wrong pickup cards can still appear even when route variants exist. | Ensure cruise route variants and pickup/dropoff do not contradict each other. |
| `components/product-tour-static/_shared/route-variants/PortSelectorTimeline.tsx` | Port selector renderer for `routeVariants`. | Verify Jeju Port and Gangjeong variants render, labels fit, and selected port drives itinerary display. |
| `components/product-tour-static/_shared/route-variants/routeVariantTypes.ts` | Type contract for port route variants. | Update only if current JSON cannot fit the existing type. |

### Related Cruise Products To Review

| File | Issue | Plan |
|---|---|---|
| `components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.en.json` | Return guarantee language and timing contradict: 19:15 guarantee, 19:30 arrival, 19:30+ sail-away, 30 vs 60 min buffer. | Replace absolute guarantee with planned buffer language. Use one time model. |
| `components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.en.json` | EN gallery has pure Korean captions; prior audit also found itinerary-card content mismatch. | Translate gallery labels and manually verify all stop content matches stop names. |
| `components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.en.json` | Uses all-aboard guarantee language; vehicle pricing must not multiply by guest count. | Soften guarantee and verify vehicle price flow. |
| `components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.en.json` | Cruise timing/refund language should be checked after Busan/Jeju cleanup. | Keep if factual, soften any absolute wording. |
| `components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.en.json` | "Never miss the ship" and "guaranteed return" are too absolute. K-ETA/e-Arrival text needs current official wording. | Use planned buffer language. Update entry-card guidance from official sources before publishing. |

## P1 - Risky Refund, Passport, Guarantee Copy

| File | Issue | Plan |
|---|---|---|
| `components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json` | "No passport, no DMZ entry, no refund" is blunt and potentially high-friction. Military access changes "no refund" wording may invite disputes. | Keep policy substance if required, but rewrite to standard cancellation/refund-policy language and clearly distinguish guest-caused vs military-caused changes. |
| `components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.en.json` | "Return guaranteed", "not missed a sail-away in 4 seasons" is risky and hard to substantiate. | Remove or soften historical guarantee claim. |
| `components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.en.json` | "So you never miss the ship" is absolute. | Replace with "planned to return with buffer, subject to ship details and conditions." |

## P2 - Visible Copy Cleanup

| File | Issue | Plan |
|---|---|---|
| `components/product-tour-static/east-signature-nature-core/east-signature-nature-core.en.json` | "A easy-to-follow"; empty hero carousel image index. | Change to "An easy-to-follow"; remove/replace empty hero image. |
| `components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json` | "What's the difference vs the our year-round Eastern UNESCO tour tour?" and empty itinerary image fields. | Rewrite FAQ question; optionally fill images or ensure empty values are ignored. |
| `components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.en.json` | FAQ answer starts with "similar local route." | Rewrite as normal comparison copy. |
| `components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.en.json` | "The similar local route runs..." | Replace with operator-neutral/private-option wording. |
| `components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.en.json` | "Eastern UNESCO tour (similar local route)" wording. | Replace with "companion eastern route" or "sister route" if true. |
| `components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.en.json` | Multiple "similar local route" strings; leaked operator/guides wording (`Love Korea Tours`, named guides). | Remove leaked operator/name copy and write clean comparison text. |
| `components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json` | Price mismatch and empty route phase descriptions. Empty descriptions not currently rendered. | Fix price in P0; leave route phase descriptions unless component starts rendering them. |
| `components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json` | Price mismatch; gallery captions contain `? photo` mojibake-like separator; empty page-section images not currently rendered. | Fix price; clean gallery captions if visible. |
| `components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.en.json` | Price mismatch; gallery captions contain `? photo` in output from script. | Fix price; clean caption separator. |

## P2 - Included / Not Included Clarity

Fix these only where the section title is just "What's included" but the items contain exclusions. If the title is already "What's included vs pay-direct" or "Included / Not Included", no urgent change is required.

| File | Plan |
|---|---|
| `components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json` | Split included vs excluded. |
| `components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json` | Split included vs excluded. |
| `components/product-tour-static/east-signature-nature-core/east-signature-nature-core.en.json` | Title already says included/not included; optional layout polish. |
| `components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json` | Title already says included/not included; optional layout polish. |
| `components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json` | Title already says included/not included; optional layout polish. |
| `components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.en.json` | Title says vehicle/driver-guide; admissions/meals pay direct. Leave unless visual section implies inclusion. |
| `components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.en.json` | Same as Jeju private charter. |
| `components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.en.json` | Same: vehicle and driver-guide included; admissions/meals pay direct. |
| `components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.en.json` | Title already says lunch pay direct; optional polish only. |
| `components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.en.json` | Title already says lunch pay direct; optional polish only. |

## P3 - Files Found But No Immediate Edit Required

These 33 public EN JSON files were included in scope. Some have issues listed above; others need only a post-fix smoke test unless a manual rewrite pass finds new copy problems.

| File | Current Action |
|---|---|
| `components/product-tour-static/busan-cruise-shore-excursion-bus-tour/busan-cruise-shore-excursion-bus-tour.en.json` | Edit guarantee/timing language. |
| `components/product-tour-static/busan-gyeongju-unesco-legacy-tour-national-museum/busan-gyeongju-unesco-legacy-tour-national-museum.en.json` | No immediate edit from latest deep pass; verify no `$0` recommendations after P0. |
| `components/product-tour-static/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour/busan-outskirts-tongdosa-amethyst-yeongnam-day-tour.en.json` | No immediate edit from latest deep pass; optional guarantee/refund tone review. |
| `components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json` | P0 price/season fix. |
| `components/product-tour-static/busan-private-car-charter-cruise-shore/busan-private-car-charter-cruise-shore.en.json` | Vehicle price and guarantee language review. |
| `components/product-tour-static/busan-small-group-sightseeing-tour-cruise-passengers/busan-small-group-sightseeing-tour-cruise-passengers.en.json` | EN gallery and itinerary consistency review. |
| `components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json` | P0 price/season fix. |
| `components/product-tour-static/busan-top-attractions-day-tour/busan-top-attractions-day-tour.en.json` | No immediate edit; verify recommendation cards. |
| `components/product-tour-static/east-signature-nature-core/east-signature-nature-core.en.json` | Price alignment, typo, empty hero image. |
| `components/product-tour-static/from-busan-gyeongju-ancient-capital-day-tour/from-busan-gyeongju-ancient-capital-day-tour.en.json` | No immediate edit; verify recommendation cards. |
| `components/product-tour-static/from-incheon-seoul-day-tour-cruise-guests/from-incheon-seoul-day-tour-cruise-guests.en.json` | Cruise timing/refund tone review. |
| `components/product-tour-static/incheon-seoul-private-car-shore-excursion-cruise/incheon-seoul-private-car-shore-excursion-cruise.en.json` | Guarantee and e-Arrival/K-ETA wording review. |
| `components/product-tour-static/jeju-cherry-blossom-tour-east-route/jeju-cherry-blossom-tour-east-route.en.json` | Seasonal availability, price, typo. |
| `components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json` | P1 cruise route/pickup fix. |
| `components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json` | P1 cruise route/pickup fix. |
| `components/product-tour-static/jeju-eastern-unesco-spots-day-tour/jeju-eastern-unesco-spots-day-tour.en.json` | Price and comparison wording. |
| `components/product-tour-static/jeju-grand-highlights-loop/jeju-grand-highlights-loop.en.json` | Price alignment. |
| `components/product-tour-static/jeju-hydrangea-festival-tour-east-route/jeju-hydrangea-festival-tour-east-route.en.json` | Price, seasonal availability, comparison wording. |
| `components/product-tour-static/jeju-hydrangea-festival-tour-southwest-route/jeju-hydrangea-festival-tour-southwest-route.en.json` | Price, seasonal availability, caption polish. |
| `components/product-tour-static/jeju-island-private-car-charter-tour/jeju-island-private-car-charter-tour.en.json` | Vehicle price flow. |
| `components/product-tour-static/jeju-southern-top-unesco-spots-tour/jeju-southern-top-unesco-spots-tour.en.json` | Price and comparison wording. |
| `components/product-tour-static/jeju-west-south-full-day-authentic-tour/jeju-west-south-full-day-authentic-tour.en.json` | Price and leaked/internal wording cleanup. |
| `components/product-tour-static/jeju-winter-southwest-tangerine-snow-camellia-tour/jeju-winter-southwest-tangerine-snow-camellia-tour.en.json` | Seasonal availability; public copy is okay if booking is blocked outside Dec-Feb. |
| `components/product-tour-static/pocheon-sanjeong-lake-herb-island-art-valley/pocheon-sanjeong-lake-herb-island-art-valley.en.json` | Optional included/not-included polish only. |
| `components/product-tour-static/seoul-dmz-private-3rd-tunnel-suspension-bridge/seoul-dmz-private-3rd-tunnel-suspension-bridge.en.json` | Passport/refund tone cleanup; vehicle price flow. |
| `components/product-tour-static/seoul-private-nami-morning-calm-petite-france/seoul-private-nami-morning-calm-petite-france.en.json` | Optional included/not-included polish. |
| `components/product-tour-static/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip/seoul-seoraksan-naksansa-temple-naksan-beach-day-trip.en.json` | No immediate edit. |
| `components/product-tour-static/seoul-seoraksan-nami-island-morning-calm-day-tour/seoul-seoraksan-nami-island-morning-calm-day-tour.en.json` | "All admissions included" can stay if optional cable car remains clearly excluded; optional copy narrow to "core admissions included". |
| `components/product-tour-static/seoul-suburbs-private-chartered-car-10hr/seoul-suburbs-private-chartered-car-10hr.en.json` | Vehicle price flow; optional included/not-included polish. |
| `components/product-tour-static/seoul-suwon-hwaseong-folk-village-starfield-library/seoul-suwon-hwaseong-folk-village-starfield-library.en.json` | No immediate edit. |
| `components/product-tour-static/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library/seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library.en.json` | No immediate edit. |
| `components/product-tour-static/seoul-suwon-hwaseong-waujeongsa-starfield/seoul-suwon-hwaseong-waujeongsa-starfield.en.json` | Optional included/not-included polish. |
| `components/product-tour-static/southwest-hallasan-osulloc-aewol/southwest-hallasan-osulloc-aewol.en.json` | Price and caption polish. |

## Blocked / Retired File Found

| File | Action |
|---|---|
| `components/product-tour-static/seoul-seoraksan-national-park-sokcho-beach-day-trip/seoul-seoraksan-national-park-sokcho-beach-day-trip.en.json` | No public content edit needed because it is blocked from consumer route/sitemap. Optional cleanup: unpublish DB row or remove from admin-only generated lists to reduce future confusion. |

## Catalog / Registry Files Found

| File | Issue | Plan |
|---|---|---|
| `components/product-tour-static/catalog/catalogCards.generated.ts` | Contains generated catalog data and stale/non-EN slug was observed in order list, though sitemap filters it out. | Regenerate after price/status fixes. Confirm blocked and stale slugs do not leak to recommendations. |
| `components/product-tour-static/catalog/staticTourCatalogCards.ts` | Used by recommendations and static catalog listing. | Verify filters exclude blocked/unpriced/season-closed products. |
| `lib/tour-consumer-visibility.ts` | Blocks retired consumer slugs. | Keep as-is; optionally add season-closed filtering elsewhere, not here unless product should 404. |

## Rendering / SEO Files Found

| File | Issue | Plan |
|---|---|---|
| `app/tour-product/[slug]/page.tsx` | Loads Supabase detail first, overlays static-only fields, builds recommendations from static catalog. | After fixes, verify DB/static precedence does not reintroduce stale prices. Consider filtering recommendations with valid price and active season. |
| `components/product-tour-static/_shared/TourProductDetailClient.tsx` | Main renderer passes `routeVariants`, recommendations, booking card, sections. | Verify no layout conflict after route variant/pickup changes. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourHeroSection.tsx` | Empty string in `hero.images` can create blank carousel slide. | Filter empty image URLs defensively, or fix source data. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourDayFlowSection.tsx` | `routePhases.description` is not rendered, so empty descriptions are not a current bug. | No immediate edit. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourIncludedSection.tsx` | Included/not-included layout may make mixed lists clearer if supported. | Optional after content split. |
| `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourPracticalDetails.tsx` | Practical accordion rendering source for included/excluded copy. | Verify split content displays clearly. |
| `lib/seo/tourProductJsonLd.ts` | JSON-LD price uses `vm.price.amountLabel`; `$0` or mismatched prices can leak to structured data. | After price fixes, verify JSON-LD Offer prices match checkout prices and exclude invalid price. |

## Type / Admin Files Found During Audit

These are not all confirmed edit targets, but they may need updates if `vehicle` becomes a first-class price type.

| File | Why Found | Plan |
|---|---|---|
| `lib/admin/tour-write-rules.ts` | Admin validation currently documents `person | group`. | Add `vehicle` if admin can edit vehicle-priced tours. |
| `lib/db-relations.ts` | Type annotation only allows `person | group`. | Add `vehicle`. |
| `lib/supabase.ts` | Generated/manual Supabase types show `price_type: 'person' | 'group'`. | Regenerate or update after DB enum/contract decision. |
| `app/admin/products/page.tsx` | Admin product UI only supports `person | group`. | Add `vehicle` option if editing vehicle products through admin. |
| `app/api/admin/tours/route.ts` | Admin route validates only `person | group`. | Add `vehicle` if admin writes vehicle products. |
| `app/api/admin/tours/[id]/route.ts` | Admin update route may validate price type. | Same as above. |
| `app/api/tours/route.ts` | Tour API maps `priceType`; should preserve `vehicle`. | Verify after type update. |
| `app/api/tours/[id]/route.ts` | Tour detail API maps `priceType`. | Verify after type update. |
| `app/api/cart/route.ts` | Cart total may treat non-person as fixed. | Make `vehicle` explicit. |
| `app/api/cart/[id]/route.ts` | Cart update total may treat non-person as fixed. | Make `vehicle` explicit. |
| `app/api/bookings/[id]/route.ts` | Booking detail uses joined tour price type. | Verify display/calculation copy. |
| `app/api/bookings/[id]/receipt/route.ts` | Receipt includes `price_type`. | Ensure vehicle label displays properly. |
| `app/api/admin/orders/[id]/route.ts` | Admin order display includes `price_type`. | Ensure vehicle label displays properly. |
| `app/api/wishlist/route.ts` | Wishlist includes `price_type`. | Ensure vehicle label displays properly. |
| `components/TourCard.tsx` | Price type prop only `person | group`. | Add `vehicle` if cards show vehicle-priced products. |
| `components/TourList.tsx` | Tour list type only `person | group`. | Add `vehicle`. |
| `components/SeasonalTours.tsx` | Seasonal card type only `person | group`. | Add `vehicle` only if seasonal private products are shown here. |
| `components/tours/DetailedTourCard.tsx` | Displays `/ {tour.priceType}`. | Add label mapping for vehicle. |
| `components/TourSectionRow.tsx` | Passes `priceType` into cards. | Verify vehicle label. |
| `lib/tour-catalog-type-infer.ts` | Already recognizes `vehicle` in inference. | Use as reference; no immediate edit. |

## Existing Related Docs Found

| File | Use |
|---|---|
| `docs/tour-product-en-content-audit-2026-05-23.md` | Earlier broad audit report. Contains useful findings but appears mojibake in PowerShell output; do not rely on it as the clean final plan. |
| `docs/pickup-dropoff-weather-data-correctness-plan-2026-05-23.md` | Related pickup/dropoff/weather correctness plan. Keep separate; this fix plan supersedes it only for the Jeju cruise "hotel vs port" category error. |

## Suggested Execution Phases

### Phase 1 - Data/booking integrity

1. Decide canonical prices for all mismatched Jeju products.
2. Fix Busan seasonal products: real price or closed-season state.
3. Add seasonal availability gates or seed inventory rows.
4. Add first-class `vehicle` support where needed.
5. Verify no live page or recommendation card shows `$0`.

### Phase 2 - Cruise route correctness

1. Migrate Jeju cruise populated `itinerary_variants` to rendered `routeVariants`.
2. Replace Jeju cruise hotel/airport pickup cards with port-specific pickup/dropoff.
3. Validate Gangjeong and Jeju Port variants in live UI.
4. Review Busan/Incheon cruise guarantee language.

### Phase 3 - Copy cleanup

1. Fix typo/internal wording strings:
   - `A easy`
   - `the our`
   - `tour tour`
   - `route route`
   - `similar local route`
   - leaked operator/guides where not intended
2. Split included/excluded lists where title is misleading.
3. Translate pure Korean EN gallery captions where needed.
4. Soften DMZ passport/refund copy.

### Phase 4 - Verification

Run these checks after changes:

1. Fetch all 33 public EN URLs and confirm status 200.
2. Confirm blocked slug returns 404 and is absent from sitemap/recommendations.
3. Search rendered HTML for:
   - `$0`
   - `similar local route`
   - `the our`
   - `route route`
   - `A easy`
   - `Ocean Suites Jeju Hotel` on cruise pages
4. Confirm Jeju cruise pages render both Jeju Port and Gangjeong port options.
5. Confirm vehicle-priced products show fixed per-vehicle totals with multiple guests.
6. Confirm seasonal tours cannot book dates outside their operating window.
7. Confirm JSON-LD Offer price matches the visible booking card.

