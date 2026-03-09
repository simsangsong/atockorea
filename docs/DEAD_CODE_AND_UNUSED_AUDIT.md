# Dead Code and Unused Code Audit

**Date:** 2026-03-09  
**Scope:** Unused files, components, hooks, utilities, unreachable code, stale comments, duplicated/unreferenced files, obsolete test/demo code, unused imports.  
**No changes applied.**

---

## 1. Unused Files

| File path | Why it appears unused | Confidence | Safe to remove automatically? |
|-----------|------------------------|------------|--------------------------------|
| **auth/signin/page.tsx** | Root-level `auth/` is not under `app/`. Next.js App Router only serves routes under `app/`. This file is never used as a route; `app/auth/signin/page.tsx` is the active route. | **High** | **No.** Confirm no build step or redirect references `/auth/signin` from this tree; then remove. |
| **auth/signup/page.tsx** | Same as above; duplicate of `app/auth/signup/page.tsx`. | **High** | **No.** Same as above; verify links and OAuth callbacks use `app/auth` routes. |
| **lib/api-client.ts** | No import of `@/lib/api-client` or `apiClient` anywhere in app, components, or API routes. Comment says "for mobile and web" (e.g. Capacitor); may be intended for future mobile use. | **High** | **No.** If mobile is planned, keep; otherwise safe to remove after product confirmation. |
| **lib/performance.ts** | No file imports `@/lib/performance`. Exports `debounce`, `throttle`, `preloadResource`, `prefetchRoute` — none referenced elsewhere. | **High** | **Yes**, if no planned use. Low risk; no ties to auth/payment/booking. |
| **app/test-admin/page.tsx** | Demo page: "Test Admin Page / If you can see this, routing is working!". No links found from production UI; exposes `/test-admin` if deployed. | **High** | **No.** Remove only after confirming it is not used for smoke tests or redirects; otherwise safe to delete. |

---

## 2. Unused Components

All under `components/`. No other file imports these components (no `import ... from '...'` and no `<ComponentName />` in app or other components).

| File path | Why it appears unused | Confidence | Safe to remove automatically? |
|-----------|------------------------|------------|--------------------------------|
| **components/tour/FAQ.tsx** | No imports of `FAQ` from `@/components/tour/FAQ`. Tour FAQ UI is implemented inline (e.g. `app/tour/[id]/page.tsx` uses `FaqAccordion`; `app/jeju/[slug]/page.tsx` has its own FAQ block). | **High** | **No.** Could be legacy or alternate FAQ design; confirm with product/design before removing. |
| **components/tour/Breadcrumb.tsx** | No imports. Admin layout has its own `getBreadcrumbs`; tour pages don’t use this component. | **High** | **Yes**, if no planned breadcrumb on tour pages. |
| **components/tour/QuickFacts.tsx** | No imports. Tour detail uses `KeyInfoBar`, `CollapsibleSection`, etc., not QuickFacts. | **High** | **Yes**, low risk. |
| **components/tour/ImageGallery.tsx** | No imports. Tour detail uses `GalleryGrid`, not ImageGallery. | **High** | **Yes**, low risk. |
| **components/tour/BookingSidebar.tsx** | No imports. Tour detail uses `EnhancedBookingSidebar` (dynamic import). BookingSidebar may be an older version. | **High** | **No.** Ensure no server-side or conditional path uses it; then safe to remove. |
| **components/tour/RelatedTours.tsx** | No imports. Related tours may be inlined or unused in current design. | **High** | **No.** Confirm no locale or A/B use; then safe. |
| **components/tour/TourTabs.tsx** | No imports. Tour layout uses `CollapsibleSection` and other components, not TourTabs. | **High** | **Yes**, low risk. |
| **components/tour/TrustIndicators.tsx** | No imports. | **High** | **Yes**, low risk. |
| **components/SeasonalTours.tsx** | No imports. Home uses `TourList`, `DestinationsCards`, etc., not SeasonalTours. | **High** | **No.** Name suggests seasonal campaigns; confirm with product. |
| **components/optimized/LazyImage.tsx** | No imports. Images use Next.js `Image` or other components. | **High** | **Yes**, if no planned lazy-image usage. |

---

## 3. Unused Hooks

| File path | Export | Why it appears unused | Confidence | Safe to remove automatically? |
|-----------|--------|------------------------|------------|--------------------------------|
| **lib/hooks/useErrorHandler.ts** | `useErrorHandler` | No file imports `@/lib/hooks/useErrorHandler` or calls `useErrorHandler()`. | **High** | **No.** Hook may be for client error handling/redirect; confirm no future use, then remove. |

