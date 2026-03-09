# Fragile and Unstable Code Paths — Audit Report

**Date:** 2026-03-09  
**Scope:** Race conditions, null/optional chaining, async handling, try/catch, promises, client/server boundaries, hydration, stale state, auth assumptions, payment/reservation consistency, DB updates, redirects, validation, loading/error/empty states.  
**No code changes applied.**

---

## 1. Webhook idempotency — Stripe and PayPal

### Issue
Stripe webhook (`checkout.session.completed`) and PayPal webhook (PAYMENT.CAPTURE.COMPLETED) do **not** check whether the booking is already paid before updating and sending the confirmation email. Duplicate delivery (retries, replay) can overwrite `payment_reference` and send the confirmation email again.

### Affected files
- `app/api/stripe/webhook/route.ts` (case `checkout.session.completed`)
- `app/api/webhooks/paypal/route.ts` (PAYMENT.CAPTURE.COMPLETED branch)

### Why it is fragile
- Stripe/PayPal may retry webhooks; handlers are not idempotent.
- Paddle webhook, by contrast, does check: `if (booking.payment_status === 'paid' && booking.payment_transaction_id === transaction.id)` and returns early.

### Real-world failure scenario
Stripe retries the same `checkout.session.completed` event; the handler runs twice. Second run updates the booking again and sends a second confirmation email. Customer receives duplicate emails; logs show duplicate processing.

### Severity
**Medium.** No double charge (payment is external), but duplicate emails and unnecessary DB writes; can complicate support and analytics.

### Safe to auto-fix?
**No.** Fix requires: (1) select booking and check `payment_status === 'paid'` (and for Stripe, optional match on `payment_reference`); (2) if already paid, return 200 and skip update + email; (3) ensure first run still updates and sends email. Manual review and tests (including duplicate event) recommended.

---

## 2. Inventory `available_spots` read-modify-write race

### Issue
Inventory is updated with a read-then-write pattern: read `available_spots` (or compute from bookings), compute new value, then `update(...).eq('id', inventory.id)`. No row-level locking or atomic increment. Two concurrent requests (e.g. two bookings or two cancels for the same tour/date) can both read the same value, both compute, both write — leading to overbooking or double-restore.

### Affected files
- `app/api/bookings/route.ts` (after creating booking: read inventory, compute `newAvailableSpots`, update)
- `app/api/bookings/[id]/route.ts` (on cancel: read inventory, add back guests, update)
- `app/api/admin/orders/[id]/route.ts` (on cancel: same restore pattern)

### Why it is fragile
Concurrent requests see the same `available_spots`; both apply their delta; last write wins and one update is lost.

### Real-world failure scenario
Two users book the last 2 seats at the same time. Both reads see 2 available; both write 0 (or 1). One booking’s decrement is lost; inventory shows 1 or 2 available instead of 0; third party could book a non-existent seat.

### Severity
**High** for overbooking; **medium** for double-restore on cancel (capacity temporarily inflated).

### Safe to auto-fix?
**No.** Proper fix needs DB-level atomicity (e.g. `update ... set available_spots = available_spots - $1 ... where id = $2 and available_spots >= $1`, or advisory lock / serializable transaction). Requires schema/query design and tests.

---

## 3. Confirmation page: fetch without `res.ok` and no request cancellation

### Issue
Confirmation page fetches `/api/bookings/${bookingId}` with `.then(res => res.json()).then(data => ...)`. It does not check `res.ok`. Non-2xx responses (e.g. 404/500) still flow into `.then`; body may be `{ error: "..." }` so `data.booking` is falsy and the code redirects — so behavior is partly correct. But: (1) 4xx/5xx are not treated as explicit errors (no user feedback, no retry); (2) the effect has no cleanup: if the user navigates away before the promise settles, `setBookingData` or `router.push` can still run (stale update / redirect after unmount).

### Affected files
- `app/tour/[id]/confirmation/page.tsx`

### Why it is fragile
- Unhandled promise can update state after unmount (React may warn in dev).
- No AbortController; slow network + quick back navigation can leave a dangling request that later runs.

### Real-world failure scenario
User completes payment, lands on confirmation, then clicks Back before the fetch completes. Fetch completes later and calls `setBookingData` or `router.push`; user may already be on another page. Minor UX/state inconsistency; in rare cases redirect could override intended route.

