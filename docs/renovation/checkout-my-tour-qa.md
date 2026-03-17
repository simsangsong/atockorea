# Checkout & My Tour Refactor — QA (Phase 3B)

**Purpose:** QA checklist and implementation notes for the Phase 3B checkout and my-tour refactor.

**Reference:** `docs/renovation/checkout-my-tour-refactor-plan.md`, `docs/renovation/final-product-spec.md` §7.6 (Checkout), §7.8 (My Tour), `.cursor/rules/*`.

---

## 1. Implementation summary

### 1.1 Checkout (`/checkout`, `/tour/[id]/checkout`)

- **Entry (`/checkout`):** Unchanged. Redirect and sessionStorage logic preserved; no payment or auth changes.
- **Main checkout (`/tour/[id]/checkout`):**
  - **Order summary:** Labels from `COPY.checkout` (orderSummary, basePrice, subtotal, depositDueToday, remainingBalanceLater, total). Base = total price; no invented surcharge breakdown when not provided by data.
  - **Booking timeline:** `BookingTimelineSection` with `allowClientFallback={false}`. No client-computed deadlines; when server does not provide timeline, only static copy is shown: "Deposit refundable until 24h before departure; balance due 18h before."
  - **Reassurance box:** Title and body from `COPY.checkout.whyDepositTitle`, `COPY.checkout.whyDepositBody`. Manual balance message from `COPY.checkout.autoChargeWarning`.
  - **CTA:** Single primary button; label is `COPY.checkout.payDeposit` (deposit) or `COPY.checkout.completeBooking` (full). No change to validation, POST `/api/bookings`, or POST `/api/stripe/checkout`.
  - **Payment execution:** Unchanged. Flow remains: validate form → POST `/api/bookings` → POST `/api/stripe/checkout` → redirect to Stripe.

### 1.2 BookingTimelineSection

- New prop: `allowClientFallback` (default `true` for tour detail page).
- When `allowClientFallback={false}` (checkout / my-tour): if no `serverTimeline`, only static copy is rendered; `buildBookingTimelineViewModelClientFallback` is never used for those pages.
- Tour detail page continues to use client fallback when server has no timeline (detail-only; Phase 3B constraint applies to checkout and my-tour only).

### 1.3 My Tour (mypage/mybookings, mypage/upcoming)

- **Status:** Display-only mapping from raw API status to spec status via `rawBookingStatusToDisplayStatus` in `src/design/status.ts`. Used only for labels in `StatusBanner`; no client-derived actionable state (no client-computed “balance due” or countdown).
- **StatusBanner:** Used on each booking card with `displayStatus` from the mapping. Ambiguous raw status uses neutral labels: pending → "Pending", completed → "Completed"; confirmed → "Confirmed", cancelled → "Cancelled", refunded → "Refunded".
- **Countdown:** Not shown. GET `/api/bookings` does not return timeline/countdown target; per plan, countdown is shown only when server provides `targetAt` (e.g. from a future API extension).
- **Primary CTA:** Single primary action per card: "View Booking Details" (`COPY.myTour.viewDetails`). Secondary: Cancel, Write Review (where applicable). "Pay Balance Now" is not shown unless the API later provides a server-driven signal (e.g. status or primaryActionLabel).
- **Copy:** Section title and CTA from `COPY.myTour`. Prices use tabular-nums; button min-height 44px and focus rings preserved.
- **Cancel:** PUT `/api/bookings/[id]` with `status: 'cancelled'` unchanged; server enforces 24h rule. `canCancel` remains for display of button availability only.

### 1.4 Design / copy

- **`src/design/copy.ts`:** Added checkout.orderSummary, basePrice, pickupSurcharge, subtotal, depositDueToday, remainingBalanceLater, total, payDeposit, completeBooking, timelineStaticCopy.
- **`src/design/status.ts`:** Added `rawBookingStatusToDisplayStatus` for display-only mapping from raw API status to `BookingStatus` for StatusBanner.

---

## 2. What was not changed

