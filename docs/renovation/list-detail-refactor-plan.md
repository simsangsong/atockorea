# List / Detail Refactor Plan (Phase 3A)

**Purpose:** Plan the generated tour list and tour detail refactor before writing code. No implementation in this step.

**Source of truth:** `docs/renovation/final-product-spec.md` §7.4 (Generated Tour List), §7.5 (Tour Detail), `docs/renovation/migration-plan.md` (Phase 3, list/detail adapters), `src/types/tours.ts`, `.cursor/rules/*`.

---

## 1. Search summary bar structure

**Spec (§7.4):** Top summary bar shows current search context and edit CTA.

**Planned structure:**

- **Single summary row** (one component or clear DOM block) containing:
  - **Destination** (e.g. Jeju)
  - **Hotel area** (pickup area label; may be "—" when not from builder)
  - **Date** (tour date; "—" when not set)
  - **Guests** (group size)
  - **Style tags** (travel style chips; optional, from builder)
  - **Edit search CTA** (link/button to builder or search refinement)

**Where it appears:**

- **Generated list (post-builder):** Bar reflects `BuildTourResponse.searchSummary` (destination, pickupAreaLabel, date, guests, styleTags). Edit CTA returns to builder (e.g. `/custom-join-tour` or future `/build-tour`).
- **Classic list (`/tours/list`) and search (`/search`):** Bar can show a reduced summary (e.g. "X tours found", destination filter, keyword) with optional "Refine" CTA. Current search page already has a simple summary (count, destination, keyword); align with same structure and design tokens.

**Data source:** For builder flow, `BuildTourResponse.searchSummary`. For classic list/search, derive from URL params + API response count; no new API for summary.

**Out of scope for bar itself:** Filter UI (chips/dropdowns) is separate (see §2). Summary is read-only display + one edit/refine CTA.

---

## 2. Filter structure

**Spec (§7.4):** Primary filter order:

1. Hotel Area  
2. Tour Type  
3. Date  
4. Group Size  
5. Travel Style  
6. Pickup surcharge level  
7. Price  

**Planned structure:**

- **Filter bar / row** below the search summary bar.
- **Filter order** as above. Each filter can be:
  - **Chip / pill** (e.g. "Hotel Area: Jeju City") with clear or change action, or
  - **Dropdown / sheet** (mobile) for multi-option filters (tour type, travel style, surcharge, price).
- **Hotel Area** is not just a filter: it drives join suitability, surcharge, and messaging (spec). So filter state may feed both list filtering and "match quality" / "private tour recommended" on cards.
- **Tour Type:** Private | Join | Bus (and optionally "All"). Sections (Recommended, Private, Join, Bus) may be driven by same taxonomy.
- **Date / Group size / Travel style:** When from builder, pre-filled from search summary; still adjustable as filters.
- **Price:** Min/max or bands; optional for Phase 3A if not in current API.

**Where filters apply:**

- **Generated list:** Filters narrow `recommended` / `privateTours` / `joinTours` / `busTours` (client-side or future API support).
- **Classic list / search:** Today `GET /api/tours` supports e.g. `city`, `search`, `limit`, `sortBy`, `sortOrder`. Filters map to existing params where possible; new params only if agreed (e.g. `tourType`, `hotelArea`) without breaking existing callers.

**Risk:** Changing `GET /api/tours` query params breaks `TourSectionRow`, `TourList`, `SeasonalTours`, mobile. Mitigation: introduce adapter and optional new params; list page uses adapter; other callers keep current params until migrated.

---

## 3. Card structure

**Spec (§7.4) tour card requirements:**

- Title  
- Type badge (Private / Join / Bus)  
- Tags  
- Pickup area  
- Match quality (Great pickup match / Good pickup match / Slight extra travel time)  
- **If join:** join status, joined traveler count, capacity  
- Surcharge line  
- Deposit/balance note  
- CTA  

**Current state:**

- **TourCardDetail** (`components/TourCardDetail.tsx`): Used on `tours/list` and `search`. Expects `DetailedTour` (from `data/tours.ts`). Shows image, title, schedule dots, price, duration, lunch/ticket, pickup, discount; link via `detailHref`.
- **TourCard** (`components/TourCard.tsx`): Used on homepage sections, TourList, RelatedTours. Different shape (e.g. `Tour` with `slug`, `price` in thousands).  
- **DetailedTourCard** (`components/tours/DetailedTourCard.tsx`): Tours feature; richer layout, wishlist.

**Planned card structure (single card component or variants):**

