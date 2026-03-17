# Homepage Refactor Plan (Phase 2A)

**Purpose:** Plan the homepage refactor before writing code. No implementation in this step.

**Source of truth:** `docs/renovation/final-product-spec.md` §7.1, `docs/renovation/migration-plan.md` §2.2 (Homepage), `.cursor/rules/*`, `src/design/copy.ts`, `src/design/tokens.ts`.

---

## 1. Sections to build

Implement or restyle the following sections in spec order. Order on page may be adjusted for flow; all must be present.

| # | Section | Spec reference | Current state |
|---|---------|-----------------|---------------|
| 1 | **Header** | Shell; apply tokens in Phase 2 Shell step (not in this homepage-only refactor). | Existing `Header` — out of scope for this doc. |
| 2 | **Hero** | §7.1 Hero: headline, sub copy, compact planner input, micro trust points; right: preview card / itinerary mockup; stacked mobile. | `HeroSection` exists; carousel + title. Needs new copy, optional compact input, trust points, and spec layout. |
| 3 | **Trust strip** | §7.1: e.g. "AI-built itinerary in minutes", "Smarter pickup flow", "3–13 travelers only", "Transparent deposit and balance rules". | `CompactTrustBar` exists. Restyle and replace copy with centralized constants. |
| 4 | **Why choose (comparison)** | §7.1: "Why travelers choose this over crowded bus tours or expensive private charters"; compare planning, group size, pickup, comfort, flexibility, booking clarity, price. | **New section.** No existing component. |
| 5 | **Tour type cards** | §7.1: Card 1 AI Private, Card 2 AI Small-Group Join, Card 3 Classic Bus (smaller visual priority). CTAs: Start Private Tour, Join Small Group, View Classic Bus Tours. | **New section.** Product hierarchy 1–2–3; Classic Bus must not dominate. |
| 6 | **How it works** | §7.1: 1. Enter your hotel 2. We plan the best route 3. Choose your comfort level 4. Travel with less hassle. | **New section.** No existing component. |
| 7 | **Preview itinerary** | §7.1: Example card with title, pickup area, hotel-fit hint, traveler count, vehicle type, deposit note, balance opens 24h before. | **New section** or extend a card component; static/mock data for presentation only. |
| 8 | **Destinations** | §7.1: Jeju — Available now; Busan / Seoul — Coming soon (muted + notify/waitlist CTA, no dead links). | `DestinationsCards` exists; contains Jeju CTA + proposed tours. Restyle and add Busan/Seoul coming-soon cards. |
| 9 | **Classic bus fallback** | §7.1: Title "Prefer a classic group tour instead?"; link to classic bus list. | Today: single row in `HomeTourSections`. Use a **wrapper only**: section title per spec; do not change HomeTourSections internals (section count, order, fetch URLs, params, or response handling). |
| 10 | **Reviews** | §7.1: Positioning-aligned reviews (e.g. "Much easier than planning it myself", "More comfortable than a regular bus tour"). | **New section.** No existing component. |
| 11 | **Final CTA** | §7.1: "Ready to build your Jeju trip the smarter way?" + Plan My Trip. | **New section.** No existing component. |
| 12 | **Footer** | Shell; out of scope for this doc. | Existing `Footer`. |

---

## 2. Existing components to reuse

Use as-is or wrap; do not change behavior (links, fetch URLs, params).

| Component | Path | Reuse strategy |
|-----------|------|-----------------|
| **Header** | `components/Header.tsx` | Not modified in homepage refactor; Shell step later. |
| **Footer** | `components/Footer.tsx` | Not modified in homepage refactor. |
| **BottomNav** | `components/BottomNav.tsx` | Not modified in homepage refactor. |
| **HeroSection** | `components/HeroSection.tsx` | Restyle with design tokens; replace copy via `COPY` or i18n keys that point to spec copy. Keep or simplify carousel; add sub copy, micro trust points, optional compact input. |
| **CompactTrustBar** | `components/CompactTrustBar.tsx` | Restyle; replace all copy with centralized constants (e.g. `src/design/copy.ts` or existing i18n used by design layer). |
| **DestinationsCards** | `components/DestinationsCards.tsx` | Restyle; preserve `ProposeTransitionLink` href `/custom-join-tour` and `/api/custom-join-tour/proposed` fetch. Add Jeju "Available now" and Busan/Seoul "Coming soon" cards with muted state and non-dead CTA (e.g. notify/waitlist). |
| **HomeTourSections** | `components/HomeTourSections.tsx` | **Do not change** section count, section order, fetch URLs, fetch params, or response handling in Phase 2A. If the homepage needs a Classic Bus fallback presentation, do it with a wrapper/title treatment only (e.g. a parent section with spec title "Prefer a classic group tour instead?"), without restructuring HomeTourSections internals. Restyle container only. |
| **TourSectionRow** | `components/TourSectionRow.tsx` | Used by HomeTourSections. Restyle only; do not change API URL, query params, or response handling. |
| **ProposeTransitionLink** | `components/ProposeButton.tsx` | Keep all hrefs and transition behavior; may wrap in new Card/Button from `src/components/ui/`. |
| **Logo** | `components/Logo.tsx` | Unchanged. |
| **Icons** | `components/Icons.tsx` | Unchanged. |

