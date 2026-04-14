# Legacy homepage — function & dependency inventory

**Scope:** `components/home/legacy/LegacyHomePage.tsx` and everything it mounts.  
**Purpose:** Controlled migration planning for wiring into `HomeV2Page`.  
**Date:** 2026-04-11  
**Constraint:** This document is from static inspection only — no code was changed for this step.

---

## 1. Component tree (render order)

| # | Component | Path |
|---|-----------|------|
| 1 | `HeroPremium` | `src/components/home/HeroPremium.tsx` |
| 2 | `ProductCardsPremium` | `src/components/home/ProductCardsPremium.tsx` |
| 3 | `SmallGroupValuePremium` | `src/components/home/SmallGroupValuePremium.tsx` |
| 4 | `HowItWorksPremium` | `src/components/home/HowItWorksPremium.tsx` |
| 5 | `TrustAndReviewsSection` | `src/components/home/TrustAndReviewsSection.tsx` |
| 6 | `ClassicBusSection` | `components/ClassicBusSection.tsx` |
| 7 | `FinalCtaPremium` | `src/components/home/FinalCtaPremium.tsx` |

**Shared child modules (non-route):**

- `src/components/home/product-card-glass.tsx` — `CardFilmGrain`, `ProductCardCheckIcon` (used from Hero + ProductCards).
- `src/components/home/home-style-options.ts` — `HOME_STYLE_OPTIONS` (hero chip ids + i18n keys).
- `lib/homepage-product-card-images.shared.ts` — defaults + URL guard types.
- `lib/homepage-product-card-images.server.ts` — used only by API route (not imported by these components directly).
- `src/design/analytics.ts` — `analytics` helper (Hero only).
- Styling: `app/home-premium.css` (imported from root `app/globals.css`) — extensive `.hero-*`, `.home-*` utilities.

---

## 2. Per-section behavior

### 2.1 `HeroPremium`

| Area | Detail |
|------|--------|
| **i18n** | `useTranslations("home")` — copy under `premium.hero.*`, `premium.comparison.*`. |
| **Destination** | Local state `destination`: `"jeju" \| "seoul" \| "busan"`. Only Jeju selectable; Seoul/Busan disabled (coming soon). |
| **Intent text** | `intent` string; desktop + mobile textarea (`HeroIntentWell`). |
| **Quick chips** | `HOME_STYLE_OPTIONS` → translated labels; `appendChip` appends to `intent` (comma-separated, de-dupes substring). Preview count `HERO_CHIP_PREVIEW_COUNT = 3`; `chipsExpanded` toggles “more” row. |
| **Mobile intro video** | `NEXT_PUBLIC_HERO_INTRO_VIDEO_URL`; if set + mobile + not reduced motion: video layer with autoplay, dismiss, play gesture, **12s failsafe** to textarea (`HERO_INTRO_VIDEO_FAILSAFE_MS`). |
| **Responsive** | `useMediaQuery("(max-width: 639px)")` splits mobile vs desktop hero behavior. |
| **a11y motion** | `usePrefersReducedMotion()` disables video path. |
| **“Match” flow (mobile only)** | **Not an API.** `matchPhase`: `planner` → `loading` → `result`. `handleMobileMatchCta` sets loading and runs **staggered timeouts** (`HERO_MATCH_LOAD_MS`), then shows result. |
| **Loading UI** | Spinner + `loadingLabel` from i18n by `loadingStep` 0/1/2. |
| **Error states** | No user-visible error for image fetch failure; silent fallback. |
| **Validation** | No schema: free-text `intent`; destination fixed for CTA building. |
| **Recommendation** | **None.** Best-match card is **static i18n lines** + dynamic **background image URL** only. |
| **API** | `GET /api/homepage-product-card-images` on mount — updates `matchBgSrc` (join image) if response matches `HomepageProductCardImages` or partial `{ join }`. |
| **Analytics** | `analytics.heroFormStart()` on: desktop primary CTA click, mobile match CTA click, best-match overlay `Link` click (naming is misleading vs “form start”). |
| **CTA / routing** | `continueHref` = `/custom-join-tour?destination=jeju` (if Jeju) + `&intent=` when non-empty. **Important gap:** `CustomJoinTourContent` does **not** read `intent` or `destination` from `useSearchParams()` (verified: no `get('intent')` / `get('destination')` in `app/custom-join-tour`). Params are currently **inert** on landing. |
| **Other links** | `HeroBestMatchArticle`: tour `/tour/east-signature-nature-core`, also consider `/custom-join-tour`, `/tours/list`. Result phase: back button resets `matchPhase` to `planner`; link to `/tours/list`. |
| **Animation** | `framer-motion` `AnimatePresence` / `motion.div` for mobile phase transitions; `motionEase` cubic bezier. |
| **Scroll** | No programmatic scroll on homepage hero (custom-join uses `scrollIntoView` internally on other steps — not part of this tree). |