- **Unified card props** from **TourCardViewModel** (`src/types/tours.ts`): `id`, `title`, `type` (private | join | bus), `tags`, `priceFrom`, `currency`, `pickup` (PickupInfo: areaLabel, surchargeLabel, joinAvailable, etc.), `matchQuality?`, `joinStatus?`, `travelersJoined?`, `maxTravelers?`.
- **Sections on card:**  
  - Header: image, type badge, tags.  
  - Body: title, pickup area, match quality label (if present).  
  - Join block (if type === "join"): join status badge, "X / Y travelers", capacity; only when join data present.  
  - Footer: surcharge line, deposit/balance short note, price, CTA (e.g. "View" or "Book").
- **Design:** Use design tokens and `src/components/ui` primitives (card, badge, button). Restyle TourCardDetail to accept ViewModel and new fields; or introduce a new **TourListCard** that consumes TourCardViewModel and deprecate ad-hoc mapping in list/search.
- **Detail link:** Card links to detail page (e.g. `/tour/[id]` or `/jeju/[slug]` per routing). No change to URL scheme in this plan; only ensure `detailHref` is correct from adapter.

**Differentiation:** Private vs Join is explicit via `type` and optional join block; Bus is third type. No mixed card; one card component with conditional join block and type badge.

---

## 4. Private vs Join differentiation

**Spec:** Strong differentiation between private, join, and bus. Card and detail must make type obvious.

**Planned approach:**

- **Type badge** on every card and detail hero: "Private" | "Small-Group Join" | "Classic Bus" (or localized). Visual distinction (e.g. color or icon) per type.
- **Copy and CTAs:**
  - **Private:** e.g. "Private comfort", "Start Private Tour"; no join state.
  - **Join:** "More affordable than private"; show join status and traveler count when available; CTA e.g. "Join this tour" or "View details".
  - **Bus:** "Classic bus tour"; no join; CTA "View tour".
- **Detail page:** Same badge and section "Who this is for" / "Why this fits you" with type-specific copy (private vs join vs bus). No shared "private/join" toggle on a single product; each product is one type.
- **Data:** `TourCardViewModel.type` and `TourDetailViewModel` (or equivalent) carry `type`; adapter maps API/DB to this. Current API may not expose type; adapter can infer from product metadata or default to "bus" for classic tours.

---

## 5. Join state display strategy

**Spec (§7.4) visible join states:**

- Waiting for more travelers  
- Balance payment open  
- Confirmed  
- Missed deadline  
- Private tour recommended  
- Join not available for this route yet  

**Types:** `JoinVisibleStatus` in `src/types/tours.ts`: `waiting` | `balance_open` | `confirmed` | `missed_deadline` | `private_only` | `join_unavailable`.

**Display strategy:**

- **List card (join only):** Show one primary status badge (e.g. "Waiting for more travelers", "Balance open", "Confirmed") and optional short subtitle (e.g. "3/7 joined"). Use `joinStatus` and `travelersJoined` / `maxTravelers` from TourCardViewModel. If `joinStatus === 'private_only'` or `'join_unavailable'`, show that label instead of traveler count.
- **Detail page:** Same status in a prominent block (e.g. under price or in "Booking timeline" area) so user knows next step (wait, pay balance, or join closed). No automatic charge copy: "We will never charge your card automatically for the remaining balance…" (spec).
- **Copy:** All labels from centralized copy (e.g. `src/design/copy.ts` or i18n) keyed by `JoinVisibleStatus`. No hardcoded strings in card/detail.
- **When status is missing:** If API does not return join state, do not show join block on card; detail can show generic "Small-group tour" without status. Adapter returns optional `joinStatus` / `travelersJoined` / `maxTravelers`.

---

## 6. Detail page section structure

**Spec (§7.5) required structure:**

- Title / hero visual  
- Key badges  
- Price summary  
- Pickup area + surcharge  
- Why this fits you  
- Overview  
- **Booking timeline**  
- Cancellation policy  
- Who this is best for  
- Similar alternatives  

**Current state:**

- **tour/[id]** (`app/tour/[id]/page.tsx`): Hero, "Why Choose Us" strip, gallery, "The Adventure Unfolds" (itinerary timeline), Meeting & Pickup, bottom accordions (FAQs, child eligibility, etc.), **right sidebar:** EnhancedBookingSidebar only. No dedicated "booking timeline" block (deposit → refund deadline → balance open → balance due → tour start). No explicit "Why this fits you" or "Who this is best for" sections.
- **jeju/[slug]** (`app/jeju/[slug]/page.tsx`): Different layout; uses static/API hybrid, different sections.

