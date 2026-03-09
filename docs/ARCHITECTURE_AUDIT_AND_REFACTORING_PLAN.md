# Repository Audit & Refactoring Plan

**Role:** Senior Software Architect  
**Scope:** Security, performance, architecture, database efficiency, error handling  
**Date:** 2026-03-09

---

## Applied Fixes (2026-03-09)

The following items from Phase 1 and Phase 2 have been implemented:

- **IDOR removed:** `GET /api/bookings`, `GET/PATCH /api/user-settings`, `GET/POST/DELETE /api/wishlist`, `GET/POST/DELETE /api/cart` now require authentication via `getAuthUser(req)` and no longer accept `userId` from query for authorization. `GET /api/reviews` allows `?userId=` only when the authenticated user’s id matches.
- **Cron protection:** `POST /api/emails/reminders` requires `CRON_SECRET` (or `VERCEL_CRON_SECRET`) as Bearer token or `X-Cron-Secret` header. Set the env var and use it in your cron job.
- **PayPal webhook:** Signature verification implemented via PayPal’s `verify-webhook-signature` API; invalid signatures return 401.
- **Resend webhook:** Signature verification implemented with Svix (`RESEND_WEBHOOK_SECRET`); invalid signatures return 401.
- **Logging:** Auth debug logs in `lib/auth.ts` gated to development; full request body logging removed from `POST /api/bookings`; create-merchant script no longer logs the temporary password.
- **Tour search/filter:** `app/api/tours/route.ts` now escapes `%` and `_` for ILIKE and sanitizes duration/feature keywords to prevent injection.
- **Empty catch blocks:** Replaced with logging or short comments in mypage/layout, auth/callback, admin/orders, mypage/settings, lib/currency, signup, tour/confirmation.

---

## Executive Summary

The codebase is a Next.js App Router application with Supabase (PostgreSQL), Stripe/PayPal payments, Resend email, and admin/merchant portals. The audit identified **critical security issues** (IDOR, unverified webhooks, unprotected cron endpoints), **performance and maintainability concerns** (over-fetching, in-memory rate limiting, no request validation layer), and **architectural gaps** (inconsistent auth, swallowed errors, duplicated logic). The refactoring plan prioritizes security fixes first, then validation and auth consistency, then performance and structure.

---

## 1. Security Vulnerabilities

### 1.1 Critical: IDOR via `userId` Query Parameter

**Location:**  
- `GET /api/bookings` — accepts `?userId=<uuid>` without verifying the requester is that user.  
- `GET /api/reviews` — `?userId=` allows listing any user’s reviews.  
- `GET/PATCH /api/user-settings` — uses `userId` from query.  
- `GET/POST/DELETE /api/wishlist` — same.  
- `GET/POST /api/cart` — same.

**Risk:** An unauthenticated or authenticated attacker can pass another user’s ID and read or mutate that user’s data (bookings, reviews, settings, wishlist, cart).

**Recommendation:**  
- Remove support for unauthenticated “filter by userId” on these routes.  
- Require authentication (Bearer or session); derive `userId` only from the authenticated user (e.g. `getAuthUser(req)`).  
- Never trust `userId` (or similar) from query/body for authorization; use it only for logging/display after verifying it matches the authenticated user.

---

### 1.2 Critical: PayPal Webhook Signature Not Verified

**Location:** `app/api/webhooks/paypal/route.ts`

**Current behavior:**  
- Comment states: “For now, we'll trust webhook ID matching” and “In production, should verify signature properly.”  
- Only `paypal-webhook-id` header is checked; no cryptographic verification.

**Risk:** Attackers can forge `PAYMENT.CAPTURE.COMPLETED` (and other) events and mark bookings as paid without real payment.

