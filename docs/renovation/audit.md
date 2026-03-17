# Phase 0: Architecture Audit

**Date:** 2025-03-17  
**Scope:** Map pages, shared components, and dependencies for UI renovation. No application behavior changed.

---

## 1. Page Map

### 1.1 Homepage

| Route | File | Notes |
|-------|------|--------|
| `/` | `app/page.tsx` | EN homepage: Header, HeroSection, CompactTrustBar, DestinationsCards, HomeTourSections, Footer, BottomNav. Force dynamic. |
| `/[locale]` | `app/[locale]/page.tsx` | Localized (ko, zh-CN, zh-TW, ja, es): same shell + TourList, PaymentMethodInfo, TrustBar, LocaleHomeClient. `/en` redirects to `/`. |

### 1.2 Builder / Planner (Tour builder–like flows)

| Route | File | Notes |
|-------|------|--------|
| `/custom-join-tour` | `app/custom-join-tour/page.tsx` | Wizard: steps (participants, vehicle, destination, date, language, chat, itinerary, checkout). Uses HotelMapPicker, CustomCalendar, ItineraryMapWithSearch, RobotMascot. Calls `/api/custom-join-tour/generate`, `/api/custom-join-tour/proposed`, `/api/custom-join-tour/confirm`, `/api/bookings`, `/api/stripe/checkout`. Supabase auth for session. |
| `/custom-join-tour/proposed` | `app/custom-join-tour/proposed/page.tsx` | Proposed tour list by `?id= joinId`; fetches `/api/custom-join-tour/proposed`. |

**Note:** There is no dedicated `/build-tour` route. The spec’s “Tour Builder” aligns with `custom-join-tour` or a future build-tour page.

### 1.3 Loading

| Route | File | Notes |
|-------|------|--------|
| (none) | — | No dedicated loading route (e.g. no `app/search/loading.tsx` or `app/build-tour/loading.tsx`). Loading is in-page: search results, custom-join-tour during generate, tour detail fetch. |

### 1.4 List (tour listing)

| Route | File | Notes |
|-------|------|--------|
| `/tours/list` | `app/tours/list/page.tsx` | Fetches `/api/tours` (limit 500, isActive, sortBy rating). Uses TourCardDetail, mapApiTourToDetail. Header, Footer, BottomNav. |
| `/search` | `app/search/page.tsx` | Query params: city, q. Fetches `/api/tours` with locale. Renders TourCardDetail (transformed). SearchLayout wraps children only. |
| `/tours` | `app/tours/page.tsx` | Static timeline-style content (Busan sample); not an API-driven list. |
| `/jeju` | `app/jeju/page.tsx` | Static Jeju tour cards (TourCard); links to `/jeju/[slug]`. |
| `/[locale]` | `app/[locale]/page.tsx` | TourList component for locale-specific list. |

### 1.5 Detail (tour detail)

| Route | File | Notes |
|-------|------|--------|
| `/tour/[id]` | `app/tour/[id]/page.tsx` | Main tour detail: fetches tour via `/api/tours/${tourId}`. Uses TourOverviewContent, FaqAccordion, ImportantNotesContent, TourReviewsSection, EnhancedBookingSidebar, InteractiveMap. Layout: `app/tour/[id]/layout.tsx` (metadata, Supabase, structured data). |
| `/jeju/[slug]` | `app/jeju/[slug]/page.tsx` | Jeju slug detail: fetches `/api/tours/${currentSlug}`. GalleryGrid, TourOverviewContent. |
| `/busan/[slug]` | `app/busan/[slug]/page.tsx` | Busan slug detail. |
| `/seoul/[slug]` | `app/seoul/[slug]/page.tsx` | Seoul slug detail. |

### 1.6 Checkout

