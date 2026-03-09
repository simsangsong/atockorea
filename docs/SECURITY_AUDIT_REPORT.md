# Security-Focused Audit Report

**Date:** 2026-03-09  
**Scope:** Exposed secrets, env usage, API safety, authorization, admin protection, redirects/callbacks, webhooks, client trust, XSS, injection, auth assumptions, DB access, validation.  
**No code changes applied.**

---

## 1. Client-controlled payment amount (price manipulation)

### Vulnerability
Booking creation and payment checkout accept **client-supplied price/amount**. The server stores and charges whatever the client sends.

### Affected files
- `app/api/bookings/route.ts` (POST): `finalPrice` from body stored as `bookingData.final_price`; `unitPrice` falls back to `tour.price || finalPrice` but `final_price` is always from body.
- `app/api/stripe/checkout/route.ts` (POST): `amount` and `currency` from request body used for Stripe `line_items[].price_data.unit_amount`; booking is loaded but its `final_price` is not used for the session.
- `app/api/paypal/create-order/route.ts` (POST): `amount` from request body used for PayPal order; `booking.final_price` is loaded but not used for the order value.
- `app/api/paddle/checkout/route.ts` (POST): `amount` from body; success_url uses `APP_URL` (env), but amount is still client-controlled.

### Severity
**Critical.**

### Exploit scenario
Attacker creates a booking with `finalPrice: 0.01`, then calls Stripe/PayPal checkout with `amount: 0.01`. Server creates payment for 0.01 and, after webhook, marks booking as paid. Result: confirmed booking at arbitrary (e.g. minimal) price.

### Recommended fix
- **Bookings:** Compute `final_price` (and related fields) server-side from `tour.price`, `tour.price_type`, `numberOfGuests`, and any server-side promo logic. Do not store client-supplied `finalPrice` as authoritative.
- **Stripe/PayPal/Paddle checkout:** Use `booking.final_price` (and booking currency) from DB for `unit_amount` / order amount. Ignore `amount`/`currency` from body or use only for display/validation mismatch checks.

### Safe to auto-fix?
**No.** Requires business logic and payment-flow review; test all gateways and edge cases (discounts, rounding, currency).

---

## 2. Paddle webhook signature not verified

### Vulnerability
Paddle webhook requires a `paddle-signature` header but **never verifies** it. When `PADDLE_PUBLIC_KEY` is set, the code only comments that verification “may vary” and continues processing.

### Affected files
- `app/api/paddle/webhook/route.ts`

### Severity
**High.**

### Exploit scenario
Attacker sends a forged POST to `/api/paddle/webhook` with a valid-looking body and any `paddle-signature` value. Server marks a booking as paid and may send confirmation email without any real Paddle payment.

### Recommended fix
Implement Paddle’s documented webhook verification (e.g. verify signature using `PADDLE_PUBLIC_KEY` and the raw body). Reject requests with invalid or missing signature. Do not process payment-completion logic until verification succeeds.

### Safe to auto-fix?
**No.** Requires correct use of Paddle’s verification API and testing with real Paddle webhooks.

---

## 3. Resend webhook processed without verification when secret unset

### Vulnerability
When `RESEND_WEBHOOK_SECRET` is not set, the handler **skips signature verification** and still processes the payload. Any caller can POST to the endpoint and inject data into `received_emails` and `contact_inquiries`.

### Affected files
- `app/api/webhooks/resend/route.ts`

### Severity
**High** (when Resend is used and secret is unset).

### Exploit scenario
Attacker sends a crafted POST to `/api/webhooks/resend` with `type: 'email.received'` and arbitrary from/to/content. Server inserts into DB; inbox and contact forms are polluted or used for phishing/abuse.

### Recommended fix
If Resend inbound webhooks are enabled, require `RESEND_WEBHOOK_SECRET` and **reject** (e.g. 401/503) when the secret is missing. Do not process the body when verification is skipped.

### Safe to auto-fix?
**Partially.** Adding a guard “if Resend webhook is used then require secret and reject when unset” is low-risk; actual verification logic is already present when secret is set.

---

