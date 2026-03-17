# List / Detail Refactor — QA Checklist (Phase 3A)

**Purpose:** Post-implementation QA for the generated tour list and tour detail refactor. Use this after deploying or before release.

**Reference:** `docs/renovation/list-detail-refactor-plan.md`, `docs/renovation/final-product-spec.md` §7.4–7.5.

---

## 1. ViewModel-only consumption

- [ ] **List page (`/tours/list`):** No raw API payload used in render. All list items come from `adaptToursListResponse(data)` → `TourCardViewModel[]`.
- [ ] **Search page (`/search`):** Same; results are `TourCardViewModel[]` from adapter only.
- [ ] **Detail page (`/tour/[id]`):** Tour content comes from `adaptTourDetailResponse(data)` → `TourDetailViewModel`. No `data.tour` or raw fields used in UI.
- [ ] **Adapters:** List adapter validates with `TourCardViewModelSchema`; detail adapter with `TourDetailViewModelSchema`. Invalid items are dropped (list) or null (detail).

---

## 2. Data loading and routes

- [ ] **List:** GET `/api/tours` with same params as before (`limit`, `isActive`, `sortBy`, `sortOrder`). No new required params.
- [ ] **Search:** GET `/api/tours` with `city`, `search`, `locale` as before.
- [ ] **Detail:** GET `/api/tours/[id]` (or slug) with `locale`. ID/slug from URL unchanged.
- [ ] **Detail links:** List and search cards link to `/tour/${tour.id}`. No change to URL scheme.
- [ ] **Other callers:** TourSectionRow, TourList, SeasonalTours, mobile still use GET `/api/tours` with existing params; no breaking change.

---

## 3. Hotel-area and filters

- [ ] **Search summary bar:** Shows destination (or "All"), optional hotel area, keyword, count. Copy from `COPY.listDetail`.
- [ ] **List summary:** Shows count and "Refine" link to `/search`. No hotel area pre-filled unless from builder (future).
- [ ] **Cards:** Pickup area (`tour.pickup.areaLabel`) shown on each card. Match quality shown when present from ViewModel.

---

## 4. Join states and type differentiation

- [ ] **Type badge:** Every list card shows one of: Private, Small Group, Classic Bus (from `COPY.detail.badge*`).
- [ ] **Join cards:** When `tour.type === 'join'` and `tour.joinStatus` is set, card shows the correct label (Waiting for more travelers, Balance payment open, Confirmed, etc.) from `COPY.joinStatus`.
- [ ] **Traveler count:** When join and `travelersJoined` / `maxTravelers` present, card shows "X / Y travelers".
- [ ] **Detail:** Join status and who-this-is-best-for use ViewModel; no hardcoded strings.

---

## 5. Booking timeline on detail

- [ ] **Section present:** Detail page has a "Booking timeline" section (title from `COPY.timeline.title`).
- [ ] **Placeholder:** When no date selected and no server timeline, section shows "Select a date above to see your booking timeline" (`COPY.detail.selectDateToSeeTimeline`).
- [ ] **Server-first:** When `TourDetailViewModel.bookingTimeline` is present (API returns `bookingTimeline` or `timeline`), the UI uses it. Adapter maps via `mapServerBookingTimeline`; frontend does not override server timeline.
- [ ] **Client fallback (risk):** When server does **not** provide timeline, UI may use `buildBookingTimelineViewModelClientFallback(selectedDate)`. This is **not** source of truth; rules (24h/18h) are duplicated on client. Prefer adding server-provided timeline (e.g. GET `/api/tours/[id]` with optional `?date=` or dedicated timeline endpoint) so timeline is server-driven.
- [ ] **Sidebar callback:** `EnhancedBookingSidebar` receives `onDateSelect`; parent passes `serverTimeline={tour.bookingTimeline}` and `selectedDateForFallback={timelineSelectedDate}` to `BookingTimelineSection`.

---

## 5a. Server-driven timeline (risk)

**Risk:** If the tour detail API does not return `bookingTimeline` (or `timeline`), the detail page uses client-computed dates from `buildBookingTimelineViewModelClientFallback`. That makes the frontend the de facto source of timeline rules (24h before balance opens, 18h before due). Policy changes would require a client deploy.

**Mitigation:** Prefer server-provided timeline everywhere. Options: (1) Extend GET `/api/tours/[id]` to accept optional `date` and return `bookingTimeline`; (2) Add GET `/api/tours/[id]/booking-timeline?date=YYYY-MM-DD` returning timeline fields; (3) Include timeline in existing availability response when available. Adapter already maps `tour.bookingTimeline` and `tour.timeline` via `mapServerBookingTimeline`; once API provides these, no frontend change is needed beyond passing the ViewModel.

---

## 6. Centralized copy

- [ ] **List / search:** Loading, no results, summary labels, "Refine", "View details", "Join this tour", deposit/balance note from `COPY.listDetail` or `COPY.detail`.
- [ ] **Cards:** Type badges, match quality, join status labels from `COPY.detail.*` and `COPY.joinStatus.*`, `COPY.pickupMatch.*`.
- [ ] **Detail:** "Why this fits you", "Who this is best for", "Cancellation policy", timeline title and step labels from `COPY.detail` and `COPY.timeline`.
- [ ] **No hardcoded UI strings** in `TourListCard`, `SearchSummaryBar`, `BookingTimelineSection`, or list/detail pages for these flows.

---

## 7. Detail page sections

- [ ] **Order:** After "Why Choose Us" strip: Why this fits you (if any) → Booking timeline → Cancellation policy → Who this is best for → Photo gallery → Itinerary → Meeting & Pickup → … .
- [ ] **Why this fits you:** Rendered when `tour.whyThisFitsYou.length > 0`; bullets from ViewModel.
- [ ] **Cancellation:** One block with `tour.cancellationPolicy` and `COPY.checkout.autoChargeWarning`.
- [ ] **Who this is best for:** Rendered when `tour.whoThisIsBestFor.length > 0`; list from ViewModel.
- [ ] **Sidebar:** Still shows date picker, guests, pickup, price, Book CTA. Receives `tour` (ViewModel-compatible shape) and `onDateSelect`.

---

## 8. Regressions

- [ ] **Checkout:** From detail, "Book" still goes to checkout with correct query params (tourSlug/id, date, guests). No change to checkout flow or sessionStorage.
- [ ] **Wishlist / cart:** Not modified in this refactor; any existing buttons still work.
- [ ] **Locale:** List and search work with current locale; detail fetch includes `locale` for translations.
- [ ] **Mobile:** List and search layout usable on small screens; detail sidebar and timeline readable.

---

## 9. Files touched (implementation)

| Area | Files |
|------|--------|
| Types / schemas | `src/types/tours.ts`, `src/lib/schemas/tours.ts` |
| Adapters | `src/lib/adapters/tours-adapter.ts` |
| Copy | `src/design/copy.ts` |
| List | `app/tours/list/page.tsx`, `components/list/SearchSummaryBar.tsx`, `components/tour/TourListCard.tsx` |
| Search | `app/search/page.tsx` |
| Detail | `app/tour/[id]/page.tsx`, `components/tour/BookingTimelineSection.tsx`, `components/tour/EnhancedBookingSidebar.tsx` |

---

## 10. What was not changed

- GET/POST API contracts; no new or breaking response shapes.
- Checkout, payment, Stripe, auth.
- Builder (custom-join-tour) APIs and pages.
- My page, wishlist, TourSectionRow, TourList (homepage), SeasonalTours, mobile app.
- `jeju/[slug]` detail page.

---

*Complete this checklist after Phase 3A implementation and before marking list/detail refactor as done.*
