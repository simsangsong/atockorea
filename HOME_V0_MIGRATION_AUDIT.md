# v0 Homepage Migration Audit

**Scope:** Inspection only. No runtime wiring, no homepage replacement, no deletions.  
**v0 source root:** `components/landing page (4)/`  
**Date:** 2026-04-11

---

## 1. What this folder actually is

The folder is a **nested mini Next.js 16 app** (v0 export), not a flat component pack:

- Own `app/page.tsx`, `app/layout.tsx`, `app/globals.css`
- Own `package.json`, `next.config.mjs`, `tsconfig.json`, `pnpm-lock.yaml`
- Full **shadcn/Radix-style `components/ui/*`** tree (50+ files)
- Own `lib/utils.ts`, `hooks/*`, `public/*`, `styles/globals.css`

**Implication:** Do **not** copy the whole tree into `components/` as-is without a deliberate namespacing strategy; it duplicates tooling, Tailwind major versions, and UI primitives versus the main app.

---

## 2. Main entry (v0)

| Item | Path | Role |
|------|------|------|
| **Page entry** | `components/landing page (4)/app/page.tsx` | Composes full page: shell background + chrome + sections + sticky bar |

Render order in v0 `app/page.tsx`:

1. Fixed full-screen **atmospheric background** (`div` with inline `radial-gradient` / `linear-gradient` stack, `-z-10`)
2. **`SiteHeader`** ← **EXCLUDE** from migration (duplicate of live site header)
3. **`<main>`** ← **IN-SCOPE** (migration body)
4. **`Footer`** ← **EXCLUDE** (duplicate of live site footer)
5. **`StickyPriceBar`** ← **EXCLUDE** (bottom sticky price / CTA)

**In-scope `<main>` section order** (preserve this order for design parity):

1. `HeroSection`
2. `BestMatchPreview`
3. `ChooseTravelStyle`
4. `ProcessOperational`
5. `VisualBreak`
6. `TravelerReviews`
7. `FinalCTA`

---

## 3. Subcomponents map

| Component | File | Client? | Notes |
|-----------|------|---------|--------|
| `SiteHeader` | `components/home/site-header.tsx` | yes | Sticky top nav, logo, search, region/currency/account menus (**exclude**) |
| `HeroSection` | `components/home/hero-section.tsx` | yes | Video hero + preference form + tags (**include**); no separate overlay nav |
| `BestMatchPreview` | `components/home/best-match-preview.tsx` | yes | Sample recommendation card (**include**) |
| `ChooseTravelStyle` | `components/home/choose-travel-style.tsx` | yes | Small group / private / bus tiles (**include**) |
| `ProcessOperational` | `components/home/process-operational.tsx` | yes | 4-step process + trust block (**include**) |
| `VisualBreak` | `components/home/visual-break.tsx` | yes | Mid-page video band + copy (**include**) |
| `TravelerReviews` | `components/home/traveler-reviews.tsx` | yes | Review list from in-file array (**include**; data is mock) |
| `FinalCTA` | `components/home/final-cta.tsx` | yes | Closing CTA block (**include**) |
| `Footer` | `components/home/footer.tsx` | yes | Full marketing/legal footer (**exclude**) |
| `StickyPriceBar` | `components/home/sticky-price-bar.tsx` | yes | Fixed bottom bar, scroll reveal, fake “viewing now” (**exclude**) |

**Excluded chrome summary**

- **Top nav:** `SiteHeader`
- **Hero overlay nav:** none as a separate component (hero text/UI is part of `HeroSection`)
- **Footer:** v0 `Footer`
- **Floating footer CTA:** not present as its own component (bottom urgency is `StickyPriceBar`)
- **Sticky bottom booking / price bar:** `StickyPriceBar`
- **Mobile sticky CTA:** same `StickyPriceBar` (responsive layout; still excluded)

---

## 4. Assets

### 4.1 v0 `public/` (actually shipped in bundle)

Only: `icon.svg`, `placeholder.svg`, `placeholder-logo.svg`.

### 4.2 Paths referenced by in-scope components (missing from v0 `public/`)

| Path | Used in |
|------|---------|
| `/images/jeju-hero.jpg` | `HeroSection` (`<video poster>`) |
| `/images/jeju-seasonal.jpg` | `VisualBreak` (`<video poster>`) |
| `/images/east-jeju-coast.jpg` | `BestMatchPreview` (`next/image`) |