**Planned section order (single canonical detail layout):**

1. **Hero:** Title, hero image, key badges (AI Planned, Small Group, Private, Verified Local Guide, Transparent Booking Rules — as applicable).  
2. **Price summary + pickup:** Price, pickup area, surcharge line (from ViewModel).  
3. **Why this fits you:** Short bullets (e.g. good fit for your hotel area, smoother pickup, fewer travelers than bus, better value than private). Data from adapter/ViewModel (can be empty for classic bus).  
4. **Overview:** Existing overview/description content.  
5. **Booking timeline:** Visual timeline (see §7).  
6. **Cancellation policy:** One block; copy from design.  
7. **Who this is best for:** Optional; type-based or tag-based.  
8. **Itinerary / The Adventure Unfolds:** Keep existing timeline of stops.  
9. **Meeting & Pickup:** Keep; ensure pickup points and map unchanged in behavior.  
10. **Similar alternatives / Related:** Existing related tours or "More tours like this".  
11. **Sticky sidebar (desktop):** EnhancedBookingSidebar + **booking timeline** (compact) inside sidebar or directly above it.

**Badges:** From ViewModel or tour metadata; no new API. Prefer one source (adapter) for badge list.

---

## 7. Booking timeline placement (server-driven)

**Spec (§7.5, §7.6):** Booking timeline must be visual. Checkout also shows timeline. Detail page must show it.

**Server-driven rule:** Timeline dates and rules must be server-provided or adapter-mapped from server wherever available. Frontend-generated timeline logic must not be the source of truth. When API returns `bookingTimeline` or `timeline`, adapter maps via `mapServerBookingTimeline`; UI uses it. Client fallback (`buildBookingTimelineViewModelClientFallback`) is used only when server does not provide timeline and is explicitly not source of truth. Risk: if API never returns timeline, UI falls back to client 24h/18h rules; prefer extending API so timeline is server-driven.

**Current state:**

- **BookingTimeline** (`src/components/ui/timeline.tsx`): Takes `now`, `refundDeadlineAt`, `balanceOpensAt`, `balanceDueAt`, `tourStartAt`; renders steps (deposit, refund deadline, balance open, balance due, tour start). Copy from `COPY.timeline`.
- **Detail:** tour/[id] does **not** render `BookingTimeline`; only EnhancedBookingSidebar (date, guests, pickup, price, Book CTA). Timeline data would come from booking/adapter (e.g. after date/guests chosen or from server).

**Planned placement:**

- **Detail page – main content:** Add a **"Booking timeline"** section in the left column (e.g. after "Why this fits you" or after "Overview"). Content: visual timeline (deposit → refund deadline → balance opens → balance due → tour start). Data: either (a) from TourDetailViewModel with placeholder/example dates until date is selected, or (b) from adapter that computes dates from "selected date" (sidebar) + rules (balance opens 24h before, due 18h before). Prefer (b) so timeline updates when user picks date in sidebar.
- **Detail page – sidebar:** Optionally repeat a **compact** timeline (e.g. icons + dates only) inside or above EnhancedBookingSidebar so it’s visible when scrolling. Same data source.
- **Checkout:** Already in spec (§7.6); out of scope for this list/detail plan. Timeline component reused there.
- **Data source:** Prefer server (API returns timeline; adapter maps). Fallback: client-computed from selected date (not source of truth). ViewModel: `{ refundDeadlineAt, balanceOpensAt, balanceDueAt, tourStartAt, autoCharge: false }`.

---

## 8. Files to modify

