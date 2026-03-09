# Final Repository Audit — Post-Refactor

**Date:** 2026-03-09  
**Scope:** Verification of all refactors (dead code, deduplication, stability, typing, security, maintainability) and identification of remaining risks.  
**No code changes in this audit.**

---

## 1. Refactor Verification Summary

### 1.1 Dead code removal — **Safe**

- **Removed:** `lib/performance.ts` (debounce, throttle, preloadResource, prefetchRoute), `components/tour/Breadcrumb.tsx`, `QuickFacts.tsx`, `ImageGallery.tsx`, `TourTabs.tsx`, `TrustIndicators.tsx`, `components/optimized/LazyImage.tsx`.
- **Verification:** No remaining imports or references to these files in the codebase.
- **Conclusion:** Dead code was removed safely; no broken references.

### 1.2 Duplicated logic reduced — **Improved**

- **Booking status:** `ACTIVE_BOOKING_STATUSES` from `lib/constants/booking-status.ts` is used in 5 places: `app/api/bookings/route.ts`, `app/api/tours/[id]/availability/route.ts`, `app/api/tours/[id]/availability/range/route.ts`, `app/api/admin/merchants/[id]/route.ts`. Same values (`['pending', 'confirmed']`); single source of truth.
- **PayPal API:** `getPayPalAccessToken` and `getPayPalApiBaseUrl` from `lib/paypal.ts` used in `create-order`, `capture-order`, and `webhooks/paypal` — no duplicated token/base logic.
- **Validation:** `getMissingRequiredFields` from `lib/validation.ts` used in `app/api/bookings/route.ts` for POST body validation.
- **Reminder email:** `buildReminderEmailHtml` in `lib/email-templates/reminder.ts`; `lib/email.ts` calls it — template separated from send logic; same output.
- **Status badge:** `BookingStatusBadge` in `components/admin/BookingStatusBadge.tsx` used in `app/admin/orders/page.tsx` and `app/admin/page.tsx` — one component for status colors and default Korean labels.
- **Conclusion:** Duplication reduced without behavior change (admin dashboard pending badge color unified to yellow).

### 1.3 Stability — **Improved**

- **Booking cancellation:** `app/api/bookings/[id]/route.ts` — `booking_date` guarded before `.split('T')`; inventory restore only when date string is valid; `final_price` guarded for notification.
- **Confirmation page:** `app/tour/[id]/confirmation/page.tsx` — `isMountedRef` prevents state update/redirect after unmount; `res.ok` checked before `res.json()`; `fetchError` state and "Back to tour" link on fetch failure when no sessionStorage.
- **Webhooks/emails:** Stripe/PayPal/Resend paths use optional chaining and guarded `final_price` / tour title / profile; reminders use `TourRelation`, `UserProfileRelation`, `PickupPointRelation` with null-safe access.
- **Conclusion:** Null guards and lifecycle handling added; no business-logic changes to reservation status or payment transitions.

### 1.4 Typing — **Improved**

- **Shared relation types:** `lib/db-relations.ts` defines `TourRelation`, `UserProfileRelation`, `PickupPointRelation`; used in `bookings/[id]`, `paypal/capture-order`, `webhooks/paypal`, `emails/reminders` (and reminders route) — fewer `as any` casts.
- **Error handling:** Multiple API routes use `catch (error: unknown)` and `error instanceof Error ? error.message : String(error)` (e.g. `bookings/[id]`, `paypal/capture-order`, `webhooks/paypal`, `emails/reminders`).
- **Error-handler module:** `lib/error-handler.ts` — `details` and response `data` typed as `unknown` where appropriate.
- **Conclusion:** Safer typing in critical paths; no over-engineered types.

### 1.5 Security — **Improved**

- **OAuth callback:** `app/auth/callback/page.tsx` — `next` restricted to same-origin path: must be string, start with `/`, no `:`, length ≤ 500; otherwise defaults to `/mypage`. Open redirect mitigated.
- **PayPal webhook:** Payment events (`PAYMENT.*`) require full credentials and signature verification; if credentials incomplete, returns 503 and does not process.
- **Resend webhook:** Requires `RESEND_WEBHOOK_SECRET`; returns 503 when unset; GET returns 405.
- **Admin contacts:** `app/api/admin/contacts/route.ts` — search param sanitized: `String(search).slice(0, 200).replace(/'/g, "''")` before use in `.or(ilike...)`.
- **Conclusion:** Low-risk hardening applied; critical payment-amount and Paddle webhook issues unchanged (intentionally).

### 1.6 Maintainability — **Improved**

- **New modules:** `lib/constants/booking-status.ts`, `lib/email-templates/reminder.ts`, `lib/paypal.ts`, `lib/validation.ts`, `lib/db-relations.ts`, `components/admin/BookingStatusBadge.tsx`.
- **Large files:** Only `lib/email.ts` was reduced (reminder template extracted). No splitting of `admin/products/page.tsx`, `jeju/[slug]/page.tsx`, or `EnhancedBookingSidebar` (higher-risk).
- **Conclusion:** Incremental improvements; no big-bang restructuring.

---

## 2. New Risks Introduced

- **None identified.** All changes preserve behavior except:
  - Admin dashboard: pending status badge color changed from amber to yellow (visual only; aligns with orders page).
  - Reminder email: same HTML produced via `buildReminderEmailHtml`; `sendBookingReminderEmail` signature and call sites unchanged.

---

## 3. Remaining High-Risk Areas