### 2.2 `ProductCardsPremium`

| Area | Detail |
|------|--------|
| **i18n** | `useTranslations("home")` — `premium.productCards.*`. |
| **API** | Same `GET /api/homepage-product-card-images`; replaces all three card images when full object valid. |
| **Errors** | Silent `.catch`; keeps defaults. |
| **Navigation** | `Link`: featured + private → `/custom-join-tour`; bus → `/tours/list`. |
| **Presentation** | `GlassOfferCard` + `next/image` + film grain SVG; no local form state. |

### 2.3 `SmallGroupValuePremium`

| Area | Detail |
|------|--------|
| **i18n** | `useTranslations("home")` — `premium.smallGroupValue.*`. |
| **Logic** | Static layout + `BRAND_NAVY` inline color; no API, no analytics, no links in inspected portion. |

### 2.4 `HowItWorksPremium`

| Area | Detail |
|------|--------|
| **i18n** | `useTranslations("home")` — `premium.howItWorks.*`. |
| **Logic** | Static step list + note; no API, no links. |

### 2.5 `TrustAndReviewsSection`

| Area | Detail |
|------|--------|
| **i18n** | `useTranslations("home")` — `premium.trust.*`, `premium.reviews.*`. |
| **Logic** | Static proof tiles + two blockquotes; **not** wired to `/api/reviews` or live review data. |

### 2.6 `ClassicBusSection`

| Area | Detail |
|------|--------|
| **i18n** | `useTranslations("home")` — `premium.classicBus.*`. |
| **Navigation** | `Link` → `/tours/list`. |

### 2.7 `FinalCtaPremium`

| Area | Detail |
|------|--------|
| **i18n** | `useTranslations("home")` — `premium.finalCta.*`. |
| **Navigation** | Primary → `/custom-join-tour`; secondary → `/custom-join-tour?intent=Private%20tour%20day` (constant `PRIVATE_INTENT`). Same **gap:** join flow does not read `intent` from query today. |

---

## 3. Backend & data paths touched from this tree

| Endpoint / module | Used by | Notes |
|-------------------|---------|--------|
| `GET /api/homepage-product-card-images` | `HeroPremium`, `ProductCardsPremium` | Dynamic route; falls back to JSON defaults on error. Server: `getHomepageProductCardImages()`. |
| Admin/CMS | (indirect) | Admin can override images per site settings — consumed only through the API above. |

**Not used by legacy homepage components:** auth session, cart, Stripe, booking APIs, `/api/tours` list fetch on home, `/api/reviews` for trust section.

---

## 4. Analytics

| Event | Trigger (legacy home) |
|-------|------------------------|
| `hero_form_start` | Desktop “find match” link click; mobile match button; click-through overlay on hero best-match card. |

Implementation: `trackEvent` → **currently `console.log`** in `src/design/analytics.ts` (placeholder for a future provider). Payload sanitization strips geo-like keys for other events; `hero_form_start` only optional `pickupAreaLabel` (unused here).

---

## 5. Auth / session

**None** in the seven legacy homepage components. They do not call Supabase, NextAuth, or read cookies.

---

## 6. Locale / i18n

- All sections use **`useTranslations("home")`** (or full `useTranslations` elsewhere in app — not in these seven).
- Locale **route** wraps localized home in `LocaleHomeClient` (`app/[locale]/page.tsx`) — outside `LegacyHomePage` but affects the same components when rendered under `/ko`, etc.
- Copy lives in `messages/*.json` under `home.premium.*` (and comparison keys for chips).

