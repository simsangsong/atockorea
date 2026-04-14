# East tour v2 — static v0 import layer

## What was preserved

- **Full v0 body section order** (from `components/tour-detail/east/v2/source/`), mounted via `V0EastTourDetailBody`:
  - `HeroSection`
  - `StickySubnav` (in-page section navigation: Overview / Itinerary / Details / FAQ)
  - Overview (`DecisionSummary` in `id="overview"`)
  - Gallery (`RouteGallery`)
  - Itinerary (`ItinerarySection`, `id="itinerary"`)
  - Route shape (`RouteShape`)
  - Experience / route logic (`ExperienceSection`, `id="details"`)
  - Practical details (`PracticalDetails`)
  - Booking support (`BookingSupport`)
  - FAQ UI (`QuestionsSection`, `id="faq"`)
  - Recommendations (`RecommendationsSection`)
- **`StickyBookingBar`** at the bottom of the v2 subtree: fixed desktop bar (From + KRW + Book Now), mobile price row + Book Now + four icon buttons + trailing spacer (`h-32 sm:h-20`), matching v0 source markup and classes.
- **v0 design tokens and utilities** under `.east-v2-detail-root` in `east-v2-detail-scope.css` (cream background, tints `bg-warm-ivory` / `bg-soft-pearl` / etc., `card-premium` / `card-hero`, `shadow-hero`, `scrollbar-hide`, `text-balance`).
- **Typography stack inside the isolate:** `next/font` **Geist** (`--font-geist-sans`) + **Playfair Display** (`--font-playfair-v0`) on the v2 wrapper, aligned with the v0 mini-app layout intent.
- **Site chrome outside the v2 layer:** On the **live** East join route, `Header` and `Footer` wrap `EastSmallGroupTourV2Page` in `app/tour/[id]/page.tsx` when the East SKU matches and v2 is enabled. The **preview** route `app/tour-preview/east-small-group-v2/page.tsx` still exists for isolated QA (amber banner + tuned scroll offsets).

## What was excluded

- **`SiteHeader`** from `source/components/tour/site-header.tsx` — not imported in `V0EastTourDetailBody`, so the v0 top bar (AtoC mark, search, account) does not render; the live site header is used instead.
- **v0 root layout** (`app/layout.tsx` from the v0 export folder) — not used; no duplicate `<html>` / `<body>` / Analytics.
- **v0 “site footer”** — the v0 page source does not define a marketing/legal footer component; nothing to exclude beyond not duplicating the site `Footer` inside the v2 tree.

## Exact visual mismatches (known)

1. **Viewport background outside `.east-v2-detail-root`** — The main app keeps global `body` / mesh styling per project policy. The v0 cream surface (`bg-background` + tokens) applies inside `.east-v2-detail-root` only; gutters or areas that remain `transparent` on the tour page wrapper may show the global page mesh next to the v0 column.
2. **Shadcn `Button`** — Sticky bar and any future host UI use `@/components/ui/button` (AtoC), not the v0 export’s copy. Token overrides from `.east-v2-detail-root` apply to `bg-foreground` / `text-*` utilities; microscopic differences vs standalone v0 are possible if button variants diverge.
3. **`cn` helper** — v0 tour modules import `../../lib/utils` from the **snapshot** `source/lib/utils.ts` (same `clsx` + `tailwind-merge` pattern as shadcn). Behavior should match; file path differs from `@/lib/utils`.
4. **Site `BottomNav`** — Omitted when **live** or **preview** uses v2 so the v0 sticky bar can sit at `bottom: 0`. **Legacy** East (`?legacyEast=1` or kill-switch) still renders `BottomNav`.
5. **Hero class `shadow-hero`** — Scoped CSS defines `.east-v2-detail-root .shadow-hero { box-shadow: var(--shadow-hero); }` so the hero matches v0 intent (v0 globals had only `.shadow-premium-hero` mapping to the same variable).

## Temporary placeholder behavior

