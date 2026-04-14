# East tour detail — v0 source audit

**Source root:** `components/Tour Detail page`  
**Scope:** Read-only inventory of this embedded v0/Next mini-app. No runtime routes or app behavior were changed for this audit.

---

## 1. Entry file

| Role | Path |
|------|------|
| **Page entry (composition + section order)** | `components/Tour Detail page/app/page.tsx` |
| **Root layout (fonts, metadata, global CSS, Analytics)** | `components/Tour Detail page/app/layout.tsx` |
| **Global styles for this app** | `components/Tour Detail page/app/globals.css` |

The **authoritative “tour screen” entry** for section order and chrome is **`app/page.tsx`**.

---

## 2. Subcomponents (tour feature)

All under `components/Tour Detail page/components/tour/`:

| File | Role |
|------|------|
| `site-header.tsx` | v0 top site header (logo block, currency hint, search/account icon buttons) |
| `hero-section.tsx` | Full-bleed hero image, title, pills, meta bar (duration / region / stops / rating) |
| `sticky-subnav.tsx` | Horizontal section nav; becomes `sticky top-0` after scroll; scroll-spy + smooth scroll |
| `decision-summary.tsx` | “At a glance” grid |
| `route-gallery.tsx` | Media carousel / lightbox-style gallery |
| `itinerary-section.tsx` | Expandable itinerary cards |
| `route-shape.tsx` | “How this day moves” stop flow + phase bands |
| `experience-section.tsx` | Route logic / experience accordion-style content |
| `practical-details.tsx` | Practical accordion + seasonal strip |
| `booking-support.tsx` | Trust + support steps |
| `questions-section.tsx` | FAQ list |
| `recommendations-section.tsx` | “You might also like” horizontal cards |
| `sticky-booking-bar.tsx` | Fixed bottom price + Book CTA; mobile adds icon “tab” row |

**Not used by `app/page.tsx`:** none of the above are omitted from the page tree except that **`site-header`** is the only header; there is **no separate footer component**.

---

## 3. Assets

### 3.1 `public/` (in v0 mini-app)

| File |
|------|
| `public/icon.svg` |
| `public/placeholder.svg` |
| `public/placeholder-logo.svg` |

### 3.2 Referenced in layout metadata but **not present** under this `public/`

`app/layout.tsx` metadata `icons` / `apple` reference:

- `/icon-light-32x32.png`
- `/icon-dark-32x32.png`
- `/apple-icon.png`

**Risk:** In a standalone build of this folder, those paths would 404 unless added elsewhere.

### 3.3 Remote images (hardcoded)

Unsplash URLs are used in `hero-section.tsx`, `route-gallery.tsx`, `itinerary-section.tsx`, `recommendations-section.tsx` (see §8).

---

## 4. Tailwind / CSS dependencies

| Item | Path / note |
|------|-------------|
| **Tailwind v4 pipeline** | `package.json`: `tailwindcss` ^4.2, `@tailwindcss/postcss` |
| **PostCSS** | `postcss.config.mjs` → `@tailwindcss/postcss` only |
| **App globals** | `app/globals.css`: `@import 'tailwindcss'`, `@import 'tw-animate-css'`, `@custom-variant dark`, `:root` design tokens, `@theme inline`, `@layer base`, `@layer utilities` (tint bg classes, card/shadow utilities, `scrollbar-hide`, `text-balance`) |
| **Alternate globals** | `styles/globals.css` — second palette (oklch defaults); **not imported** by `app/layout.tsx` (layout imports `./globals.css` from `app/` only). Treat as **unused duplicate** unless wired later. |

**Host project note:** The main AtoC app uses **Tailwind v3** + different `globals.css` conventions. Porting classes/tokens without bringing equivalent CSS risks **visual drift** or **missing utilities**.

**CSS / class discrepancy (within v0 source):**

- `hero-section.tsx` uses Tailwind class **`shadow-hero`**.
- `app/globals.css` defines **`--shadow-hero`** and utility **`.shadow-premium-hero`** (`box-shadow: var(--shadow-hero)`), but **no `.shadow-hero` utility** appears in that file.
- **Risk:** Hero shadow may be a no-op unless Tailwind v4 generates `shadow-hero` from elsewhere (not visible in this file), or the class is effectively unused.

---

## 5. Helper utilities

| Path | Used by tour components |
|------|-------------------------|
| `lib/utils.ts` — `cn()` (`clsx` + `tailwind-merge`) | `decision-summary`, `route-gallery`, `itinerary-section`, `route-shape`, `experience-section`, `practical-details`, `booking-support`, `questions-section`, `sticky-subnav` |

**Hooks:** `hooks/use-mobile.ts`, `hooks/use-toast.ts` exist for the full shadcn scaffold; **no imports from `components/tour/*` to these hooks** were found.