**Recommendation:**  
- Implement PayPal webhook signature verification using `PAYPAL_WEBHOOK_SECRET` and the algorithm described in [PayPal’s webhook docs](https://developer.paypal.com/docs/api/webhooks/v1/#verify-webhook-signature).  
- Reject requests with invalid or missing signature (e.g. 401).

---

### 1.3 Critical: Reminder Emails Endpoint Unprotected

**Location:** `POST /api/emails/reminders`

**Current behavior:**  
- No authentication or authorization.  
- Sends reminder emails for all confirmed bookings for “tomorrow.”

**Risk:** Anyone can trigger reminder emails to all customers (abuse, spam, confusion).

**Recommendation:**  
- Protect with a shared secret (e.g. `Authorization: Bearer <CRON_SECRET>` or `X-Cron-Secret` header) or Vercel cron secret.  
- Validate the secret in the handler and return 401 if missing/invalid.  
- Optionally restrict by IP if the cron runner has a fixed IP.

---

### 1.4 High: Resend Webhook Signature Not Verified

**Location:** `app/api/webhooks/resend/route.ts`

**Current behavior:**  
- `TODO: Resend signing secret 검증 구현` — `resend-signature` and `RESEND_WEBHOOK_SECRET` are not used.

**Risk:** Forged webhook events could create or update records (e.g. email threads) based on fake inbound data.

**Recommendation:**  
- Implement Resend’s webhook signature verification (e.g. HMAC) and reject invalid requests.

---

### 1.5 High: Sensitive Data in Logs

**Locations:**  
- `lib/auth.ts` — logs session structure, cookie names, token presence, and truncated session JSON.  
- `app/api/bookings/route.ts` — `console.log('Received booking request:', JSON.stringify(body, null, 2))` (can include PII).  
- `app/api/admin/tours/[id]/route.ts` — logs request body keys.  
- `scripts/create-merchant.js` — logs temporary password to console.

**Risk:** Session structure and PII in logs can leak to log aggregation; temporary passwords in scripts can be seen by anyone with script access.

**Recommendation:**  
- Remove or gate auth debug logs behind `NODE_ENV === 'development'` and never log tokens or full session objects.  
- In API routes, log only non-PII (e.g. booking ID, tour ID); avoid logging full request bodies.  
- In create-merchant script, print “Password has been set; check secure channel” and send password via a secure channel (e.g. encrypted email or secrets manager), not console.

---

### 1.6 High: Search / Filter Injection (Tours API)

**Location:** `app/api/tours/route.ts`

**Current behavior:**  
- `search`: used in `.or(\`title.ilike.%${search}%,...\`)` without escaping `%` or `_`.  
- `durations`: used in `duration.ilike.%${normalizedDuration}%`.  
- User input is concatenated into filter strings.

**Risk:** `%` and `_` in user input change LIKE semantics (e.g. overly broad matches or performance issues); in theory could interact badly with other layers if not parameterized correctly.

**Recommendation:**  
- Escape `%` → `\%`, `_` → `\_` for any value used in `ilike` (and use `ESCAPE` if supported by PostgREST/Supabase).  
- Validate/sanitize `duration` and `features` (e.g. allowlist of known values or length limits).  
- Prefer parameterized filters; avoid building raw filter strings from user input.

---

### 1.7 Medium: Client Error Log Endpoint Unprotected

**Location:** `POST /api/logs/error`

**Current behavior:**  
- No authentication or rate limiting.  
- Accepts arbitrary JSON and logs it.

**Risk:** Log flooding, log injection, or abuse to fill logs with junk.

**Recommendation:**  
- Add rate limiting (per IP or per user if authenticated).  
- Optionally require authentication so only your app (with a valid session) can submit.  
- Sanitize or restrict structure of logged content (e.g. max length, no raw HTML).

---

### 1.8 Medium: XSS Surface

**Locations:**  
- `app/admin/emails/page.tsx` — `dangerouslySetInnerHTML={{ __html: selectedEmail.html_content }}`.  
- `app/layout.tsx` — `dangerouslySetInnerHTML` for JSON-LD (organization/website); data source should be trusted.

**Risk:** If `html_content` or JSON-LD ever includes user-controlled or external content, XSS is possible.

**Recommendation:**  
- For admin email view: sanitize `html_content` (e.g. DOMPurify) or render in a sandboxed iframe with a strict CSP.  
- For JSON-LD: ensure data is from a trusted source (static or controlled CMS); if it ever becomes user-editable, sanitize or avoid `dangerouslySetInnerHTML`.

---

## 2. Performance Issues

### 2.1 Over-fetching with `select('*')`

**Locations (examples):**  
- `app/api/bookings/route.ts` (GET), `app/api/admin/contacts/route.ts`, `app/api/notifications/route.ts`, `app/api/admin/stats/route.ts`, `app/api/admin/tours/[id]/route.ts`, `app/api/admin/orders/route.ts`, `app/api/bookings/[id]/route.ts`, `app/api/merchant/products/route.ts`, `app/api/promo-codes/route.ts`, `app/api/user-settings/route.ts`, `app/api/tours/[id]/availability/route.ts`, `app/api/tours/[id]/availability/range/route.ts`, and others.

**Risk:** Unnecessary data transfer, larger JSON payloads, and more work for the DB when only a subset of columns is needed.

**Recommendation:**  
- Replace `select('*')` with explicit column lists (and only needed relations) per use case.  
- For list endpoints, select only fields required for list UI; for detail, include detail fields.  
- Add a short comment at the top of each route describing the intended response shape to avoid drift.

---

### 2.2 In-Memory Rate Limiting

**Location:** `lib/rate-limit.ts`

**Current behavior:**  
- Uses a single in-memory `Map` keyed by IP.  
- Only used in `auth/merchant/login` and `admin/merchants/create`.

**Risk:** On serverless/multi-instance deployments, each instance has its own map, so limits are per-instance, not global. Attackers can exceed intended limits by hitting different instances.

**Recommendation:**  
- Use a shared store (e.g. Redis, Vercel KV, or Supabase with a small table) for rate limit counters.  
- Keep the same API (e.g. `rateLimit(options)`) but implement the backend with TTL and atomic increment.  
- Apply rate limiting to sensitive endpoints: sign-in, contact, booking creation, password reset, and possibly `/api/logs/error`.

---

### 2.3 No Caching for Read-Heavy Data

**Observation:**  
- Tour list, tour detail, and currency/rate are good candidates for caching.  
- No evidence of response caching (e.g. `revalidate`, CDN, or in-memory cache) for public tour data.

**Recommendation:**  
- For public tour list/detail: use Next.js `revalidate` (ISR) or short-lived cache (e.g. 60s) and cache key by locale/query.  
- For currency rate API: short TTL (e.g. 1 hour) and cache in memory or KV to avoid hitting external API on every request.  
- Document cache invalidation when tours or prices are updated in admin.

---

## 3. Architecture & Maintainability

### 3.1 Inconsistent Authentication Patterns

**Observation:**  
- Some routes use `getAuthUser(req)`, `requireAdmin(req)`, or `withAuth(handler, roles)` from `lib/auth` / `lib/middleware`.  
- Others (e.g. `bookings`, `bookings/[id]`) manually parse `Authorization: Bearer` and do not use a shared helper.  
- GET `/api/bookings` allows unauthenticated access with `?userId=`.

**Risk:** Easy to add new routes that forget to enforce auth or to enforce it differently; IDOR and logic bugs.

**Recommendation:**  
- Standardize on `getAuthUser(req)` for “current user” and `requireAdmin` / `requireMerchant` / `withAuth` for role-based routes.  
- Never accept `userId` (or equivalent) from query/body for authorization; always derive from the authenticated user.  
- Add a small “API auth” doc: which routes require auth, which roles, and how to call them (Bearer vs cookie).

---

### 3.2 No Centralized Request Validation

**Observation:**  
- No Zod (or similar) schemas for API bodies/query.  
- Validation is ad hoc (e.g. `if (!tourId || !bookingDate)`) and inconsistent (e.g. `numberOfGuests` and `finalPrice` not validated as positive numbers or ranges).

**Risk:** Invalid or malicious payloads can reach the DB or business logic; type coercion and missing checks can cause bugs.

**Recommendation:**  
- Introduce a validation layer (e.g. Zod) and define schemas per route (or per resource).  
- Validate: types, ranges (e.g. `numberOfGuests` 1–100), string length, and allowlisted enums where applicable.  
- Return 400 with a consistent shape (e.g. `{ error, code: 'VALIDATION_ERROR', details: issues[] }`) and use a single helper (e.g. `validateBody(req, schema)`).

---

### 3.3 Duplicated Auth and Supabase Client Creation

**Observation:**  
- Many routes create Supabase client with `createServerClient()` and then parse Bearer token and call `supabase.auth.getUser(token)` in the same way.  
- This duplicates the logic in `getAuthUser` and makes it easy to forget checks (e.g. no check that resource belongs to user).

**Recommendation:**  
- Use `getAuthUser(req)` (and optional `requireAuth`) at the start of every protected route; then use returned `user.id` (and role) for the rest of the handler.  
- Keep a single place for “how we get the current user” (lib/auth) and one for “how we get a DB client” (createServerClient).

---

### 3.4 Error Handling Gaps

**Locations:**  
- Empty or minimal `catch` blocks: e.g. `app/mypage/layout.tsx`, `app/auth/callback/page.tsx`, `app/api/admin/orders/[id]/route.ts`, `app/mypage/settings/page.tsx`, `lib/currency.tsx`, `app/signup/page.tsx`, `app/tour/[id]/confirmation/page.tsx` — `catch (_) {}` or `catch (_) { }` with no logging or user feedback.

**Risk:** Failures are invisible; harder to debug and users may see silent failures or generic errors.

**Recommendation:**  
- In API routes: use `withErrorHandler` or a single try/catch that calls `handleApiError(error, req)` so all errors return a consistent JSON response and are logged.  
- In UI: at minimum log the error (e.g. `logger.error`) and, where appropriate, set a local error state or toast; avoid empty catch.  
- For non-critical paths (e.g. optional analytics), log and continue is acceptable, but document it (e.g. “Ignore errors for optional feature X”).

---

### 3.5 Next.js Middleware Does Not Enforce Auth

**Observation:**  
- Root `middleware.ts` only handles locale and rewrites; it does not protect `/admin`, `/merchant`, or `/mypage`.

**Risk:** Not a vulnerability by itself (APIs can still enforce auth), but any future page that assumes “only admins see this route” without server-side checks could leak data if someone hits the page directly.

**Recommendation:**  
- Either: add middleware that redirects unauthenticated users to sign-in for `/admin`, `/merchant`, `/mypage` (and optionally checks role), or clearly document that auth is enforced only in API and in page/server components.  
- Ensure every admin/merchant/mypage page and API that returns sensitive data validates the session (and role) server-side.

---

## 4. Database Query Efficiency

### 4.1 Use of `select('*')`

Already covered under Performance (2.1). Explicit selects reduce payload and can use covering indexes where applicable.

### 4.2 Index Usage

**Observation:**  
- Schema defines indexes on e.g. `bookings(user_id, status, tour_id, booking_date)`, `tours`, etc.  
- No audit was done of actual query patterns vs indexes (e.g. slow query log).  
- List queries (bookings by user, orders by merchant) should be aligned with indexes (e.g. `user_id` + `created_at` for ordering).

**Recommendation:**  
- For high-traffic or slow endpoints, log query time and add indexes if needed (e.g. composite on `(user_id, created_at DESC)` for “my bookings”).  
- Prefer single query with joins (e.g. bookings + tours + pickup_points) over N+1; the codebase already does this in many places, but reminders and admin orders should be reviewed to avoid N+1 when adding features.

### 4.3 No Connection Pooling Visibility

**Observation:**  
- Supabase client is created per request (`createServerClient()`). Supabase manages pooling on their side; no application-level pooling is visible.

**Recommendation:**  
- Rely on Supabase best practices (connection limits, pooling).  
- If you add a direct Postgres driver later, use a connection pool (e.g. PgBouncer or driver pooling) and avoid creating a new connection per request.

---

## 5. Error Handling Summary

- **Strengths:**  
  - `lib/error-handler.ts` provides `AppError`, `handleApiError`, `ErrorResponses`, and Supabase error code mapping.  
  - Many API routes use try/catch and return consistent JSON.  
- **Gaps:**  
  - Not all routes use `withErrorHandler`; some return ad hoc JSON and status codes.  
  - Empty catch blocks in several UI and one API route.  
  - No shared “validation error” shape for 400 responses (field-level errors).  

Recommendations above: centralize on `handleApiError`, avoid empty catches, add validation layer with a consistent error shape.

---

## 6. Refactoring Plan (Prioritized)

### Phase 1 — Security (Immediate)

1. **Remove IDOR on user-scoped APIs**  
   - GET/POST/PATCH/DELETE for bookings, reviews, user-settings, wishlist, cart: require auth and derive `userId` from `getAuthUser(req)` only; remove `userId` (and equivalent) from query/body for authorization.  
   - Add tests or manual checks that changing `userId` in requests does not return other users’ data.

2. **Verify PayPal webhooks**  
   - Implement signature verification in `app/api/webhooks/paypal/route.ts` using PayPal’s verification API or documented algorithm; reject invalid requests.

3. **Protect reminder endpoint**  
   - Add cron secret (header or Bearer) to `POST /api/emails/reminders` and validate it; return 401 if missing or wrong.

4. **Verify Resend webhook**  
   - Implement Resend webhook signature verification in `app/api/webhooks/resend/route.ts`.

5. **Reduce sensitive logging**  
   - Remove or gate auth debug logs; stop logging full booking (and other PII) request bodies; avoid logging temporary passwords in scripts.

### Phase 2 — Validation & Auth Consistency (Short Term)

6. **Introduce request validation**  
   - Add Zod (or similar); define schemas for booking create/update, contact, sign-in, and other mutation payloads.  
   - Validate query params for list endpoints (e.g. limit, offset, status).  
   - Return 400 with a consistent `{ error, code: 'VALIDATION_ERROR', details }` shape.

7. **Standardize auth on APIs**  
   - Use `getAuthUser(req)` / `requireAdmin` / `requireMerchant` in every protected route.  
   - Refactor bookings, reviews, wishlist, cart, user-settings to use shared auth and remove duplicate Bearer parsing.

8. **Escape/sanitize tour search and filters**  
   - In `app/api/tours/route.ts`, escape `%` and `_` for `ilike` and restrict duration/features to allowlist or safe length.

### Phase 3 — Performance & Observability (Medium Term)

9. **Replace `select('*')` with explicit selects**  
   - Audit all routes that use `select('*')` and replace with minimal column sets; add a one-line comment for “response shape” where helpful.

10. **Move rate limiting to a shared store**  
    - Implement Redis/KV-backed rate limiter; use it for login, contact, booking create, logs/error, and optionally other write endpoints.

11. **Add caching for public reads**  
    - Tours list/detail: ISR or short TTL cache; currency rate: short TTL in memory or KV.  
    - Document invalidation when data is updated.

### Phase 4 — Structure & Maintainability (Ongoing)

12. **Unify error handling**  
    - Use `withErrorHandler` (or equivalent) for all API routes; replace empty catch blocks with at least logging and, where appropriate, user-facing error state.

13. **Optional: Service layer**  
    - Extract “booking creation,” “send confirmation email,” “apply promo” into small service functions used by API route handlers; improves testability and keeps routes thin.

14. **Documentation**  
    - Add a short “API security & auth” doc (who can call what, how to authenticate, no client-supplied userId for auth).  
    - Document cron endpoints and required secrets.

---

## 7. Summary Table

| Category            | Severity   | Count | Priority |
|---------------------|-----------|-------|----------|
| IDOR / auth bypass  | Critical  | 6+    | P1       |
| Webhook verification| Critical  | 2     | P1       |
| Unprotected cron   | Critical  | 1     | P1       |
| Sensitive logging   | High      | 4+    | P1       |
| Filter injection    | High      | 1     | P2       |
| XSS surface         | Medium    | 2     | P2       |
| Over-fetching       | Medium    | 15+   | P3       |
| Rate limiting       | Medium    | 1     | P2       |
| Auth consistency    | Medium    | Many  | P2       |
| Validation layer    | Medium    | All   | P2       |
| Empty catch blocks  | Low       | 7+    | P3       |

This plan addresses security first, then validation and auth, then performance and structure, and leaves room for incremental improvement without big-bang rewrites.