These were **not** changed by the refactors and still require human review and/or fixes.

### 3.1 Critical

| Area | Location | Issue |
|------|----------|--------|
| **Client-controlled payment amount** | `app/api/bookings/route.ts`, `app/api/stripe/checkout/route.ts`, `app/api/paypal/create-order/route.ts`, `app/api/paddle/checkout/route.ts` | Server stores and charges client-supplied `final_price`/`amount`. Attacker can set minimal price and complete checkout. |
| **IDOR: GET booking by ID** | `app/api/bookings/[id]/route.ts` (GET) | No auth; any client can fetch any booking by ID and receive full PII/booking data. |
| **Unauthenticated inventory writes** | `app/api/inventory/route.ts`, `app/api/inventory/[id]/route.ts` | POST/PUT have no auth; anyone can create/update product inventory. |
| **Unauthenticated promo-codes** | `app/api/promo-codes/route.ts` | GET returns all promo codes; POST creates promo code; no auth. |
| **Paddle webhook unverified** | `app/api/paddle/webhook/route.ts` | Signature not verified; forged webhooks could mark bookings as paid. |

### 3.2 High

| Area | Location | Issue |
|------|----------|--------|
| **Webhook idempotency** | `app/api/stripe/webhook/route.ts`, `app/api/webhooks/paypal/route.ts` | No check for “already paid” before update + confirmation email; retries can duplicate emails and DB writes. |
| **Inventory race** | `app/api/bookings/route.ts`, `app/api/bookings/[id]/route.ts`, `app/api/admin/orders/[id]/route.ts` | Read-modify-write on `available_spots` without atomicity; concurrent bookings can overbook. |

### 3.3 Medium (security / consistency)

| Area | Location | Issue |
|------|----------|--------|
| **Inconsistent API error handling** | Many API routes | Mix of `handleApiError`/`withErrorHandler` vs raw try/catch and ad-hoc JSON; possible detail leakage. |
| **Weak typing / any** | Various | Remaining `any` in admin contacts (`user: any`), some API responses, and other non-critical paths. |

---

## 4. Recommended Next Priorities

1. **Auth and payment (critical)**  
   - Add auth to `GET /api/bookings/[id]` and restrict to booking owner or admin/merchant with scope.  
   - Implement server-side computation of `final_price` and use it (and booking currency) in Stripe/PayPal/Paddle checkout instead of client-supplied amount.  
   - Add auth to inventory and promo-codes APIs (e.g. admin or merchant).

2. **Webhooks**  
   - Implement Paddle webhook signature verification.  
   - Add idempotency to Stripe and PayPal payment-completion handlers (check `payment_status === 'paid'` / payment_reference before update and email).

3. **Inventory**  
   - Introduce atomic updates or locking for `available_spots` (e.g. `set available_spots = available_spots - $1 where ... and available_spots >= $1`) and test under concurrency.

4. **Maintainability (incremental)**  
   - Extract one more email template from `lib/email.ts`.  
   - Consider extracting a small presentational section from `app/admin/products/page.tsx` or `app/jeju/[slug]/page.tsx` without changing behavior.

---

## 5. Manual QA Scenarios (Browser)

- **Auth callback redirect:** Sign in via OAuth (e.g. Google/LINE), with `?next=/mypage` and with `?next=https://evil.com` — expect redirect to `/mypage` in both cases (evil.com not used).  
- **Confirmation page:** Complete a test booking to confirmation; confirm “Back to tour” appears if fetch fails (e.g. block `/api/bookings/:id` in DevTools).  
- **Confirmation page unmount:** From confirmation, navigate away before load finishes — no console errors or unexpected redirects.  
- **Admin orders / dashboard:** Orders list and dashboard show status badges (확정/대기/완료/취소) with correct colors; pending = yellow.  
- **Booking creation and availability:** Create a booking for a tour/date; confirm availability decreases and reminder/confirmation flows still work (if enabled).  
- **PayPal flow (sandbox):** Create booking, pay with PayPal; confirm webhook marks booking paid and confirmation email sent; repeat with invalid/missing webhook secret (if testable) — expect 503 for payment events when misconfigured.

---

## 6. Production Areas Needing Human Review

- **Environment:** Ensure `RESEND_WEBHOOK_SECRET`, `PAYPAL_WEBHOOK_ID`, `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET` are set if Resend/PayPal webhooks are used; Stripe webhook secret; Paddle keys if Paddle is used.  
- **Booking and payment:** Confirm business rules for who may GET a booking (owner, admin, merchant) and enforce in `GET /api/bookings/[id]`.  
- **Price and currency:** Confirm server-side price computation and that checkout uses only server-derived amounts and currency.  
- **RLS and DB:** Ensure Supabase RLS and policies align with API auth (e.g. no bypass via direct client).  
- **Rate limiting:** Confirm rate limits (e.g. login, create-merchant, API) are appropriate for production traffic.  
- **i18n and locales:** Confirm `SUPPORTED_LOCALES` and locale handling are consistent across middleware, API, and admin (no unintended behavior from multiple definitions).

---

## 7. Summary

Refactors (dead code removal, shared constants/helpers, one email template, one status component, null/lifecycle guards, typing and security hardening) were applied conservatively and verified. No new high-risk issues were introduced. Critical and high-risk items (IDOR, client-controlled payment amount, unauthenticated APIs, Paddle webhook, idempotency, inventory race) remain and should be addressed in the order above, with manual QA and production review as indicated.