### Severity
**Low to medium.** No payment or reservation logic; mainly UX and lifecycle.

### Safe to auto-fix?
**Partially.** Safe changes: (1) check `res.ok` before `res.json()` and in non-ok case set error state or redirect; (2) use an `isMounted` or `aborted` flag (or AbortController) in the effect and skip `setBookingData` / `router.push` if unmounted/aborted. Logic and redirect targets should be reviewed so existing behavior is preserved.

---

## 4. Confirmation page: no loading/error state for fetch failure

### Issue
While the fetch is in flight or when it fails (network error, 500), the user only sees “Loading confirmation...” or a redirect. There is no explicit “Failed to load” or retry; on catch they fall back to sessionStorage or redirect. If both fetch and sessionStorage fail, they redirect to tour page without explaining why.

### Affected files
- `app/tour/[id]/confirmation/page.tsx`

### Why it is fragile
User may not understand why they were sent back; no retry path for transient failures.

### Real-world failure scenario
API returns 503; `.catch` runs; no sessionStorage (e.g. new tab); user is redirected to tour page with no message. User thinks booking might have failed.

### Severity
**Low.** UX only; no data or payment impact.

### Safe to auto-fix?
**Yes.** Add an error state (e.g. `fetchError`), show a short message and a “Retry” or “Back to tour” button; keep existing redirect/sessionStorage fallback. Low risk.

---

## 5. sessionStorage as source of truth for confirmation data

### Issue
Confirmation page stores booking display data in `sessionStorage` and, when fetch fails or on direct load, reads from it. If the user opens the confirmation URL in a new tab or after closing the tab, sessionStorage may be empty and they are redirected. No server-side verification that the booking is paid before showing confirmation; GET /api/bookings/[id] is used but the page does not enforce “only show if payment is completed” on the client (the API returns the booking regardless of payment status for that route — see IDOR note in prior audits).

### Affected files
- `app/tour/[id]/confirmation/page.tsx`

### Why it is fragile
- sessionStorage is tab-scoped and can be cleared; not a reliable single source of truth.
- If GET /api/bookings/[id] is later restricted to owner or paid status, confirmation flow must still work for the redirect-from-Stripe case.

### Real-world failure scenario
User bookmarks confirmation URL or opens in new tab; sessionStorage empty; immediate redirect to tour page. Confusion.

### Severity
**Low.** Edge case; main flow (redirect with session_id + booking_id) uses fetch.

### Safe to auto-fix?
**Partially.** Prefer always fetching by bookingId when session_id/booking_id are present; use sessionStorage only as fallback for display. Do not change GET /api/bookings/[id] behavior in this audit; fix IDOR and payment visibility in a separate change.

---

## 6. Optional chaining and `as any` on payment/booking paths

### Issue
Payment and booking code uses `(booking.tours as any).title`, `(booking.user_profiles as any).email`, and similar. If Supabase join shape changes or is null, this can throw at runtime or show “undefined”. Some paths guard with `if (booking.tours)` but not consistently.

### Affected files
- `app/api/stripe/webhook/route.ts` (booking.tours, booking.user_profiles)
- `app/api/paypal/capture-order/route.ts` (booking.user_profiles, booking.tours)
- `app/api/webhooks/paypal/route.ts` (targetBooking.user_profiles, targetBooking.tours)
- `app/api/bookings/[id]/route.ts` (fullBooking.tours, fullBooking.pickup_points, userProfile)

### Why it is fragile
Type safety is bypassed; null/undefined can cause runtime errors or wrong email/name in emails.

### Real-world failure scenario
Supabase returns `tours: null` for a corrupted or deleted tour; code does `(booking.tours as any).title` and throws; webhook handler returns 500; Stripe retries; confirmation email never sent.

### Severity
**Medium** where it can throw (email path); **low** where fallbacks exist.

### Safe to auto-fix?
**Partially.** Safe to add null checks and optional chaining (e.g. `booking.tours?.title`) and to narrow types instead of `as any`. Avoid changing business logic (e.g. when to send email). Manual review for each caller.

---

## 7. Resend webhook: promise not awaited; errors only logged