## 4. PayPal webhook weak verification when credentials partial

### Vulnerability
When `PAYPAL_WEBHOOK_ID` is set but `PAYPAL_CLIENT_ID` or `PAYPAL_SECRET` are missing, the handler only checks the `paypal-webhook-id` header against `PAYPAL_WEBHOOK_ID`. That header can be forged by an attacker who knows the configured webhook ID.

### Affected files
- `app/api/webhooks/paypal/route.ts` (branch `else if (PAYPAL_WEBHOOK_ID)`).

### Severity
**Medium.**

### Exploit scenario
In a misconfiguration where only `PAYPAL_WEBHOOK_ID` is set, an attacker sends a fake `PAYMENT.CAPTURE.COMPLETED` with a known webhook ID. Server may mark a booking as paid and send confirmation.

### Recommended fix
Require full PayPal credentials for webhook verification. If credentials are not all set, return 503 and do not process payment events. Do not rely on webhook-id-only check for payment state changes.

### Safe to auto-fix?
**Yes (conservative).** Return 503 when webhook credentials are incomplete and do not process payment-completion logic in that branch.

---

## 5. OAuth callback open redirect via `next` parameter

### Vulnerability
Auth callback uses `next` from the query string in `router.push(next)` without validating that it is a same-origin path. A URL like `?next=https://evil.com` could redirect the user to an external site after login.

### Affected files
- `app/auth/callback/page.tsx` (e.g. `const next = (searchParams.get('next') || '/mypage').replace(/^null$/i, '') || '/mypage';` then `router.push(next)`).

### Severity
**Medium.**

### Exploit scenario
Attacker sends victim to `/auth/callback?code=...&next=https://evil.com`. After successful OAuth, victim is sent to evil.com with an open redirect and possible phishing.

### Recommended fix
Allow only relative paths: e.g. ensure `next` starts with `/` and does not start with `//` or contain `:`. Reject or replace with `/mypage` if not allowed. Optionally use an allowlist of paths.

### Safe to auto-fix?
**Yes.** Validation can be a small, well-tested function (e.g. allow only `^/[a-zA-Z0-9/_-]*$` or an explicit list).

---

## 6. PayPal callback redirect path injection / invalid bookingId

### Vulnerability
`bookingId` from the query is interpolated into redirect paths without validation. Although `new URL(..., req.nextUrl.origin)` keeps the host same, a value like `../../../something` or an invalid ID can produce unexpected paths or errors.

### Affected files
- `app/api/paypal/callback/route.ts` (e.g. `/tour/${bookingId}/confirmation?payment=processing&orderId=${token}`).

### Severity
**Low–Medium.**

### Exploit scenario
`bookingId=../../../admin` could yield a redirect to `/admin` after payment. Less likely to be a direct open redirect to another domain but can confuse users or bypass intended flows.

### Recommended fix
Validate `bookingId`: allow only UUID format or a known-safe ID format (e.g. regex). If invalid, redirect to a safe default (e.g. `/` or `/mypage`) without using `bookingId` in the path.

### Safe to auto-fix?
**Yes.** Add a small validator (e.g. UUID or numeric ID) and a safe fallback redirect.

---

## 7. Merchant orders PATCH accepts arbitrary body (overwrite risk)

### Vulnerability
Merchant order update uses the full request body in `supabase.from('bookings').update(body)`. Although the row is scoped by `orderId` and merchant check, any allowed column in the table can be overwritten (e.g. `payment_status`, `final_price`, `user_id`).

### Affected files
- `app/api/merchant/orders/route.ts` (PATCH branch).

### Severity
**High.**

### Exploit scenario
A compromised or malicious merchant sends `PATCH` with `payment_status: 'paid'`, `final_price: 0`, or other sensitive fields. Server updates that booking row and can mark unpaid bookings as paid or alter financial data.

### Recommended fix
Use an allowlist of updatable fields (e.g. `status`, `tour_time`, notes) and build an update object only from those keys. Do not pass `body` (or `...body`) directly into `update()`.

### Safe to auto-fix?
**Partially.** Allowlisting fields is straightforward; deciding which fields merchants may set requires product/ops input.

