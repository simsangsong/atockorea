# Renovation QA Checklist

**Purpose:** Manual regression and quality checklist for the renovated app (Phases 1–5).

**Reference:** `docs/renovation/final-product-spec.md`, `.cursor/rules/03-design-system.md`, `.cursor/rules/02-do-not-break-logic.md`.

---

## 1. Accessibility

- [ ] **Focus states:** All interactive elements (buttons, links, inputs, selects) have visible focus (e.g. `focus:ring-2`, `focus:ring-offset-2`). Test with Tab key; no focus trap.
- [ ] **Button min height:** Primary and secondary CTAs meet min 44px height (touch target). Check: hero CTA, tour cards, checkout CTA, my-tour actions, footer/header links.
- [ ] **Status not by color alone:** StatusBanner and any status badges show text/label plus color. Screen reader gets label via `aria-label` or visible text. Test with color disabled or screen reader.
- [ ] **Contrast:** Text on background meets WCAG AA (e.g. gray-900 on white, white on brand blue). No low-contrast placeholder or disabled text for critical content.
- [ ] **Tabular numerics:** Times, prices, countdowns, seat counts use `tabular-nums` where alignment matters.
- [ ] **Landmarks/labels:** Hero has `aria-label` where needed; form sections have labels; status has `role="status"` and accessible name.

---

## 2. Analytics

- [ ] **Instrumentation:** Key events fire from `src/design/analytics.ts`: `hero_form_start`, `detail_viewed`, `checkout_started` (see `docs/renovation/analytics-events.md`). No raw hotel names or exact coordinates in payloads.
- [ ] **Sanitization:** `trackEvent` / analytics helpers strip `hotelName`, `hotelRaw`, `lat`, `lng`, `coordinates` from payloads.

---

## 3. Motion

- [ ] **Duration:** Animations use 150–220 ms range (e.g. `src/design/motion.ts`: fast 150, base 200, slow 220).
- [ ] **Easing:** `ease-out` (or Framer `easeOut`). No linear or flashy curves for UI feedback.
- [ ] **Scope:** Opacity and small scale only; no implied backend or loading behavior that doesn’t exist.

---

## 4. Copy & design system

- [ ] **Centralized copy:** No hardcoded UI strings in components for checkout, my-tour, hero, trust, status labels. Use `COPY.*` or i18n.
- [ ] **Status labels:** Raw API status maps to display via `rawBookingStatusToDisplayStatus`; ambiguous raw (e.g. `pending`) use neutral label ("Pending"), not "Deposit Paid".

---

## 5. Checkout & payment (no regressions)

- [ ] **Flow:** Redirect from `/checkout` or tour detail → `/tour/[id]/checkout` → form → POST `/api/bookings` → POST `/api/stripe/checkout` → Stripe redirect. No change to request bodies or success/cancel URLs.
- [ ] **Reassurance & trust:** Reassurance box and manual balance message visible; CTA label from COPY (Pay Deposit / Complete Booking).
- [ ] **Timeline:** Checkout shows only server timeline or static copy; no client-computed deadline/countdown.

---

## 6. My Tour (no regressions)

- [ ] **Status:** StatusBanner shows correct display label (Pending, Confirmed, Cancelled, Completed, Refunded). Single primary CTA per card ("View Booking Details"); Cancel/Write Review secondary.
- [ ] **No client-derived actions:** No "Pay Balance Now" or countdown unless server provides status/timeline.
- [ ] **Cancel:** PUT cancel and 24h rule unchanged; button disabled when within 24h.

---

## 7. Homepage & tour flows

- [ ] **Hero:** CTA "Plan My Trip" links to builder/join flow; focus and min-height OK.
- [ ] **Tour detail:** Booking timeline (server or client fallback for detail only), price, pickup info; no broken images or layout.
- [ ] **List/detail:** Filters and tour cards work; no broken links or missing data.

---

## 8. Backend & API (unchanged)

- [ ] **POST /api/bookings**, **POST /api/stripe/checkout:** Request/response and execution unchanged.
- [ ] **GET /api/bookings**, **GET /api/bookings/[id]:** Existing fields and auth unchanged.
- [ ] **PUT /api/bookings/[id]:** Cancel logic unchanged.
- [ ] **Auth:** Supabase session, redirect to signin, Authorization header unchanged.

---

*Use this checklist for pre-release and post-renovation regression runs.*