**Status:** These files are **not** in v0’s `public/` folder. The main repo’s `public/` also has **no** matching `public/images/*.jpg` at audit time (only Stripe SVGs under `public/images/stripe/`).

**Action later:** Add real assets under `public/images/` (or change URLs) before preview/production, or posters/images will 404 / break optimization.

### 4.3 External media

- **Video source:** `https://videos.pexels.com/video-files/3629519/3629519-uhd_2560_1440_30fps.mp4` in `HeroSection` and `VisualBreak` (third-party CDN; privacy, CSP, and availability considerations for production).

---

## 5. CSS / Tailwind / design tokens

### v0 stack (`components/landing page (4)/`)

- **Tailwind CSS v4:** `app/globals.css` uses `@import 'tailwindcss';`, `@theme inline`, OKLCH CSS variables, `@import 'tw-animate-css'`.
- **Scroll UX:** `.scroll-animate` / `.visible` pattern + keyframes (`fadeInUp`, etc.) defined in v0 `app/globals.css`.

### Main app stack (`app/globals.css`)

- **Tailwind v3** (`@tailwind base/components/utilities`), Pretendard, **`body::before`** global mesh (do not replace when touching globals per project rules).
- **`app/home-premium.css`**, existing home sections use this system.

**Conflict:** v0 assumes Tailwind v4 + its `:root` / `@theme` token set. The main app uses **shadcn/tailwind.css** + different token wiring. Porting “as closely as possible” will require either:

- **Scoped strategy:** a **namespaced CSS file** (e.g. loaded only for the v0 body subtree) that recreates v0’s utility behavior without converting the whole app to Tailwind v4, **or**
- **Token alignment:** map v0 `bg-primary`, `text-muted-foreground`, etc. to existing main tokens and accept small visual drift.

**Do not** wholesale replace `app/globals.css` with v0’s file (would violate global background policy and break the whole site).

---

## 6. Libraries & imports

### Used by **in-scope** `components/home/*` (excluding header, footer, sticky bar)

| Dependency | Usage |
|------------|--------|
| `react` | All sections (`'use client'`) |
| `next/image` | `BestMatchPreview` |
| `lucide-react` | Icons across sections |
| `@/components/ui/button` | CTAs in hero, cards, final CTA, etc. |

**Not used** by in-scope home files: `framer-motion`, `embla`, `recharts`, `vaul`, RHF, zod, etc.

### Used only by **excluded** `SiteHeader`

- `@/components/ui/dropdown-menu` (Radix-style API in v0)

### v0-only / unused for home body

- `components/theme-provider.tsx` — **not** referenced by v0 `app/layout.tsx`
- `hooks/use-toast.ts`, `hooks/use-mobile.ts` — **not** imported by `components/home/*`

### `@vercel/analytics` in v0 `app/layout.tsx`

**Out of scope** for this migration slice; do not duplicate analytics wiring from v0 without an explicit product decision.

---

## 7. Mock vs real data (later wiring targets)

| Area | Current behavior | Later wire to |
|------|------------------|----------------|
| `HeroSection` | Local state (destination, textarea, tags); CTA does nothing | Search / preference capture / tour listing flows already used on live site |
| `BestMatchPreview` | Static copy, static prices, static stats | Real recommendation or featured tour API/CMS |
| `ChooseTravelStyle` | Static prices/features | Real catalog routes (`/tours`, Jeju/Seoul/Busan sections) |
| `ProcessOperational` | Pure copy | Optional: align copy with live trust/ops content |
| `TravelerReviews` | `reviews` array in component; header claims “234 verified” | `TrustAndReviewsSection` / reviews API / `messages/*` i18n |
| `FinalCTA` | Non-functional buttons | Same entry points as current `FinalCtaPremium` + search |
| `StickyPriceBar` | Mock price + random viewer count | **Do not migrate** (excluded) |

---

## 8. Presentational vs interactive

- **Mostly presentational (light `useEffect` for `.visible` only):** `BestMatchPreview`, `ChooseTravelStyle`, `ProcessOperational`, `VisualBreak`, `TravelerReviews`, `FinalCTA`
- **Heavily interactive UI state:** `HeroSection` (form-like controls; still no backend)
- **Pure chrome / excluded:** `SiteHeader`, `Footer`, `StickyPriceBar`

---

## 9. Known technical issues to fix during integration

