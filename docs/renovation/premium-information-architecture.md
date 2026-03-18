# Premium Information Architecture: Homepage & Tour Detail (Mobile-First)

**Purpose:** Final mobile-first IA for homepage and tour detail page. Informs layout and content order; no code in this step.

**Goals:**
1. Keep essential explanatory content.
2. Reduce visual complexity.
3. Introduce premium global-platform polish.
4. Preserve all working links and backend logic.

**Sources:** `docs/renovation/premium-readability-audit.md`, `docs/renovation/homepage-refactor-plan.md`, `docs/renovation/final-product-spec.md` §7.1 and §7.5, `app/page.tsx`, `app/tour/[id]/page.tsx`.

---

## 1. Principles

| Principle | Application |
|-----------|-------------|
| **Mobile-first** | Section order and content density are defined for the narrow viewport first; desktop adds columns or sticky elements without introducing new content blocks. |
| **One place per idea** | Trust, deposit rules, “why choose,” and product differentiation each live in one canonical block; avoid repeating the same message in multiple sections. |
| **Clear hierarchy** | One hero block (headline + primary CTA); one tier of “primary” sections; one tier of “supporting” sections. Section labels (tags) are minimal and consistent, not decorative. |
| **Price when choosing** | Any card or block that invites a booking decision (AI Private, Join, example itinerary, proposed tours, tour detail) surfaces price or “from ₩X” in the same view. |
| **No dead links** | Every link and CTA keeps its current href or documented target; Busan/Seoul use “Coming soon” + notify/waitlist only (no broken routes). |
| **Backend untouched** | No change to API routes, request/response shapes, fetch URLs, query params, or adapter logic; only composition, order, copy, and presentation. |

---

## 2. Homepage information architecture

### 2.1 Section order (mobile = vertical order)

Order is fixed. Same order on desktop; layout may use columns or sticky elements.

| Order | Section | Purpose | Content rule |
|-------|---------|---------|--------------|
| 0 | **Header** | Nav, Plan My Trip. | Out of scope for this IA; preserve all links. |
| 1 | **Hero** | Single value proposition + one primary CTA. | Headline + one short sub line only. **No trust list in hero** (trust moves to strip only). Primary CTA: “Plan My Trip” → `/custom-join-tour`. Optional: compact planner (destination, date, hotel area, guests) that deep-links to builder; if present, same behavior as today. |
| 2 | **Trust strip** | Single source of trust copy. | One row/card with 4 items from `COPY.hero.trust` (e.g. “AI-built itinerary in minutes”, “Smarter pickup flow”, “3–13 travelers only”, “Transparent deposit and balance rules”). No repetition in hero. |
| 3 | **Why choose (comparison)** | Differentiate from bus/private. | One heading + **3 bullets only** on mobile (expand to 5–7 on larger viewports or “See more” if needed). Copy: planning, group size, pickup/comfort. No overlap with trust strip wording. |
| 4 | **Tour type cards** | Product choice with clear hierarchy. | Three cards: (1) AI Private — hero treatment, **include “From ₩X” or range**, CTA “Start Private Tour” → `/custom-join-tour`; (2) AI Small-Group Join — **include “From ₩X” or range**, CTA “Join Small Group” → `/custom-join-tour`; (3) Classic Bus — muted, CTA “View Classic Bus Tours” → `/tours/list`. On mobile: **one line of benefit + price + CTA per card**; optional “See benefits” expand for bullets. |
| 5 | **How it works** | Single explanation of flow. | 4 steps only (Enter hotel → We plan route → Choose comfort → Travel). **No separate “Example itinerary” section**; merge one example line into this section (e.g. “Example: 4 travelers, premium van, 20% deposit”) or into Tour type cards. Eliminates duplicate “flow” explanation. |
| 6 | **Destinations** | Where we operate. | **One** CTA block for Jeju (not two). Content: Jeju “Available now” + **price hint “From ₩X”** + one CTA “Plan My Trip” / “Build My Tour” → `/custom-join-tour`. Below: three destination chips/cards — Jeju (primary, link), Busan (Coming soon, notify CTA → e.g. `/contact` or waitlist), Seoul (same). **Proposed tours** list: keep fetch `/api/custom-join-tour/proposed`, links to `/custom-join-tour/proposed?id={id}`; show **price on first line** (bold or prominent), then participants + vehicle. |
| 7 | **Classic bus fallback** | Alternative product. | One section title: “Prefer a classic group tour instead?” + existing `HomeTourSections` (no change to fetch, params, or `seeAllHref`). Tour cards keep current links to detail; “See all” → `/tours/list`. |
| 8 | **Reviews** | Social proof. | **2 quotes on mobile** (optionally “Read more” or carousel for 2 more). Each quote: text + **attribution** (“— Traveler”, “— [Month]” or source). Same copy as today; add attribution only. |
| 9 | **Final CTA** | Close the loop. | One headline + one button “Plan My Trip” → `/custom-join-tour`. |
| 10 | **Footer** | Links, legal. | Out of scope; preserve all links. |
| — | **BottomNav** | Mobile nav. | Out of scope; preserve. |

