# V0 visual layer — safe migration plan

This document audits the **current AtoC Korea codebase** vs the original **V0 export** (historical reference) and proposes a **file-by-file** plan to port **presentation only**.

The bundled V0 export folder was **removed from the repo** after the port (see `docs/v0-design-port-cleanup.md`). Retrieve the old snapshot from git history if you need side-by-side reference.

**Non-goals (do not violate):**

- Do not replace production pages with V0’s `app/page.tsx` (it is a **single-route SPA prototype**).
- Do not change **API routes**, **fetch URLs**, **payment / checkout flows**, **Supabase queries**, **validation**, **routing**, or **server/client contracts**.
- Do not bulk-copy V0 `components/ui/*` over the repo’s existing `components/ui/*` without a diff review (duplicate shadcn generations diverge).

**V0 reference:** Previously `components/v0-home/b_SnKSfSkZwVb-1774060261784/` (removed).

---

## 1. Current project — files to know

### 1.1 Landing page

| Role | Path |
|------|------|
| Route | `app/page.tsx` |
| Section UI | `src/components/home/HeroPremium.tsx`, `TrustStripPremium.tsx`, `ComparisonPanelPremium.tsx`, `ProductCardsPremium.tsx`, `HowItWorksPremium.tsx`, `ReviewsPremium.tsx`, `FinalCtaPremium.tsx` |
| Shared blocks | `components/DestinationsCards.tsx`, `components/ClassicBusSection.tsx` (wraps `HomeTourSections`) |
| Chrome | `components/Header.tsx`, `components/Footer.tsx` |

### 1.2 “Planner” / itinerary builder (production)

| Role | Path | Notes |
|------|------|--------|
| Main builder | `app/custom-join-tour/page.tsx` | Large client page: maps, hotel picker, chat/step state, `fetch` to `/api/custom-join-tour/*`, Supabase, i18n, currency. **Not** the same step model as V0’s mock wizard. |
| Related | `app/custom-join-tour/proposed/page.tsx`, `app/api/custom-join-tour/*` | APIs and contracts must stay stable. |

Optional: `app/itinerary/page.tsx` exists as a separate route — confirm product intent before styling; not assumed equivalent to V0 “planner”.

### 1.3 Tours list

| Role | Path |
|------|------|
| List page | `app/tours/list/page.tsx` — uses `fetch('/api/tours?...')`, `TourListCard`, `SearchSummaryBar`, adapters |
| Other | `app/tours/page.tsx` — different marketing/timeline style page (not the same as list) |

### 1.4 My page / account

| Role | Path |
|------|------|
| Mobile hub | `app/mypage/page.tsx` (redirects desktop to dashboard) |
| Layout + nav | `app/mypage/layout.tsx` — Header, Footer, BottomNav, sidebar/menu, user state |
| Subpages | `app/mypage/dashboard/`, `mybookings/`, `upcoming/`, `history/`, `reviews/`, `wishlist/`, `settings/`, etc. |

### 1.5 Bottom navigation

| Path | Notes |
|------|--------|
| `components/BottomNav.tsx` | `usePathname`, `Link`s to `/`, `/custom-join-tour/proposed`, `/cart`, `/mypage`; active-state rules are **behavior** — preserve. |

### 1.6 Shared UI primitives (current repo)

| Path | Notes |
|------|--------|
| `components/ui/*` | Subset of shadcn-style components (e.g. `button`, `card`, `input`, `dialog`, `tabs`, `sonner`, …) — **already in use** across the app. |
| `components/theme-provider.tsx` (if present at root) | Theme wiring — touch only with care. |
| `lib/utils.ts` | `cn()` helper — standard. |

### 1.7 Global CSS / theme

| Path | Notes |
|------|--------|
| `app/globals.css` | Tailwind layers, Pretendard, datepicker, animations, project-specific utilities. |
| `app/layout.tsx` | Root layout: fonts (Inter, Noto SC/TC), `I18nProvider`, `CurrencyProvider`, `ThemeProvider`, `globals.css`. |

---

## 2. V0 export — structure (reference only)

| V0 path | Purpose |
|---------|---------|
| `app/page.tsx` | **Single file** ~1.2k lines: `view` state switches **landing | planner | tours | mypage**; **no real routing**. Contains mock **6-step planner** (`setTimeout`, dummy prices/dates), **ToursView** list mock, **MyPageView** mock. |
| `app/layout.tsx` | Geist fonts, Vercel Analytics — **do not replace** root `app/layout.tsx`. |
| `app/globals.css` | Tailwind v4-style `@import 'tailwindcss'`, OKLCH tokens — **different pipeline** from main `app/globals.css`. |
| `components/ui/*` | Full shadcn bundle — V0’s **main page does not import these**; mostly inline Tailwind + `framer-motion` + `lucide-react`. |
| `hooks/*` | `use-mobile`, `use-toast` duplicates — overlap with existing patterns; avoid blind copy. |
| `public/*` | Icons/placeholders — optional asset copy if needed. |

