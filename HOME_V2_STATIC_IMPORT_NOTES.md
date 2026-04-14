# Home v2 static import (v0 body)

**Date:** 2026-04-11  
**Source:** `components/landing page (4)/` (v0 export; still excluded from `tsconfig` — code was copied into `components/home/v2/`).

## What was imported

| v0 file | Migrated to |
|---------|-------------|
| `components/home/hero-section.tsx` | `components/home/v2/sections/hero-section.tsx` |
| `components/home/best-match-preview.tsx` | `components/home/v2/sections/best-match-preview.tsx` |
| `components/home/choose-travel-style.tsx` | `components/home/v2/sections/choose-travel-style.tsx` |
| `components/home/process-operational.tsx` | `components/home/v2/sections/process-operational.tsx` |
| `components/home/visual-break.tsx` | `components/home/v2/sections/visual-break.tsx` |
| `components/home/traveler-reviews.tsx` | `components/home/v2/sections/traveler-reviews.tsx` |
| `components/home/final-cta.tsx` | `components/home/v2/sections/final-cta.tsx` |
| v0 shadcn `button` (Radix Slot) | `components/home/v2/ui/button.tsx` |
| v0 scroll-reveal utilities | `app/home-v2.css` (prefixed `.home-v2-*` to avoid clashes) |
| v0 `app/page.tsx` atmospheric gradient | `HomeV2Page` fixed background layer (inside `<main>` only) |

**Production routes:** `app/page.tsx` and `app/[locale]/page.tsx` render `<HomeV2Page />` inside the existing shell (`SitePageShell` or `Header`/`Footer`/`BottomNav`).

**Legacy backup:** `components/home/legacy/LegacyHomePage.tsx`; **`/legacy-home-preview`** always renders the old homepage (no env flag).

**Rollback:** `components/home/HomeMainBody.tsx` chooses the body. Set **`NEXT_PUBLIC_USE_LEGACY_HOMEPAGE=true`** (then rebuild — `NEXT_PUBLIC_*` is compile-time inlined) to serve legacy on **`/`** and **`/[locale]`**. Default remains **v2**.

## Intentionally excluded v0 pieces

- `site-header.tsx` — duplicate of live `Header`
- `footer.tsx` — duplicate of live `Footer`
- `sticky-price-bar.tsx` — bottom sticky price / CTA / fake “viewing now”
- v0 root `app/layout.tsx`, analytics, metadata — not used
- Entire v0 `components/ui/*` except a dedicated v2 `Button` copy

## Behavior (this step)

- No API, auth, booking, payment, or recommendation wiring.
- Buttons and hero controls are **UI-only** (`type="button"`; no navigation).
- Forms do not submit.

## Temporary / placeholder content (marked in code)

- **`traveler-reviews.tsx`:** `REVIEWS_PLACEHOLDER` — illustrative quotes; header stats (“234 verified”) are static copy for layout.
- **Pricing** in cards (`$58`, `$198`, etc.) — v0 marketing numbers; not tied to inventory.
- **“Example recommendation”** block — same as v0 sample framing.

## Unresolved / intentional mismatches

1. **Images & video:** v0 referenced missing `/public/images/*.jpg`. Migrated version uses **HTTPS Unsplash posters** and the same **Pexels** MP4 URLs as v0. Production may want self-hosted assets and stricter CSP.
2. **Tailwind:** v0 used Tailwind v4 + OKLCH theme; this app stays on **Tailwind v3** + existing CSS variables. Minor color/spacing drift is possible; `tailwind.config.js` now includes **`home`** in scanned component dirs.
3. **Button:** Global site `components/ui/button` is **Base UI**; v2 uses an isolated **Radix Slot + cva** button to match v0 styling. Dependency: `@radix-ui/react-slot`.
4. **Typography:** Site body uses Pretendard / locale stacks from root layout; v0 assumed Inter-only. Headings may render slightly differently from v0.app.
5. **Global background:** Site keeps `body::before` mesh; v2 adds its **own** fixed gradient **behind** main content (`-z-10`) — combined effect may differ from pure v0 or pure legacy home.
6. **i18n:** All strings remain **English** (v0 copy); locale routes show the same English v2 body until messages are wired.
7. **Process step connector line:** v0 used a duplicate `via-*` gradient; replaced with a single `via-primary/15` for Tailwind v3 validity.

## Files touched (summary)

- `components/home/v2/**` (new)
- `app/home-v2.css` (new)
- `app/layout.tsx` (import `home-v2.css`)
- `app/page.tsx`, `app/[locale]/page.tsx` → `HomeV2Page`
- `tailwind.config.js` — `home` in `COMPONENT_SUBDIRS`
- `package.json` / lockfile — `@radix-ui/react-slot`
