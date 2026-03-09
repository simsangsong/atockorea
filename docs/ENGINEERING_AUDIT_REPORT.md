# Engineering Audit Report — atockorea

**Date:** 2026-03-09  
**Scope:** Full codebase (no code changes applied)  
**Focus:** Production safety, readability, maintainability.

---

## 1. Executive Summary

The codebase is a **Next.js 14 App Router** application with **Supabase** (auth, DB), **Stripe** and **PayPal** payments, **Resend** email, **i18n** (next-intl), and admin/merchant portals. The audit identified **critical security issues** (IDOR on booking by ID, unauthenticated inventory and promo-code writes, unverified Paddle webhook), **inconsistent error handling and auth patterns**, **dead/unused code**, **duplicated logic**, and **fragile areas** for production. Findings are grouped by severity and by whether they are **safe to auto-fix** vs **risky (manual review required)**.

---

## 2. Severity Definitions

- **Critical:** Security or data integrity; exploitable or high-impact production failure.
- **High:** Security/auth/consistency gaps; likely production issues under load or misuse.
- **Medium:** Maintainability, type safety, or robustness; may cause bugs or confusion.
- **Low:** Cleanup, consistency, or minor hardening.

---

## 3. Critical Findings

### 3.1 IDOR: GET /api/bookings/[id] returns any booking without auth

- **Files:** `app/api/bookings/[id]/route.ts`
- **Issue:** `GET` handler fetches a booking by `params.id` with **no authentication**. Any client can request any booking ID and receive full booking details (user, tour, pickup, etc.).
- **Risk:** Exposure of PII and booking data.
- **Fix:** Require authentication and restrict to: booking owner, or admin/merchant with scope. Use `getAuthUser(req)` and filter by `user_id` (or role) before returning.
- **Category:** **Risky — manual review.** Authorization rules (owner vs admin vs merchant) must be defined and tested.

---

### 3.2 Unauthenticated write: POST/PUT /api/inventory and /api/inventory/[id]

- **Files:** `app/api/inventory/route.ts`, `app/api/inventory/[id]/route.ts`
- **Issue:** `POST` (create/update) and `PUT` (update) have **no auth**. Any client can create or update product inventory for any tour/merchant.
- **Risk:** Data corruption, overbooking, or malicious inventory changes.
- **Fix:** Require merchant or admin (e.g. `requireMerchant` or `requireAdmin`) and enforce that the caller can only modify inventory for their own tours/merchant.
- **Category:** **Risky — manual review.** Need clear ownership rules (e.g. via `tours.merchant_id`).

---

### 3.3 Unauthenticated read/write: GET and POST /api/promo-codes

- **Files:** `app/api/promo-codes/route.ts`
- **Issue:**  
  - **GET** without `?code=`: returns **all promo codes** with no auth (comment says "admin only - add auth check if needed").  
  - **POST**: creates a promo code with **no auth**.
- **Risk:** Leak of all promo codes; anyone can create arbitrary promo codes.
- **Fix:** GET list: require admin (e.g. `requireAdmin`). POST: require admin.
- **Category:** **Safe to auto-fix** (add `requireAdmin` to both handlers), with a quick manual check that no legitimate public flow needs unauthenticated list/create.

---

### 3.4 Paddle webhook signature not verified

- **Files:** `app/api/paddle/webhook/route.ts`
- **Issue:** Code checks for `paddle-signature` header and has a comment that verification "may vary" and "we'll process the webhook and verify later if needed." **No actual signature verification** is performed with `PADDLE_PUBLIC_KEY`.
- **Risk:** Forged webhooks could mark bookings as paid without real payment.
- **Fix:** Implement Paddle’s webhook signature verification (e.g. HMAC) using `PADDLE_PUBLIC_KEY` and reject invalid requests (401).
- **Category:** **Risky — manual review.** Depends on Paddle’s current verification API; implement per their docs and test in sandbox.

---

## 4. High Findings

### 4.1 Inconsistent API error handling

- **Files:**  
  - Use **handleApiError / withErrorHandler:** `app/api/tours/route.ts`, `app/api/tours/[id]/route.ts`, `app/api/bookings/route.ts`, `app/api/admin/tours/route.ts`, `app/api/admin/settings/route.ts`.  
  - **All other API routes** use raw `try/catch` and ad-hoc `NextResponse.json({ error: ... })` and `console.error`.