### Issue
In `app/api/webhooks/resend/route.ts`, after processing the event, a Supabase insert (or similar) is done with `.then(({ error: inquiryErr }) => { if (inquiryErr) console.error(...) })`. The handler does not await this promise. Response is sent before the write completes; if the write fails, the client already got 200 and the error is only logged.

### Affected files
- `app/api/webhooks/resend/route.ts`

### Why it is fragile
Partial success: webhook is “processed” but side effect (e.g. saving to contact_inquiries) can fail silently; no retry from Resend’s side if we return 200.

### Real-world failure scenario
Resend sends event; we return 200; Supabase insert fails (e.g. constraint); error is logged; inquiry is lost.

### Severity
**Low to medium** depending on how critical saving the inquiry is.

### Safe to auto-fix?
**Yes.** Await the promise (or use async/await) and return 500 (or 503) if the write fails, so Resend can retry. Ensure Resend treats 5xx as retriable.

---

## 8. JSON.parse without try/catch (or with silent catch)

### Issue
Several places parse `special_requests` or similar with `JSON.parse(...)`. Some are inside try/catch; others assume valid JSON. If the field is malformed (e.g. user input), parse can throw and blow up the handler or leave email/name unset.

### Affected files
- `app/api/webhooks/paypal/route.ts` (payment_provider_data: `JSON.parse(booking.payment_provider_data || '{}')` inside try/catch — OK)
- `app/api/bookings/[id]/route.ts` (special_requests in cancellation email path — inside try/catch)
- `app/api/admin/orders/[id]/route.ts` (special_requests — inside try/catch)
- Client: `app/tour/[id]/confirmation/page.tsx` (special_requests and sessionStorage — try/catch present)

### Why it is fragile
Any new or missed `JSON.parse` on untrusted or stored data without try/catch is a single point of failure.

### Real-world failure scenario
Legacy or malformed `special_requests` string; parse throws; request fails with 500; cancel flow or email resolution fails.

### Severity
**Low** where try/catch exists; **medium** if any critical path parses without catch.

### Safe to auto-fix?
**Yes** where parse is currently unguarded: wrap in try/catch and use a fallback (e.g. `{}` or existing defaults). Audit all `JSON.parse` in API and key client paths.

---

## 9. Mypage layout: session vs localStorage fallback and auth assumption

### Issue
Mypage layout loads user data from Supabase session first, then falls back to localStorage (userAvatar, userName, userEmail) if there is no session. It assumes that “no session” implies “use localStorage” and that localStorage is in sync with the last known user. If the user logged out elsewhere or session expired but localStorage was not cleared, UI can show stale or wrong user data.

### Affected files
- `app/mypage/layout.tsx`

### Why it is fragile
Two sources of truth (session vs localStorage); logout or session expiry may not clear localStorage in all code paths; stale localStorage can show a previous user’s name/avatar.

### Real-world failure scenario
User A logs out (session cleared); localStorage not cleared. User B uses same device; mypage might still show User A’s name/avatar from localStorage until B logs in and overwrites.

### Severity
**Medium** on shared devices; **low** on single-user.

### Safe to auto-fix?
**No.** Fix is product/UX: when to clear localStorage, whether to trust it when session is absent, and whether mypage should require session and redirect if missing. Manual design and review.

---

## 10. Admin/merchant routes: error response handling and `err.message` check

### Issue
Some admin routes catch and check `err.message === 'Unauthorized' || err.message?.includes('Forbidden')` to return 403. This ties behavior to the exact string thrown by `requireAdmin` or similar. If the auth layer changes the message or throws a different error type, 403 handling can break and expose 500 or wrong status.

### Affected files
- `app/api/admin/orders/[id]/route.ts` (catch (err: any), check message)
- `app/api/merchant/products/route.ts` (similar)
- `app/api/admin/settings/route.ts` (similar)
- `app/api/admin/merchants/[id]/route.ts` (similar)

### Why it is fragile
Brittle dependency on error message text; auth refactors can silently change behavior.

### Real-world failure scenario
requireAdmin is changed to throw with message "Admin required"; code checks for "Unauthorized" or "Forbidden"; 403 is no longer returned; callers get 500 and generic “Internal server error”.

### Severity
**Low.** Only affects error status and message seen by client.