---

## 8. Admin contact search filter injection risk

### Vulnerability
The `search` parameter is interpolated into a Supabase `.or()` filter string without sanitization: `full_name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%`. If Supabase passes this as raw SQL in some code path, or if the string is misused, it could lead to injection.

### Affected files
- `app/api/admin/contacts/route.ts` (GET, `search` handling).

### Severity
**Low–Medium** (depends on Supabase/PostgREST behavior; parameterization may already apply).

### Exploit scenario
A crafted `search` value could theoretically break the filter or inject characters that change query meaning. Risk is lower if Supabase always parameterizes.

### Recommended fix
Validate/sanitize `search`: length limit, strip or escape `%` and `_` if they are not intended as wildcards, and/or use a single parameterized pattern (e.g. one `ilike` with a single placeholder). Avoid building filter strings by concatenation.

### Safe to auto-fix?
**Partially.** Sanitization and length limits are low-risk; full fix may require confirming Supabase’s exact API.

---

## 9. Admin PATCH contact_inquiries spreads full `updates` object

### Vulnerability
`updateContact` does `supabase.from('contact_inquiries').update({ ...updates, updated_at: ... }).eq('id', inquiry_id)`. Any column writable by the DB can be updated, including potentially sensitive or internal fields.

### Affected files
- `app/api/admin/contacts/route.ts` (PATCH).

### Severity
**Medium** (admin-only but weak principle of least privilege).

### Exploit scenario
Admin account compromised or malicious; attacker sends `updates: { status: 'closed', some_future_column: 'abuse' }` and overwrites or sets columns that should not be client-controlled.

### Recommended fix
Allowlist columns that admins may update (e.g. `status`, `is_read`, `updated_at`) and build the update object only from those keys.

### Safe to auto-fix?
**Partially.** Allowlist is straightforward; which fields are allowed should be confirmed with product.

---

## 10. Stored XSS in admin email view (HTML content)

### Vulnerability
Admin emails page renders `selectedEmail.html_content` with `dangerouslySetInnerHTML`. That content comes from inbound emails (e.g. Resend) and is not sanitized. A malicious sender can inject script or other active content.

### Affected files
- `app/admin/emails/page.tsx` (e.g. `dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}`).

### Severity
**Medium** (admin-only; impact is session/actions as admin).

### Exploit scenario
Attacker sends an email with `<script>...</script>` or an event handler. When an admin views the email in the app, the script runs in the admin’s session (e.g. steal token, change settings).

### Recommended fix
Sanitize HTML before rendering (e.g. DOMPurify or a server-side sanitizer) with a strict policy (strip script, event handlers, dangerous tags). Or render as plain text / simple formatted text only.

### Safe to auto-fix?
**Partially.** Introducing a sanitizer is standard; policy and testing (especially for legitimate HTML in emails) need review.

---

## 11. Error responses leak internal messages and (dev) stack

### Vulnerability
Many API routes return `details: error.message` (or similar) in JSON. In production this can leak internal paths, DB hints, or third-party messages. One route also returns `stack` in development, which is correct, but `details` is often still generic “internal” info.

### Affected files
- Widespread: e.g. `app/api/bookings/route.ts` (returns `details`, and `stack` when `NODE_ENV === 'development'`), `app/api/cart/route.ts`, `app/api/wishlist/route.ts`, and many others that send `error.message` in the response.

### Severity
**Low** (information disclosure; can aid attackers in probing).

### Exploit scenario
Attacker triggers errors (invalid IDs, bad payloads) and inspects response bodies for DB errors, file paths, or library messages to refine attacks.

### Recommended fix
In production, return a generic message (e.g. “Internal server error”) and a stable code; log full `error.message` and stack server-side only. Use a central error handler so behavior is consistent.

### Safe to auto-fix?
**Partially.** Centralizing and switching to generic messages is low-risk; ensure logging is sufficient for debugging.

---

## 12. Cron endpoint protection depends on secret strength

### Vulnerability
Reminder cron (`POST /api/emails/reminders`) is protected by `CRON_SECRET` (Bearer or `X-Cron-Secret`). If the secret is weak, guessable, or leaked, anyone can trigger reminder emails and DB reads.

