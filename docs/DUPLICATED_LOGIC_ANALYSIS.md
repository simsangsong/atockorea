# Duplicated Logic Analysis

**Date:** 2026-03-09  
**Scope:** Duplicated UI, utilities, API code, validation, formatting, error handling, DB patterns, loading/empty/error states.  
**No refactoring applied** — analysis and recommendations only.

---

## 1. Duplicated Patterns Found

### 1.1 API route: Bearer token parsing + `supabase.auth.getUser(token)` (auth/session)

**Pattern:** In many API routes, the same 6–8 lines repeat: read `Authorization` header, check `Bearer `, substring token, call `supabase.auth.getUser(token)`, assign `userId` if success. These routes do **not** use `getAuthUser(req)` from `lib/auth.ts`, so they also skip **cookie-based session** (only Bearer is honored).

**Files involved:**
- `app/api/bookings/route.ts` (POST)
- `app/api/bookings/[id]/route.ts` (PUT, DELETE)
- `app/api/cart/[id]/route.ts` (PUT, DELETE)
- `app/api/settlements/route.ts` (GET, POST)
- `app/api/reviews/route.ts` (POST)
- `app/api/reviews/reports/route.ts` (GET, POST)
- `app/api/reviews/reports/[id]/route.ts` (PATCH)
- `app/api/reviews/reactions/route.ts` (POST, DELETE)
- `app/api/auth/update-profile/route.ts` (uses token from body, not header)

**Proposed shared abstraction:** Use existing `getAuthUser(req)` from `lib/auth.ts` in all of these handlers. Return 401 when `getAuthUser(req)` is null; otherwise use `user.id` (and optionally `user.role` / `user.merchantId`).

**Risk level:** **Medium.** Behavior change: routes would start accepting **cookie-based** auth in addition to Bearer. That is the intended design of `getAuthUser` and improves web clients; any Bearer-only client continues to work. Risk is in edge cases (e.g. cookie vs Bearer precedence, or legacy clients that send both).

**Safe to refactor without changing behavior?** **Yes, if** you accept that “behavior” includes “cookie auth is now valid.” No change to reservation status, payment state, or webhook logic. **Manual review:** Run through sign-in flows (browser cookie and API Bearer) and one protected route per area (bookings, cart, reviews, settlements).

---

### 1.2 API route: try/catch + `console.error` + `NextResponse.json({ error: ... }, { status: 500 })`

**Pattern:** Many handlers use the same catch shape: `catch (error: any) { console.error('...', error); return NextResponse.json({ error: '...', details: error.message }, { status: 500 }); }`. Response shape and status codes vary slightly; some routes never use `handleApiError` or `withErrorHandler`.

**Files involved:** Most of `app/api/**/*.ts` (e.g. wishlist, user-settings, notifications, inventory, cart, reviews, settlements, promo-codes, contact, stripe/webhook, paypal/capture-order, paddle/webhook, admin/merchants, admin/upload, auth/merchant/login, logs/error, currency/rate, webhooks/resend, etc.). Exceptions: routes that already use `handleApiError` or `withErrorHandler` (e.g. tours, bookings, admin/tours, admin/settings).

**Proposed shared abstraction:** Wrap handlers with `withErrorHandler(handler)` from `lib/error-handler.ts`, or in the catch block call `return handleApiError(error, req)`. Optionally replace ad-hoc messages with `ErrorResponses.internalError()` for consistency.

**Risk level:** **Low.** Standardizes status codes and response shape; can reduce accidental leakage of `error.message` in production. No change to business logic.

**Safe to refactor without changing behavior?** **Yes.** Use the same status codes and message semantics as today where possible (e.g. 500 for unexpected errors, 401/403 from existing checks). Avoid changing error messages that clients parse.

---

### 1.3 Page layout: Header + Footer + BottomNav on every page

**Pattern:** Many pages import and render the same trio: `<Header />`, `<Footer />`, `<BottomNav />`, often with the same wrapper structure.

**Files involved:** e.g. `app/page.tsx`, `app/[locale]/page.tsx`, `app/about/page.tsx`, `app/cart/page.tsx`, `app/signin/page.tsx`, `app/signup/page.tsx`, `app/tours/page.tsx`, `app/tour/[id]/page.tsx`, `app/tour/[id]/checkout/page.tsx`, `app/tour/[id]/confirmation/page.tsx`, `app/forgot-id/page.tsx`, `app/support/page.tsx`, `app/legal/page.tsx`, `app/refund-policy/page.tsx`, `app/mypage/layout.tsx`, `app/admin/emails/page.tsx`, `app/dsa/page.tsx`, etc.