---

## 3. New components to create

All under `components/` (same as HeroSection, DestinationsCards). Use design tokens and `src/design/copy.ts` (or i18n); use primitives from `src/components/ui/` (card, button, section-header, badge, etc.) where applicable.

| Component | Purpose | Primitives / design |
|-----------|---------|----------------------|
| **ComparisonSection** (or **WhyChooseSection**) | "Why travelers choose this over crowded bus tours or expensive private charters" — compare planning, group size, pickup, comfort, flexibility, booking clarity, price. | Card, SectionHeader, copy from design. |
| **TourTypeCards** | Three cards: AI Private, AI Small-Group Join, Classic Bus. Hierarchy and CTAs per spec. | Card, Button, SectionHeader; copy centralized. |
| **HowItWorksSection** | Four steps: Enter hotel → We plan route → Choose comfort → Travel with less hassle. | SectionHeader, layout (grid/list); no new primitives required. |
| **PreviewItineraryCard** | Example itinerary card: title, pickup area, hotel-fit hint, traveler count, vehicle type, deposit note, balance 24h. | Card, Badge, copy; static/mock data. |
| **ReviewsSection** | 2–4 positioning-aligned review quotes. | Card or simple block; typography from tokens. |
| **FinalCTASection** | Headline "Ready to build your Jeju trip the smarter way?" + Plan My Trip CTA. | SectionHeader, Button (primary); copy from design. |

**ClassicBusSection** (wrapper): Renders the spec title "Prefer a classic group tour instead?" and wraps the existing `HomeTourSections` component. No changes to HomeTourSections internals — section count, order, fetch URLs, params, and response handling stay unchanged.

---

## 4. Files to modify

| File | Change |
|------|--------|
| `app/page.tsx` | Compose new section order: Hero, Trust strip, Comparison (new), Tour type cards (new), How it works (new), Preview itinerary (new), Destinations, Classic bus section (restyled), Reviews (new), Final CTA (new). Preserve Header/Footer/BottomNav; same wrapper/layout. |
| `app/[locale]/page.tsx` | Currently uses different sections (TourList, TrustBar, PaymentMethodInfo; no CompactTrustBar or HomeTourSections). Align with same section order as `app/page.tsx` where applicable; preserve locale routing, i18n, and locale-specific content (e.g. TourList with `localeOverride`). |
| `components/HeroSection.tsx` | Restyle with design tokens; spec headline/sub copy; optional compact planner input; micro trust points; keep or simplify carousel. |
| `components/CompactTrustBar.tsx` | Restyle; replace copy with centralized constants. |
| `components/DestinationsCards.tsx` | Restyle; add Jeju "Available now" and Busan/Seoul "Coming soon" blocks; preserve `/custom-join-tour` and proposed API fetch. |
| `components/HomeTourSections.tsx` | Restyle container only. **Do not change** section count, section order, fetch URLs, fetch params, or response handling. Classic Bus title is applied via wrapper (e.g. ClassicBusSection), not by restructuring this component. |
| `components/TourSectionRow.tsx` | Presentation only: design tokens, typography, spacing; no change to fetch or data shape. |
| `src/design/copy.ts` (or i18n used by design) | Add homepage-specific keys: hero headline/sub, trust strip lines, comparison title/bullets, tour type card copy, how-it-works steps, preview itinerary labels, classic bus section title, review quotes, final CTA headline and button. |

New files (create only in implementation step):

- Component(s) for ComparisonSection, TourTypeCards, HowItWorksSection, PreviewItineraryCard, ReviewsSection, FinalCTASection (and optionally ClassicBusSection wrapper).

---

## 5. Risk level per file

| File / area | Risk | Mitigation |
|-------------|------|------------|
| `app/page.tsx` | **Low** | Only composition and order; no new data fetching or routing. |
| `app/[locale]/page.tsx` | **Low** | Same as above; ensure locale routing and i18n unchanged. |
| `components/HeroSection.tsx` | **Low** | Presentation and copy only; keep existing carousel logic or simplify without removing. |
| `components/CompactTrustBar.tsx` | **Low** | Restyle + copy swap. |
| `components/DestinationsCards.tsx` | **Medium** | Contains fetch to `/api/custom-join-tour/proposed` and `ProposeTransitionLink`. Do not change URLs or response handling; only layout and copy. |
| `components/HomeTourSections.tsx` | **Medium** | Do not change section count, order, fetch URLs, params, or response handling. Classic Bus title via wrapper only; restyle container only. |
| `components/TourSectionRow.tsx` | **Medium** | Used in multiple places; change only CSS/design tokens; do not change props contract or fetch. |
| New sections (Comparison, TourTypeCards, etc.) | **Low** | New components; no existing behavior to break. |
| `src/design/copy.ts` / i18n | **Low** | Additive keys; ensure keys are used and fallbacks exist. |

---

## 6. How existing links and actions will be preserved