---

## 7. Query parameters (legacy home as *source*)

| Param | Built by | Intended target | Actually consumed on target? |
|-------|----------|-----------------|------------------------------|
| `destination` | `HeroPremium` `continueHref` | `/custom-join-tour` | **No** (not read in `CustomJoinTourContent`). |
| `intent` | `HeroPremium` `continueHref`, `FinalCtaPremium` private link | `/custom-join-tour` | **No** — `customerInput` starts `''`; no hydration from URL. |

This is a **contract mismatch** to fix either on the join page (hydrate from query) or by changing the hero CTAs.

---

## 8. Grouped for migration planning

### Presentational only

- `SmallGroupValuePremium`, `HowItWorksPremium`, `TrustAndReviewsSection`, `ClassicBusSection` (plus static halves of Hero/Product cards once data is fixed externally).

### UI state only

- Hero: `destination`, `intent`, `chipsExpanded`, `matchPhase`, `loadingStep`, `matchBgSrc` (after optional fetch), mobile video layer state in `HeroIntentWell`.
- Product cards: `images` state (after optional fetch).

### API-connected

- `GET /api/homepage-product-card-images` (Hero + ProductCards).

### Shared / global dependency

- `I18nProvider` + `useTranslations("home")`.
- `app/home-premium.css` + `app/globals.css` tokens/classes.
- `next/image`, `next/link`.
- `framer-motion` (Hero mobile phases).
- `DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES` + shared types.
- `analytics` facade (console today).

### Must migrate early (if parity matters)

- **i18n** for any v2 strings that replace premium hero/cards.
- **Card image API** so marketing/admin overrides still apply to v2 imagery if you reuse the same assets.
- **Analytics** calls at equivalent interaction points (or consciously drop them).
- **Query param contract** with `/custom-join-tour` — either implement read side or stop sending dead params.

### Must migrate later

- Deeper **custom join** / AI generate / checkout (only entered via links from home, not implemented on home).
- Replacing **static** trust quotes with live review API (if product requires).
- Any **real** recommendation service (legacy hero “match” is simulated).

---

## 8.1 Reuse vs adapter vs decouple

### Reuse as-is (low risk)

- `GET /api/homepage-product-card-images` and `lib/homepage-product-card-images.*` (server + shared).
- `HOME_STYLE_OPTIONS` taxonomy + message keys (if v2 keeps chip semantics).
- `analytics.heroFormStart` signature (wire provider under the hood later).

### Wrap in adapters (recommended for v2)

- **“Match” orchestration:** today = timeouts + phase enum. Adapter interface e.g. `runMatch(intent) => Promise<Result | phases>` so v2 UI can swap in real logic later without rewriting layout.
- **Image bundle loader:** single hook `useHomepageOfferImages()` wrapping fetch + defaults — both Hero and ProductCards duplicate parsing today.

### Too coupled to legacy UI (separate before or during migration)

- **CSS class surface** (`hero-planner-*`, `home-*`, glass card classes) — tied to `home-premium.css` and old markup; v2 should not depend on these unless you explicitly bridge with duplicate class names.
- **`HeroIntentWell`** — combines video marketing behavior + textarea + timers; hard to drop into v0 markup without visual/behavior drift; extract “intent input” and “optional intro video” as smaller units if reusing behavior.
- **Framer mobile phase machine** — tightly bound to old layout regions; v2 uses different structure — either reimplement phases in v2 or accept different motion.

---

## 9. Summary checklist (for sequencing)

| Item | Legacy reality |
|------|----------------|
| Form submit to backend from hero | **No** — desktop navigates with query string; mobile runs fake loading then shows static result. |
| Recommendation API | **No** |
| Validation library | **No** |
| Loading states | Yes (mobile match + image fetch in-flight without UI). |
| Error states (user-visible) | **No** for image API |
| Auth | **No** |
| Analytics | Yes (`hero_form_start`, console) |
| i18n | Yes, all sections |
| Query params | Built but **not consumed** by join app |

---

*End of inventory.*