- **Issue:** Inconsistent status codes, error shapes, and logging; stack/details may leak in some paths; Supabase errors not mapped consistently.
- **Risk:** Harder to debug, unstable client handling, possible information leakage.
- **Fix:** Gradually wrap handlers with `withErrorHandler` or use `handleApiError` in catch blocks; use `ErrorResponses` for common cases. Avoid exposing `error.message` or stack in production.
- **Category:** **Safe to auto-fix** per route (wrap or return handleApiError), with **manual review** of each route’s intended status codes and response shape.

---

### 4.2 Duplicated auth logic (Bearer parsing) in API routes

- **Files:**  
  `app/api/bookings/[id]/route.ts`, `app/api/cart/[id]/route.ts`, `app/api/settlements/route.ts`, `app/api/reviews/route.ts`, `app/api/reviews/reports/route.ts`, `app/api/reviews/reports/[id]/route.ts`, `app/api/reviews/reactions/route.ts`, `app/api/auth/update-profile/route.ts`
- **Issue:** These routes manually parse `Authorization: Bearer <token>` and call `supabase.auth.getUser(token)`. They **do not** use `getAuthUser(req)`, so they **ignore cookie-based session** and duplicate logic. Behavior may differ from routes that use `getAuthUser` (e.g. cookie vs Bearer).
- **Risk:** Inconsistent auth (e.g. web app with cookies may get 401 where Bearer would work); maintenance burden and drift.
- **Fix:** Replace inline Bearer + getUser with `getAuthUser(req)` (and then require user or role as needed).
- **Category:** **Safe to auto-fix** with **manual review** (ensure no intentional Bearer-only behavior and test cookie flow).

---

### 4.3 POST /api/logs/error unauthenticated and not rate-limited

- **Files:** `app/api/logs/error/route.ts`
- **Issue:** Any client can POST arbitrary payloads to log errors. No auth, no rate limit. Body is logged and could be persisted later.
- **Risk:** Log flooding, storage/CPU abuse, or injection of misleading content into logs.
- **Fix:** Add rate limiting (e.g. `apiRateLimit`) and optionally require auth or a minimal shared secret for client-error reporting.
- **Category:** **Safe to auto-fix** (add rate limit); auth/secret is **manual review** (product decision).

---

### 4.4 Rate limiter: apiRateLimit never used

- **Files:** `lib/rate-limit.ts` (export), no usage in `app/api`
- **Issue:** `apiRateLimit` is defined but **never imported** in any API route. Only `loginRateLimit` and `createMerchantRateLimit` are used.
- **Risk:** Public APIs (contact, bookings, signup, etc.) have no application-level rate limiting; in-memory limit is also not shared across instances.
- **Fix:** Apply `apiRateLimit` to sensitive public endpoints (e.g. contact, signup, bookings POST, logs/error). Document that in-memory limit does not scale across multiple instances.
- **Category:** **Safe to auto-fix** (wire apiRateLimit to selected routes); **manual review** for which routes and limits.

---

### 4.5 In-memory rate limiting not production-safe

- **Files:** `lib/rate-limit.ts`
- **Issue:** Uses a single `Map` in process memory. In serverless/multi-instance deployments, each instance has its own map; limits are not global.
- **Risk:** Rate limits can be bypassed by hitting different instances; under load, limits may be ineffective.
- **Fix:** Prefer a shared store (e.g. Redis, Vercel KV) for production; keep current API and add a note in docs. See `docs/ARCHITECTURE_AUDIT_AND_REFACTORING_PLAN.md`.
- **Category:** **Risky — manual review.** Requires infrastructure and possibly new env vars.

---

## 5. Medium Findings

### 5.1 createSuccessResponse unused in production

- **Files:** `lib/error-handler.ts` (export), only used in `__tests__/lib/error-handler.test.ts`
- **Issue:** `createSuccessResponse` is never used by any API route. Success responses are built inline.
- **Risk:** None functionally; dead export and missed consistency.
- **Fix:** Either adopt it in a few routes for consistency or remove the export and keep tests using a local helper.
- **Category:** **Safe to auto-fix** (remove or start using); **low impact**.

---

### 5.2 requireAuth never used by API routes

- **Files:** `lib/auth.ts` (export). Used only inside `requireRole`. No route calls `requireAuth(req)` directly.
- **Issue:** Dead public API; could confuse future developers.
- **Fix:** Use it where “any authenticated user” is enough, or document/deprecate.
- **Category:** **Safe to auto-fix** (use where appropriate or mark internal).

---

### 5.3 Dead code: geocodeAddress, reverseGeocode, preloadResource, prefetchRoute

- **Files:**  
  - `lib/google-maps.ts`: `geocodeAddress`, `reverseGeocode` — not imported anywhere.  
  - `lib/performance.ts`: `preloadResource`, `prefetchRoute` — not imported anywhere.