- **Nav / Shell:** Header, Footer, BottomNav — not modified in this refactor; all links and auth unchanged.
- **Hero:** Any CTA (e.g. "Plan My Trip") will keep the same destination (e.g. `/custom-join-tour` or current behavior).
- **DestinationsCards:**  
  - `ProposeTransitionLink` href remains `/custom-join-tour`.  
  - Fetch to `/api/custom-join-tour/proposed` unchanged; no change to response handling or polling.
- **HomeTourSections / TourSectionRow:**  
  - `seeAllHref` remains `/tours/list` (or current value).  
  - `fetchParams` (e.g. `limit: 4`, `sortBy: 'rating'`, `sortOrder: 'desc'`) unchanged.  
  - No new API routes or query params.
- **Tour type cards (new):**  
  - "Start Private Tour" → link to existing private flow (e.g. `/custom-join-tour` or specified route).  
  - "Join Small Group" → same.  
  - "View Classic Bus Tours" → same as current "see all" (e.g. `/tours/list`).
- **Final CTA:** "Plan My Trip" → same target as Hero CTA.
- **Busan/Seoul:** No dead links; use "Coming soon" with optional waitlist/notify CTA (no route change for existing pages).

---

## 7. What remains adapter-based

- **Homepage refactor (Phase 2A)** is presentation and copy only. No new adapters are required for this step.
- **TourSectionRow** today likely fetches from an API and maps data in-component. The migration plan (Phase 3) will introduce a tour-list adapter (GET `/api/tours` → TourCardViewModel[]). For Phase 2A we do **not** change how TourSectionRow gets or maps data; we only restyle it. When Phase 3 is done, the same homepage section will consume adapter output; until then, existing fetch and mapping remain.
- **DestinationsCards** uses `/api/custom-join-tour/proposed`; that API and response shape are unchanged. No adapter for proposed tours on homepage in this step.
- Summary: On homepage, no adapter changes in Phase 2A. Adapter-based work is deferred to list/detail/checkout/mypage phases.

---

## 8. What will not be touched

- **Header, Footer, BottomNav:** No changes in this homepage refactor (Shell is a separate step).
- **Auth, session, redirects, Supabase:** Unchanged.
- **API routes and request/response contracts:** No new or modified APIs for homepage.
- **TourSectionRow fetch URL, query params, and response handling:** Unchanged.
- **DestinationsCards:** `/custom-join-tour` link and `/api/custom-join-tour/proposed` fetch and polling logic unchanged.
- **Payment, checkout, booking, Stripe:** Not on homepage; untouched.
- **Builder flow (custom-join-tour):** Only linked from homepage; no changes to builder pages in this step.
- **List/detail/checkout/mypage:** Out of scope.
- **Locale routing and i18n:** No change to `SUPPORTED_LOCALE_ROUTES`, `toI18nLocale`, or redirect behavior; only section composition may change on `[locale]` page.

---

## 9. Step 13 (planned): Locale homepage parity

**Purpose:** Align `app/[locale]/page.tsx` with the refactored root homepage (`app/page.tsx`) so that locale routes (e.g. `/ko`, `/zh-CN`, `/ja`, `/es`, `/zh-TW`) show the same section order and components where applicable. No implementation in this planning step.

**Current gap (documented in `homepage-qa.md` §7 and `risk-map.md` §4):**

- Root `/` uses: Hero, CompactTrustBar, ComparisonSection, TourTypeCards, HowItWorksSection, PreviewItineraryCard, DestinationsCards, ClassicBusSection, ReviewsSection, FinalCTASection.
- Locale pages use: Hero, DestinationsCards, TourList, PaymentMethodInfo, TrustBar.

**Step 13 scope (planning only):**

| Item | Plan |
|------|------|
| **Section order** | Use the same section order as `app/page.tsx`: Hero → CompactTrustBar → Comparison → TourTypeCards → HowItWorks → PreviewItinerary → Destinations → ClassicBusSection → Reviews → FinalCTA. |
| **Locale-specific content** | Preserve `TourList` with `localeOverride` where it fits the spec (e.g. after Destinations or in a defined slot). Preserve or relocate `PaymentMethodInfo` and `TrustBar` per product decision (e.g. keep TrustBar for locale-only trust copy, or replace with CompactTrustBar and centralized copy). |
| **Routing and i18n** | Do not change `SUPPORTED_LOCALE_ROUTES`, `toI18nLocale`, `/en` → `/` redirect, or `LocaleHomeClient` locale prop. All new sections must consume i18n (e.g. `COPY` keys or existing messages) so locale content is correct. |
| **Files to touch** | `app/[locale]/page.tsx` only for composition; reuse existing components (CompactTrustBar, ComparisonSection, TourTypeCards, HowItWorksSection, PreviewItineraryCard, ClassicBusSection, ReviewsSection, FinalCTASection). No changes to API routes, auth, payment, or adapter logic. |
| **Risks** | See `risk-map.md` §4 (locale parity). Mitigation: same section order and components; preserve locale routing and i18n. |

**Out of scope for Step 13:** Fixing Hero vs CompactTrustBar duplicate copy; that remains a separate follow-up.

---

*This document is planning only. No code changes are made in Phase 2A planning.*