### Affected files
- `app/api/emails/reminders/route.ts`

### Severity
**Low–Medium** (depends on secret management and deployment).

### Exploit scenario
Weak or leaked `CRON_SECRET` allows an attacker to trigger reminder job repeatedly (load, potential spam) or to probe booking data via error messages.

### Recommended fix
Use a strong, randomly generated secret; store in env/secrets manager; do not log it. Prefer Vercel cron or similar that sends a secret only from the scheduler. Optionally add rate limiting or IP allowlist for the cron route.

### Safe to auto-fix?
**No.** Configuration and secret rotation are operational; code can only enforce “secret required” and constant-time comparison if applicable.

---

## 13. Stripe/PayPal webhook idempotency (duplicate processing)

### Vulnerability
Stripe and PayPal webhooks do not check “already paid” before updating the booking and sending confirmation email. Duplicate delivery (retries or replay) can overwrite `payment_reference` and send the confirmation email again.

### Affected files
- `app/api/stripe/webhook/route.ts` (e.g. `checkout.session.completed`).
- `app/api/webhooks/paypal/route.ts` (e.g. `PAYMENT.CAPTURE.COMPLETED`).

### Severity
**Medium** (no double charge, but duplicate emails and writes; support/analytics impact).

### Exploit scenario
Stripe/PayPal retries the same event; handler runs twice. Second run updates the same booking again and sends a second confirmation email. Customer receives duplicate emails; logs show duplicate processing.

### Recommended fix
After loading the booking, if `payment_status === 'paid'` (and for Stripe, optionally `payment_reference` matches), return 200 and skip update and email. Otherwise proceed as today. Align with existing Paddle webhook pattern.

### Safe to auto-fix?
**No.** Requires careful handling of first vs retry and tests with duplicate events.

---

## 14. Booking creation without authentication (guest checkout)

### Vulnerability
`POST /api/bookings` does not require authentication; it optionally uses a Bearer token for `user_id`. This is by design for guest checkout but increases abuse surface (e.g. mass booking creation, inventory exhaustion).

### Affected files
- `app/api/bookings/route.ts` (POST).

### Severity
**Low–Medium** (design trade-off; depends on rate limiting and inventory logic).

### Exploit scenario
Attacker scripts many POSTs to create bookings and reduce `available_spots`, causing denial of inventory for real users (without paying).

### Recommended fix
Apply rate limiting (by IP and optionally by token) on booking creation. Consider CAPTCHA or stricter checks for unauthenticated requests. Ensure inventory is only decremented when payment is confirmed (already the case via webhooks), and monitor for burst creation.

### Safe to auto-fix?
**Partially.** Adding rate limiting is low-risk; exact limits and CAPTCHA are product/ops decisions.

---

## 15. Supabase service role key usage (bypasses RLS)

### Vulnerability
Server-side API uses `createServerClient()` with `SUPABASE_SERVICE_ROLE_KEY`, which bypasses RLS. All authorization is therefore enforced in application code (e.g. `getAuthUser`, `requireAdmin`, merchant checks). Any bug or missing check can lead to cross-tenant or privilege escalation.

### Affected files
- `lib/supabase.ts` (`createServerClient`).
- All API routes that use this client.

### Severity
**Medium** (architectural; depends on correctness of every route).

### Exploit scenario
A new or modified route forgets to call `requireAdmin` or to scope by `user_id`/`merchant_id`; with service role the query runs and returns or updates other users’ data.

### Recommended fix
Keep using service role only where necessary (e.g. server-only admin or cross-user operations). For user-scoped operations, consider a client that uses the user’s JWT so RLS applies (where feasible). Document and audit every route that uses the service role and enforce review for new routes.

### Safe to auto-fix?
**No.** This is an architectural and process improvement, not a single code change.

---

## 16. Redirect URLs in sign-in (OAuth)

### Vulnerability
Sign-in and callback use `window.location.origin` and `NEXT_PUBLIC_APP_URL` for redirect/callback URLs. If an attacker can control the host (e.g. via DNS or misleading link), they could try to use the app’s OAuth flow with a malicious redirect (mitigated by provider allowlists).