**Critical architectural mismatch:** Production uses **Next.js App Router routes** + real data. V0 uses **one route** + **local state**. Porting “V0” means extracting **classNames, layout, motion patterns, and asset ideas** into **existing** components — **not** swapping `app/page.tsx`.

---

## 3. Safe migration map (file-by-file)

Legend — **Risk**: Low / Medium / High (to behavior, build, or design consistency).

---

### Landing

| Existing file | V0 source reference | What to port | What NOT to touch | Risk |
|---------------|---------------------|--------------|-------------------|------|
| `app/page.tsx` | `.../app/page.tsx` → `LandingView` outer wrapper (bg layers, padding) | Optional **wrapper** classes (e.g. full-page background, `min-h-screen`) — keep `metadata`, `dynamic`, component imports | SEO `metadata`, route, `Header`/`Footer`/`BottomNav` structure | Low |
| `src/components/home/HeroPremium.tsx` | `LandingView` hero / glass cards / tags | Tailwind **patterns**: glass panels, radii, typography scale, tag pills; optional **framer-motion** wrappers if bundle already used | Image carousel timing logic, `COPY`, CTA `href`, `analytics` calls | Medium |
| `src/components/home/TrustStripPremium.tsx` | Trust / strip sections in `LandingView` | Bar styling only | `COPY.hero.trust` content | Low |
| `src/components/home/ComparisonPanelPremium.tsx` | Compare section (`#compare` area) | Card/table **visual** layout, gradients | `HOMEPAGE_*` data from `@/src/design/homepage` | Medium |
| `src/components/home/ProductCardsPremium.tsx` | `ProductCard` + “formats” section | Image-gradient cards, bullet rows — as **presentational** mapping to existing `cards` data | `href`s, pricing copy sources | Medium |
| `src/components/home/HowItWorksPremium.tsx` | “How it works” steps | Step list styling | `COPY.howItWorks` | Low |
| `src/components/home/ReviewsPremium.tsx` | Reviews block | Card/grid styling | `COPY.reviews` | Low |
| `src/components/home/FinalCtaPremium.tsx` | Final CTA | Button/container styling | CTA links to real routes | Low |
| `components/DestinationsCards.tsx` | Destination cards in `LandingView` | Card chrome only | `fetch` to `/api/custom-join-tour/proposed`, `ProposeTransitionLink`, i18n | Medium |
| `components/ClassicBusSection.tsx` | (indirect) | Title wrapper classes only | `HomeTourSections` internals (per comment in file) | Low |

---

### Planner / custom join tour (visual shell only)

| Existing file | V0 source reference | What to port | What NOT to touch | Risk |
|---------------|---------------------|--------------|-------------------|------|
| `app/custom-join-tour/page.tsx` | `PlannerView` in `.../app/page.tsx` | **Only** outer shell: e.g. `glassStyle`-like classes, progress bar **appearance**, step panel borders, loading overlay **styling** (your `BuilderLoadingOverlay` stays the logic entry) | `Step` state machine, `fetch`/Supabase, map loaders, hotel validation, payment, `useSearchParams` flows | **High** |

**Note:** V0’s “6 steps” are **not** the same as production steps (`'start' \| 'ask_participants' \| …`). Do **not** replace production steps with V0’s `step === 1..6` logic.

---

### Tours list

| Existing file | V0 source reference | What to port | What NOT to touch | Risk |
|---------------|---------------------|--------------|-------------------|------|
| `app/tours/list/page.tsx` | `ToursView` in V0 `app/page.tsx` | List **spacing**, page background, loading/error **UI** shells | `fetch('/api/tours?...')`, `adaptToursListResponse`, currency | Medium |
| `components/tour/TourListCard.tsx` | V0 tour row cards | Card layout / image / typography | Props and navigation to real tour detail | Medium |

---

### My page / account

| Existing file | V0 source reference | What to port | What NOT to touch | Risk |
|---------------|---------------------|--------------|-------------------|------|
| `app/mypage/page.tsx` | `MyPageView` in V0 `app/page.tsx` | Profile card + menu **look** (glass, icons) | Desktop redirect to `/mypage/dashboard`, real `Link` paths | Medium |
| `app/mypage/layout.tsx` | Same `MyPageView` / sidebar patterns | Sidebar spacing, active styles — **if** aligned with design system | Auth/session fetch, menu `path`s, logout | **High** |