**Proposed shared abstraction:** A shared layout component (e.g. `components/layout/PageLayout.tsx`) that renders Header, main content slot, Footer, BottomNav; or move this into a single `app/(main)/layout.tsx` and put these routes under that group so they don’t each import the three components.

**Risk level:** **Low.** Purely structural; no auth or payment logic. Some pages may need to opt out (e.g. full-screen or minimal layout).

**Safe to refactor without changing behavior?** **Yes**, as long as the same components render in the same order and no page relies on a different layout structure.

---

### 1.4 Client: loading state (useState + setLoading(true/false) + conditional “Loading…” UI)

**Pattern:** Pages use `const [loading, setLoading] = useState(true)` (or `false`), set it around fetch, and render something like `{loading ? <p className="text-gray-600">Loading...</p> : <Content />}`. Copy and styling vary (“Loading…”, “Loading order details…”, “Loading tours…”, etc.).

**Files involved:** e.g. `app/admin/orders/page.tsx`, `app/admin/orders/[id]/page.tsx`, `app/admin/contacts/page.tsx`, `app/admin/emails/page.tsx`, `app/admin/merchants/page.tsx`, `app/admin/merchants/[id]/page.tsx`, `app/admin/products/page.tsx`, `app/admin/settings/page.tsx`, `app/admin/analytics/page.tsx`, `app/admin/page.tsx`, `app/mypage/dashboard/page.tsx`, `app/mypage/history/page.tsx`, `app/mypage/mybookings/page.tsx`, `app/mypage/reviews/page.tsx`, `app/mypage/reviews/write/page.tsx`, `app/mypage/upcoming/page.tsx`, `app/mypage/wishlist/page.tsx`, `app/cart/page.tsx`, `app/tours/page.tsx`, `app/tour/[id]/page.tsx`, `app/tour/[id]/checkout/page.tsx`, `app/tour/[id]/confirmation/page.tsx`, `app/jeju/[slug]/page.tsx`, `app/merchant/products/page.tsx`, `app/[locale]/page.tsx`, `app/auth/callback/page.tsx`, `app/admin/layout.tsx`, etc.

**Proposed shared abstraction:** (1) A small hook, e.g. `useAsyncData<T>(fetchFn)` that returns `{ data, loading, error, refetch }` and sets loading true/false around the request. (2) A single `LoadingSpinner` or `LoadingMessage` component used everywhere (and optionally i18n key like `common.loading`). (3) Optionally a shared “page with loading” wrapper that shows a skeleton or message when `loading`.

**Risk level:** **Low.** Only UI and loading state; no reservation or payment logic.

**Safe to refactor without changing behavior?** **Yes**, if the same loading conditions and UX (spinner vs text, placement) are preserved. Prefer a single i18n key for “Loading…” for multi-language consistency.

---

### 1.5 Client: empty state UI (“No … found”)

**Pattern:** After loading, many pages show an empty state with a short message and sometimes a CTA: “No bookings found”, “No tours found”, “No emails found”, “No merchants found”, “No contact inquiries found”, cart/wishlist empty messages (sometimes from `t('cart.empty')`).

**Files involved:** e.g. `app/mypage/mybookings/page.tsx`, `app/admin/products/page.tsx`, `app/admin/contacts/page.tsx`, `app/admin/emails/page.tsx`, `app/admin/merchants/page.tsx`, `app/admin/merchants/[id]/page.tsx`, `app/tours/page.tsx`, `app/cart/page.tsx`, `app/mypage/wishlist/page.tsx`, etc.

**Proposed shared abstraction:** A reusable `EmptyState` component: optional icon, title, description, and optional action button. Callers pass message (or i18n key) and optional action. Ensures consistent styling and accessibility.

**Risk level:** **Low.**

**Safe to refactor without changing behavior?** **Yes**, if messages and actions stay the same (use i18n where already used).

---

### 1.6 Price formatting (formatPrice)

**Pattern:** Several places implement “format price for display” locally: use `currencyCtx.formatPrice(price)` when context exists, otherwise fallback to `Intl.NumberFormat` for KRW (or `toLocaleString()`). Some pages use raw `toLocaleString()` or `toFixed(2)` for USD.