### Affected files
- `app/signin/page.tsx`, `app/auth/callback/page.tsx`, `app/api/auth/line/route.ts`, etc.

### Severity
**Low** (providers typically restrict redirect URIs to a fixed list).

### Exploit scenario
User is on a cloned/phishing domain; OAuth redirect_uri might still point to the real app if origin is not attacker-controlled. Risk is mainly if redirect_uri were ever derived from user input, which it is not in the current code.

### Recommended fix
Ensure OAuth redirect/callback URIs are allowlisted in Google/LINE/etc. and match exactly. Prefer `NEXT_PUBLIC_APP_URL` over `window.location.origin` for server-side redirect generation so it is not spoofed by client. Document the exact redirect URIs used in production.

### Safe to auto-fix?
**No.** Configuration and provider dashboards; code already uses fixed origins.

---

## 17. GET /api/webhooks/resend exposes endpoint existence

### Vulnerability
`GET /api/webhooks/resend` returns a simple JSON message that the endpoint is active. This reveals the route exists and that Resend may be integrated; low information value but unnecessary exposure.

### Affected files
- `app/api/webhooks/resend/route.ts` (GET handler).

### Severity
**Low.**

### Exploit scenario
Scanner or attacker enumerates endpoints and confirms Resend webhook usage.

### Recommended fix
Remove the GET handler or return 404/405 so only POST (with verification) is accepted.

### Safe to auto-fix?
**Yes.** Removing or restricting GET is a small, safe change.

---

## Summary table

| # | Issue | Severity | Auto-fix |
|---|--------|----------|----------|
| 1 | Client-controlled payment amount | Critical | No |
| 2 | Paddle webhook signature not verified | High | No |
| 3 | Resend webhook no verification when secret unset | High | Partially |
| 4 | PayPal webhook weak verification (webhook-id only) | Medium | Yes (conservative) |
| 5 | OAuth callback open redirect (`next`) | Medium | Yes |
| 6 | PayPal callback bookingId in path | Low–Medium | Yes |
| 7 | Merchant orders PATCH arbitrary body | High | Partially |
| 8 | Admin contacts search injection risk | Low–Medium | Partially |
| 9 | Admin contacts PATCH full spread | Medium | Partially |
| 10 | Stored XSS in admin email HTML | Medium | Partially |
| 11 | Error response info leakage | Low | Partially |
| 12 | Cron secret strength / handling | Low–Medium | No |
| 13 | Stripe/PayPal webhook idempotency | Medium | No |
| 14 | Booking creation abuse (no auth) | Low–Medium | Partially |
| 15 | Service role bypasses RLS | Medium | No |
| 16 | OAuth redirect URI configuration | Low | No |
| 17 | Resend webhook GET exposes endpoint | Low | Yes |

---

## Areas of special attention (as requested)

- **Reservation status consistency:** Addressed indirectly by idempotency (item 13) and by fixing price/amount handling (item 1) so payment state is not driven by client or duplicate events.
- **Payment state transitions:** Critical that only webhooks (and server-computed amounts) drive “paid” and “confirmed”; item 1 and 2/3/4 are directly relevant.
- **Admin-only actions:** Admin routes use `requireAdmin`/`withAuth`; items 7 (merchant), 9 (admin PATCH), and 10 (admin XSS) tighten admin-surface security.
- **Webhook idempotency:** Item 13; Paddle already has an “already processed” check; Stripe/PayPal should mirror it.
- **Duplicate booking risks:** Not separately called out; mitigated by server-side inventory and, once fixed, server-side price (item 1).
- **Auth/session edge cases:** Callback redirect (item 5) and optional cron secret (item 12) are the main findings.
- **Client-side assumptions server-verified:** Item 1 is the main case (price/amount must be server-authoritative).
- **Multi-language field handling:** Not specifically audited; no separate finding in this pass.
- **Database writes that can partially fail:** Not specifically audited; recommend transactional patterns where booking + inventory + email are updated together where applicable.