### Safe to auto-fix?
**Partially.** Prefer catching a dedicated error type (e.g. AppError with code) or checking `err.statusCode === 403` if your auth layer sets it. Requires a small, consistent contract in lib/auth and lib/error-handler.

---

## 11. Booking date and inventory key: `booking_date.split('T')[0]`

### Issue
Server code uses `currentBooking.booking_date.split('T')[0]` or `existing.booking_date?.toString().split('T')[0]` to get a date key for inventory lookups. If `booking_date` is null, undefined, or not a string, `.split` can throw or produce an invalid key.

### Affected files
- `app/api/bookings/[id]/route.ts` (cancel path: `currentBooking.booking_date.split('T')[0]` — no optional chaining)
- `app/api/admin/orders/[id]/route.ts` (`existing.booking_date?.toString().split('T')[0]` — guarded)

### Why it is fragile
bookings/[id] assumes `booking_date` is always a string when status is cancelled; a bad row or type could throw.

### Real-world failure scenario
Rare bad data or type (e.g. number); split throws; cancel fails with 500; inventory not restored.

### Severity
**Low.** Defensive check is cheap.

### Safe to auto-fix?
**Yes.** Use optional chaining and/or `String(booking_date).split('T')[0]` with a fallback (e.g. skip inventory restore if no valid date). Preserve existing behavior when data is valid.

---

## 12. Missing loading or error state on client fetch

### Issue
Several pages fetch data in useEffect but do not expose a clear loading or error state (or only a generic one). User may see a blank screen, stale data, or a single message that doesn’t distinguish “loading” vs “error” vs “empty”.

### Affected files
- Various admin and mypage list/detail pages (some have loading, some minimal)
- `app/tour/[id]/confirmation/page.tsx` (loading only; no error state for fetch failure)
- `app/jeju/[slug]/page.tsx` (complex state; worth checking loading/error coverage)

### Why it is fragile
Poor UX and harder to debug; users may retry unnecessarily or think the app is broken.

### Real-world failure scenario
API is slow or returns 500; user sees “Loading...” indefinitely or a sudden redirect with no explanation.

### Severity
**Low** for most pages; **medium** for payment-related (e.g. confirmation) where clarity matters.

### Safe to auto-fix?
**Yes** for adding explicit loading/error/empty states and messages. Prefer i18n for messages. Low risk if behavior (when to redirect, when to show list) is unchanged.

---

## 13. Stale state in useEffect without cleanup

### Issue
Several useEffects start async work (fetch, auth) and then call setState or router.push. If the component unmounts or dependencies change before the work completes, the callback may still run. tour/[id]/page.tsx uses an `isMounted` flag to guard; confirmation page does not.

### Affected files
- `app/tour/[id]/confirmation/page.tsx` (fetch in effect, no cleanup)
- `app/mypage/layout.tsx` (loadUserData in effect, no cleanup)
- `app/auth/callback/page.tsx` (handleCallback in effect, no cleanup)
- Others that fetch in useEffect without AbortController or isMounted

### Why it is fragile
setState after unmount can trigger React warnings and, in theory, leaks or wrong UI if the component tree is reused. router.push after unmount can still change route.

### Real-world failure scenario
User navigates away quickly; async callback runs later; setState or router.push runs; minor inconsistency or unexpected redirect.

### Severity
**Low** in most cases; **medium** if it leads to wrong redirect (e.g. after payment).

### Safe to auto-fix?
**Partially.** Adding an isMounted flag or AbortController and skipping setState/router when unmounted/aborted is usually safe. Must not change the intended flow when the user stays on the page; manual check per effect.

---

## 14. Duplicate source of truth for “active” booking status

### Issue
The set of statuses that mean “active” (count toward capacity, trigger reminders, etc.) is repeated: `.in('status', ['pending', 'confirmed'])` and `.eq('status', 'confirmed')` appear in multiple files. If product adds or renames a status, multiple places must be updated.

### Affected files
- `app/api/bookings/route.ts` (list filter)
- `app/api/tours/[id]/availability/route.ts`, `app/api/tours/[id]/availability/range/route.ts`
- `app/api/admin/merchants/[id]/route.ts`
- `app/api/emails/reminders/route.ts`
- Docs or constants (if any)