- **Issue:** Exported but unused; increase bundle/maintenance cost slightly.
- **Fix:** Remove exports (or entire functions) if not planned for use; or wire them where needed.
- **Category:** **Safe to auto-fix** (delete or use); **manual review** if product plans to use them soon.

---

### 5.4 Type safety: use of `any` in app and API code

- **Files:**  
  - `app/tour/[id]/page.tsx`: `gallery: any[]`, `err: any`, `(tour as any).keywords`  
  - `app/mypage/dashboard/page.tsx`: `booking: any`  
  - `app/api/admin/upload/route.ts`: `error: any`, `supabase: any`  
  - `app/api/paypal/create-order/route.ts`, `app/api/settlements/route.ts`, `app/api/notifications/route.ts`: `error: any`  
  - `app/api/cart/[id]/route.ts`: `existingItem.tours as any`, `updateData: any`
- **Issue:** Weakens type safety and refactor safety; some `any` may hide bugs.
- **Fix:** Replace with proper types (Supabase generated types, or explicit interfaces) and `unknown` in catch where appropriate.
- **Category:** **Safe to auto-fix** incrementally; **manual review** for correct types (e.g. Supabase types).

---

### 5.5 Next.js 15 params compatibility

- **Files:** Most dynamic API routes and pages use `{ params }: { params: { id: string } }`. One route uses `params: Promise<{ id: string }> | { id: string }`: `app/api/admin/tours/[id]/route.ts`.
- **Issue:** In Next.js 15, route handlers can receive `params` as a Promise. Current code assumes synchronous `params`; may break after upgrade.
- **Risk:** Runtime errors when accessing `params.id` if `params` is a Promise.
- **Fix:** Use the same pattern as admin/tours/[id] (e.g. `const resolvedParams = params instanceof Promise ? await params : params`) in all dynamic routes, or follow Next.js 15 migration guide.
- **Category:** **Risky — manual review.** Apply when upgrading Next.js; test all dynamic routes.

---

### 5.6 No route-level loading UI (loading.tsx)

- **Files:** No `app/**/loading.tsx` files.
- **Issue:** No Suspense boundaries or route-level loading states; users may see blank content during data fetch.
- **Fix:** Add `loading.tsx` for key segments (e.g. `app/[locale]/loading.tsx`, `app/mypage/loading.tsx`, `app/tour/[id]/loading.tsx`) with skeletons or spinners.
- **Category:** **Safe to auto-fix** (add simple loading components); **manual review** for UX.

---

### 5.7 Sensitive env file in repo

- **Files:** `.env.local (2).txt` appears in git status (likely a duplicate/backup with real keys).
- **Issue:** If committed, secrets (e.g. Stripe live key seen in snippet) would be in history.
- **Risk:** Credential leak. Ensure it is in `.gitignore` and not pushed.
- **Fix:** Add to `.gitignore` if not already; remove from tracking and from history if ever committed.
- **Category:** **Safe to fix** (gitignore + ensure not committed); **manual verification**.

---

## 6. Low Findings

### 6.1 Duplicate auth pages: /auth vs app/auth

- **Files:** `auth/signin/page.tsx`, `auth/signup/page.tsx` at repo root vs `app/auth/signin/page.tsx`, `app/auth/signup/page.tsx`, etc.
- **Issue:** Two signin/signup entry points; routing depends on Next.js and middleware. Risk of confusion and duplicate maintenance.
- **Fix:** Prefer a single location (e.g. App Router under `app/auth/`) and redirect or remove the root `auth/` pages.
- **Category:** **Risky — manual review.** Confirm which URLs are in use (links, docs, OAuth callbacks) before removing.

---

### 6.2 Naming consistency: STRIPE_SECRET_KEY

- **Files:** All Stripe code and docs use `STRIPE_SECRET_KEY` consistently.
- **Note:** No inconsistency found; good to keep.

---

### 6.3 Console logging in API routes

- **Files:** Many files under `app/api/` use `console.log` / `console.error` / `console.warn` for errors and debug.
- **Issue:** No structured logger in most routes; levels and format differ; in production, console may be captured but not centralized.
- **Fix:** Use `createServerLogger(req)` from `lib/logger.ts` in API routes and replace ad-hoc console calls.
- **Category:** **Safe to auto-fix** incrementally; **manual review** to avoid logging sensitive data.

---

### 6.4 ErrorBoundary and error.tsx

- **Files:** `components/ErrorBoundary.tsx`, `app/error.tsx`, `app/[locale]/error.tsx`, `app/global-error.tsx`
- **Note:** Error boundaries exist; ensure all critical trees are covered and that `global-error` is minimal and always works.

