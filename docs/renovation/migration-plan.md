# Migration Plan (Phase 0)

**Purpose:** Propose an adapter-based migration order for the UI renovation. No application behavior is changed in Phase 0. This plan aligns with `docs/renovation/final-product-spec.md` and `.cursor/rules`.

**Gap analysis:** See `docs/renovation/gap-analysis.md` for a full spec-coverage matrix (product, payment, hotel-area, design, page-level). The following sections incorporate remediation for items marked missing or partially covered.

---

## 1. Principles

- **Strangler pattern:** Replace presentation layer incrementally; preserve working backend, payment, auth, and API contracts.
- **Server as source of truth:** Price, time, booking state, and confirmation stay server-driven. Frontend only renders and formats.
- **Adapters first:** Legacy API payloads → Zod in `lib/adapters/` → ViewModels → new UI. Do not pass raw legacy payloads to UI.
- **Risky areas:** Isolate with adapters and optional feature flags; do not rewrite working logic.

---

## 2. Adapter-based migration order

### 2.1 Foundation (Phase 1 – no page replacement)

1. **Design system (no behavior change)**  
   - Confirm or add: `src/design/tokens.ts`, `copy.ts`, `status.ts`, `motion.ts`, `analytics.ts`.  
   - Use semantic roles (e.g. status colors) and centralized copy; do not hardcode hex or strings in components yet.

2. **Zod schemas and adapters (read-only layer)**  
   - **Already present:** `src/lib/schemas/booking.ts`, `tours.ts`, `hotel.ts`; `src/lib/adapters/booking-adapter.ts`, `tours-adapter.ts`.  
   - **Extend as needed:**  
     - Hotel lookup response (for builder): map to `pickupAreaLabel`, `surchargeAmount`, `joinAvailable`, etc.  
     - Tour list/detail: ensure one adapter path from GET `/api/tours` and GET `/api/tours/[id]` to a TourCardViewModel / TourDetailViewModel.  
     - Booking timeline: map server/booking data to timeline ViewModel (refundDeadlineAt, balanceOpensAt, balanceDueAt, autoCharge: false).  
   - **Rule:** All new UI that shows tour/booking/hotel data must consume adapter output only. Use `safeParse`; on failure return fallback ViewModel and log.

3. **Reusable UI primitives**  
   - Add or adopt from `src/components/ui/`: button, badge, card, input, timeline, countdown-label, status-banner, section-header, etc.  
   - Build against design tokens and copy constants. Do not replace pages yet.

### 2.2 Page order (presentation replacement)

Order below is by **risk and dependency**: safe presentation first, then list/detail with adapters, then checkout and my-tour with wrappers only.

| Order | Area | What to do | What not to do |
|-------|------|------------|----------------|
| 1 | **Shell** | Apply design tokens to Header, Footer, BottomNav (layout, typography, colors). | Change auth logic, session fetch, redirect, nav hrefs. |
| 2 | **Homepage** | New Hero, trust strip, destinations, tour type cards, “How it works”, preview itinerary block, reviews, final CTA. Use copy constants. | Change CTA links or TourSectionRow fetch params. |
| 3 | **List (tours/list, search)** | Introduce adapter for GET `/api/tours` → TourCardViewModel[]. Replace in-page mapping (e.g. mapApiTourToDetail) with adapter. Restyle TourCardDetail with design system. | Change API URL, query params, or bypass adapter. |
| 4 | **Builder (custom-join-tour or future /build-tour)** | Optional: add hotel-adapter for place/hotel lookup. Restyle steps, calendar, map; add “live summary” panel and deposit note. Keep all API calls and payloads unchanged. | Change generate/proposed/confirm request or response. |
| 5 | **Loading** | Add a dedicated loading route or in-page loading state with spec copy (“Checking pickup flow…”, “Almost there…”). No fake “real-time matching” claims. | Change when or what is fetched. |
| 6 | **Detail (tour/[id])** | Feed detail from adapter (GET `/api/tours/[id]` → TourDetailViewModel). Add “booking timeline” block from timeline ViewModel. Restyle sidebar, “why this fits you”, badges. | Change price/date/pickup source or “Book” action target. |
| 7 | **Checkout** | Add reassurance box and trust copy (“We will never charge your card automatically…”). Restyle order summary (base, surcharge, deposit, balance). Keep POST `/api/bookings` and POST `/api/stripe/checkout` and redirect unchanged. | Change form state, validation, or payment flow. |
| 8 | **Login / Auth** | Restyle signin/signup/forgot-password; benefit copy (“manage your booking…”). | Change Supabase calls or redirect. |
| 9 | **My Tour / My Page** | Consume GET `/api/bookings` via booking-adapter → MyTourViewModel. Single primary CTA per status; status labels from design/status. Restyle tabs and cards. | Change cancel/pay actions or API usage. |

### 2.3 Adapters to add or extend

| Adapter / schema | Purpose | Consumed by |
|------------------|---------|-------------|
| **tours-adapter** (existing) | Build tour response → searchSummary + recommended/privateTours/joinTours/busTours. | Future build-tour list page. |
| **booking-adapter** (existing) | My tour response → tour + paymentHistory. | mypage/dashboard, mybookings, upcoming. |
| **Hotel lookup** | Map place/hotel API to pickupAreaLabel, surchargeAmount, joinAvailable. | Builder hotel step. |
| **Tour list** | GET /api/tours response → TourCardViewModel[]. | tours/list, search. |
| **Tour detail** | GET /api/tours/[id] response → TourDetailViewModel (with timeline fields if present). | tour/[id] page. |
| **Booking timeline** | Booking + tour data → { now, tourStartAt, refundDeadlineAt, balanceOpensAt, balanceDueAt, autoCharge: false }. Use spec rules: balance opens 24h before departure, balance due 18h before. | Detail and checkout. |

