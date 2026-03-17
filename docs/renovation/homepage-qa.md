# Homepage QA (Phase 2A)

**Purpose:** Post-implementation checklist for the homepage refactor. Use this to verify links, actions, layout, and copy.

**Reference:** `docs/renovation/homepage-refactor-plan.md`, `docs/renovation/final-product-spec.md` §7.1.

---

## 1. Section order and presence

- [ ] **Hero** — Headline and sub copy from `COPY.hero`; carousel; micro trust points; Plan My Trip CTA.
- [ ] **Trust strip** — Four trust lines from `COPY.hero.trust`; visible on mobile and desktop.
- [ ] **Why choose (comparison)** — Title and bullets from `COPY.comparison`; no hover-only critical info.
- [ ] **Tour type cards** — Three cards: AI Private, AI Small-Group Join, Classic Bus (smaller visual priority). CTAs visible (not hover-only).
- [ ] **How it works** — Four steps from `COPY.howItWorks`; numbered; mobile-first grid.
- [ ] **Preview itinerary** — Example card with pickup area, hotel-fit hint, traveler count, vehicle type, deposit/balance copy.
- [ ] **Destinations** — Section title; Jeju “Available now” + link to `/custom-join-tour`; Busan/Seoul “Coming soon” + Notify Me (e.g. `/contact`); proposed tours block with same fetch and links.
- [ ] **Classic bus fallback** — Wrapper title “Prefer a classic group tour instead?”; `HomeTourSections` unchanged (section count, order, fetch, params).
- [ ] **Reviews** — 2–4 quotes from `COPY.reviews.quotes`.
- [ ] **Final CTA** — Headline and Plan My Trip button; links to `/custom-join-tour`.

---

## 2. Links and actions (must not break)

- [ ] **Hero “Plan My Trip”** → `/custom-join-tour`.
- [ ] **Tour type cards:** “Start Private Tour” and “Join Small Group” → `/custom-join-tour`; “View Classic Bus Tours” → `/tours/list`.
- [ ] **Destinations:** Jeju card and main Jeju CTA → `/custom-join-tour`. “View all” proposed → `/custom-join-tour/proposed`. Proposed tour rows → `/custom-join-tour/proposed?id={id}`. Busan/Seoul “Notify Me” → `/contact` (or non-dead route).
- [ ] **Classic bus “See all”** (inside `TourSectionRow`) → `/tours/list` (unchanged).
- [ ] **Final CTA “Plan My Trip”** → `/custom-join-tour`.
- [ ] **Header / Footer / BottomNav** — No changes; all existing nav links work.

---

## 3. Data flow (unchanged)

- [ ] **Proposed tours** — Fetch to `/api/custom-join-tour/proposed`; polling interval and response handling unchanged.
- [ ] **Classic bus row** — Fetch to `/api/tours` with same params (limit, sortBy, sortOrder); no new query params or API routes.

---

## 4. UX and accessibility

- [ ] **Mobile-first** — Sections stack correctly; touch targets at least 44px where applicable.
- [ ] **No hover-only critical info** — All CTAs and key copy visible without hover (e.g. on tap/focus).
- [ ] **Focus states** — Links and buttons have visible focus ring.
- [ ] **Copy** — Homepage sections use centralized copy (`COPY` or i18n); no hardcoded strings for spec content.

---

## 5. HomeTourSections (wrapper-only)

- [ ] **Section count** — Unchanged (single section).
- [ ] **Section order** — Unchanged.
- [ ] **Fetch URL / params / response handling** — Unchanged.
- [ ] **Classic bus title** — Applied only via `ClassicBusSection` wrapper; no changes inside `HomeTourSections.tsx` to SECTIONS or fetch.

---

## 6. Files touched (for regression)

| Area | Files |
|------|--------|
| Page | `app/page.tsx` |
| New sections | `ComparisonSection`, `TourTypeCards`, `HowItWorksSection`, `PreviewItineraryCard`, `ReviewsSection`, `FinalCTASection`, `ClassicBusSection` |
| Restyled | `HeroSection`, `CompactTrustBar`, `DestinationsCards`, `HomeTourSections` (container only), `TourSectionRow` (presentation only) |
| Copy | `src/design/copy.ts` |

---

*Complete this checklist after Phase 2A implementation and before marking homepage refactor done.*

---

## 7. Documented follow-ups (Step 12)

- **Hero micro trust points and CompactTrustBar duplicate copy.**  
  Both render the same four lines from `COPY.hero.trust` ("AI-built itinerary in minutes", "Smarter pickup flow", "3–13 travelers only", "Transparent deposit and balance rules"). Consider deduplicating (e.g. single source on hero or trust bar) in a later step.

- **Locale homepages do not match refactored root homepage.**  
  `app/[locale]/page.tsx` (e.g. `/ko`, `/zh-CN`) still uses the old section set (Hero, DestinationsCards, TourList, PaymentMethodInfo, TrustBar) and does not include CompactTrustBar, ComparisonSection, TourTypeCards, HowItWorksSection, PreviewItineraryCard, ClassicBusSection, ReviewsSection, or FinalCTASection. Parity with `app/page.tsx` is a known follow-up.

### Step 12 changed file list (exact, from git diff / untracked)

**Modified (tracked, changed vs HEAD):**

- `app/page.tsx`
- `components/CompactTrustBar.tsx`
- `components/DestinationsCards.tsx`
- `components/HeroSection.tsx`
- `components/HomeTourSections.tsx`
- `components/TourSectionRow.tsx`

**New (untracked):**

- `components/ClassicBusSection.tsx`
- `components/ComparisonSection.tsx`
- `components/FinalCTASection.tsx`
- `components/HowItWorksSection.tsx`
- `components/PreviewItineraryCard.tsx`
- `components/ReviewsSection.tsx`
- `components/TourTypeCards.tsx`
- `src/design/copy.ts`
