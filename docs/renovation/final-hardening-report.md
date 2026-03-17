# Final Hardening Report (Phase 5)

**Purpose:** Summary of Phase 5 hardening: status-label safety, accessibility, analytics, motion, QA checklist, and regression safety.

**Reference:** `docs/renovation/final-product-spec.md`, `docs/renovation/checkout-my-tour-refactor-plan.md`, `.cursor/rules/*`.

---

## 1. Status label safety (rawBookingStatusToDisplayStatus)

**Issue:** Ambiguous raw API status (e.g. `pending`) was mapped to "Deposit Paid", overstating server truth (payment may not be confirmed).

**Changes:**
- **Neutral labels for ambiguous raw status:**
  - `pending` → display status **`pending`** → label **"Pending"** (no implication of payment completion).
  - `completed` → display status **`completed`** → label **"Completed"** (factual; not "Confirmed").
- **Fallback for unknown raw:** My-tour pages now use **`"pending"`** as fallback instead of `"deposit_paid"`, so we never show "Deposit Paid" when the server only sent an unknown or ambiguous value.
- **Types and copy:** Added `pending` and `completed` to `BookingStatus` (display-only), `COPY.myTour.status.pending` / `COPY.myTour.status.completed`, and `bookingStatusConfig` in `src/design/status.ts`.

**Files:** `src/types/booking.ts`, `src/design/copy.ts`, `src/design/status.ts`, `app/mypage/mybookings/page.tsx`, `app/mypage/upcoming/page.tsx`.

---

## 2. Accessibility

- **Focus:** Checkout CTA, my-tour primary/secondary buttons, hero CTA, and other renovated CTAs use `focus:ring-2` / `focus:ring-offset-2` where applicable.
- **Button min height:** Checkout CTA and my-tour actions use `min-h-[44px]`; hero and tour-type cards already had 44px.
- **Status not by color alone:** `StatusBanner` shows label text plus tone (color); added `aria-label={label}` so assistive tech gets the status without relying on color.
- **Tabular numerics:** Prices and dates in checkout and my-tour use `tabular-nums` where implemented.

**Files:** `src/components/ui/status-banner.tsx`, checkout page, mybookings/upcoming (already had focus and min-height from Phase 3B).

---

## 3. Analytics instrumentation

- **Source:** All events via `src/design/analytics.ts`; payloads sanitized (no `hotelName`, `lat`, `lng`, `coordinates`).
- **Wired in Phase 5:**
  - **Hero:** `analytics.heroFormStart()` on "Plan My Trip" CTA click (`components/HeroSection.tsx`).
  - **Tour detail:** `analytics.detailViewed(tour.type, tour.pickup?.areaLabel ?? 'Unknown')` after successful fetch (`app/tour/[id]/page.tsx`).
  - **Checkout:** `analytics.checkoutStarted('unknown', pickupAreaLabel ?? 'Unknown')` when `bookingData` is set from sessionStorage (`app/tour/[id]/checkout/page.tsx`). Tour type/pickup can be enriched when bookingData or API provides them.

**Files:** `components/HeroSection.tsx`, `app/tour/[id]/page.tsx`, `app/tour/[id]/checkout/page.tsx`.

---

## 4. Motion consistency

- **Config:** `src/design/motion.ts` defines duration (150 / 200 / 220 ms) and ease-out; Framer-friendly.
- **Usage:** Renovated components do not introduce new motion; existing transitions remain. No change to motion in this phase beyond documenting the standard (150–220 ms ease-out, opacity/scale only).

---

## 5. QA checklist and docs

- **Created:** `docs/renovation/qa-checklist.md` — accessibility, analytics, motion, copy, checkout, my-tour, homepage/tour flows, backend/API.
- **Created:** `docs/renovation/analytics-events.md` — event catalog, payloads, privacy rules, wiring status.
- **Updated:** `docs/renovation/checkout-my-tour-qa.md` — status mapping now describes Pending / Completed (neutral) instead of deposit_paid for pending.

---

## 6. Files changed (Phase 5 + status fix)