| File | Change |
|------|--------|
| **List flow** | |
| `app/tours/list/page.tsx` | Use list adapter (GET /api/tours → TourCardViewModel[]); add search summary bar; add filter bar; replace in-page mapping with adapter output; render card component that accepts TourCardViewModel; preserve detail link to `/tour/[id]` or current. |
| `app/search/page.tsx` | Align with same summary bar and filter structure; use adapter for GET /api/tours; same card component; optional "Refine" CTA. |
| `components/TourCardDetail.tsx` | Refactor to accept TourCardViewModel (or extended type) and optional DetailedTour for backward compatibility; add type badge, match quality, join block (status + travelers), surcharge, deposit/balance note; use design tokens and ui primitives. Or introduce `components/tour/TourListCard.tsx` and use it from list/search. |
| **Detail flow** | |
| `app/tour/[id]/page.tsx` | Fetch via detail adapter (GET /api/tours/[id] → TourDetailViewModel); add section order per §6 (badges, why this fits you, booking timeline, cancellation, who this is for); integrate BookingTimeline in main content and optionally in sidebar; keep EnhancedBookingSidebar; feed sidebar from ViewModel. |
| `components/tour/EnhancedBookingSidebar.tsx` | Accept ViewModel shape; do not change price/date/pickup computation or Book action target; restyle only if needed; optional: show compact timeline above or inside. |
| **Adapters & types** | |
| `src/types/tours.ts` | Already has TourCardViewModel, BuildTourResponse, JoinVisibleStatus. Add TourDetailViewModel if not present (with timeline-related fields, type, badges, whyThisFitsYou). |
| `src/lib/adapters/` (e.g. new or existing tours-adapter) | List adapter: raw GET /api/tours response → TourCardViewModel[]. Detail adapter: raw GET /api/tours/[id] response → TourDetailViewModel. Optionally booking-timeline adapter: tour + selectedDate → timeline ViewModel. |
| **Copy / i18n** | |
| `src/design/copy.ts` or i18n | Add keys for search summary labels, filter labels, match quality labels, join status labels, "Why this fits you", "Who this is best for", booking timeline (if not already in COPY.timeline). |
| **API (optional, minimal)** | |
| `app/api/tours/route.ts` | No change to response shape in Phase 3A if adapter normalizes; optional new query params for tourType, hotelArea only if agreed and backward compatible. |
| `app/api/tours/[id]/route.ts` | No change to response shape if adapter normalizes; ensure response includes fields needed for TourDetailViewModel and timeline (or document what’s missing). |

**New files (implementation step only):**

- Optional: `components/list/SearchSummaryBar.tsx`, `components/list/FilterBar.tsx`, `components/tour/TourListCard.tsx`, `components/tour/BookingTimelineSection.tsx` (wraps BookingTimeline with section title and ViewModel wiring).

---

## 9. Risk level per file

| File / area | Risk | Mitigation |
|-------------|------|------------|
| `app/tours/list/page.tsx` | **Medium** | Introduce adapter first; keep existing API URL/params until adapter is stable; then switch to ViewModel. Other callers (TourSectionRow, TourList, SeasonalTours, mobile) keep current API usage until migrated. |
| `app/search/page.tsx` | **Medium** | Same as list; ensure city/search params still work; adapter maps response to same ViewModel. |
| `components/TourCardDetail.tsx` | **Medium** | Today expects DetailedTour; add optional ViewModel branch or new component. Do not break existing callers (tours/list, search) until they pass ViewModel. |
| `app/tour/[id]/page.tsx` | **High** | Large page; many sections. Add new sections (timeline, why this fits you) without removing existing behavior. Detail adapter must not change price/date/pickup semantics used by sidebar and checkout. |
| `components/tour/EnhancedBookingSidebar.tsx` | **High** | Touches price, date, pickup, Book action. Feed from ViewModel; do not change how deposit/balance or checkout redirect work. |
| New adapters | **Medium** | Parse and validate with zod (or existing schema); log and fallback on parse failure; document required API fields. |
| `app/api/tours/route.ts` | **Low** (if unchanged) | If new query params added, default them so existing callers unaffected. |
| `app/api/tours/[id]/route.ts` | **Low** (if unchanged) | Adapter handles current shape; no API change. |
| `src/design/copy.ts` / i18n | **Low** | Additive keys; use fallbacks. |

---

## 10. What will not be touched

- **Auth, session, redirects, Supabase:** Unchanged.  
- **Checkout flow:** No change to POST /api/bookings, POST /api/stripe/checkout, redirect after payment, or sessionStorage bookingData. List/detail only link to checkout with same query params.  
- **Builder (custom-join-tour):** Generate/proposed/confirm APIs and payloads unchanged. Only "generated list" UI (if we add a dedicated post-builder list page) or link from builder to list/detail is in scope; builder form and steps not refactored here.  
- **Payment execution, Stripe, balance payment:** Unchanged.  
- **My page / My Tours / wishlist:** Out of scope; no change to tabs, status badges, or API.  
- **Header, Footer, BottomNav:** No change in this refactor.  
- **Other list consumers:** TourSectionRow, TourList (homepage), SeasonalTours, mobile app — keep using current GET /api/tours and current mapping until they are explicitly migrated to adapter + ViewModel.  
- **jeju/[slug] detail:** Can remain as-is or be aligned in a later step; this plan focuses on tour/[id] and list (tours/list, search).  
- **API contracts:** No breaking change to GET /api/tours or GET /api/tours/[id] response shape unless explicitly versioned or extended in a separate change. Adapters absorb current shape.

---

*This document is planning only. No code changes are made in Phase 3A planning.*
