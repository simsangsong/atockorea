# Maintainability and Project Structure Report

**Date:** 2026-03-09  
**Scope:** Folder structure, naming, file size, component responsibilities, repeated business logic, separation of concerns, utilities, data/UI/business boundaries.  
**No refactors applied.**

---

## 1. Maintainability Issues

### 1.1 Confusing or inconsistent folder structure

- **tour vs tours (singular vs plural)**  
  - **app:** `app/tour/[id]/` (detail, checkout, confirmation) vs `app/tours/` (listing).  
  - **components:** `components/tour/` (detail/booking) vs `components/tours/` (list/filter).  
  Convention is consistent (singular = one, plural = list) but the two names appear in both app and components, which can confuse onboarding and navigation.

- **Many top-level app segments**  
  `app/` has many siblings: `admin/`, `auth/`, `tour/`, `tours/`, `mypage/`, `merchant/`, `dashboard/`, `cart/`, `search/`, `contact/`, `jeju/`, `seoul/`, `busan/`, `signin/`, `signup/`, etc. No grouping (e.g. `(dashboard)/admin`, `(auth)/signin`) or single place that documents how they relate.

- **No dedicated shared-UI folder**  
  There is no `components/ui/` or `components/shared/`. Reusable pieces (Header, Footer, ErrorBoundary, ContactForm, TourCard, etc.) sit at `components/` root next to feature folders (`tour/`, `tours/`, `maps/`, `admin/`). “Shared vs feature” is implied by name/folder, not by a clear convention.

