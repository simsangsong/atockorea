# EN Tour Product Post-Merge Audit - 2026-05-23

## Scope

- Target: EN locale tour product detail pages and related product data.
- Product count checked: 33 public EN tour product pages plus catalog/static support files.
- Mode: original audit plus follow-up remediation log. The first pass was audit-only; fixes were applied after owner approval on 2026-05-24.
- Exclusion requested by owner: Busan cruise return-time emphasis is not counted as a blocking issue in this report.

## Executive Summary

2026-05-24 follow-up status: the actionable P0/P1 items from this report have been remediated in static JSON, supporting TypeScript code, and Supabase data migrations. This document keeps the original finding details below for traceability.

Implemented follow-up changes:

- Jeju cruise pickup/dropoff stale DB payloads were corrected in the earlier merged pass and re-verified.
- Busan seasonal products now use USD 52 sale price / USD 58 original price in static JSON, generated catalog cards, Supabase `tours`, and default offers.
- Jeju cherry and Jeju winter products now have seasonal availability windows, including the December-February wrap-around winter window.
- Remaining awkward EN copy patterns from the audit now return no static or DB matches.
- Jeju cruise included/excluded accordion copy now explicitly says `What's included / not included`, with lunch and gratuities marked separate.
- `vehicle` price type is now accepted in residual TypeScript/admin validation paths.
- Cruise on-time return / never-miss-the-ship guarantee language is intentional operating policy and must stay strong.

Original audit summary:

Most of the earlier broad pricing mismatch issues appeared to be resolved. The major remaining risks were concentrated in three areas:

1. Live Supabase payload for the two Jeju cruise products still exposes hotel/airport pickup-dropoff data.
2. Two Busan seasonal products still have live sellable price `0`.
3. Seasonal availability is only implemented for the two Busan bloom products, not for Jeju cherry/winter seasonal products.

There were also smaller but customer-visible copy quality issues: repeated words, awkward FAQ phrasing, blunt cancellation wording, and one generated catalog card typo that could appear as a recommendation on multiple pages.

## Priority Legend

- `P0`: Can directly mislead customers, create wrong bookings, or expose a wrong sellable price.
- `P1`: Customer-visible quality, trust, or policy risk.
- `P2`: Cleanup / consistency / maintenance risk.

## P0 - Original Customer / Booking Risks

### 1. Jeju Cruise Pickup / Dropoff Still Stale in Live DB

Affected products:

- `jeju-cruise-shore-excursion-bus-tour`
- `jeju-cruise-shore-excursion-small-group-tour`

Problem:

- Live Supabase `tour_product_pages.detail_payload.pickup_dropoff` still contains normal Jeju city pickup/dropoff points:
  - `Ocean Suites Jeju Hotel`
  - `Jeju International Airport (3F, Gate 3)`
  - `LOTTE City Hotel Jeju`
  - `Shilla Duty Free (Jeju Store)`
  - `Dongmun Traditional Market`
- These are inappropriate for cruise shore excursion pages and can confuse cruise passengers.
- Static JSON may have been partially corrected, but live pages use Supabase payload first, so DB content must also be corrected.

Evidence:

- DB query confirmed both EN rows still have `pickup_dropoff.departure` and `pickup_dropoff.return` with the stale hotel/airport points.
- Live rendered HTML still included `Ocean Suites Jeju Hotel` and `Jeju International Airport (3F, Gate 3)` for both Jeju cruise products.

Recommended fix:

- Update Supabase `tour_product_pages.detail_payload` for both EN rows.
- Replace pickup/dropoff with cruise-terminal-specific points only.
- Keep route variants for `Gangjeong Cruise Terminal` and `Jeju Cruise Terminal`.
- Confirm after patch that neither page renders hotel/airport pickup points.

Likely files / sources to check:

- `components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json`
- `components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json`
- Supabase table: `public.tour_product_pages`

### 2. Busan Seasonal Products Still Sell at USD 0 in Season

Affected products:

- `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju`
- `busan-spring-cherry-blossom-gyeongju-highlights-day-tour`

Problem:

- `tours.price = 0.00`
- Default `tour_product_offers.amount_minor = 0`
- EN static JSON has empty price fields:
  - `catalog_card.priceLabel`
  - `price.amountLabel`
  - `sticky_booking_bar.price.amountLabel`
- Off-season dates are blocked now, but in-season dates return `available: true, price: 0`.

Evidence:

- `2026-05-24` correctly returns unavailable due to season lock.
- `2027-03-05` for Busan plum returns `available: true, price: 0`.
- `2027-04-02` for Busan spring cherry returns `available: true, price: 0`.

Recommended fix:

- Either set confirmed USD prices in:
  - `public.tours.price`
  - `public.tour_product_offers.amount_minor`
  - EN static JSON price labels
- Or keep products unavailable until pricing is confirmed.

Likely files / sources to check:

- `components/product-tour-static/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju/busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju.en.json`
- `components/product-tour-static/busan-spring-cherry-blossom-gyeongju-highlights-day-tour/busan-spring-cherry-blossom-gyeongju-highlights-day-tour.en.json`
- Supabase tables:
  - `public.tours`
  - `public.tour_product_offers`

### 3. Jeju Seasonal Products Are Still Bookable Outside Season

Affected products:

- `jeju-cherry-blossom-tour-east-route`
- `jeju-winter-southwest-tangerine-snow-camellia-tour`

Problem:

- Availability logic currently season-locks only the two Busan bloom products.
- Jeju cherry and Jeju winter products are still available on dates outside their seasonal positioning.

Evidence:

- `lib/tour-seasonal-windows.ts` currently registers only:
  - `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju`
  - `busan-spring-cherry-blossom-gyeongju-highlights-day-tour`
- Availability API returned `available: true, price: 59` for:
  - `jeju-cherry-blossom-tour-east-route` on `2026-05-24`
  - `jeju-winter-southwest-tangerine-snow-camellia-tour` on `2026-05-24`

Recommended fix:

- Add Jeju seasonal windows to `lib/tour-seasonal-windows.ts`.
- Confirm exact operating windows before setting:
  - Cherry blossom East route: likely late March to early April, but needs owner confirmation.
  - Winter southwest/tangerine/snow/camellia: likely winter-only, but exact dates need owner confirmation.
- Re-test availability API for in-window and out-of-window dates.

Likely files:

- `lib/tour-seasonal-windows.ts`
- `app/api/tours/[id]/availability/route.ts`

## P1 - Original Customer-Visible Copy / Trust Issues

### 4. Remaining Awkward / Erroneous English Phrases

These are customer-visible or can appear in recommendations / FAQ / JSON-LD.

| Issue | Affected product/source | Current phrase | Suggested direction |
| --- | --- | --- | --- |
| Article typo | `components/product-tour-static/catalog/catalogCards.generated.ts` | `A easy-to-follow` | `An easy-to-follow` |
| Repeated word | Jeju cruise bus | `route route option` | `route option` |
| Repeated word | Jeju cruise small group | `route route option` | `route option` |
| Internal/awkward comparison phrase in DB/live | Jeju cruise bus, Jeju cruise small group, Jeju Eastern UNESCO, Jeju hydrangea East, Jeju Southern UNESCO, Jeju West/South | `similar local route` | Rewrite as customer-facing comparison or remove |
| Broken phrase in DB/live | `jeju-cherry-blossom-tour-east-route` | `the our`, `tour tour` | Rewrite affected FAQ/copy |
| Repeated word | `jeju-winter-southwest-tangerine-snow-camellia-tour` | `schedule schedule` | `schedule` |
| Repeated word | `seoul-seoraksan-national-park-sokcho-beach-day-trip` | `small-group group dynamics` | `small-group dynamics` |
| Repeated word | `southwest-hallasan-osulloc-aewol` | `1100 Road road-closure` | `1100 Road closure` |
| Source text typo | `seoul-dmz-private-3rd-tunnel-suspension-bridge` | `Visit Korea Korea Foundation...` | `Visit Korea Foundation...` or remove if source label is internal |
| Blunt refund wording in DB/live | `seoul-dmz-private-3rd-tunnel-suspension-bridge` | `No passport, no DMZ entry, no refund` | Softer but clear wording, e.g. passport required and non-refundable if missing |

Recommended fix:

- Patch static JSON/catalog first.
- Patch Supabase EN payload for rows where DB/live still contains the bad phrase.
- Rebuild generated catalog if `catalogCards.generated.ts` is generated from JSON.

### 5. Jeju Cruise Included / Excluded Section Is Still Mixed

Affected products:

- `jeju-cruise-shore-excursion-bus-tour`
- `jeju-cruise-shore-excursion-small-group-tour`

Problem:

- Under `What's included`, the section includes excluded or customer-paid items:
  - `Lunch break - own expense at local restaurant`
  - `Personal shopping`
  - `Gratuities`

Why it matters:

- Customers may interpret all bullets under `What's included` as included in the price.
- This can create payment disputes or complaint risk.

Recommended fix:

- Split into clear sections:
  - `Included`
  - `Not included`
- Or rename the current group to `Included / not included` only if the UI supports mixed lists clearly.

Likely files:

- `components/product-tour-static/jeju-cruise-shore-excursion-bus-tour/jeju-cruise-shore-excursion-bus-tour.en.json`
- `components/product-tour-static/jeju-cruise-shore-excursion-small-group-tour/jeju-cruise-shore-excursion-small-group-tour.en.json`

### 6. Vehicle Price Type Is Mostly Fixed for Customer Checkout, but Not Everywhere

Status:

- Customer-facing booking card / sticky bar / cart path appears improved.
- `vehicle` is now recognized in key checkout context code.

Remaining risk:

- Several admin/types/list components still restrict price type to `person | group`.
- This may break admin edits or secondary display paths for vehicle-priced products.