---

## 7. Dead Code / Unused Files Summary

| Item | Location | Note |
|------|----------|------|
| `createSuccessResponse` | `lib/error-handler.ts` | Only in tests |
| `requireAuth` | `lib/auth.ts` | Only used by requireRole; no direct route use |
| `geocodeAddress`, `reverseGeocode` | `lib/google-maps.ts` | Not imported |
| `preloadResource`, `prefetchRoute` | `lib/performance.ts` | Not imported |
| `apiRateLimit` | `lib/rate-limit.ts` | Exported but never used |
| Root `auth/signin`, `auth/signup` | `auth/*.tsx` | Likely duplicate of app/auth |

---

## 8. Duplicated Patterns

| Pattern | Locations | Recommendation |
|--------|-----------|----------------|
| Bearer parsing + `supabase.auth.getUser(token)` | bookings/[id], cart/[id], settlements, reviews*, auth/update-profile | Use `getAuthUser(req)` everywhere |
| Raw try/catch + NextResponse.json({ error }) | Most API routes | Use `withErrorHandler` or `handleApiError` |
| Manual admin check (requireAdmin) vs withAuth(['admin']) | admin/*: mixed | Prefer one pattern (e.g. requireAdmin for admin/*) and document |

---

## 9. Fragile Areas (Likely to Break in Production)

1. **GET /api/bookings/[id]** — IDOR; any booking exposed.  
2. **Inventory API** — Unauthenticated writes; inventory and availability can be corrupted.  
3. **Promo codes** — Unauthenticated list and create; abuse and data leak.  
4. **Paddle webhook** — No verification; forged payments possible.  
5. **Rate limiting** — In-memory only; ineffective in multi-instance/serverless.  
6. **Params type** — Sync `params` in dynamic routes may break on Next.js 15.  
7. **Error handling** — Inconsistent; some routes may leak stack or return 500 for client errors.  
8. **Logs/error endpoint** — No rate limit; log flooding or abuse.

---

## 10. Configuration / Environment

- **Referenced env vars:**  
  NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_APP_URL, STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PAYPAL_*, PADDLE_*, RESEND_*, CRON_SECRET / VERCEL_CRON_SECRET, LINE_*, EXCHANGE_RATE_API_KEY, NEXT_PUBLIC_GOOGLE_MAPS_API_KEY, NODE_ENV, ANALYZE, BUILD_FOR_MOBILE.
- **Config issues:**  
  - Paddle webhook uses `PADDLE_PUBLIC_KEY` but does not verify.  
  - `.env.local (2).txt` should not be tracked.  
  - No single `.env.example` checklist was audited; ensure all required vars are documented.

---

## 11. Safe to Auto-Fix vs Risky (Manual Review)

### Safe to auto-fix (with optional light review)

- Add `requireAdmin` to GET and POST `/api/promo-codes` (confirm no public need for list/create).
- Replace inline Bearer + getUser with `getAuthUser(req)` in: bookings/[id], cart/[id], settlements, reviews (route + reports + reactions), auth/update-profile.
- Wrap more API handlers with `withErrorHandler` or consistent `handleApiError` in catch.
- Add `apiRateLimit` to contact, signup, bookings POST, logs/error (and tune limits).
- Add rate limiting to POST `/api/logs/error`.
- Remove or use: `createSuccessResponse`, `geocodeAddress`, `reverseGeocode`, `preloadResource`, `prefetchRoute`.
- Add `loading.tsx` for main segments.
- Ensure `.env.local (2).txt` and similar are gitignored and not committed.
- Replace `any` with proper types or `unknown` in selected files.
- Use `createServerLogger(req)` in API routes instead of raw console.

### Risky — requires manual review

- **GET /api/bookings/[id]:** Define and implement owner vs admin vs merchant access; add tests.
- **Inventory API:** Add merchant/admin auth and scope by merchant/tour; add tests.
- **Paddle webhook:** Implement real signature verification per Paddle docs; test in sandbox.
- **Replace in-memory rate limit** with shared store (Redis/KV); design and deploy.
- **Next.js 15 params:** When upgrading, update all dynamic route signatures and test.
- **Removing root `auth/`** pages: Verify all entry points and redirects first.

---

## 12. References

- Existing security and refactor notes: `docs/ARCHITECTURE_AUDIT_AND_REFACTORING_PLAN.md`
- Stripe: `docs/STRIPE_SETUP.md`
- Env vars: `docs/ENVIRONMENT_VARIABLES_EXPLAINED.md`, `.env.example`

---

*End of audit report. No code was modified.*