**Files involved:**
- `lib/currency.tsx` — provides `formatPrice` in context (canonical).
- `components/tours/DetailedTourCard.tsx` — local `formatPrice` using context or Intl.
- `app/tour/[id]/page.tsx` — local `formatPrice` (currencyCtx or ₩ + Intl).
- `components/tour/EnhancedBookingSidebar.tsx` — same pattern.
- `components/TourCard.tsx` — uses context `formatPrice`.
- `app/jeju/[slug]/page.tsx` — inline `Intl.NumberFormat` for KRW.
- `app/mypage/wishlist/page.tsx` — `price.toFixed(2)` for display.
- `app/admin/page.tsx` — `parseFloat(booking.final_price).toLocaleString()` for ₩.

**Proposed shared abstraction:** Use `useCurrency()` / `useCurrencyOptional()` and `formatPrice` from `lib/currency.tsx` everywhere. For server or non-React code (e.g. admin email templates), a small `formatPriceKRW(amount: number)` and optionally `formatPriceWithCurrency(amount, currency)` in `lib/format.ts` or `lib/currency.tsx` (exported pure helpers).

**Risk level:** **Low.** Display only; no payment or booking math.

**Safe to refactor without changing behavior?** **Yes**, if output format (symbol, decimals, grouping) is preserved and currency switching still works where applicable.

---

### 1.7 Date formatting (display and API date part)

**Pattern:** (1) **Display:** `formatDate(dateString)` or `new Date(x).toLocaleDateString(...)` repeated with different options (locale, options). (2) **API/DB:** `bookingDate.split('T')[0]` or `existing.booking_date?.toString().split('T')[0]` to get the date part.

**Files involved:**
- **Display:** `app/admin/contacts/page.tsx`, `app/admin/emails/page.tsx`, `app/admin/page.tsx`, `app/mypage/mybookings/page.tsx`, `app/mypage/upcoming/page.tsx`, `app/tour/[id]/confirmation/page.tsx`, `app/tour/[id]/checkout/page.tsx`, `app/admin/merchants/page.tsx`, `lib/email.ts` (toLocaleDateString('en-US', { ... })).
- **API/DB:** `app/api/bookings/route.ts`, `app/api/bookings/[id]/route.ts`, `app/api/admin/orders/[id]/route.ts`, `app/api/admin/stats/route.ts`.

**Proposed shared abstraction:** (1) **Client:** One `formatDisplayDate(date: string | Date, locale?: string)` in `lib/format.ts` or i18n helper, used by all pages. (2) **Server:** One `toDateOnly(isoOrDate: string | Date): string` (e.g. YYYY-MM-DD) used for booking_date, tour_date, and inventory. Ensures consistent timezone/format assumptions (e.g. server UTC vs local).

**Risk level:** **Low** for display. **Medium** for server date part: reservation and inventory logic depend on correct date; refactor must preserve “date of tour” vs “date of booking” semantics and timezone handling.

**Safe to refactor without changing behavior?** **Display: yes.** **Server date part: yes only if** the helper returns the same string as current `.split('T')[0]` (or equivalent) for all current inputs; verify booking_date, tour_date, and inventory queries unchanged.

---

### 1.8 Validation: “required fields” and 400 response

**Pattern:** Routes parse body, check a list of required keys, and return `NextResponse.json({ error: 'Missing required fields: X, Y' }, { status: 400 })` (or use `ErrorResponses.validationError`). The list of required fields and message text differ per route.

**Files involved:** `app/api/bookings/route.ts`, `app/api/contact/route.ts`, `app/api/admin/tours/route.ts`, `app/api/admin/merchants/create/route.ts`, `app/api/admin/merchants/route.ts`, `app/api/reviews/route.ts`, `app/api/notifications/route.ts`, `app/api/stripe/checkout/route.ts`, `app/api/paddle/checkout/route.ts`, etc.

**Proposed shared abstraction:** A small `requireFields(body: Record<string, unknown>, keys: string[]): { ok: true } | { ok: false; error: NextResponse }` (or throw a validation error that `handleApiError` turns into 400). Each route keeps its own list of keys; only the “check and return 400” logic is shared.

**Risk level:** **Low.** Same semantics: missing field → 400. No change to reservation or payment logic.

**Safe to refactor without changing behavior?** **Yes**, if error message and status code stay the same (or improve consistency).

---

### 1.9 API route: “fetch resource by id + check ownership (user_id)” then mutate

**Pattern:** Get user id (Bearer or getAuthUser); fetch row by id (e.g. booking, cart item); if not found return 404; if `row.user_id !== userId` return 403; then perform update/delete. Same structure in bookings/[id], cart/[id], and partially in reviews (booking ownership for posting a review).