- POST `/api/bookings` and POST `/api/stripe/checkout` — request/response and execution.
- Stripe webhook and payment_status / booking status updates.
- Auth: Supabase session, getSession, redirect to signin, Authorization header.
- PUT `/api/bookings/[id]` — cancel and validation logic.
- GET `/api/bookings` and GET `/api/bookings/[id]` — existing fields and auth (no breaking changes).
- Tour detail page booking timeline (may still use client fallback for detail-only display).
- Confirmation page, header, footer, bottom nav.
- Builder flow, list/detail, auth pages.

---

## 3. QA checklist

### 3.1 Checkout

- [ ] Open `/tour/[id]/checkout` with valid `bookingData` in sessionStorage (e.g. from tour detail or `/checkout` redirect). Left column: traveler and contact form unchanged; validation and required fields behave as before.
- [ ] Right column: order summary shows base price, subtotal, deposit due today, remaining balance later (when deposit method), and total. Labels match design constants (no hardcoded strings).
- [ ] Booking timeline block shows only the static sentence (no dates/countdown) when server does not provide timeline.
- [ ] Reassurance box shows "Secure Your Seat with a 20% Deposit" and body copy; below it, manual balance message: "We will never charge your card automatically..."
- [ ] Primary CTA: deposit method shows "Pay Deposit", full payment shows "Complete Booking". Click triggers same flow as before (create booking → Stripe checkout); no change to payment amount or redirect.
- [ ] Deposit and full payment paths both complete without error; redirect to Stripe and return to confirmation unchanged.
- [ ] Mobile: layout stacks; button min-height and focus visible.

### 3.2 My Bookings / Upcoming

- [ ] Authenticated user sees list from GET `/api/bookings`. Each card shows StatusBanner with correct label (e.g. raw pending → "Pending", confirmed → "Confirmed", cancelled → "Cancelled", completed → "Completed").
- [ ] One primary CTA per card: "View Booking Details" (links to tour detail). Secondary: Cancel (where allowed), Write Review (completed).
- [ ] No countdown or "Balance due in X" (server does not send timeline/countdown).
- [ ] Cancel still works when allowed; 24h message shown when cancel is disabled. No change to PUT cancel API.
- [ ] Copy uses COPY.myTour; no hardcoded status or CTA strings.
- [ ] Tabular numerics for dates/prices; 44px min-height and focus on buttons.

### 3.3 Tour detail page

- [ ] Booking timeline on tour detail still works; when server has no timeline, client fallback is still used for detail page only (allowClientFallback default true).

### 3.4 Regression

- [ ] Sign-in required for my-tour; redirect to signin when unauthenticated.
- [ ] POST `/api/bookings` and POST `/api/stripe/checkout` behavior unchanged (amounts, bookingId, success/cancel URLs).
- [ ] No new client-side logic that derives payment deadlines or “balance due” state from dates; no countdown from client-computed targets.

---

## 4. Risk notes

- **Checkout:** High-traffic page; only presentational and copy changes. Payment and validation logic untouched.
- **My-tour:** Status is display-only mapping; when API is extended with spec status/timeline/primaryAction, adapters and UI can be wired to use them without re-deriving on client.
- **BookingTimelineSection:** Default `allowClientFallback=true` keeps existing detail-page behavior; checkout and my-tour explicitly pass `allowClientFallback={false}`.

---

## 5. Files touched

| File | Change |
|------|--------|
| `src/design/copy.ts` | Checkout and order summary copy; timeline static copy. |
| `src/design/status.ts` | `rawBookingStatusToDisplayStatus` (display-only). |
| `components/tour/BookingTimelineSection.tsx` | `allowClientFallback` prop; static copy when false and no server timeline. |
| `app/tour/[id]/checkout/page.tsx` | Order summary structure, reassurance box, timeline (no fallback), trust copy, CTA from COPY. |
| `app/mypage/mybookings/page.tsx` | StatusBanner, display status map, single primary CTA, COPY. |
| `app/mypage/upcoming/page.tsx` | StatusBanner, display status map, single primary CTA, COPY. |

---

*Phase 3B implementation complete. Server-driven timeline/status only for checkout and my-tour; no client-derived deadlines or countdowns.*