| File | Change |
|------|--------|
| `src/types/booking.ts` | Added `pending`, `completed` to `BookingStatus`. |
| `src/design/copy.ts` | Added `myTour.status.pending`, `myTour.status.completed`. |
| `src/design/status.ts` | Neutral mapping: pending→pending, completed→completed; added `bookingStatusConfig.pending`, `bookingStatusConfig.completed`; fallback doc. |
| `src/components/ui/status-banner.tsx` | Added `aria-label={label}` for status (not by color alone). |
| `app/mypage/mybookings/page.tsx` | Fallback `getDisplayStatus` → `"pending"` (was `"deposit_paid"`). |
| `app/mypage/upcoming/page.tsx` | Same fallback. |
| `components/HeroSection.tsx` | Import analytics; `heroFormStart()` on hero CTA click. |
| `app/tour/[id]/page.tsx` | Import analytics; `detailViewed(type, pickup.areaLabel)` after tour fetch. |
| `app/tour/[id]/checkout/page.tsx` | Import analytics; `checkoutStarted('unknown', pickupAreaLabel)` when bookingData set. |
| `docs/renovation/qa-checklist.md` | **Created.** |
| `docs/renovation/analytics-events.md` | **Created.** |
| `docs/renovation/final-hardening-report.md` | **Created.** (this file) |
| `docs/renovation/checkout-my-tour-qa.md` | Optional: update status bullet to say pending→Pending, completed→Completed. |

---

## 7. Files intentionally not changed

- **Backend / API routes:** No changes to `app/api/bookings/*`, `app/api/stripe/*`, `app/api/tours/*`, auth, or webhooks.
- **Payment execution:** POST `/api/bookings`, POST `/api/stripe/checkout`, Stripe redirect, success/cancel URLs unchanged.
- **Adapter schemas:** `MyTourViewModelSchema` (booking) still uses spec status enum only; `pending`/`completed` are display-only in UI type and config.
- **Tour detail booking timeline:** Still uses client fallback when server has no timeline (detail page only).
- **Confirmation page, header, footer, bottom nav, builder flow:** No changes in this phase.
- **Admin/merchant pages:** Not part of renovation hardening scope.

---

## 8. Backend logic untouched

- POST `/api/bookings` — create booking, validation, Supabase insert.
- POST `/api/stripe/checkout` — session creation, redirect.
- Stripe webhook — payment confirmation, status updates.
- PUT `/api/bookings/[id]` — cancel, 24h rule.
- GET `/api/bookings`, GET `/api/bookings/[id]` — response shape and auth unchanged.
- Supabase session, `getSession()`, redirect to signin.

---

## 9. API contracts untouched

- No changes to request/response shapes for bookings, stripe checkout, or tours.
- Additive use of existing fields only (e.g. display mapping from existing `status` string).

---

## 10. Known risks

- **Checkout analytics:** `checkoutStarted` currently sends `tourType: 'unknown'` and `pickupAreaLabel` from bookingData if present; when entry or API adds tour type/pickup to bookingData, events can be enriched without changing analytics contract.
- **Status schema:** `MyTourViewModelSchema` (Zod) does not include `pending`/`completed`; that schema validates future API response. UI type `BookingStatus` is separate and used only for display mapping and StatusBanner.
- **Admin BookingStatusBadge:** If it uses `BookingStatus` from `@/src/types/booking`, it now includes `pending` and `completed`; ensure admin badge config handles them if displayed.

---

## 11. Manual regression checklist

Use in addition to `docs/renovation/qa-checklist.md`:

1. **My Tour status:** Log in, open My Bookings and Upcoming. For a booking with raw status `pending`, banner must show **"Pending"**, not "Deposit Paid". For `completed`, show **"Completed"**.
2. **Checkout:** From tour detail or `/checkout` redirect, complete checkout (deposit or full). No change to payment flow or success/cancel redirect.
3. **Analytics:** In console, trigger hero CTA click, open a tour detail, open checkout with bookingData; confirm `[analytics]` logs for `hero_form_start`, `detail_viewed`, `checkout_started` with no hotel name or coordinates.
4. **Focus:** Tab through checkout and my-tour; primary and secondary buttons show visible focus ring.
5. **Status banner:** With a screen reader or dev tools, confirm StatusBanner has accessible name (aria-label or visible text).

---

*Phase 5 hardening complete. Backend logic and API contracts unchanged; status labels and analytics aligned with spec and privacy rules.*