**Files involved:** `app/api/bookings/[id]/route.ts`, `app/api/cart/[id]/route.ts`; conceptually similar in `app/api/reviews/route.ts` (user can only post review for own booking), `app/api/notifications/[id]/route.ts`, `app/api/user-settings/route.ts`, `app/api/wishlist/route.ts`.

**Proposed shared abstraction:** (1) Use `getAuthUser(req)` consistently (see 1.1). (2) Optional helper: `assertResourceOwner(supabase, table, id, userId, options?)` that does select by id, checks user_id (or custom column), returns 404/403 or the row. Use only for simple “single owner” resources to avoid over-abstraction. **Do not** share the actual mutation (booking status, payment_status, etc.) — that stays in each handler for clarity and safety.

**Risk level:** **Medium.** Centralizing ownership checks can reduce IDOR risk if done correctly, but a bug in the helper would affect multiple routes. Keep mutation logic in each route.

**Safe to refactor without changing behavior?** **Yes**, if the helper exactly encodes current “fetch by id, check user_id, return 404/403” behavior and each route keeps its own update/delete logic. **Manual review:** All routes that currently check ownership.

---

### 1.10 Payment success: booking update + confirmation email

**Pattern:** After payment success (Stripe webhook, PayPal capture, PayPal webhook), the app (1) updates `bookings` with `payment_status: 'paid'`, `status: 'confirmed'`, payment method and reference, (2) fetches booking with tours + user_profiles (and optionally pickup_points), (3) resolves customer email/name from session or metadata or user_profiles or special_requests, (4) optionally fetches pickup point name, (5) calls `sendBookingConfirmationEmail(...)`. The exact fields and order vary slightly; idempotency (e.g. “already paid”) is handled in some paths but worth standardizing.

**Files involved:**
- `app/api/stripe/webhook/route.ts` (checkout.session.completed)
- `app/api/paypal/capture-order/route.ts`
- `app/api/webhooks/paypal/route.ts` (PAYMENT.CAPTURE.COMPLETED)
- `app/api/bookings/[id]/route.ts` (when status is set to confirmed and payment is paid — sends confirmation email)

**Proposed shared abstraction:** **Do not** merge webhook handlers. Keep Stripe vs PayPal vs booking-update flows separate. You can introduce a **server-only** helper, e.g. `markBookingPaidAndSendConfirmation(supabase, bookingId, { paymentMethod, paymentReference, customerEmail?, customerName? })` that: (1) updates booking to paid/confirmed (with guard: if already paid, skip update and optionally skip email), (2) loads booking + tours + user_profiles + pickup_points, (3) resolves email/name from args or profile or special_requests, (4) calls `sendBookingConfirmationEmail`. Each caller (Stripe webhook, PayPal capture, PayPal webhook, bookings/[id] PUT) still does its own auth and event validation, then calls this helper. Reduces duplicated “load booking, resolve email, send email” and makes idempotency (e.g. “already paid”) one place.

**Risk level:** **High.** Touches payment state, reservation status, and webhook idempotency. Any bug can cause double emails, wrong status, or missed confirmations.

**Safe to refactor without changing behavior?** **Only with strict manual review.** Ensure: (1) idempotency rules are the same (e.g. already paid → no second email or no overwrite of payment_reference), (2) customer email/name resolution order matches current behavior in each caller, (3) partial failure (e.g. email fails after DB update) is handled the same way (log and don’t roll back DB). Prefer extracting only the “load + resolve email + send email” into a helper and leaving “when to call it” and “how to update paid/confirmed” in each route.

---

### 1.11 Client: API fetch with Bearer token from session

**Pattern:** Client code gets `session.access_token` (or similar) and calls `fetch(url, { headers: { 'Authorization': `Bearer ${session.access_token}` }, credentials: 'include' })`. Repeated in admin, mypage, and auth flows.

**Files involved:** Many pages under `app/admin/*`, `app/mypage/*`, `app/auth/*`, `app/tour/[id]/checkout/page.tsx`, etc.

**Proposed shared abstraction:** A small `apiFetch(path, options?)` (or use existing `apiClient` in `lib/api-client.ts` if adopted) that reads token from the same place (e.g. cookie or a shared auth context) and adds `Authorization: Bearer ...` and `credentials: 'include'`. Reduces copy-paste and ensures consistent auth and error handling.

**Risk level:** **Low.** Same requests, same tokens; only centralization.

