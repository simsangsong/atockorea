# Risk Map (Phase 0)

**Purpose:** Separate safe presentation-only refactors from risky business-logic areas. No changes to behavior in this phase.

---

## 1. Safe (presentation-only)

Refactors here do not alter booking, payment, auth, or API contracts. Prefer these for early phases.

### 1.1 Shell and global chrome

| Area | What’s safe | What to avoid |
|------|-------------|---------------|
| Header | Layout, typography, spacing, logo size, nav link order/styling, design tokens (colors, radii). | Auth check logic, redirect after login, session fetch, currency state logic, search submit behavior. |
| Footer | Layout, links styling, spacing, copy (if from constants). | Link URLs or removal of links. |
| BottomNav | Icons, labels, active state styling, spacing. | Nav targets or visibility logic. |
| ErrorBoundary | Styling of fallback UI. | Error handling logic or boundary placement. |

### 1.2 Homepage (EN and locale)

| Area | What’s safe | What to avoid |
|------|-------------|---------------|
| HeroSection | Headline, subcopy, CTA button styling, background, layout. | CTA href or form action targets. |
| CompactTrustBar / TrustBar | Text, icons, layout, order of trust points. | — |
| DestinationsCards | Card layout, “Coming soon” styling, copy. | Links (hrefs) or removal of links. |
| HomeTourSections | Section title styling, “See all” link styling. | seeAllHref or fetchParams. |
| TourSectionRow | Card grid layout, TourCard styling. | Fetch URL, query params, or data shape passed to TourCard. |
| TourList | Section layout, card styling. | API or locale logic. |
| PaymentMethodInfo | Layout, icons, copy. | — |
| LocaleHomeClient | Wrapper styling. | Locale prop or children. |

### 1.3 Static and marketing pages

| Area | What’s safe | What to avoid |
|------|-------------|---------------|
| about, support, contact, legal, refund-policy, dsa | Full visual refresh: typography, spacing, sections, ContactForm styling. | ContactForm submit endpoint or validation. |
| Sign-in / sign-up pages (layout only) | Form field styling, button styling, OAuth button order/look. | submit handlers, Supabase calls, redirect URLs. |

### 1.4 Tour list (layout and cards – after adapter)

| Area | What’s safe | What to avoid |
|------|-------------|---------------|
| tours/list, search | Page layout, filter bar styling, card grid. | Once adapters are in place: card content from ViewModel is safe to restyle. | Changing API URL, query params, or raw payload usage before adapter. |
| TourCardDetail | Styling of title, price, image, badges. | Prop source: must receive adapter output, not raw API. |

### 1.5 Tour detail (content blocks only)

| Area | What’s safe | What to avoid |
|------|-------------|---------------|
| TourOverviewContent | Typography, spacing, section layout. | Data source: keep from tour payload or adapter. |
| FaqAccordion | Accordion styling, spacing. | FAQ data source. |
| ImportantNotesContent | Styling. | Content source. |
| TourReviewsSection | Card layout, star display. | Review fetch or data shape. |
| GalleryGrid | Grid layout, image styling. | Image URLs source. |
| HeroImage | Layout, overlay. | Image URL source. |

### 1.6 Checkout and confirmation (presentation only)

| Area | What’s safe | What to avoid |
|------|-------------|---------------|
| Checkout page | Layout (two columns), labels, spacing, reassurance box, trust copy text, CTA button styling. | Form state, validation, POST /api/bookings, POST /api/stripe/checkout, redirect, sessionStorage keys. |
| Confirmation page | Success message, summary layout, styling. | Fetch `/api/bookings/${id}`, redirect logic. |

### 1.7 My Page (layout and labels)

| Area | What’s safe | What to avoid |
|------|-------------|---------------|
| mypage hub, dashboard, mybookings, upcoming, history, reviews, wishlist, settings | Tab/menu styling, card layout, status badge styling (colors/icons), copy. | API calls, cancel/pay actions, redirect after login, data shape. |

---

## 2. Risky (business logic / data flow)

Do not change behavior here until adapters and/or feature flags are in place. Touch only for presentation wrappers or after Phase 1 foundation.

### 2.1 Auth and session

