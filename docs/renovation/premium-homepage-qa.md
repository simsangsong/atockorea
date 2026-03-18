# Premium Homepage QA

**Purpose:** QA checklist for the refactored root homepage (`/`) using premium components. Use this to verify links, conversion story, trust content, and mobile readability before release.

**Reference:** `docs/renovation/homepage-refactor-plan.md`, `docs/renovation/final-product-spec.md` §7.1.

---

## 1. Section order and presence

| # | Section | Location | Verify |
|---|---------|----------|--------|
| 1 | Header | Top | Nav links, logo, auth work. |
| 2 | Hero (compact) | After header | Headline, sub copy, Plan My Trip CTA; value prop clear; compact on mobile. |
| 3 | Trust strip | After hero | 4 trust points visible; readable on mobile. |
| 4 | **Comparison panel** | Near top (after trust) | Table: AI Join vs Private vs Bus; 3 trust blocks below (pickup, deposit/balance, booking rules). Horizontal scroll on small screens. |
| 5 | Tour type cards (with **visible prices**) | After comparison | 3 cards: AI Join (emphasized), AI Private, Classic Bus. Each shows "Starting from" + price (e.g. From ₩50,000 / person). CTAs: Join Small Group, Start Private Tour, View Classic Bus Tours. |
| 6 | How it works | After cards | 4 steps; readable on mobile. |
| 7 | Destinations | After how it works | Jeju (Available now → `/custom-join-tour`), Busan/Seoul (Coming soon → `/contact`). **No** legacy AI beta block or proposed tours block. |
| 8 | Classic bus fallback | After destinations | Title "Prefer a classic group tour instead?"; HomeTourSections below (see-all → `/tours/list`). |
| 9 | Reviews | After classic bus | 2–4 quotes; positioning-aligned. |
| 10 | Final CTA | After reviews | "Ready to build your Jeju trip the smarter way?" + Plan My Trip → `/custom-join-tour`. |
| 11 | Footer | Bottom | Links and layout unchanged. |
| 12 | BottomNav | Fixed (mobile) | Links work. |

---

## 2. Links and actions (must be preserved)

| Element | Expected behavior / href |
|---------|---------------------------|
| Hero CTA | "Plan My Trip" → `/custom-join-tour` |
| Trust strip | Informational only; no link. |
| Comparison panel | Informational only; no link. |
| AI Join card | CTA "Join Small Group" → `/custom-join-tour` |
| AI Private card | CTA "Start Private Tour" → `/custom-join-tour` |
| Classic Bus card | CTA "View Classic Bus Tours" → `/tours/list` |
| Jeju destination | Card → `/custom-join-tour` (ProposeTransitionLink) |
| Busan / Seoul | Card → `/contact` (Notify Me) |
| Classic bus "see all" | From HomeTourSections → `/tours/list` (unchanged) |
| Final CTA | "Plan My Trip" → `/custom-join-tour` |
| Header / Footer / BottomNav | All existing links and auth unchanged. |

---

## 3. Essential trust and conversion content

Confirm the following are present and scan-friendly (short blocks, clear hierarchy):

| Content | Where |
|---------|--------|
| What the product is | Hero sub copy; product card descriptions. |
| Who it is for | Comparison "Best for" row; card "Best for" lines. |
| How pickup works | Comparison panel trust block: "How pickup works". |
| Deposit and balance | Comparison panel trust block: "Deposit & balance" (20% deposit, balance in My Tours, no auto-charge). |
| Why AI Join vs private/bus | Comparison table (Planning, Group size, Pickup, Comfort, Price, Best for). |
| Key booking rules | Comparison panel trust block: "Booking rules" (cancellation, balance 24h, no auto-charge). |

---

## 4. Visible prices on AI cards (mandatory)

| Card | Must show |
|------|-----------|
| AI Small-Group Join | "Starting from" + e.g. "From ₩50,000 / person" (from `HOMEPAGE_AI_PRICES.joinPriceLabel`). |
| AI Private Tour | "Starting from" + e.g. "From ₩398,000 / group" (from `HOMEPAGE_AI_PRICES.privatePriceLabel`). |
| Classic Bus Tour | "Starting from" + e.g. "From ₩59,000 / person" (from `HOMEPAGE_AI_PRICES.busPriceLabel`). |

Prices are indicative; server remains source of truth at checkout.

---

