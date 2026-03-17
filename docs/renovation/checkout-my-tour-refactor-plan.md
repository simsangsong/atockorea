# Checkout & My Tour Refactor Plan (Phase 3B)

**Purpose:** Plan the checkout and my-tour refactor before writing code. No implementation in this step.

**Source of truth:** `docs/renovation/final-product-spec.md` §7.6 (Checkout), §7.8 (My Tour), §3 (Booking/Payment rules), `docs/renovation/migration-plan.md` §2.2 (Checkout, My Tour), `.cursor/rules/*`.

**Critical constraint (Phase 3B):** Do **not** reuse any client-side timeline fallback as authoritative booking or payment deadline logic in checkout or my-tour. Use **server-provided timeline/status only** for actionable states, deadlines, countdowns, and payment messaging.

---

## 1. Checkout layout

**Current:**  
- **Entry:** `app/checkout/page.tsx` — client-only redirect: reads `tourSlug`/`tourId` + date + guests from query or sessionStorage, fetches `/api/tours/[idOrSlug]`, builds `bookingData`, stores in sessionStorage, redirects to `/tour/[id]/checkout`.  
- **Main checkout:** `app/tour/[id]/checkout/page.tsx` — two-column layout: left = customer form (name, phone, email, preferredChatApp, chatAppContact); right = sticky order summary + single payment button. No reassurance box, no booking timeline block. Data from `sessionStorage.bookingData`.

**Target (spec §7.6):**  
- **Left column:** traveler info, contact info, hotel/pickup area confirmation (if applicable), payment method (deposit vs full).  
- **Right column:** sticky order summary, **booking timeline** (server-provided only), **reassurance box**, single primary CTA.  
- Layout remains responsive (stacked on small screens); header/footer/bottom nav unchanged.

**Decisions:**  
- Keep `/checkout` as redirect-only; all UI changes on `/tour/[id]/checkout`.  
- Booking timeline on checkout must be driven by **server-provided** timeline only (e.g. from GET `/api/tours/[id]` with `bookingTimeline`, or from a new server endpoint that returns timeline for the selected date). No `buildBookingTimelineViewModelClientFallback` or any client-computed deadline used for messaging or countdowns on checkout.  
- If server does not yet return timeline for the selected date, show a neutral line such as “Deposit refundable until 24h before departure; balance due 18h before” (copy only, no client-computed dates).

---

## 2. Reassurance box placement

**Placement:** In the right column of checkout, **above** the primary CTA and **below** the order summary (and below the booking timeline if present). Sticky column so the box scrolls with the summary and CTA.

**Content (spec):**  
- **Title:** “Secure Your Seat with a 20% Deposit”  
- **Body:** “Pay a small deposit today to reserve your spot. No automatic balance charge. Free cancellation until 24 hours before departure.”  
- Copy must come from design constants (e.g. `src/design/copy.ts` or i18n); no hardcoded strings in the component.

**Additional trust copy:** Near the CTA (below or inside reassurance): “We will never charge your card automatically for the remaining balance. You need to complete it manually in My Tours.”

---

## 3. Booking timeline placement

**Checkout:**  
- Right column, between order summary and reassurance box.  
- **Source:** Server-only. Options: (a) Pass timeline from tour detail fetch (e.g. GET `/api/tours/[id]` with `bookingTimeline` for the selected date), or (b) New server endpoint that accepts tourId + date and returns timeline.  
- **Do not:** Use `BookingTimelineSection` with only `selectedDateForFallback` (client fallback) for any actionable or deadline messaging on checkout. If server timeline is missing, show only static copy (no countdown or client-computed dates).  
- Reuse `src/components/ui/timeline.tsx` (or `BookingTimeline` from it) for **display only** when server provides timeline; do not derive refund/balance dates on the client for this page.

**My-tour:**  
- Timeline/status and countdowns come only from server (see §5–6). No reuse of client-side timeline fallback for deadlines or payment messaging.

---

## 4. Order summary structure

**Current:**  
- Tour date, guests, payment method (deposit/full).  
- If deposit: deposit amount, “Pay on site” balance.  
- Total (deposit or full).  
- No explicit base price, surcharge, or subtotal breakdown.

**Target (spec):**  
- Base tour price  
- Pickup surcharge as separate line item (if applicable)  
- Subtotal  
- Deposit due today  
- Remaining balance later (when deposit method)  
- Final surcharge label if known  
- Total (deposit amount or full price for CTA)

**Preserve:** All amounts and payment method already come from `bookingData` (and tour fetch). Only add presentational lines and labels; do not change how deposit/balance/total are computed or sent to POST `/api/bookings` or POST `/api/stripe/checkout`.