**Safe to refactor without changing behavior?** **Yes**, if the token source and headers are unchanged. **Note:** `lib/api-client.ts` is currently unused; adopting it would be the natural place for this.

---

### 1.12 PayPal access token (getAccessToken / getPayPalAccessToken)

**Pattern:** Two places implement “get PayPal OAuth2 client_credentials token”: same endpoint, same Basic auth, same body. One is in `app/api/paypal/capture-order/route.ts` (`getAccessToken`), the other in `app/api/webhooks/paypal/route.ts` (inline or similar). `app/api/paypal/create-order/route.ts` may also need a token.

**Files involved:** `app/api/paypal/capture-order/route.ts`, `app/api/webhooks/paypal/route.ts`, and possibly `app/api/paypal/create-order/route.ts`.

**Proposed shared abstraction:** A single `getPayPalAccessToken(): Promise<string>` in `lib/paypal.ts` (or a small server-only module), using `PAYPAL_CLIENT_ID`, `PAYPAL_SECRET`, and `PAYPAL_MODE` from env. All PayPal API routes and webhook import it.

**Risk level:** **Low.** Same credentials and endpoint; no change to payment or webhook semantics.

**Safe to refactor without changing behavior?** **Yes.** Ensure env vars and error handling (e.g. 500 when token fails) stay the same.

---

## 2. Files Involved (Summary)