1. **Tailwind / design system mismatch** (v4/OKLCH vs main v3 + shadcn tokens) — highest risk to visual parity.
2. **Button primitive mismatch:** v0 targets Radix-based shadcn `Button`; main repo `components/ui/button.tsx` is **@base-ui/react**. Props mostly overlap (`variant`, `size`, `className`), but **verify** dropdown-free flows visually and behaviorally.
3. **Dynamic Tailwind in `TravelerReviews`:** `className={... shadow-${review.color}/20}` — Tailwind JIT will **not** generate arbitrary dynamic classes; shadow may be missing unless refactored to safelisted classes.
4. **Missing image assets** (see §4.2).
5. **Duplicate atmospheric background:** v0 page wrapper gradient vs main site **global** `body::before` mesh — decide whether the v0 body needs its own inner fixed gradient (still **between** header/footer) to match v0 without editing forbidden global background blocks.

---

## 10. Live site homepage today (for shell alignment)

| Route | Shell | Main content |
|-------|--------|--------------|
| `/` | `SitePageShell` → `Header`, `Footer`, `BottomNav` | `HeroPremium`, `ProductCardsPremium`, `SmallGroupValuePremium`, `HowItWorksPremium`, `TrustAndReviewsSection`, `ClassicBusSection`, `FinalCtaPremium` |
| `/[locale]` (non-en) | `Header`, `Footer`, `BottomNav`, `LocaleHomeClient` | Same section components |

**Keep** `Header` / `Footer` / `BottomNav` exactly as today when introducing v0 body content.

---

## 11. Safest import strategy (recommended)

### Where the new homepage **body** should live

- **Preferred:** `src/components/home-v0/` (or `components/home-v0/`) as a **clearly namespaced** folder containing **only** the seven in-scope section files (copied or re-exported), plus a single orchestrator, e.g. `HomeV0MainContent.tsx`, that mirrors v0 `<main>` order.
- **Avoid:** dumping into `src/components/home/` next to `HeroPremium.tsx` until the cutover is intentional (reduces accidental imports and merge confusion).

### Where the **legacy** homepage body stays

- **Leave** `app/page.tsx` and `app/[locale]/page.tsx` **unchanged** until a planned cutover.
- Optional later (not required now): a **preview-only** route such as `app/home-v0-preview/page.tsx` that uses `SitePageShell` but swaps `<main>` children to `HomeV0MainContent` — gate with `NODE_ENV` or an env flag so production stays untouched until ready.

### What stays **static** for now

- All v0 CTAs, hero submission, and recommendation card actions remain **non-functional** or `#`-style until explicitly connected.
- No changes to API routes, Stripe, Supabase auth, booking, or analytics modules.
- Do **not** import v0 `app/layout.tsx`, v0 analytics, or v0 root metadata as the site default.

### What gets **wired later** (explicit phases)

1. i18n (`next-intl` / `messages/*`) for all visible strings (v0 is English-hardcoded).
2. Hero + CTA → existing search / tours navigation patterns.
3. Product/review/stat numbers → real data sources.
4. Images/video → self-hosted or CDN choices + `next.config` `images.remotePatterns` if needed.

### Migrating **only** the main content while preserving header/footer

1. Render **`SitePageShell`** (or the locale layout equivalent: `Header` → `main` → `Footer` → `BottomNav`).
2. Inside `<main>`, render **`HomeV0MainContent`** (the seven sections only).
3. Omit v0’s `SiteHeader`, `Footer`, `StickyPriceBar`.
4. Reproduce v0’s **optional** full-page gradient as a **single wrapper inside `<main>`** (fixed `inset-0` with negative z-index **scoped under main**), if design review requires parity with v0 — without modifying global `body::before` rules.
5. Port **scoped CSS** for `.scroll-animate` (+ prefers-reduced-motion) into a file imported only by the v0 subtree (e.g. `home-v0.css`) to avoid global animation side effects.

---

## 12. File checklist (v0 — reference only)

**Entry:** `app/page.tsx`  
**In-scope sections:** `components/home/hero-section.tsx` … `final-cta.tsx` (seven files)  
**Excluded:** `site-header.tsx`, `footer.tsx`, `sticky-price-bar.tsx`  
**Supporting CSS:** `app/globals.css` (extract subset, do not replace site root)  
**Hooks/lib used by sections:** only standard React + main `cn` from `@/lib/utils` once aligned  

---

*End of audit.*