---

### Bottom navigation

| Existing file | V0 source reference | What to port | What NOT to touch | Risk |
|---------------|---------------------|--------------|-------------------|------|
| `components/BottomNav.tsx` | Bottom `NavIcon` row in V0 `app/page.tsx` | Icon swap (lucide vs inline SVG), bar glass classes, active color | `path` list, `pathname` matching rules (especially `custom-join-tour` branch) | Medium |

---

### Shared components / theme

| Existing file | V0 source reference | What to port | What NOT to touch | Risk |
|---------------|---------------------|--------------|-------------------|------|
| `components/ui/button.tsx` (and others) | `.../components/ui/button.tsx` | **Do not wholesale replace.** If needed, merge **variant classes** via `cva` diff review | Exported component API used across app | **High** |
| `app/globals.css` | `.../app/globals.css` | Optional **scoped** utilities (e.g. `.glass-panel`) or CSS variables — add, don’t replace entire file | Pretendard, existing animations, third-party imports | Medium |
| `app/layout.tsx` | V0 `app/layout.tsx` | Nothing wholesale | Font pipeline, providers, structured data | **High** |

---

### V0 assets

| Existing / target | V0 source reference | What to port | What NOT to touch | Risk |
|-------------------|---------------------|--------------|-------------------|------|
| `public/` | `.../public/*` | Only icons/images **if** licensed and needed | Replace existing brand assets without approval | Low–Medium |

---

## 4. Recommended phased order (minimize risk)

1. **Landing only** — `src/components/home/*` + optional `app/page.tsx` wrapper; no API changes.
2. **BottomNav** — classNames + icons; preserve paths.
3. **Tours list** — page shell + `TourListCard` styles; preserve `fetch` and adapters.
4. **My page** — `app/mypage/page.tsx` first; `layout.tsx` only after visual spec is frozen.
5. **Custom join tour** — last; smallest possible className-only PRs; pair with QA on maps/checkout.

---

## 5. Technical cautions

- **Tailwind / CSS pipeline:** V0 export targets Tailwind v4-style `globals.css`; this repo uses **Tailwind v3-style** `app/globals.css`. Prefer **Tailwind classes in components** or **small scoped CSS** over pasting V0’s entire `:root` token block unless the project migrates CSS pipeline intentionally.
- **Framer Motion:** V0 uses `motion` heavily; production already uses it in `custom-join-tour`. Follow existing **ease typing** / variant rules (project lint rules) when adding motion.
- **Bundle size:** Importing all V0 `components/ui` files is unnecessary; the V0 landing is mostly **not** built from that folder.

---

## 6. Deliverable checklist before implementation PRs

- [ ] Design tokens: decide **one** source (Tailwind theme vs CSS variables) for glass/radius.
- [ ] No replacement of `app/page.tsx` with V0’s monolith.
- [ ] Each PR: **one surface** (e.g. “landing hero only”) + visual QA + lint.

---

## 7. Presentational shells (`src/components/v0-skin/`) — suggested wrap order

Implementation lives under `@/src/components/v0-skin` with tokens in `src/styles/v0-skin.css`. **No routes or API changes** inside these shells.

| Shell | Suggested first consumers | Notes |
|-------|---------------------------|--------|
| `AppBackground` | `app/page.tsx` (optional outer wrapper) | Keeps photo + frost; `contentClassName` for stacking; BottomNav stays `z-50` below modals. |
| `GlassPanel` / `SectionShell` | `src/components/home/*`, `DestinationsCards` | Pure layout/chrome. |
| `ProductVisualCard` | `ProductCardsPremium` (or marketing cards) | Pass `title`, `footer` (e.g. `Link`) from existing data; no fake prices in the shell. |
| `PlannerModalShell` + `ProgressShell` | `app/custom-join-tour/page.tsx` (incremental) | Inject `value`/`max` from real step state; `topRight` for close control; `zIndex` default `100` > bottom nav. |
| Bottom bar chrome | `components/BottomNav.tsx` | Use `.v0-bottom-bar-shell` in `v0-skin.css` if wrapping the bar; optional future component was removed as unused (see cleanup doc). |

**Z-index reference:** `BottomNav` uses `z-50`; `PlannerModalShell` defaults to `100`; busy overlays in builder should use higher values (e.g. `110`) only when needed.

---

*Document version: 1.1 — added §7 shell wrap order; shells are presentational only.*