## 5. Legacy content removed or hidden

| Item | Expected |
|------|----------|
| Legacy AI beta block (DestinationsCards) | **Hidden** when `hideLegacyBlocks={true}` (premium homepage). |
| Proposed tours block (DestinationsCards) | **Hidden** when `hideLegacyBlocks={true}`. |
| Duplicate stacked product layers | **Removed**; single product story via Tour type cards + Comparison + How it works. |
| Old TrustBar / duplicate trust | Root `/` uses TrustStripPremium only; no duplicate trust sections. |

---

## 6. Mobile readability (sharp improvement)

| Area | Check |
|------|--------|
| Hero | Compact height; headline and sub readable without zoom; CTA min 44px tap target. |
| Trust strip | Text not too small; wrap OK on narrow screens. |
| Comparison | Table scrolls horizontally; trust blocks stack in one column; body text ≥ 14px equivalent. |
| Product cards | Cards stack; price and CTA clearly visible; tap targets ≥ 44px. |
| How it works | Steps stack or 2-column; step labels readable. |
| Destinations | Cards stack; tap targets adequate. |
| Classic bus section | Title and tour row readable. |
| Reviews | Quotes readable; grid stacks on small screens. |
| Final CTA | Headline and button readable; button ≥ 44px. |
| Global | No horizontal overflow; consistent vertical rhythm; no tiny body text. |

---

## 7. Locale homepage (`/[locale]`)

- **Current state:** Locale routes (e.g. `/ko`, `/zh-CN`) use the **legacy** composition: HeroSection, DestinationsCards (no hideLegacyBlocks), TourList, PaymentMethodInfo, TrustBar.
- **Parity:** To align with premium homepage, a separate step (e.g. Step 13 in the plan) would: use HeroPremium, TrustStripPremium, ComparisonPanelPremium, ProductCardsPremium, HowItWorksPremium, DestinationsCards with `hideLegacyBlocks`, ClassicBusSection, ReviewsPremium, FinalCtaPremium; and preserve TourList with localeOverride and locale-specific content where needed.
- **This QA doc** applies to the **root** `/` premium homepage. Locale QA can be added when parity is implemented.

---

## 8. Quick smoke test (manual)

1. Load `/` — no console errors; layout intact.
2. Tap Hero "Plan My Trip" → `/custom-join-tour`.
3. Scroll to comparison — table and 3 trust blocks visible; scroll table on mobile.
4. Scroll to product cards — all 3 show "Starting from" + price; tap each CTA → correct route.
5. Scroll to Destinations — Jeju, Busan, Seoul present; no "Beta" or "Proposed tours" block.
6. Scroll to "Prefer a classic group tour instead?" — tour row and see-all link work.
7. Tap Final CTA "Plan My Trip" → `/custom-join-tour`.
8. Resize to 375px width — no overflow; text readable; key CTAs tappable.

---

## 9. Files touched (implementation reference)

| File | Role |
|------|------|
| `app/page.tsx` | Composes premium sections; DestinationsCards with `hideLegacyBlocks`. |
| `src/components/home/HeroPremium.tsx` | Compact hero; value prop; CTA. |
| `src/components/home/TrustStripPremium.tsx` | Micro trust points. |
| `src/components/home/ComparisonPanelPremium.tsx` | Visual comparison + pickup, deposit/balance, booking rules. |
| `src/components/home/ProductCardsPremium.tsx` | Tour type cards with **visible prices**; CTAs. |
| `src/components/home/HowItWorksPremium.tsx` | 4 steps. |
| `components/DestinationsCards.tsx` | Destinations grid; legacy blocks hidden when `hideLegacyBlocks`. |
| `components/ClassicBusSection.tsx` | Wrapper + HomeTourSections. |
| `src/components/home/ReviewsPremium.tsx` | Review quotes. |
| `src/components/home/FinalCtaPremium.tsx` | Final CTA. |
| `src/design/copy.ts` | Hero, howItWorks, tourTypes, destinations, fallback, finalCta, reviews. |
| `src/design/homepage.ts` | HOMEPAGE_COMPARISON, HOMEPAGE_AI_PRICES, HOMEPAGE_PICKUP, HOMEPAGE_DEPOSIT_BALANCE, HOMEPAGE_BOOKING_RULES. |

---

*Document created after premium homepage refactor. Update this QA doc when section order or mandatory elements change.*
