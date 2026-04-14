# Homepage logic extraction (legacy → shared, v2-ready)

**Date:** 2026-04-11  
**Goal:** Isolate reusable behavior from `HeroPremium` / `ProductCardsPremium` without changing outcomes, so `HomeV2Page` can adopt features incrementally.

## What changed in behavior

**None intended.** `HeroPremium` and `ProductCardsPremium` should behave as before (same fetches, same timeouts, same hrefs, same analytics call sites).

## New layout

| Path | Role |
|------|------|
| `lib/home/types/hero-planner.ts` | `HeroDestination`, `HeroMatchPhase` |
| `lib/home/constants.ts` | `HOME_HERO_MOBILE_MQ` (shared with v2 hero / match) |
| `lib/home/services/homepage-product-card-images-response.ts` | Type guards + `joinImageUrlFromHomepageProductCardApiPayload` |
| `lib/home/services/homepage-product-card-images-api.ts` | `HOMEPAGE_PRODUCT_CARD_IMAGES_API_PATH` |
| `lib/home/services/custom-join-href.ts` | `buildCustomJoinTourHref` (legacy query rules) |
| `lib/home/services/hero-intent-append-chip.ts` | `appendIntentPhraseToIntentField` |
| `lib/home/services/hero-match-load-delays.ts` | `HERO_MATCH_LOAD_DELAYS_MS` (was inline in hero) |
| `lib/home/services/hero-match-schedule.ts` | `startHomepageMatchSimulation` + `clearHomepageMatchTimeouts` (shared stagger; legacy + v2) |
| `hooks/home/useHomepageJoinCardImage.ts` | Join image URL fetch (hero best-match background) |
| `hooks/home/useHomepageProductCardImages.ts` | Full join/private/bus fetch (product cards grid) |
| `hooks/home/useHeroMobileMatchFlow.ts` | Mobile planner → loading → result + `analytics.heroFormStart` |
| `hooks/home/useHomeHeroMobileMq.ts` | `matchMedia` for `HOME_HERO_MOBILE_MQ` (v2 hero) |
| `components/home/v2/HomeV2MatchProvider.tsx` | v2 in-page match phase + join image (wraps v2 main column) |
| `lib/home/adapters/legacy-home-to-v2-ui.ts` | Types + pure adapters for v2 “three ways” / planner CTA |
| `lib/home/adapters/v2-best-match-result-vm.ts` | i18n + routes → v0-shaped best-match card (no API) |

## Legacy components updated to use shared code

- `src/components/home/HeroPremium.tsx` — uses hooks + `buildCustomJoinTourHref` + `appendIntentPhraseToIntentField` + shared types.
- `src/components/home/ProductCardsPremium.tsx` — uses `useHomepageProductCardImages`.

## Home v2 hero + best-match (wired)

- **`components/home/v2/sections/hero-section.tsx`** — planner state + chips + `buildCustomJoinTourHref`. **Mobile** (`useHomeHeroMobileMq`): `startInPageMatchFlow()` (shared stagger + `analytics.heroFormStart` inside provider). **Desktop**: `analytics.heroFormStart()` + `router.push(continueHref)` (unchanged).
- **`components/home/v2/sections/best-match-preview.tsx`** — **Desktop:** always shows the static v0 “example” card. **Mobile:** `idle` → same example; `loading` → spinner + same i18n steps as legacy; `result` → `useHomepageJoinCardImage` URL + `buildV2BestMatchResultViewModel` (tour CTA, back, browse, also-consider links). Image `onError` → copy + **Try again** (retry-safe). **Back to planner** clears timeouts and returns to `idle` (same as legacy `setMatchPhase("planner")`).

There is still **no** dynamic recommendation API; behavior matches legacy simulated match + fixed East Jeju product.

## `HomeV2Page` status (other sections)

`ChooseTravelStyle`, `ProcessOperational`, `VisualBreak`, `TravelerReviews`, `FinalCTA` are not wired to `useHomepageProductCardImages` or CMS yet. Use `adaptHomepageProductCardImagesToV2StyleImages` when needed.

## Intentionally not extracted (legacy-only dependencies)

- **`HeroIntentWell`** (intro video + textarea + timers) — only in `HeroPremium`; v2 hero uses a simpler video + textarea without F1–F8 intro flow.
- **`HeroBestMatchArticle`** (glass / film grain / full-bleed overlay layout) — legacy-only; v2 reuses the v0 card layout with the same i18n strings and hrefs via `v2-best-match-result-vm`.
- **`usePrefersReducedMotion`** branches in legacy hero video — not replicated on v2 hero video.
- **`FinalCtaPremium`** private link still uses its own `encodeURIComponent` string (unchanged to avoid query-encoding drift).
- **Product grid images** — `useHomepageProductCardImages` is only on legacy `ProductCardsPremium` (and shared hook for future v2 sections).

## Related docs

- `HOME_LEGACY_FUNCTION_INVENTORY.md` — full behavior inventory.
- `HOME_V2_STATIC_IMPORT_NOTES.md` — v2 static import notes.
