# Analytics Events (Renovation)

**Purpose:** Document analytics events used in the renovated app. All tracking goes through `src/design/analytics.ts`. Raw hotel names and exact coordinates are never sent.

**Reference:** `final-product-spec.md` §11 (Analytics / Privacy).

---

## 1. Implementation

- **Module:** `src/design/analytics.ts`
- **Sanitization:** `trackEvent()` strips `hotelName`, `hotelRaw`, `lat`, `lng`, `coordinates` from every payload before logging/sending.
- **Allowed granularity:** Pickup area label, surcharge tier, tour type, state transitions, funnel steps.

---

## 2. Event catalog

| Event | When | Payload | Instrumented in |
|-------|------|---------|------------------|
| `hero_form_start` | User starts planner (e.g. clicks "Plan My Trip" on hero) | `pickupAreaLabel?` (optional) | `components/HeroSection.tsx` (CTA click) |
| `hotel_selected` | User selects a hotel in builder | `pickupAreaLabel`, `surchargeTier`, `joinAvailable` | (builder; add when wired) |
| `surcharge_shown` | Surcharge info shown | `pickupAreaLabel`, `surchargeTier` | (builder/detail; add when wired) |
| `build_tour_started` | User starts build-tour flow | `pickupAreaLabel`, `preferredType` | (builder; add when wired) |
| `build_tour_completed` | Build returns results | `pickupAreaLabel`, `resultCount` | (builder; add when wired) |
| `tour_card_viewed` | Tour card in list view | `tourType`, `pickupAreaLabel` | (list; add when wired) |
| `detail_viewed` | Tour detail page loaded | `tourType`, `pickupAreaLabel` | `app/tour/[id]/page.tsx` |
| `checkout_started` | Checkout page loaded with bookingData | `tourType`, `pickupAreaLabel` | `app/tour/[id]/checkout/page.tsx` |
| `deposit_paid` | Deposit payment completed (e.g. success callback) | `tourType`, `pickupAreaLabel` | (confirmation/webhook; add when wired) |
| `balance_paid` | Balance payment completed | `tourType`, `pickupAreaLabel` | (my-tour; add when wired) |
| `balance_open_seen` | User sees balance-open state in my-tour | `tourType`, `pickupAreaLabel` | (my-tour; add when wired) |
| `payment_missed` | Deadline missed / payment missed | `tourType`, `pickupAreaLabel` | (my-tour; add when wired) |

---

## 3. Privacy rules

- **Never store in analytics:** Raw hotel name, exact lat/lng, coordinates.
- **Use only:** `pickupAreaLabel` (e.g. "City Core", "Near-city"), `surchargeTier`, `tourType` ("private" | "join" | "bus"), counts, and funnel step names.

---

## 4. Wiring status (Phase 5)

- **Wired:** `hero_form_start` (hero CTA), `detail_viewed` (tour detail), `checkout_started` (checkout page).
- **To wire later:** Builder/hotel selection, list card view, deposit_paid/balance_paid (e.g. on confirmation or webhook), balance_open_seen, payment_missed.