### 2.2 Homepage: content merges and removals

| Before | After |
|--------|--------|
| Trust list in Hero + same 4 lines in CompactTrustBar | Trust only in Trust strip (strip after hero). Hero: headline + sub + CTA only. |
| “Why choose” 7 bullets | 3 bullets on mobile; up to 5–7 on desktop or behind “See more.” |
| “How it works” + “Preview itinerary” as two sections | One “How it works” section; example (traveler count, vehicle, deposit) as one line or small badge inside it, or in a single tour-type card. |
| Two Jeju CTAs (card + large block) | One Destinations block: Jeju primary with one CTA; no duplicate large dark block. |
| Tour type cards: no price | Add “From ₩X” or range to AI Private and AI Small-Group Join; keep Classic Bus as “View” (price on cards in next section). |
| Preview itinerary card (standalone) | Remove as standalone; fold example into How it works or one card. |
| Reviews: 4 quotes, no attribution | 2 visible on mobile; add “— Traveler” or “— [Month]”; optional 2 more via carousel/expand. |

### 2.3 Homepage: link and data preservation

| Element | Preserved behavior |
|---------|--------------------|
| Hero CTA | → `/custom-join-tour` (or current). |
| Trust strip | Copy only; no new links. |
| Tour type: Start Private Tour | → `/custom-join-tour`. |
| Tour type: Join Small Group | → `/custom-join-tour`. |
| Tour type: View Classic Bus Tours | → `/tours/list`. |
| Destinations: Jeju CTA | → `/custom-join-tour` (ProposeTransitionLink or same). |
| Destinations: Proposed tours | Fetch `GET /api/custom-join-tour/proposed`; links ` /custom-join-tour/proposed?id={id}`. Polling/limit unchanged. |
| Destinations: Busan / Seoul | “Coming soon”; CTA → `/contact` or existing waitlist (no dead link). |
| Classic bus: card links | → `/tour/[id]` (or current detail URL). |
| Classic bus: See all | → `/tours/list`. HomeTourSections fetch params and API unchanged. |
| Final CTA | → `/custom-join-tour`. |
| Header / Footer / BottomNav | No change to links or behavior. |

---

## 3. Tour detail page information architecture

### 3.1 Section order (mobile = vertical order)

Main content (left column on desktop) order below. Booking sidebar and mobile sticky bar are separate (see 3.3).