| Route | File | Notes |
|-------|------|--------|
| `/tour/[id]/checkout` | `app/tour/[id]/checkout/page.tsx` | Reads bookingData from sessionStorage; POST `/api/bookings`, then POST `/api/stripe/checkout` → redirect to Stripe. Supabase session for user prefill. |
| `/checkout` | `app/checkout/page.tsx` | Unified entry: reads `id` from query, fetches `/api/tours/${id}`, redirects to `/tour/${id}/checkout`. |
| `/tour/[id]/confirmation` | `app/tour/[id]/confirmation/page.tsx` | Post-payment: reads bookingId from query/sessionStorage, GET `/api/bookings/${bookingId}`. |

### 1.7 Login / Auth

| Route | File | Notes |
|-------|------|--------|
| `/signin` | `app/signin/page.tsx` | Supabase: signInWithPassword, OAuth (Google), profile create. Redirect after login. |
| `/auth/signin` | `app/auth/signin/page.tsx` | Stub: TODO “调用 /api/auth/login 或 NextAuth signIn”; not wired to Supabase. |
| `/signup` | `app/signup/page.tsx` | Supabase: OTP, verifyOtp, signInWithOAuth, `/api/auth/check-email`, `/api/auth/create-profile`. |
| `/auth/signup` | `app/auth/signup/page.tsx` | Stub (TODO register). |
| `/auth/callback` | `app/auth/callback/page.tsx` | OAuth/code callback: exchangeCodeForSession, LINE `/api/auth/line`, `/api/auth/create-profile`. |
| `/forgot-password` | `app/forgot-password/page.tsx` | Supabase resetPasswordForEmail. |
| `/reset-password` | `app/reset-password/page.tsx` | Supabase updateUser password, signOut. |

### 1.8 My Tour / My Page

| Route | File | Notes |
|-------|------|--------|
| `/mypage` | `app/mypage/page.tsx` | Mobile hub: menu to dashboard, mybookings, upcoming, history, reviews, wishlist, settings. Desktop redirects to `/mypage/dashboard`. |
| `/my` | `app/my/page.tsx` | Redirect only → `/mypage`. |
| `/mypage/dashboard` | `app/mypage/dashboard/page.tsx` | GET `/api/bookings`, `/api/reviews`; Supabase session. |
| `/mypage/mybookings` | `app/mypage/mybookings/page.tsx` | GET `/api/bookings?userId=`, GET `/api/bookings/${id}` (cancel). Supabase session; redirect to /signin if unauthenticated. |
| `/mypage/upcoming` | `app/mypage/upcoming/page.tsx` | GET `/api/bookings?userId=`, GET `/api/bookings/${bookingId}`. |
| `/mypage/history` | `app/mypage/history/page.tsx` | GET `/api/bookings?userId=`. |
| `/mypage/reviews` | `app/mypage/reviews/page.tsx` | GET `/api/reviews?userId=`. |
| `/mypage/reviews/write` | `app/mypage/reviews/write/page.tsx` | POST `/api/reviews`. |
| `/mypage/wishlist` | `app/mypage/wishlist/page.tsx` | GET/POST `/api/wishlist`. |
| `/mypage/settings` | `app/mypage/settings/page.tsx` | PATCH `/api/auth/update-profile`. |
| `/mypage/layout` | `app/mypage/layout.tsx` | Shell: Header, Footer, BottomNav; session check; signOut. |

---

## 2. Booking / Payment / Auth / API Dependencies

### 2.1 Auth