Files still showing stale type/validation:

- `lib/admin/tour-write-rules.ts`
- `app/api/admin/tours/route.ts`
- `lib/supabase.ts`
- `lib/db-relations.ts`
- `components/TourCard.tsx`
- `components/TourList.tsx`
- `components/SeasonalTours.tsx`
- `components/tours/DetailedTourCard.tsx`
- `app/api/cart/[id]/route.ts`

Recommended fix:

- Extend all relevant types/validation to `person | group | vehicle`.
- Confirm admin update flow accepts existing vehicle products without downgrading or rejecting them.

## P2 - Optional / Non-Blocking Cleanup

### 7. Cruise On-Time Return Guarantee Language

Affected product:

- `incheon-seoul-private-car-shore-excursion-cruise`

Phrases:

- `never miss the ship`
- `guaranteed return buffer`

Note:

- Owner clarified on 2026-05-24 that cruise on-time return is an intentional hard operating guarantee.
- Strong copy such as `never miss the ship`, `return guaranteed`, and `guaranteed return buffer` should be preserved.
- Do not soften this language unless the owner explicitly changes the cruise compensation / operations policy.

Recommended direction:

- Keep strong reassurance visible on cruise product pages.
- Pair the guarantee with operational specifics: all-aboard time intake, return buffer, guide timing checks, and route shortening when needed.

### 8. Route Variant Shape Is Still Legacy in Source, but Rendering Appears Covered

Affected products:

- `jeju-cruise-shore-excursion-bus-tour`
- `jeju-cruise-shore-excursion-small-group-tour`

Status:

- DB/static payloads still use `itinerary_variants` and have `routeVariants` empty/missing.
- The app now adapts `itinerary_variants` to `routeVariants`, so live rendering is not currently blocked.

Evidence:

- Adapter exists:
  - `lib/tour-product/portRouteVariantsAdapter.ts`
  - `lib/tour-product/loadTourProductPage.ts`
  - `components/product-tour-static/_shared/buildTourProductViewModelFromJson.ts`
- Live HTML included both `Gangjeong Cruise Terminal Pickup` and `Jeju Cruise Terminal Pickup`.

Recommended fix:

- Not urgent.
- Later, normalize source data to canonical `routeVariants` to reduce future fragility.

### 9. Empty Legacy Fields Need Careful Filtering, Not Blind Fixing

Observation:

- Many static JSON files have empty `page_sections[*].props.hero.imageUrl` or duplicated section-level `price.amountLabel` fields.
- Live pages did not show obvious blank hero failures or visible `$0` from these fields.

Recommendation:

- Do not blindly patch every empty nested legacy field.
- Prioritize fields that are actually consumed:
  - top-level `catalog_card.priceLabel`
  - top-level `price.amountLabel`
  - `sticky_booking_bar.price.amountLabel`
  - DB `tours.price`
  - DB `tour_product_offers.amount_minor`

## Already Resolved / Not Reproduced

- The broad Jeju `$59` / `$69` mismatch problem was not reproduced in this audit.
- 33 EN product detail pages returned HTTP 200 on local live fetch.
- No obvious live `$0` / `US$0` text was found in rendered detail HTML.
- Core vehicle checkout display appears improved in:
  - `lib/tour-product/eastSignatureCheckoutContext.ts`
  - `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourDesktopBookingCard.tsx`
  - `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourStickyBookingBar.tsx`
  - `app/cart/page.tsx`
- Jeju cruise route variant rendering appears functional through the adapter.

## Suggested Fix Order

1. Patch Jeju cruise DB pickup/dropoff for the two cruise products.
2. Fix or disable Busan seasonal products with USD 0 pricing.
3. Add seasonal windows for Jeju cherry and Jeju winter products after confirming exact dates.
4. Patch customer-visible copy issues in static JSON/catalog and matching DB payloads.
5. Split Jeju cruise `What's included` / `Not included`.
6. Extend stale `person | group` type/validation sites to include `vehicle`.
7. Preserve strong cruise return guarantee language; do not soften `never miss the ship` / on-time return claims.

## Verification Checklist After Fixes

- Fetch both Jeju cruise detail pages and confirm no hotel/airport pickup points are present.
- Confirm both Jeju cruise pages still render both port route options.
- Query DB for Busan seasonal products:
  - `tours.price > 0`
  - default `tour_product_offers.amount_minor > 0`
- Test availability API:
  - Busan seasonal out-of-window date returns unavailable.
  - Busan seasonal in-window date returns available with non-zero price.
  - Jeju cherry out-of-window date returns unavailable.
  - Jeju winter out-of-window date returns unavailable.
- Search EN DB/static payload for:
  - `A easy-to-follow`
  - `route route`
  - `schedule schedule`
  - `group group`
  - `Road road`
  - `the our`
  - `tour tour`
  - `similar local route`
  - `No passport, no DMZ entry, no refund`
- Confirm admin tour update API accepts `price_type = vehicle`.