| Order | Section | Purpose | Content rule |
|-------|---------|---------|--------------|
| 0 | **Header** | Nav. | Preserve. |
| 1 | **Hero** | Title + visual + one trust line. | Full-width image; overlay: title (h1), rating + review count. **One badge only** (e.g. “Small Group” or “AI Planned” or “Trusted by 50,000+”; if “50,000+” keep only if verifiable; otherwise use product badge). **No “Why Choose Us” strip here**; move trust into one compact line or into sidebar. |
| 2 | **Price + CTA (main column)** | Price anchor in main content. | **New:** One short block below hero (or right under title on mobile): “From ₩X per person” (or formatted price) + “Deposit today” + primary CTA “Book now” (scroll to sidebar or open booking). Same price as sidebar; no new logic. |
| 3 | **Why this tour** | Single “fit” message. | **Merge** “Why this fits you” and “Who this is best for” into **one** section: “Why this tour” with one list (bullet or checkmarks). Data: `tour.whyThisFitsYou` + `tour.whoThisIsBestFor` combined, deduplicated. |
| 4 | **Booking timeline** | When things happen. | Keep `BookingTimelineSection`; server timeline or fallback. No duplication of deposit rules here; one short line “Deposit refundable until 24h before; balance in My Tours.” |
| 5 | **Cancellation** | Policy in one place. | One card: cancellation policy text + **one** line for “We never auto-charge the balance” (COPY.checkout.autoChargeWarning). Remove repetition from sidebar; sidebar can link “See cancellation” to scroll here. |
| 6 | **Gallery** | Photos. | Keep current gallery; tag/label optional, single style (e.g. “Photos”). |
| 7 | **Itinerary (timeline)** | Day at a glance. | Keep timeline; one section label (“Your day” / “Itinerary”). Optional: **collapse long “View Details” text on mobile** (tap to expand). |
| 8 | **Meeting & pickup** | Where and when. | Pickup points list + map. **Replace 5 separate notice cards** with **one “Pickup tips” block**: 4–5 short bullets (exact times, arrive early, no-show, airport, Jeju cost if applicable). Same info; one block, less visual noise. |
| 9 | **At a glance** | Quick facts. | Duration, languages, Included, Excluded. Keep; single style. Labels use readable contrast (not neutral-400). |
| 10 | **Reviews** | Social proof. | Keep `TourReviewsSection`; no change to data or links. |
| 11 | **More information (collapsible)** | Long-form and legal. | **One** collapsible group or **single accordion** with 3–4 panels: (1) **Highlights** (if present), (2) **Full description** (overview), (3) **FAQ** (if present), (4) **Important notes + Child eligibility** (merge into one panel or two). **Unify language** (e.g. “Child eligibility” in page language only, not bilingual unless required). No 5 separate section cards; one “More information” with sub-headings inside. |
| — | **Booking sidebar (desktop)** | Sticky form. | Unchanged behavior: date, guests, pickup, language, price summary, payment option, CTA. All links and submit → checkout unchanged. |
| — | **Mobile sticky bar** | Price + CTA. | Keep; price + “Book now” scroll to form. |

### 3.2 Tour detail: content merges and removals

| Before | After |
|--------|--------|
| “Trusted by 50,000+” badge + “Why Choose Us” 3-item strip | One hero badge (product or verifiable trust). Remove “Why Choose Us” strip from main column; optional single line in sidebar. |
| “Why this fits you” + “Who this is best for” | One section: “Why this tour” (merged list). |
| Cancellation card + autoChargeWarning + sidebar deposit copy + mobile “Deposit Today” | One cancellation card in main column with policy + one autoCharge line. Sidebar: “Deposit” label + amount; link “Cancellation policy” scrolls to main. |
| 5 Meeting & Pickup notice cards (icon + text each) | One “Pickup tips” block with 4–5 bullets. |
| 5 bottom sections (Highlights, Full description, FAQ, Important notes, Child) | One “More information” block with 3–4 accordion panels; Child eligibility in page language only. |
| No price in main content | Add “Price + CTA” block below hero in main column (mirrors sidebar price). |
| Multiple section tags (Quick Info, YOUR DAY AT A GLANCE, etc.) | Reduce to consistent labels (e.g. “Itinerary”, “Pickup”, “More information”); one style, minimal tags. |