- **API organization**  
  `app/api/` is resource- and feature-based (bookings, cart, tours, admin/*, auth/*, stripe, paypal, webhooks). This is clear; the main ambiguity is “admin vs merchant” (platform admin vs merchant dashboard), which is logical but could be spelled out in a short doc.

### 1.2 Naming consistency

- **Booking status values**  
  Same set (`pending`, `confirmed`, `completed`, `cancelled`) is repeated as string literals and in type definitions across many files. No single shared constant or enum, so a typo or new value can drift (e.g. `canceled` vs `cancelled`).

- **Status labels and option lists**  
  Admin orders, admin page, mypage, merchant orders each define their own status→label mapping and sometimes option lists, in different languages (Korean, English, Chinese). Same semantics, duplicated and easy to get out of sync.

- **“Active” booking definitions**  
  Logic like “upcoming = pending or confirmed and date in future” and “only count pending/confirmed for availability” is repeated in API routes and UI (e.g. `['pending', 'confirmed']` in availability, reminders, admin merchants, mypage filters). No single source of truth for “active” or “bookable” status set.

- **Merchant vs admin**  
  Naming is consistent (admin = platform, merchant = seller dashboard); the split is clear once you know it but not documented in the repo.

### 1.3 Too-large files

| File | ~Lines | Concern |
|------|--------|--------|
| `app/admin/products/page.tsx` | **~2,075** | Single page: list, filters, edit modal, multi-tab form (basic, gallery, itinerary, pickup, translations), image upload, locale bulk edit, discount UI. Many responsibilities and state variables in one file. |
| `app/jeju/[slug]/page.tsx` | **~1,243** | Detail page: fetch, static fallback, full tour transform, FAQ, itinerary, gallery, booking CTA, SEO. Could be split into layout + sections + hooks. |
| `app/tour/[id]/page.tsx` | **~664** | Tour detail: fetch, error/loading, hero, content sections. Large but more focused than admin/products. |
| `app/cart/page.tsx` | **~600** | Cart list, item updates, remove, checkout redirect. Many state and handlers in one page. |
| `app/tour/[id]/checkout/page.tsx` | **~473** | Checkout form, payment method, API calls. |
| `app/signup/page.tsx` | **~476** | Sign-up form, validation, OAuth, profile creation. |
| `app/mypage/settings/page.tsx` | **~437** | Settings form and save. |
| `app/admin/contacts/page.tsx` | **~448** | Contact list, filters, detail, reply. |
| `app/admin/emails/page.tsx` | **~411** | Email list, detail view, HTML render. |
| `components/tour/EnhancedBookingSidebar.tsx` | **~492** | Date picker, guests, pickup, promo, availability fetch, price/deposit calculation, booking submit. Mix of UI and price/availability logic. |
| `components/tours/DetailedTourCard.tsx` | **~366** | Card layout, wishlist, price display, links. |
| `lib/email.ts` | **~549** | Resend client init, base HTML styles, and all email templates (booking confirmation, reminder, cancellation, merchant welcome, etc.) in one module. |

Other files in the 300–400 line range (e.g. admin orders [id], mypage mybookings, confirmation, signin, API routes) are manageable but would benefit from extraction if they grow.

### 1.4 Mixed responsibilities in components

- **admin/products/page.tsx**  
  Combines: data fetching, list UI, search/filter state, edit modal open/close, form state for the whole tour (basic, gallery, itinerary, pickups, translations), image upload handlers, locale bulk JSON, discount/preview, pickup name editing. Editing and listing are tightly coupled in one component. No dedicated hooks (e.g. `useTourForm`, `useTourList`) or subcomponents for form sections.

- **EnhancedBookingSidebar**  
  Handles: availability API calls, date/guest/pickup state, promo application, payment method (deposit vs full), **subtotal/total/deposit/balance calculation** (formulas similar to API), and submit-to-booking API. Price and deposit logic is effectively business logic duplicated from the API; the sidebar both displays and “authoritatively” computes amounts that the server should own.

- **jeju/[slug]/page.tsx**  
  Fetches tour, normalizes API response into a detailed view model, handles static fallback, and renders many sections (hero, itinerary, FAQ, gallery, CTA). One component does data shape transformation and all sections; sections could be separate components or a small number of section components.

- **Header.tsx (~328 lines)**  
  Navigation, auth state, mobile menu, search, language switcher. Could be split into Header shell + NavLinks + UserMenu + SearchBar if it grows further.

### 1.5 Repeated business logic in UI

- **Booking status**  
  - “Active” or “upcoming” = `pending` or `confirmed` (and sometimes date in future): repeated in `app/api/bookings/route.ts`, `app/api/tours/[id]/availability/route.ts`, `app/api/tours/[id]/availability/range/route.ts`, `app/api/admin/merchants/[id]/route.ts`, `app/api/emails/reminders/route.ts`, and in mypage dashboard/upcoming/mybookings.  
  - Status labels and dropdown options: repeated in admin orders (list and [id]), admin page, merchant orders, mypage mybookings/history with different languages.

- **Price / deposit display**  
  - `EnhancedBookingSidebar` computes subtotal, total, deposit, balance (including deposit vs full, currency) for display and for the payload it sends to the booking API. The API also computes prices from tour + guests. Two places can diverge (e.g. rounding, deposit rules).

- **Review eligibility**  
  “Only completed bookings can be reviewed” is enforced in the API; the UI (mypage reviews) only shows completed bookings for “write review.” Logic is not duplicated, but the rule is not shared as a constant or helper name.

### 1.6 Separation of concerns

- **Data layer**  
  - **API routes** use `createServerClient()` (service role) and perform almost all writes and most business reads (bookings, tours, inventory, etc.).  
  - **Server layout** `app/tour/[id]/layout.tsx` uses `createServerClient()` to load tour for SEO/structured data.  
  - **Client pages** use the anon `supabase` from `lib/supabase` for: auth (`getSession`, `signIn`, `signUp`, `exchangeCodeForSession`, `signOut`), and limited reads (e.g. `user_profiles` in signup/callback, profile in checkout/mypage settings).  
  So: **bookings** are API-only (good). **Tours** are read in API and in one server layout; **user_profiles** and auth are touched in both API and client. The boundary is mostly clear for bookings; for auth/session it’s intentional that client talks to Supabase auth and some profile reads.

- **Business logic**  
  - **Canonical** booking status transitions, payment completion, and price calculation live in **API routes and webhooks**.  
  - **Display and form** logic (what to show, what to send) live in **components**; the main duplication is **price/deposit math in EnhancedBookingSidebar** vs API.

- **UI layer**  
  - Many pages own both “fetch + transform” and “render.” No clear data-fetching layer (e.g. dedicated hooks or server components that only pass data). This is acceptable for an App Router app but makes large pages (admin/products, jeju slug) harder to split.

### 1.7 Hard-to-maintain utilities

- **lib/email.ts**  
  One file: Resend client init, base CSS string, `sendEmail`, and all templates (booking confirmation, reminder, cancellation, merchant welcome, etc.). Adding a new template or changing styles requires editing a long file; templates are not co-located by feature (e.g. booking vs merchant). No single “bad” pattern, but the file is a bottleneck.

- **lib/auth.ts**  
  Central place for getAuthUser, requireAdmin, requireRole, getMerchantId. Size (~257 lines) is still fine; if it grows (e.g. more role checks, session shape changes), splitting “session resolution” vs “role/merchant helpers” would help.

- **lib/i18n.ts**  
  Locale list, loading of message JSON, context. ~306 lines. Could be split into “config/locales” vs “provider + hooks” if more locales or server-side i18n are added.

- **Participant rules / pickup points**  
  `lib/participant-rules` and pickup-point types are used in admin and tour UI. They’re single-purpose; no maintainability issue except that tour-related types are repeated (e.g. pickup point shape in several components).

### 1.8 Weak boundaries between data, UI, and business logic

- **Data**  
  - Bookings: only API and server layout (for SEO) touch bookings; boundary is strong.  
  - Tours: read in API, in tour layout, and in admin/products via client `supabase` (after auth). So one admin page bypasses the public tours API and talks to DB through the client; acceptable for admin but different pattern from the rest of the app.  
  - Auth/session: used in both API (Bearer/cookie in getAuthUser) and client (getSession, signIn, etc.). Clear enough given Supabase’s model.

- **UI**  
  - No formal “presentation only” layer. Many components are smart (fetch, handle submit, show errors). This is normal for React but makes reuse and testing harder where the same “block” (e.g. status badge, price summary) is reimplemented with small variations.

- **Business logic**  
  - **Server:** Status rules, payment flows, and pricing are in API routes and webhooks; good.  
  - **Client:** Price/deposit in EnhancedBookingSidebar is the main place where “business” rules are reimplemented in the UI. Elsewhere, UI mostly displays API data or sends user input to the API.

---

## 2. Suggested Structure Improvements

### 2.1 Folder and convention docs

- Add a short **README or CONTRIBUTING** section (or doc under `docs/`) that explains:
  - **tour** = single-tour flows (detail, checkout, confirmation); **tours** = listing.
  - **admin** = platform admin; **merchant** = merchant dashboard.
  - Where shared vs feature components live (today: root vs `tour/`, `tours/`, `maps/`, `admin/`).
- Optionally introduce **components/shared/** or **components/ui/** and move a few generic components (e.g. ErrorBoundary, Logo, TrustBar) there over time; document the convention.

### 2.2 Constants and shared definitions

- **Booking status**  
  - Define a single list of statuses and “active”/“upcoming” subset (e.g. `lib/constants/booking-status.ts` or next to existing `lib/` modules).  
  - Use it in API routes (availability, reminders, admin) and, where possible, in UI (filters, badges).  
  - Optionally add a small helper: “isUpcoming(booking)” or “activeStatuses” used everywhere.

- **Status labels**  
  - One mapping (or i18n keys) for status → display label, and reuse in admin orders, admin page, merchant orders, mypage. Reduces duplication and keeps translations consistent.

### 2.3 Splitting large files (in order of impact)

- **app/admin/products/page.tsx**  
  - Extract the **edit modal** into a separate component (e.g. `admin/ProductEditModal.tsx` or under `components/admin/`) that receives `tour`, `onSave`, `onClose`.  
  - Extract **form sections** (basic info, gallery, itinerary, pickups, translations) into subcomponents or a single `ProductForm` with clear sections.  
  - Optionally extract **list + filters** into `AdminProductList` and keep the page as a thin wrapper that composes list + modal.  
  - Move **locale list** (e.g. SUPPORTED_LOCALES) to a shared config if used elsewhere.

- **app/jeju/[slug]/page.tsx**  
  - Extract **data fetch + transform** into a custom hook (e.g. `useJejuTour(slug)`) that returns tour, loading, error.  
  - Extract **sections** into components (e.g. TourHero, TourItinerary, TourFAQ, TourGallery, TourCTA) and keep the page as composition.  
  - Leave static fallback and routing in the page.

- **lib/email.ts**  
  - Split **client + base styles** (e.g. `lib/email-client.ts` or keep in `email.ts`) from **templates**.  
  - Move each template (or group: booking vs merchant) into its own file under e.g. `lib/email-templates/` and import into the main module that exports `sendBookingConfirmationEmail`, etc.  
  - Reduces merge conflicts and keeps template changes localized.

- **EnhancedBookingSidebar**  
  - Extract **availability** logic into a hook (e.g. `useTourAvailability(tourId, date, guests)`).  
  - Extract **price summary** (subtotal, deposit, balance) into a small component or helper that receives “price, guests, paymentMethod, depositPercent” and returns display values—without duplicating server rounding rules; ideally these values come from API or a shared helper used by both API and UI.

### 2.4 Data and API consistency

- **Admin products**  
  - Consider having admin products page call `GET /api/admin/tours` (or existing admin tours API) instead of client Supabase, so all tour reads go through API and auth is consistent. Optional and can be done incrementally.

- **Price and deposit**  
  - Prefer a single source of truth: e.g. “booking creation API returns computed prices” and checkout/sidebar only display what the API returns or request a “quote” endpoint that returns the same numbers. Then remove or minimize duplicate formulas in EnhancedBookingSidebar.

---

## 3. Low-Risk vs High-Risk Refactor Opportunities

### 3.1 Low-risk (incremental, low chance of breaking behavior)

| Change | What to do | Why low-risk |
|-------|------------|----------------|
| **Booking status constants** | Add `lib/constants/booking-status.ts` (e.g. `BOOKING_STATUSES`, `ACTIVE_BOOKING_STATUSES`) and use in 1–2 API routes first, then expand. | Additive; behavior unchanged if same strings. |
| **Status label map** | Add one shared map or i18n keys for status → label; use in one admin page first. | Same display output if keys match. |
| **Email template extraction** | Move one template (e.g. reminder) to `lib/email-templates/reminder.ts` and import into `lib/email.ts`. | Same function exports; only file layout changes. |
| **SUPPORTED_LOCALES** | Move from admin/products to e.g. `lib/i18n.ts` or `lib/constants/locales.ts` if not already there; reuse. | No behavior change. |
| **Docs** | Add `docs/PROJECT_STRUCTURE.md` or a section in README for tour/tours, admin/merchant, components. | No code change. |
| **Resend webhook GET** | Already returns 405; no further change. | — |
| **Extract one presentational component** | e.g. StatusBadge from admin orders page, reuse in admin page and merchant orders. | Pure UI; same props in, same DOM out. |

### 3.2 Medium-risk (test well, do in small steps)

| Change | What to do | Why medium-risk |
|-------|------------|-----------------|
| **Split admin/products** | Extract edit modal first; then form sections; then list. Test edit/save and list refresh after each step. | Many state and effect dependencies; refactor can introduce bugs if not careful. |
| **Split jeju/[slug]** | Extract hook then sections one by one; ensure loading/error and static fallback still work. | Data flow and conditional render paths. |
| **Extract EnhancedBookingSidebar availability** | Move availability fetch and state into `useTourAvailability`; sidebar only consumes result. | Same API calls and UI outcome if hook is correct. |
| **Shared price helper** | Add a small `lib/booking-price.ts` (or similar) used by API and optionally by sidebar for display only; then align sidebar with it. | Must match API rounding and rules exactly. |

### 3.3 High-risk (architecture or broad change; do only with tests and rollout plan)

| Change | What to do | Why high-risk |
|-------|------------|----------------|
| **Move all tour reads to API** | Have admin products (and any other client) call only API for tours; remove direct Supabase from that page. | Changes auth and data path; RLS and permissions differ. |
| **Central “data layer”** | Introduce a dedicated data/Supabase layer used by all routes and no direct createServerClient in routes. | Large refactor; touches every API route. |
| **Rename app routes** | e.g. unify tour/tours under one path scheme. | Breaks URLs and links. |
| **Change auth model** | e.g. move all session resolution to middleware or a single helper and remove getAuthUser from routes. | Affects every protected route and error handling. |

---

## 4. What Can Be Improved Incrementally Without Destabilizing the App

### 4.1 No or minimal code change

- **Document structure and naming** in `docs/PROJECT_STRUCTURE.md` (or README): tour vs tours, admin vs merchant, where components live, where API lives.
- **List “active” and “bookable” statuses** in one place in the doc so future changes (e.g. adding a status) are done consistently.

### 4.2 Additive, then substitute

- **Constants**  
  - Add `lib/constants/booking-status.ts` with `BOOKING_STATUSES` and `ACTIVE_BOOKING_STATUSES`.  
  - Replace string literals in one module (e.g. `app/api/tours/[id]/availability/route.ts`).  
  - Run tests and manual checks, then replace in other modules one at a time.

- **Email templates**  
  - Create `lib/email-templates/` and move one template (e.g. reminder) to a file there; import and re-export from `lib/email.ts`.  
  - Repeat for other templates when touching them. No change to callers.

### 4.3 Extract without changing behavior

- **Admin products**  
  - Extract the edit modal into a component that receives props and callbacks; keep state in the page at first (lift state up later if needed).  
  - Then extract one form section (e.g. “basic info”) into a presentational component.  
  - Test after each step; no change to API or URLs.

- **Status badge**  
  - Extract a `StatusBadge({ status, labels? })` used by admin orders and admin page with the same mapping.  
  - Reduces duplication and keeps labels consistent.

### 4.4 Align with existing patterns

- **API routes**  
  - Keep resource-based + namespaced (admin, auth, merchant, webhooks). New routes should follow the same pattern.  
  - Use the new booking-status constants in new or touched routes so the codebase drifts toward a single definition.

- **Components**  
  - New shared pieces can go under `components/shared/` or `components/ui/` if you introduce it; existing ones can be moved one by one when you touch them.  
  - New tour-detail UI can go under `components/tour/`, listing under `components/tours/`, to reinforce the convention.

### 4.5 What to avoid for now

- **Large renames** of app routes or component folders (tour/tours, admin structure).  
- **Removing client Supabase** from auth/session flows without a clear migration plan.  
- **Rewriting admin/products or jeju slug in one go**; split in small, testable steps instead.  
- **Introducing a global state library or new data layer** unless there’s a concrete pain point it addresses.

---

## Summary Table

| Category | Main issues | Suggested direction |
|----------|-------------|---------------------|
| **Folder structure** | tour vs tours, many app siblings, no shared-ui folder | Document; optionally add shared/ or ui/ and move gradually |
| **Naming** | Status and “active” repeated; labels duplicated | Shared constants and one status→label map |
| **Large files** | admin/products 2k+, jeju slug 1.2k+, cart, checkout, email.ts | Split modal/form/sections; extract hooks; split email templates |
| **Mixed responsibilities** | admin/products (list+edit+form+tabs+upload); EnhancedBookingSidebar (UI+price) | Extract modal, form sections, availability hook; align price with API |
| **Repeated logic** | Active status set; status labels; price/deposit in sidebar | Constants; shared label map; single price source of truth |
| **Separation of concerns** | Data mostly good (bookings API-only); price in sidebar duplicated | Keep data boundary; move price to API or shared helper |
| **Utilities** | email.ts large; auth/i18n fine for now | Split email templates; split auth/i18n only if they grow |
| **Boundaries** | Data layer clear for bookings; auth/session split by design | Document; avoid new direct DB access in client except auth/profile |

No refactors were applied in this pass; the above is a plan for incremental, low-risk improvements that preserve production safety and maintainability.