---

## 4. Unused Utility Functions

| File path | Export | Why it appears unused | Confidence | Safe to remove automatically? |
|-----------|--------|------------------------|------------|--------------------------------|
| **lib/performance.ts** | `debounce` | No imports. | **High** | **Yes** (with file removal). |
| **lib/performance.ts** | `throttle` | No imports. | **High** | **Yes** (with file removal). |
| **lib/performance.ts** | `preloadResource` | No imports. | **High** | **Yes** (with file removal). |
| **lib/performance.ts** | `prefetchRoute` | No imports. | **High** | **Yes** (with file removal). |
| **lib/google-maps.ts** | `geocodeAddress` | Only defined here; no other file imports or calls it. | **High** | **No.** Likely for future address→lat/lng; confirm then remove. |
| **lib/google-maps.ts** | `reverseGeocode` | Same as above. | **High** | **No.** Same as above. |
| **lib/error-handler.ts** | `createSuccessResponse` | Only used in `__tests__/lib/error-handler.test.ts`. No app or API route uses it. | **High** | **Yes.** Tests can use a local helper or keep for consistency; removing export is safe. |
| **lib/error-handler.ts** | `ApiError` (interface) | Exported but never used as a type (`: ApiError`, etc.) in codebase. | **High** | **Yes.** Type-only; safe to remove or keep for docs. |
| **lib/auth.ts** | `requireAuth` | No API route or component calls `requireAuth(req)`. Only used internally by `requireRole`. | **Medium** | **No.** Public API; might be used for "any authenticated user" later; prefer documenting over removal. |
| **lib/auth.ts** | `getAuthUserFromToken` | No caller; only defined in auth.ts. | **High** | **No.** Could be for token-based flows (e.g. email links); confirm then remove. |
| **lib/auth.ts** | `getMerchantId` | No caller. Returns merchant id for current user; could be for future merchant-scoped APIs. | **High** | **No.** Confirm no planned use, then remove. |
| **lib/rate-limit.ts** | `apiRateLimit` | Exported but never imported in any API route. Only `loginRateLimit` and `createMerchantRateLimit` are used. | **High** | **No.** Intended for public endpoints; wire to routes or document as "to use", don’t delete. |
| **lib/notifications.ts** | `notifyPaymentFailed` | No caller. Payment failure flow (e.g. PayPal) could use it later. | **High** | **No.** Touches payment state; add when implementing failure flow or remove after explicit decision. |
| **lib/notifications.ts** | `notifyMerchantNewOrder` | No caller. Could be for merchant dashboard alerts. | **High** | **No.** Reservation/merchant behavior; confirm then remove. |
| **lib/notifications.ts** | `notifyTourReminder` | No caller. Reminder cron uses `sendBookingReminderEmail`; in-app reminder could use this. | **High** | **No.** Booking/reminder behavior; confirm then remove. |

---

## 5. Unreachable Code

| File path | What | Why it appears unreachable | Confidence | Safe to remove automatically? |
|-----------|------|----------------------------|------------|--------------------------------|
| *(None found)* | — | No clear unreachable blocks (e.g. code after unconditional `return`) identified. Guard clauses like `return;` in async callbacks are reachable. | — | — |

---

## 6. Stale Commented-Out Code

| File path | What | Why it matters | Confidence | Safe to remove automatically? |
|-----------|------|----------------|------------|--------------------------------|
| **app/api/logs/error/route.ts** | Block comment (lines ~23–38): optional DB persistence for error logs (`supabase.from('error_logs').insert(...)`). | Documents a possible feature; not dead logic. | **High** | **No.** Keep as reference or convert to a ticket; removing may lose design intent. |

---

## 7. Duplicated / No-Longer-Referenced Files

| File path | Why it’s duplicated or unreferenced | Confidence | Safe to remove automatically? |
|-----------|--------------------------------------|------------|--------------------------------|
| **auth/signin/page.tsx** (root) | Duplicate of `app/auth/signin/page.tsx`. App Router does not serve root `auth/`. | **High** | **No.** Verify no references to this path (e.g. OAuth redirect_uri, docs); then remove. |
| **auth/signup/page.tsx** (root) | Duplicate of `app/auth/signup/page.tsx`. Same as above. | **High** | **No.** Same as above. |

---

## 8. Obsolete Test / Demo Code