- **Sticky bar** — Price text (**87,576 KRW / person**) and **Book Now** buttons are static per v0 source; no checkout, sheet, or API wiring.
- **Mobile icon row** (Home / Tours / Cart / My Page) — Non-functional `<button>` elements, same as v0.
- **Recommendations cards** — `href="#"` as in v0.
- **All section copy and Unsplash media** — Still static mock data inside the snapshot components; no merge with live tour CMS yet.

## Layout integration fixes (preview + shared v2 source)

- **Sticky booking bar (`sticky-booking-bar.tsx`):** `z-50` → **`z-[60]`** so the fixed bottom row wins over the site header’s **`z-50`** if stacking contexts ever compete; added **`pb-[env(safe-area-inset-bottom,0px)]`** on both desktop and mobile fixed shells for notched devices.
- **Section subnav (`sticky-subnav.tsx`):** **`z-[45]`** when sticky (below header `z-50`, above main content). **`EastV2LayoutIntegrationContext`** supplies **`stickySubnavTopClass`** and scroll offsets so the bar pins **below** the site header; the preview page passes taller `top-*` values to clear the **amber preview ribbon** as well.
- **Default integration values** (no extra ribbon): `stickySubnavTopClass` ≈ site header heights (`3.25rem` / `14` / `3.75rem`), `scrollToSectionOffsetPx` **96**, `scrollSpyViewportOffsetPx` **168**.
- **Preview-only overrides** (in `app/tour-preview/east-small-group-v2/page.tsx`): taller `top-*`, **120** / **220** px offsets.
- **Preview shell:** **`BottomNav` omitted** so the v0 mobile sticky bar (price + CTA + icon row) is not covered by the site nav.
- **Root isolate:** `.east-v2-detail-root` has **`relative z-0`** for predictable stacking under fixed layers.

## Preview route (safe)

- **URL:** `/tour-preview/east-small-group-v2`
- **Middleware:** Allowed through the site gate like other static previews (`middleware.ts` bypass for this path); `tour-preview` added to `RESERVED_ROOT_SEGMENTS`.
- **SEO:** `robots: noindex, nofollow` in `app/tour-preview/east-small-group-v2/layout.tsx`.
- **Layout tuning:** Preview passes extra `EastSmallGroupTourV2Page` props for **sticky subnav `top-*`** and **scroll offsets** to account for the amber preview ribbon under the site header (`EastV2LayoutIntegrationContext`).

## Rollback / live product

- Live East small-group detail: **`/tour/east-signature-nature-core`** (and locale-prefixed equivalents) → **`EastSmallGroupTourV2Page`** by default when `EAST_SMALL_GROUP_V2_LIVE` is `true` in `app/tour/[id]/page.tsx`.
- **One-step URL rollback:** append **`?legacyEast=1`** (e.g. `/tour/east-signature-nature-core?legacyEast=1`) → **`LegacyEastSmallGroupTourPage`**.
- **One-line code rollback:** set **`EAST_SMALL_GROUP_V2_LIVE`** to **`false`** in `app/tour/[id]/page.tsx` and deploy → all East hits use legacy without a query param.

## File map

| Piece | Location |
|-------|-----------|
| v2 page wrapper + fonts + scope import | `components/tour-detail/east/v2/EastSmallGroupTourV2Page.tsx` |
| Layout integration (scroll / sticky subnav top) | `components/tour-detail/east/v2/EastV2LayoutIntegrationContext.tsx` |
| Body composition (no `SiteHeader`) | `components/tour-detail/east/v2/V0EastTourDetailBody.tsx` |
| Scoped tokens / utilities | `components/tour-detail/east/v2/east-v2-detail-scope.css` |
| v0 snapshot modules | `components/tour-detail/east/v2/source/...` |
| Preview shell | `app/tour-preview/east-small-group-v2/page.tsx`, `layout.tsx` |
| Live join / East route | `app/tour/[id]/page.tsx` (East SKU → **v2** unless `?legacyEast=1` or kill-switch) |