---

## 2.4 Spec alignment (from gap analysis)

The following items are called out so they are not omitted during implementation. Do not modify app logic; add or adjust presentation and copy only.

**Hotel area (spec §4)**  
- Externally use simplified Jeju tiers (e.g. City Core / Near-city / Outer / Remote) with human copy only (e.g. “Good match for your hotel,” “Additional pickup fee applies,” “Private tour recommended”). Do not expose internal zone/rule-based language.  
- Ensure hotel-area affects: input flow, surcharge display, join suitability, route-fit messaging, list filtering, detail explanation.

**Payment timeline and trust (spec §3)**  
- UI must show: deposit refundable until 24h before departure; balance opens at 24h before; balance due at 18h before; tour confirms when minimum travelers complete balance; never auto-charge balance.  
- Mandatory trust copy near checkout CTA: “We will never charge your card automatically for the remaining balance. You need to complete it manually in My Tours.”  
- Reassurance box: title “Secure Your Seat with a 20% Deposit”; body to include no automatic balance charge and free cancellation until 24h.  
- Checkout CTA: use “Reserve My Spot” or “Pay Deposit.”

**Product hierarchy and homepage**  
- Homepage: product order 1. AI Private, 2. AI Small-Group Join, 3. Classic Bus; Classic Bus must not visually dominate.  
- Include comparison section: “Why travelers choose this over crowded bus tours or expensive private charters” (planning, group size, pickup, comfort, flexibility, booking clarity, price).  
- Classic bus section title: “Prefer a classic group tour instead?”  
- Final CTA: “Ready to build your Jeju trip the smarter way?” + Plan My Trip.

**Generated tour list**  
- Primary filter order: Hotel Area, Tour Type, Date, Group Size, Travel Style, Pickup surcharge, Price.  
- Section order: Recommended for you, Private options, Small-group options, Classic bus fallback.  
- Match quality labels: “Great pickup match,” “Good pickup match,” “Slight extra travel time may apply.”  
- Join states: Waiting for more travelers, Balance payment open, Confirmed, Missed deadline, Private tour recommended, Join not available for this route yet.

**Help / FAQ (spec §7.9)**  
- Must include: How does the deposit work? When do I pay the remaining balance? When is my tour confirmed? How do hotel-area pickup fees work? What if my hotel is outside central Jeju? Can I cancel and rebook? What happens if the minimum group is not reached?  
- Use clear accordion/card UX.

**Accessibility and design**  
- Button min height 44px; visible focus states; status never by color alone; tabular numerics for times/prices/countdowns.  
- No hover-only critical information (provide mobile bottom-sheet or inline alternative).  
- Do not hardcode UI strings in components (use design/copy).

**Analytics and privacy (spec §11)**  
- Do not track or store raw hotel names or exact lat/lng. Track only pickup area label, surcharge tier, tour type, state transitions, funnel steps (see spec example events).

---

## 3. Phase summary (spec alignment)

| Spec phase | Focus | Deliverables |
|------------|--------|--------------|
| **Phase 0** | Audit only | audit.md, component-map.md, risk-map.md, migration-plan.md, gap-analysis.md (this file). |
| **Phase 1** | Foundation | Design tokens, copy, status, motion, analytics; Zod schemas + adapters; UI primitives; a11y/copy constraints (44px buttons, no hardcoded strings). No page replacement. |
| **Phase 2** | Homepage | New layout and copy; hotel-area-first message; private/join/bus hierarchy; comparison section; classic bus fallback title; final CTA copy. |
| **Phase 3** | Builder + Loading + List + Detail | Adapter ViewModels; realistic loading copy; hotel-aware UX; booking timeline on detail; list filter/section order and match-quality/join-state labels. |
| **Phase 4** | Checkout + My Tour + Login | Trust-first UX; wrap existing auth/payment; single CTA per state; manual-balance trust copy; reassurance box and CTA wording; Help/FAQ required questions and accordion UX. |
| **Phase 5** | Hardening | Accessibility (focus, status not by color alone, tabular numerics, no hover-only critical info); analytics instrumentation (no raw hotel/lat-lng); motion consistency; QA; no regressions. |

---

## 4. Constraints (do not break)

- Do not rewrite working backend logic unless necessary.  
- Do not replace API contracts with incompatible ones.  
- Do not move pricing, time, or status decisions to the client.  
- Do not change Stripe/payment execution flows except via presentational wrappers.  
- Do not remove working features before replacement.  
- Do not use fake loading or status copy that implies unsupported backend behavior.  
- Use feature flags for risky changes; prefer adapter + ViewModel for data boundaries.

---

## 5. File structure (target, from spec)

Keep or adapt as compatible with existing app:

```
src/
  app/           (or app/ at root – current)
  components/    (or components/ at root – current)
  design/        tokens, copy, status, analytics, motion
  lib/
    adapters/    booking, tours, hotel, pricing, timeline
    schemas/     hotel, tours, booking
    format/      currency, date, countdown
  types/         tours, booking, pricing
docs/renovation/ audit, migration-plan, component-map, risk-map, qa-checklist, analytics-events
```

Existing adapters live under `src/lib/adapters/` and `src/lib/schemas/`; pages currently under `app/` and `components/`. Migration can keep this layout and add design system and new primitives under `src/design/` and `src/components/ui/` as needed.

---

This plan is the basis for executing Phases 1–5 without modifying business logic in Phase 0.