---

## 6. Icon libraries

- **`lucide-react`** — all tour sections + `site-header` + `sticky-booking-bar`.

---

## 7. Motion / animation libraries

- **`tw-animate-css`** — imported in `app/globals.css` (utility classes such as those used elsewhere in shadcn stacks).
- **No `framer-motion`** (or similar) in `components/tour/*`.
- Tour UI uses **CSS transitions**, **scroll listeners** (`sticky-subnav`), and **React `useState`** for expand/collapse.

---

## 8. UI libraries (runtime imports from tour feature)

| Package | Where it appears |
|---------|------------------|
| **`@radix-ui/react-slot`** | Via `components/ui/button.tsx` (shadcn) |
| **`class-variance-authority`** | `components/ui/button.tsx` |
| **`lucide-react`** | All `components/tour/*.tsx` |

**Tour files only import shadcn UI at:**

- `site-header.tsx` → `@/components/ui/button`
- `sticky-booking-bar.tsx` → `@/components/ui/button`

The repo under `components/Tour Detail page/components/ui/` contains the **full** shadcn-style kit (accordion, dialog, chart, etc.), but **the East page composition does not import those from `app/page.tsx`**. They are **transitive scaffold / generator output**, not required for the single page unless individual tour files are refactored to use them.

---

## 9. Hardcoded mock data (by file)

All of the following are **inline constants** or **string literals** suitable for later replacement with CMS/API props:

| File | Mock / static content |
|------|------------------------|
| `hero-section.tsx` | Unsplash hero URL; title/subtitle/pills; `8 hrs`, `East Jeju`, `6 stops`, stars `4.8` |
| `decision-summary.tsx` | `primaryItems`, `secondaryItems` |
| `sticky-subnav.tsx` | `navItems` labels + ids (`overview`, `itinerary`, `details`, `faq`) |
| `route-gallery.tsx` | `galleryItems[]` (types, Unsplash URLs, captions) |
| `itinerary-section.tsx` | `stops[]` with copy + Unsplash `image` URLs |
| `route-shape.tsx` | `stops[]`, `phases[]` |
| `experience-section.tsx` | `routeLogicItems` (+ expanded content in component) |
| `practical-details.tsx` | `accordionItems`, `seasons` |
| `booking-support.tsx` | `trustItems`, `supportSteps` |
| `questions-section.tsx` | `allQuestions` |
| `recommendations-section.tsx` | `recommendations[]` (prices, durations, Unsplash images); links use `href="#"` |
| `sticky-booking-bar.tsx` | Price **`87,576` KRW**, **`Book Now`** label; buttons have **no `onClick`/navigation** |
| `site-header.tsx` | Brand strings, static chrome |

---

## 10. Sticky CTA / booking / price bar

**Component:** `components/tour/sticky-booking-bar.tsx` (`StickyBookingBar`).

**Behavior:**

- **Desktop (`sm` and up):** `fixed bottom-0 left-0 right-0 z-50`, frosted bar, “From” + **87,576 KRW / person**, primary **`Book Now`** `Button`.
- **Mobile (`sm:hidden`):** Same fixed bar; **top row** = price + CTA; **second row** = four icon buttons (Home, Tours, Cart, My Page) — **presentational only** (`<button>`, no routing).
- **Spacer:** trailing `<div className="h-32 sm:h-20" />` to offset fixed content.

**This is not a site footer**; it is a **commerce + pseudo–bottom-nav** strip unique to this v0 page.

---

## 11. Header-related components

| Component | Path | Role |
|-----------|------|------|
| **`SiteHeader`** | `components/tour/site-header.tsx` | Sticky top bar: “AtoC” mark, “AtoC Korea”, search + user icon buttons |

**Also header-adjacent (in-page nav, not site chrome):**

- **`StickySubnav`** — secondary nav below hero; sticks after scroll.

---

## 12. Footer-related components

- **No `SiteFooter` or equivalent** is imported in `app/page.tsx`.
- The **mobile** portion of **`StickyBookingBar`** includes a **bottom icon row** that resembles an app tab bar; document as **v0 sticky bar**, not a legal/marketing footer.

---

## 13. Section order (top → bottom)

As composed in `app/page.tsx` (inside `<div className="min-h-screen bg-background">`):