| File path | What | Why it’s considered obsolete/demo | Confidence | Safe to remove automatically? |
|-----------|------|-----------------------------------|------------|--------------------------------|
| **app/test-admin/page.tsx** | Page that renders "Test Admin Page / If you can see this, routing is working!". | Clearly a routing test/demo; no production UI links to it. Exposes `/test-admin` if deployed. | **High** | **No.** Confirm not used in smoke tests or redirects; then remove. |
| **app/seoul/page.tsx** | Static list of two tours (`seoulTours`), uses `TourCard`. | Uses hardcoded data; real tours may come from API. Could be intentional landing page. | **Medium** | **No.** Product decision; may be demo or real city page. |
| **app/busan/page.tsx** | Static list; first item is "Jeju" city (likely copy-paste). | Same as above; plus possible data bug (wrong city). | **Medium** | **No.** Fix data if wrong; keep or remove page per product. |

---

## 9. Imports That Are Never Used

No project-wide automated scan was run (e.g. ESLint `no-unused-vars` / `@typescript-eslint/no-unused-vars`). Recommended:

- Run: `npx eslint . --ext .ts,.tsx --rule '@typescript-eslint/no-unused-vars: error'` (or equivalent) and fix reported unused imports.
- Manually verified: no obvious unused-import patterns were found in the sampled files (e.g. `app/api/stripe/webhook/route.ts`, `app/tour/[id]/page.tsx`); `useRef` and `useI18n` are used.

**Recommendation:** Rely on ESLint for a full unused-import list; then remove or comment with a short reason where keeping is intentional.

---

## 10. Relation to Sensitive Areas

Per your focus areas, the following unused items touch reservation, payment, or auth and should be treated with extra care:

- **Reservation / payment state**
  - **lib/notifications.ts:** `notifyPaymentFailed`, `notifyMerchantNewOrder`, `notifyTourReminder` — unused but relate to payment failure, merchant orders, and reminders. Do not remove without deciding whether these flows will be implemented; if removed, ensure no callers are added later that expect them.
- **Auth / session**
  - **auth/signin/page.tsx**, **auth/signup/page.tsx** (root) — duplicate auth pages; removal could affect any link or redirect still pointing at root `auth/` paths.
  - **lib/auth.ts:** `getAuthUserFromToken`, `requireAuth`, `getMerchantId` — unused; could be part of token-based or merchant-scoped auth. Prefer explicit product decision before removal.
- **Admin-only**
  - **app/test-admin/page.tsx** — test page; ensure no admin or smoke test depends on `/test-admin` before removal.
- **Webhooks / idempotency**
  - No dead code identified that directly implements webhook handlers or idempotency; notification helpers above are the only related unused code.
- **Multi-language**
  - No unused code specifically for multi-language fields; component removal (e.g. FAQ, Breadcrumb) could affect i18n if those components are later wired for translations.
- **Database writes**
  - **lib/notifications.ts** — unused notification functions perform DB writes (notifications table); removing them is safe only when you are sure no future code path will call them.

---

## 11. Summary Tables

### Safe to remove automatically (low risk, no auth/payment/reservation impact)

- **lib/performance.ts** (entire file) — no references.
- **lib/error-handler.ts:** `createSuccessResponse` (and optionally `ApiError` interface) — only used in tests or not at all.
- **components/tour/Breadcrumb.tsx**, **QuickFacts.tsx**, **ImageGallery.tsx**, **TourTabs.tsx**, **TrustIndicators.tsx** — no imports.
- **components/optimized/LazyImage.tsx** — no imports.

Still recommend a quick grep/search for each before bulk delete (e.g. dynamic imports or string-based references).

### Do not remove without product/security review

- Root **auth/** pages (duplicates of app/auth).
- **lib/api-client.ts** (possible mobile use).
- **lib/auth.ts:** `requireAuth`, `getAuthUserFromToken`, `getMerchantId`.
- **lib/notifications.ts:** `notifyPaymentFailed`, `notifyMerchantNewOrder`, `notifyTourReminder`.
- **lib/rate-limit.ts:** `apiRateLimit` (wire to routes instead of deleting).
- **app/test-admin/page.tsx** (confirm not used in tests or redirects).
- **components/tour/BookingSidebar.tsx**, **RelatedTours.tsx**, **FAQ.tsx**; **components/SeasonalTours.tsx** — possible future or alternate UX.
- **lib/google-maps.ts:** `geocodeAddress`, `reverseGeocode` — likely for future features.
- **lib/hooks/useErrorHandler.ts** — may be for client error handling.

---

*End of dead code and unused code audit. No code was modified.*