---

## 5. My Tour status banner structure

**Current:**  
- `mypage/dashboard`, `mypage/mybookings`, `mypage/upcoming` use raw GET `/api/bookings` response.  
- Status shown as pending / confirmed / completed / cancelled (client-side labels/colors). No spec-style status banner (e.g. “Awaiting Balance Payment”, “Balance Due”, “Confirmed”).  
- No `StatusBanner` from `src/components/ui/status-banner.tsx`; no `bookingStatusConfig` (design/status) for my-tour cards.

**Target:**  
- Each tour card (or detail block) shows a **status banner** driven by **server-provided** status.  
- Status set: deposit_paid, awaiting_balance, balance_due, confirmed, cancelled, refunded, deadline_missed (spec §7.8).  
- Labels from `src/design/status.ts` (`bookingStatusConfig` / COPY.myTour.status.*).  
- **Do not** derive booking status or “balance due” state from client-side date math (e.g. “24h before”) for banner or primary CTA. Server must provide status (and optionally timeline) for each booking; UI only renders.  
- If current API returns only pending/confirmed/completed/cancelled, the plan assumes either (a) extending GET `/api/bookings` (or per-booking endpoint) to return a mapped status/timeline, or (b) adding a server layer that maps DB status + payment/tour dates to spec status and timeline; adapter `adaptMyTourResponse` already defines the target shape (`MyTourResponse`).

---

## 6. Countdown behavior

**Rule:** Countdowns (e.g. “Balance due in X”) are **server-driven** only. Use `CountdownLabel` with `targetAt` from server (e.g. `timeline.balanceDueAt` or `tour.countdownTarget` from MyTourViewModel).  
- **Do not** compute “balance due in 18h” or “refund until 24h” on the client for my-tour or checkout.  
- If server does not provide a countdown target, do not show a countdown (show static text only, e.g. “Balance due 18h before departure”).  
- Existing `src/components/ui/countdown-label.tsx` is correct: it takes `targetAt` (ISO string); ensure callers pass only server-provided values in Phase 3B.

---

## 7. Single primary CTA logic

**Checkout:**  
- One primary CTA: “Reserve My Spot” or “Pay Deposit” (deposit method) / “Complete Booking” (full payment). Copy from design constants.  
- CTA triggers existing flow: validate form → POST `/api/bookings` → POST `/api/stripe/checkout` → redirect to Stripe. No new actions.

**My-tour (per card/state):**  
- **One** primary CTA per booking state (spec §7.8). Examples:  
  - Pay Balance Now  
  - View Booking Details  
  - View Pickup Information  
  - Rebook Another Tour  
- Which CTA is primary is determined by **server-provided** status (and optionally `primaryActionLabel` / `primaryActionHref` from MyTourViewModel). Do not derive “show Pay Balance” from client-computed “balance window open”; use server status/actions only.  
- Secondary actions (e.g. Cancel, Write Review) can remain but must not replace the single primary CTA for the state.

---

## 8. Existing payment/auth logic to preserve

**Do not change:**  
- **POST /api/bookings** — request/response contract, validation, Supabase insert, return of `booking.id`.  
- **POST /api/stripe/checkout** — body (amount, currency, bookingId, bookingData), session creation, redirect URL, success/cancel URLs.  
- **Stripe webhook** — payment confirmation, booking/payment_status updates.  
- **Auth:** Supabase session, `getSession()`, auth header on API calls, redirect to signin when unauthenticated.  
- **Checkout flow:** Create booking first, then Stripe checkout with bookingId; store `bookingData` in sessionStorage for confirmation; redirect to Stripe then back to confirmation.  
- **Cancel:** PUT `/api/bookings/[id]` with `status: 'cancelled'`; keep server-side rules (e.g. 24h) on server; my-tour UI only shows/hides Cancel based on server-provided state if we add it, or keep current canCancel logic only for **display** of button availability while server still enforces rules.  
- **GET /api/bookings** and **GET /api/bookings/[id]** — response shape may be extended (e.g. add timeline/status) but existing fields and auth must remain.

**Allowed:**  
- Add or extend server responses (e.g. timeline, spec status) for consumption by checkout and my-tour.  
- Restyle pages, add reassurance box, order summary lines, status banner, countdown (with server target only), and single primary CTA.  
- Use adapter `adaptMyTourResponse` when API provides compatible payload; do not use client fallback for timeline/status.

---

## 9. Files to modify