- **Provider:** Supabase Auth (client: `@/lib/supabase`).
- **Session usage:** Header, checkout (prefill), mypage/*, signin, signup, auth/callback, cart, custom-join-tour, admin/*.
- **API auth:** `getAuthUser(req)` in `lib/auth.ts` used by e.g. GET/POST `/api/bookings`; Bearer token from session.
- **Profiles:** `user_profiles` (full_name, phone, etc.); create via `/api/auth/create-profile` or inline in signup/signin.

### 2.2 Booking

- **Create:** POST `/api/bookings` (body: tourId, bookingDate, numberOfGuests, pickupPointId, finalPrice, paymentMethod, customerInfo, etc.). Server: `lib/validation`, `createServerClient`, DB bookings table.
- **Read:** GET `/api/bookings?userId=...` (user from auth). GET `/api/bookings/[id]` for single booking.
- **Status:** `lib/constants/booking-status.ts`: pending, confirmed, completed, cancelled. Active = pending, confirmed.

### 2.3 Payment

- **Stripe:** Primary. POST `/api/stripe/checkout` creates session; redirect to Stripe. Webhook `POST /api/stripe/webhook` (checkout.session.completed → update booking, send email). Used by `tour/[id]/checkout` and `custom-join-tour`.
- **PayPal:** POST `/api/paypal/create-order`, POST `/api/paypal/capture-order`, GET `/api/paypal/callback`; webhook `POST /api/webhooks/paypal`. Not used by current checkout page (checkout uses Stripe).
- **Paddle:** POST `/api/paddle/checkout`, POST `/api/paddle/webhook`. Not used by main checkout UI.

### 2.4 Key APIs Used by Mapped Pages

| API | Used by |
|-----|--------|
| GET/POST `/api/bookings` | checkout, confirmation, mypage/dashboard, mybookings, upcoming, history, custom-join-tour |
| POST `/api/stripe/checkout` | tour/[id]/checkout, custom-join-tour |
| GET `/api/tours` | search, tours/list, checkout (resolve id) |
| GET `/api/tours/[id]` | tour/[id] page, jeju/[slug], confirmation |
| `/api/custom-join-tour/*` | custom-join-tour, proposed |
| `/api/auth/*` | signup, callback, mypage layout/settings |
| `/api/reviews` | mypage/reviews, dashboard |
| `/api/wishlist` | mypage/wishlist, cart |

---

## 3. Shared Layout and Shell

- **Root:** `app/layout.tsx` (ErrorBoundary, etc.).
- **Tour detail:** `app/tour/[id]/layout.tsx` (metadata, Supabase, JSON-LD).
- **Search:** `app/search/layout.tsx` (metadata only; no shell).
- **Mypage:** `app/mypage/layout.tsx` (Header, Footer, BottomNav, session guard).
- **Admin:** `app/admin/layout.tsx` (session, redirect).

---

## 4. Existing Adapter / Schema Foundation

- **Adapters:** `src/lib/adapters/booking-adapter.ts` (adaptMyTourResponse), `src/lib/adapters/tours-adapter.ts` (adaptBuildTourResponse). Both use Zod safeParse and return fallback ViewModels on failure.
- **Schemas:** `src/lib/schemas/booking.ts`, `src/lib/schemas/tours.ts`, `src/lib/schemas/hotel.ts`.
- **Types:** `src/types/booking.ts`, `src/types/tours.ts`.
- **Design:** `src/design/` (tokens, copy, motion, status, analytics) present; not yet wired into pages.

---

## 5. Gaps vs. Final Product Spec

- **Builder:** Spec’s “Tour Builder” (destination, hotel area, date, group size, style, tour type) is only partially reflected in `custom-join-tour`; no dedicated `/build-tour` with spec steps.
- **Loading:** No dedicated loading route; loading states are in-page.
- **List:** No single “generated tour list” page that matches spec (Recommended / Private / Join / Bus sections); current list is generic API tours.
- **Detail:** Has sidebar and content; spec asks for “booking timeline”, “why this fits you”, “match quality” (need adapters/API for join/private tiers).
- **Checkout:** Has deposit/full and Stripe; spec’s trust copy (“We will never charge your card automatically…”) and reassurance box can be added as presentation.
- **My Tour:** Status labels and single-CTA-per-state to be aligned with spec (deposit_paid, awaiting_balance, balance_due, confirmed, etc.) via adapters.

This audit is the basis for `component-map.md`, `risk-map.md`, and `migration-plan.md`. No code or behavior was modified.