### 3.3 Tour detail: link and data preservation

| Element | Preserved behavior |
|---------|--------------------|
| Detail URL | `/tour/[id]`; fetch `GET /api/tours/[id]?locale=…`; adapter `adaptTourDetailResponse`. |
| Booking sidebar | Date picker, guests, pickup select, language, payment option, price calc, CTA → `sessionStorage` + redirect `/tour/[id]/checkout`. No change to API or checkout flow. |
| Mobile sticky bar | “Book now” scrolls to `bookingRef` (sidebar content in flow on mobile). |
| Tour reviews | Existing `TourReviewsSection`; data source unchanged. |
| Gallery, timeline, map | Existing components; no change to props or data. |
| Important notes, FAQ, Child eligibility | Content still shown; only container merged into “More information” accordion. Same data (tour.overview, tour.faqs, tour.childEligibility, ImportantNotesContent). |
| Footer / BottomNav | No change. |

---

## 4. Cross-page consistency

| Item | Homepage | Tour detail |
|------|----------|-------------|
| **Trust** | One strip (4 items); no repeat in hero. | One badge or one line; no 3-item strip. |
| **Deposit / no auto-charge** | Mention in trust strip (“Transparent deposit and balance rules”); no long copy. | One cancellation card with policy + one sentence; sidebar link to it. |
| **Price** | Visible on AI cards, example, proposed tours, classic bus cards. | Hero area + main column block + sidebar + mobile bar. |
| **Primary CTA** | “Plan My Trip” / “Start Private Tour” / “Join Small Group” → builder or list. | “Book now” → scroll to form; form CTA → checkout. |
| **Section labels** | Minimal; one style (e.g. one tag style or no tags). | Same; “Itinerary”, “Pickup”, “More information.” |
| **Language** | i18n/COPY per existing. | Same; Child eligibility and all headings in page language. |

---

## 5. Preservation checklist (no code yet)

Use this during implementation to ensure nothing is broken.

- [ ] **Homepage:** All links in Header, Hero, Tour type cards, Destinations (Jeju, proposed, Busan, Seoul), Classic bus section, Final CTA, Footer, BottomNav unchanged or explicitly documented.
- [ ] **Homepage:** `GET /api/custom-join-tour/proposed` still called by DestinationsCards; response and polling unchanged; links to `/custom-join-tour/proposed?id=…` unchanged.
- [ ] **Homepage:** HomeTourSections / TourSectionRow: fetch URL, params (`limit`, `sortBy`, `sortOrder`, etc.), `seeAllHref` unchanged.
- [ ] **Tour detail:** `GET /api/tours/[id]?locale=…` and adapter unchanged; all sidebar form fields and submit behavior unchanged; checkout redirect and sessionStorage usage unchanged.
- [ ] **Tour detail:** TourReviewsSection, ImportantNotesContent, FaqAccordion, TourOverviewContent: same data props; only container/order changed.
- [ ] **Both:** No new API routes; no change to auth, payment, or Supabase usage.

---

## 6. Summary

- **Homepage:** 9 content sections in fixed order; trust once (strip only); comparison 3 bullets on mobile; tour type cards with price and one CTA each; How it works only (no standalone example itinerary); one Jeju CTA; proposed tours with prominent price; 2 reviews + attribution on mobile; all links and APIs preserved.
- **Tour detail:** 11 main-content sections; one price block in main column; “Why this tour” merged; one cancellation card; one “Pickup tips” block; one “More information” accordion (3–4 panels); booking sidebar and mobile bar behavior unchanged.
- **Polish:** Single source for trust and deposit messaging; price visible wherever users choose; fewer sections and labels; consistent language and contrast; mobile-first density and order.

*This document is planning only. No code changes are made in this step.*