### Why it is fragile
Inconsistent filter (e.g. one route adds ‘approved’) can cause overbooking, wrong counts, or reminders sent/not sent incorrectly.

### Real-world failure scenario
New status “approved” is introduced; reminders still only use “confirmed”; some approved bookings never get a reminder. Or one route uses ['pending','confirmed','approved'] and another does not; availability and lists disagree.

### Severity
**Medium** for reservation and reminder consistency.

### Safe to auto-fix?
**Partially.** Safe to introduce a shared constant (e.g. `ACTIVE_BOOKING_STATUSES`, `CONFIRMED_STATUS`) and use it everywhere. Requires a single definition and tests. Do not change which statuses are considered active without product agreement.

---

## 15. Payment status and booking status updated together

### Issue
When marking a booking as paid, code sets both `payment_status: 'paid'` and `status: 'confirmed'` in the same update. If the update succeeds but a subsequent step (e.g. sending email) fails, the booking is already marked paid/confirmed. There is no “pending_payment” or rollback; the email is best-effort (log and continue). This is a design choice, not necessarily wrong, but it is a single place where payment and reservation state are tied.

### Affected files
- `app/api/stripe/webhook/route.ts`
- `app/api/paypal/capture-order/route.ts`
- `app/api/webhooks/paypal/route.ts`
- `app/api/paddle/webhook/route.ts` (does not set status to confirmed in the snippet seen — verify)

### Why it is fragile
If email or notification is critical, “update DB then email” can leave users without confirmation. If you later add retry for email, you must not re-update booking (idempotency).

### Real-world failure scenario
DB update succeeds; Resend is down; email fails; user is paid and confirmed in DB but never gets confirmation email. Support burden.

### Severity
**Low** if email is best-effort and documented; **medium** if confirmation email is required by policy.

### Safe to auto-fix?
**No.** This is product/ops: whether to queue emails, retry, or show a message in UI. Code can add logging and idempotency (see item 1) without changing the “update then email” order.

---

## Summary table

| # | Issue | Severity | Safe to auto-fix? |
|---|--------|----------|-------------------|
| 1 | Webhook idempotency (Stripe, PayPal) | Medium | No |
| 2 | Inventory read-modify-write race | High | No |
| 3 | Confirmation fetch: no res.ok, no cleanup | Low–Medium | Partially |
| 4 | Confirmation: no error/retry state | Low | Yes |
| 5 | sessionStorage as confirmation fallback | Low | Partially |
| 6 | Optional chaining / as any on payment paths | Medium | Partially |
| 7 | Resend webhook promise not awaited | Low–Medium | Yes |
| 8 | JSON.parse without try/catch | Low–Medium | Yes (where missing) |
| 9 | Mypage session vs localStorage | Medium | No |
| 10 | Admin error message string check | Low | Partially |
| 11 | booking_date.split without guard | Low | Yes |
| 12 | Missing loading/error state | Low | Yes |
| 13 | useEffect without cleanup | Low–Medium | Partially |
| 14 | Duplicate “active status” definition | Medium | Partially |
| 15 | Payment + status update then email | Low–Medium | No |

---

## Special attention (as requested)

- **Reservation status consistency:** Covered by inventory race (2), idempotency (1), and duplicate active-status definition (14).
- **Payment state transitions:** Covered by webhook idempotency (1) and payment+status update (15).
- **Admin-only actions:** Covered by error message check (10); no change to admin auth itself.
- **Webhook idempotency:** Item 1; Paddle is already correct; Stripe and PayPal need “already paid” check.
- **Duplicate booking risks:** Item 2 (inventory race) is the main driver; no separate “double booking creation” path found.
- **Auth/session edge cases:** Item 9 (mypage session vs localStorage); confirmation page does not depend on auth for GET booking (but GET /api/bookings/[id] has IDOR risk, separate from this audit).
- **Client-side assumptions:** Confirmation page assumes API returns booking and uses sessionStorage as fallback; no server-side “must be paid” check on the page itself.
- **Multi-language:** Not a focus of this pass; loading/error messages (item 12) should use i18n when added.
- **Database writes that can partially fail:** Items 2 (inventory), 7 (Resend webhook), 15 (update then email). Recommendation: await and handle write failures where critical; use idempotency where appropriate.

---

*End of fragile and unstable code audit. No code was modified.*