1. **`SiteHeader`** — v0 site header (exclude when integrating with host site header).
2. **`<main>`**
   1. **`HeroSection`**
   2. **`StickySubnav`**
   3. **`<section id="overview" className="bg-warm-ivory">`** → `DecisionSummary`
   4. **`<section className="bg-soft-pearl">`** → `RouteGallery`
   5. **`<section id="itinerary" className="bg-mist-blue">`** → `ItinerarySection`
   6. **`<section className="bg-cloud-gray">`** → `RouteShape`
   7. **`<section id="details" className="bg-sand-blush">`** → `ExperienceSection`
   8. **`<section className="bg-soft-pearl">`** → `PracticalDetails`
   9. **`<section className="bg-mist-blue">`** → `BookingSupport`
   10. **`<section id="faq" className="bg-warm-ivory">`** → `QuestionsSection`
   11. **`<section className="bg-sand-blush overflow-hidden">`** → `RecommendationsSection` (inner `py-14`)
3. **`StickyBookingBar`** — fixed bottom price + CTA (+ mobile icon row).

---

## 14. Body vs v0 header vs v0 footer vs sticky bar

| Region | Parts |
|--------|--------|
| **Body (main editorial content)** | Everything inside `<main>` from `HeroSection` through `RecommendationsSection`, including `StickySubnav` (in-page nav). |
| **v0 site header / nav** | `SiteHeader` only. |
| **v0 site footer** | *None in source.* |
| **Sticky CTA bar** | Entire `StickyBookingBar` (desktop + mobile variants + spacer). |

---

## 15. Likely import conflicts (host integration)

| Conflict | Detail |
|----------|--------|
| **`@/` alias** | v0 expects `@/*` → project root **of the mini-app**. In the monorepo, the same alias points at **AtoC root**; copied files must use paths that resolve to **one** `lib/utils` and **one** `components/ui/button` or keep a **namespace** (e.g. dedicated folder + relative imports). |
| **Duplicate `components/ui/button`** | v0’s button + Radix slot + CVA may **differ** from AtoC’s `components/ui/button.tsx` (variants, sizes, focus ring). Mixing can change CTA/header button visuals. |
| **Tailwind v3 vs v4** | v0 relies on Tailwind 4 + `@import 'tailwindcss'` and `@theme inline`. Host uses Tailwind 3 config; **semantic tokens** (`bg-background`, `text-muted-foreground`) depend on **which** `:root` / layer wins. |
| **Design tokens** | v0 `:root` in `app/globals.css` defines cream background, `--warm-ivory`, etc. Host `app/globals.css` defines different globals; **scoped wrapper** or **ported utilities** needed to preserve v0 surfaces without editing host global background policy. |
| **`@vercel/analytics`** | `app/layout.tsx` imports `@vercel/analytics/next`. Not a tour concern, but **tsc** in a parent project may fail if this folder is typechecked without that dependency. |
| **Next / React versions** | v0 `package.json` pins Next 16 / React 19; align with host or accept divergence during copy. |

---

## 16. Missing asset risks

| Risk | Detail |
|------|--------|
| **Layout icon files** | Metadata references PNG/apple icons not in v0 `public/`. |
| **Remote images** | Unsplash hotlinks; blocked offline/CDN policy could break media. |
| **`shadow-hero`** | Possible missing utility vs `shadow-premium-hero` (see §4). |

---

## 17. What can be copied as presentational only

Safe to treat as **mostly presentational** (still need token/CSS alignment on host):

- All **`components/tour/*` except `site-header.tsx`** if the host supplies the real site header.
- **`StickySubnav`** (behavior is scroll + in-page anchors; host must preserve `id="overview" | itinerary | details | faq"` on sections or update nav config).
- **`lib/utils.ts`** pattern is standard; can **reuse host `cn`** instead of duplicating.

Requires **data wiring** later (out of scope for “presentational only”):

- Any file listed in §9 with mock arrays and Unsplash URLs.
- **`sticky-booking-bar.tsx`** price and CTA action.

---

## 18. What contains mock data

See **§9** (table). In practice: **every tour section file** + **`sticky-booking-bar`** + **`site-header`** chrome strings.

---

## 19. Other files in the folder (context)

| Area | Note |
|------|------|
| `components/ui/*` | Full shadcn kit; **not all used** by this one page. |
| `components/theme-provider.tsx` | Present; **not referenced** by `app/layout.tsx` or `app/page.tsx` in this audit. |
| `components.json` | shadcn config; aliases `@/components`, `@/lib/utils`. |
| `next.config.mjs` | `typescript.ignoreBuildErrors: true`, `images.unoptimized: true`. |
| `pnpm-lock.yaml` | Lockfile for v0 deps. |

---

## 20. Summary checklist for migration planning

- **Entry:** `components/Tour Detail page/app/page.tsx`
- **Exclude from host chrome:** `SiteHeader` (`site-header.tsx`)
- **Preserve for fidelity (including commerce strip):** `StickyBookingBar` in full (desktop bar + mobile price row + mobile icon row + spacer)
- **No v0 footer** to exclude; align host **Footer** separately per product rules.

---

*Generated from a static inspection of `components/Tour Detail page` only.*