| File | Change |
|------|--------|
| `app/checkout/page.tsx` | Optional: copy or layout tweak only; redirect and sessionStorage logic unchanged. |
| `app/tour/[id]/checkout/page.tsx` | Layout: add reassurance box, booking timeline block (server-only), order summary structure (base, surcharge, subtotal, deposit, balance). CTA copy from design. Do not use client timeline fallback for deadlines. |
| `app/mypage/dashboard/page.tsx` | Consume server-provided status/timeline when available; restyle; avoid client-computed “upcoming”/deadline for actionable messaging. |
| `app/mypage/mybookings/page.tsx` | Per-booking: status banner from server status; single primary CTA from server; countdown only from server `targetAt`. Replace or wrap raw status labels with `StatusBanner` + design status. |
| `app/mypage/upcoming/page.tsx` | Same as mybookings: server-driven status banner, primary CTA, countdown from server only. |
| `components/tour/BookingTimelineSection.tsx` | When used on **checkout** or **my-tour**: do not pass only `selectedDateForFallback`; require server timeline or show copy-only (no client fallback for authoritative deadlines). Option: add prop to disable fallback on checkout/my-tour. |
| `src/design/copy.ts` (or i18n) | Add checkout reassurance title/body, trust copy, CTA “Reserve My Spot” / “Pay Deposit”; my-tour labels if missing. |
| New or extended API | If needed: endpoint or extended GET response that returns timeline (and optionally spec status) for a tour+date (checkout) or per booking (my-tour). Document in this plan; implement in Phase 3B implementation step. |

**Optional / existing primitives:**  
- `src/components/ui/status-banner.tsx` — use for my-tour status; already server-status driven.  
- `src/components/ui/countdown-label.tsx` — use with server `targetAt` only.  
- `src/components/ui/timeline.tsx` — use for checkout timeline display when server provides data.

---

## 10. Risk level per file

| File / area | Risk | Mitigation |
|-------------|------|------------|
| `app/checkout/page.tsx` | Low | Only copy or minor layout; redirect and fetch unchanged. |
| `app/tour/[id]/checkout/page.tsx` | **High** | Core payment flow and form. Add only presentational blocks (reassurance, timeline when server provides, order summary lines). Do not change validation, POST bookings, POST stripe/checkout, or redirect. Test deposit and full payment paths. |
| `app/mypage/dashboard/page.tsx` | Medium | Data from GET /api/bookings; if we add server status/timeline, ensure backward compatibility. Avoid client-computed deadlines for actions. |
| `app/mypage/mybookings/page.tsx` | **High** | Cancel and navigation; many CTAs today. Move to single primary CTA per state and server-driven status/countdown. Keep PUT cancel and link targets; ensure cancel still enforced by server. |
| `app/mypage/upcoming/page.tsx` | Medium | Same as mybookings for status/CTA; cancel flow shared. |
| `components/tour/BookingTimelineSection.tsx` | Medium | Disable or avoid client fallback when used on checkout/my-tour; require server timeline or copy-only. |
| New/updated API for timeline or status | Medium | Additive response fields or new route; preserve existing GET contracts and auth. |
| `src/design/copy.ts` / i18n | Low | Additive keys; use in new components only. |

---

## 11. What will not be touched

- **POST /api/bookings** and **POST /api/stripe/checkout** — request/response and execution.  
- **Stripe webhook** and payment_status/booking status updates.  
- **Auth:** Supabase client, getSession, redirect to signin, Authorization header.  
- **PUT /api/bookings/[id]** — cancel and validation logic.  
- **GET /api/bookings** and **GET /api/bookings/[id]** — existing fields and auth; only additive changes for timeline/status if any.  
- **Tour detail page** (`app/tour/[id]/page.tsx`) — booking timeline there can keep current behavior (server + optional client fallback for **detail only**); Phase 3B rule applies to **checkout and my-tour** only.  
- **Confirmation page** (`app/tour/[id]/confirmation/page.tsx`) — no change unless explicitly scoped later.  
- **Header, Footer, BottomNav** — no change in this refactor.  
- **Builder flow** (custom-join-tour), **list/detail** (tours list, tour detail), **auth pages** (signin, signup) — out of scope for Phase 3B.  
- **Adapter implementations** — `booking-adapter.ts` and `tours-adapter.ts` may be **used** as-is or extended; do not remove or break existing adapters; do not use client timeline fallback **in checkout or my-tour** for authoritative deadlines or payment messaging.

---

*This document is planning only. No code changes are made in this step. Phase 3B implementation will follow this plan with server-provided timeline/status only for checkout and my-tour.*