| Area | Risk | Mitigation |
|------|------|------------|
| Supabase auth calls (signInWithPassword, signInWithOAuth, getSession, signOut) | Break login, redirect, or session-dependent pages. | Do not modify call sites; only wrap UI (buttons, layout). |
| Header session load and sign-out | All pages show wrong user state or break logout. | Leave logic intact; restyle dropdown/buttons only. |
| auth/callback (exchangeCodeForSession, create-profile) | OAuth and magic-link flows break. | Do not change. |
| mypage/layout session guard | Users could see mypage without login or get wrong redirect. | Do not change guard logic. |

### 2.2 Booking and payment

| Area | Risk | Mitigation |
|------|------|------------|
| POST /api/bookings | Wrong payload or validation change breaks creation. | Do not change request shape or validation. |
| POST /api/stripe/checkout | Amount, currency, or metadata change can break Stripe or webhook. | Do not change body or redirect handling. |
| tour/[id]/checkout: sessionStorage bookingData | Key or shape change breaks checkout and confirmation. | Do not rename keys or change stored shape. |
| Stripe/PayPal/Paddle webhooks | Signature verification or update logic break payments. | Do not modify webhook routes. |
| GET /api/bookings, GET /api/bookings/[id] | Response shape change breaks mypage and confirmation. | Introduce adapter; UI consumes ViewModel only. |

### 2.3 Tour data and APIs

| Area | Risk | Mitigation |
|------|------|------------|
| GET /api/tours, GET /api/tours/[id] | Query params or response shape change breaks list/detail. | Add adapters (e.g. tours-adapter); pages consume ViewModels. |
| custom-join-tour: generate, proposed, confirm | Request/response change breaks builder flow. | Add adapters for proposed/generate; keep API contracts. |
| Tour detail: EnhancedBookingSidebar | Price, date, pickup, “Book” action. | Feed from adapter; do not change how price/date are computed or sent to checkout. |

### 2.4 Cart, wishlist, reviews

| Area | Risk | Mitigation |
|------|------|------------|
| /api/cart, /api/wishlist, /api/reviews | Method or body change breaks cart/wishlist/reviews. | Do not change API usage; restyle only. |
| Promo validation /api/promo-codes/validate | Cart total and checkout depend on it. | Do not change. |

### 2.5 Custom-join-tour flow

| Area | Risk | Mitigation |
|------|------|------------|
| Step state, hotel/date/itinerary payloads | Breaking flow or backend expectations. | Refactor UI in small steps; keep payloads and endpoints unchanged. |
| Booking + Stripe at end | Same as main checkout. | Wrap with same trust copy; do not change calls. |

---

## 3. Summary matrix

| Category | Safe to refactor (presentation) | Risky (do not change logic) |
|----------|---------------------------------|-----------------------------|
| Shell | Header/Footer/BottomNav layout and styling | Session, auth, redirect, nav targets |
| Homepage | Hero, trust bars, destinations, section layout, card look | API URLs, fetch params, data passed to cards |
| List | Page layout, card styling (with adapter) | API calls, raw payload → card props |
| Detail | Overview, FAQ, notes, reviews, gallery styling | Sidebar price/date/booking action, API fetch |
| Checkout | Layout, labels, trust copy, CTA style | Form submit, POST bookings, Stripe, sessionStorage |
| Confirmation | Summary layout, success message style | GET booking, redirect |
| Login/Signup | Form and button styling | Supabase calls, redirect, profile create |
| My Page | Tabs, cards, status badge look | API calls, cancel/pay, session guard |
| Builder (custom-join-tour) | Step layout, copy, calendar/map look | Generate/proposed/confirm APIs, booking, payment |

Use this map with `migration-plan.md` to choose adapter-based migration order and to avoid touching risky areas until wrapped or flagged.

---

## 4. Known follow-up risks (post–Step 12)

| Item | Risk | Mitigation |
|------|------|-------------|
| **Hero micro trust points and CompactTrustBar duplicate copy** | Same four lines appear twice (hero + trust bar); redundant and may drift if copy is updated in one place only. | Deduplicate in a later step (e.g. single source or remove one surface). |
| **Locale homepages not aligned with root homepage** | `app/[locale]/page.tsx` does not use the refactored section order or new sections (CompactTrustBar, Comparison, TourTypeCards, HowItWorks, PreviewItinerary, ClassicBusSection, Reviews, FinalCTA). User experience differs by locale. | Align `app/[locale]/page.tsx` with `app/page.tsx` section order and components where applicable; preserve locale routing and i18n. |