| Pattern | Primary files |
|--------|----------------|
| Bearer auth in API | bookings, bookings/[id], cart/[id], settlements, reviews, reviews/reports, reviews/reactions, auth/update-profile |
| Catch + 500 response | Most of app/api (wishlist, user-settings, notifications, inventory, cart, reviews, settlements, promo-codes, contact, stripe/webhook, paypal/capture-order, paddle/webhook, admin/*, auth/merchant/login, logs/error, currency/rate, webhooks/resend, etc.) |
| Header+Footer+BottomNav | app/page, [locale]/page, about, cart, signin, signup, tours, tour/[id], tour/[id]/checkout, tour/[id]/confirmation, forgot-id, support, legal, refund-policy, mypage/layout, admin/emails, dsa, etc. |
| Loading state UI | admin/*, mypage/*, cart, tours, tour/[id], tour/[id]/checkout, confirmation, jeju/[slug], merchant/products, [locale]/page, auth/callback |
| Empty state UI | mypage/mybookings, admin/products, admin/contacts, admin/emails, admin/merchants, tours, cart, mypage/wishlist |
| formatPrice | lib/currency, DetailedTourCard, tour/[id]/page, EnhancedBookingSidebar, TourCard, jeju/[slug], mypage/wishlist, admin/page |
| formatDate / date part | admin/contacts, admin/emails, admin/page, mypage/mybookings, mypage/upcoming, tour/confirmation, tour/checkout, admin/merchants, lib/email; api/bookings, api/bookings/[id], api/admin/orders/[id], api/admin/stats |
| Required-field validation | api/bookings, api/contact, api/admin/tours, api/admin/merchants, api/reviews, api/notifications, api/stripe/checkout, api/paddle/checkout |
| Ownership check then mutate | api/bookings/[id], api/cart/[id]; similar in api/reviews, api/notifications/[id], api/user-settings, api/wishlist |
| Payment success + email | api/stripe/webhook, api/paypal/capture-order, api/webhooks/paypal, api/bookings/[id] |
| Client API fetch + Bearer | admin/*, mypage/*, auth/*, tour/[id]/checkout |
| PayPal token | api/paypal/capture-order, api/webhooks/paypal, api/paypal/create-order |

---

## 3. Proposed Shared Abstractions (Summary)

| # | Abstraction | Location | Notes |
|---|-------------|----------|--------|
| 1.1 | Use existing `getAuthUser(req)` | lib/auth.ts | No new abstraction; adopt everywhere for API auth. |
| 1.2 | `withErrorHandler(handler)` / `handleApiError(error, req)` | lib/error-handler.ts | Already exist; use in all API routes. |
| 1.3 | `PageLayout` or route group layout | components/layout or app/(main)/layout.tsx | Header + Footer + BottomNav once. |
| 1.4 | `useAsyncData` (or similar) + `LoadingMessage` / i18n key | lib/hooks or components/ui | Centralize loading state and copy. |
| 1.5 | `EmptyState` component | components/ui | Icon + title + description + optional action. |
| 1.6 | Use `useCurrency().formatPrice`; optional server `formatPriceKRW` | lib/currency.tsx, optional lib/format.ts | One place for price display rules. |
| 1.7 | `formatDisplayDate`, `toDateOnly` | lib/format.ts or i18n | Client display and server date-part. |
| 1.8 | `requireFields(body, keys)` or equivalent | lib/validation.ts | Returns 400 response or throws. |
| 1.9 | Optional `assertResourceOwner(supabase, table, id, userId)` | lib/auth.ts or lib/db.ts | Only for simple ownership checks; keep mutations in routes. |
| 1.10 | Optional `markBookingPaidAndSendConfirmation` (narrow scope) | lib/booking-payment.ts (server-only) | Only “load + resolve email + send email”; callers keep update logic and idempotency. |
| 1.11 | `apiFetch(path, options)` or adopt `apiClient` | lib/api-client.ts | Add Bearer from session/cookie. |
| 1.12 | `getPayPalAccessToken()` | lib/paypal.ts | Single PayPal token helper. |

---

## 4. Risk Level of Each Refactor

| Pattern | Risk | Reason |
|--------|------|--------|
| 1.1 Bearer → getAuthUser | **Medium** | Adds cookie auth; test all callers. |
| 1.2 Unified error handling | **Low** | Same status codes and semantics. |
| 1.3 Page layout | **Low** | Structure only. |
| 1.4 Loading state | **Low** | UI only. |
| 1.5 Empty state | **Low** | UI only. |
| 1.6 formatPrice | **Low** | Display only. |
| 1.7 formatDate / toDateOnly | **Low** (display), **Medium** (server date) | Server date affects reservations/inventory. |
| 1.8 requireFields | **Low** | Same validation outcome. |
| 1.9 assertResourceOwner | **Medium** | Shared security logic; must match current checks. |
| 1.10 Payment + confirmation helper | **High** | Payment state, idempotency, email. |
| 1.11 apiFetch | **Low** | Same requests. |
| 1.12 PayPal token | **Low** | Same credentials and API. |

---

## 5. Safe to Refactor Without Changing Behavior

- **Safe (with minimal review):** 1.2 (error handling), 1.3 (layout), 1.4 (loading), 1.5 (empty state), 1.6 (formatPrice), 1.8 (requireFields), 1.11 (apiFetch), 1.12 (PayPal token).
- **Safe with explicit acceptance of “cookie auth”:** 1.1 (getAuthUser everywhere).
- **Safe if helper matches current behavior:** 1.7 display helper; 1.7 server `toDateOnly` and 1.9 `assertResourceOwner` after verification.
- **Not safe to refactor without careful design and tests:** 1.10 (payment + confirmation). Prefer small, well-tested helpers and leave “when to update paid/confirmed” and idempotency in each route.

---

## 6. Special Attention (as requested)

- **Reservation status consistency:** Duplicated “payment_status: 'paid', status: 'confirmed'” and “.eq('status', 'confirmed')” appear in Stripe webhook, PayPal capture, PayPal webhook, paddle webhook, and reminders. Refactoring (e.g. 1.10) must not change when status is set or what values are written; consider documenting the single source of truth for “confirmed” and “paid” in one place (e.g. docs or a constants file).
- **Payment state transitions:** Same as above; any shared helper must preserve current transition rules and idempotency (e.g. already paid → no overwrite).
- **Admin-only actions:** Admin routes use `requireAdmin` or `withAuth(['admin'])`; no duplication of that pattern identified. Keep admin checks in each route.
- **Webhook idempotency:** Stripe/PayPal/Paddle handlers should remain separate. A shared “mark paid + send email” helper must enforce “if already paid, skip or no-op” and not send duplicate emails.
- **Duplicate booking risks:** No new duplication found; booking creation stays in one place (POST /api/bookings). Shared payment-success logic (1.10) must not create or duplicate bookings.
- **Auth/session edge cases:** Moving to `getAuthUser(req)` (1.1) improves cookie support; test Bearer-only clients and browser cookie flows.
- **Client-side assumptions that should be server-verified:** Validation (required fields, ownership) is already server-side. Keep all “who can do what” and “required fields” checks on the server; client helpers (1.11) only send requests.
- **Multi-language field handling:** Loading and empty messages should use i18n (e.g. `t('common.loading')`) where applicable; a shared `LoadingMessage` / `EmptyState` can accept an i18n key.
- **Database writes that can partially fail:** Payment-success flows update booking then send email. If you introduce a helper (1.10), document that “update then email” is intentional and that email failure is logged and does not roll back the update; avoid making the helper do more than one critical write.

---

*End of duplicated logic analysis. No refactoring was applied.*
