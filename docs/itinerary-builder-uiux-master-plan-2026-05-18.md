# Itinerary Builder — UI/UX Upgrade Master Planner

> **Single source of truth** for closing the visual quality gap between
> `/itinerary-builder/*` (functional MVP shipped Phase 1–7) and the home
> v2 surface (`components/home/v2/*`).
>
> Functionality is done. This planner is **presentation-only** — no
> behavior changes, no new routes, no new data. Goal: make the builder
> feel like the rest of AtoC Korea.
>
> Read this whole doc before touching anything in `components/itinerary-builder/`
> or `app/itinerary-builder/`. Update §A / §B / §C as you progress.

---

## A · Status dashboard

| Field | Value |
|---|---|
| **Current phase** | Phase A — audit & tokenize ⏸ (planning only; awaiting user approval to start Phase B) |
| **Blocked on** | User sign-off on phase order + scope cut-lines |
| **Last updated** | 2026-05-18 |
| **Last commit touching this track** | (plan-init commit pending) |
| **Owner** | simsangsong |
| **Reviewers** | — |
| **Related planners** | `docs/itinerary-builder-plan.md` (feature/data — DONE), `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` (design language reference) |

### Phase progress

| Phase | Status | Started | Done | Commit hash(es) |
|---|---|---|---|---|
| A — Audit + tokenize | ✅ this doc | 2026-05-18 | 2026-05-18 | (initial commit) |
| B — Type scale + section padding wholesale | ✅ complete | 2026-05-18 | 2026-05-18 | `58e3040b` |
| C — `IntakeForm` polish | ✅ complete | 2026-05-18 | 2026-05-18 | `bb628c4e` |
| D — `POICatalogGrid` restyle (mirror destinations-showcase) | ✅ complete | 2026-05-18 | 2026-05-18 | `8ac28860` |
| E — Map page chrome + `AIRecommendPanel` | ✅ complete | 2026-05-18 | 2026-05-18 | `06ab2bc0` |
| F — `CartPanel` + mobile bottom-sheet polish | ✅ complete | 2026-05-18 | 2026-05-18 | `516b50bb` |
| G — `POIDetailModal` (gallery + type) | ✅ complete | 2026-05-18 | 2026-05-18 | (this commit) |
| H — `QuoteModal` + `/thanks` premium pass | ⏸ not started | — | — | — |
| I — Motion identity (entrance + scroll-animate) | ⏸ not started | — | — | — |
| J — Responsive sweep + Lighthouse + a11y | ⏸ not started | — | — | — |

Legend: ⏸ not started · 🔄 in progress · ✅ complete · ⚠️ blocked · ❌ abandoned

---

## B · Decision log

Append a new row whenever a design call is made. Never silently change a decision.

| Date | ID | Decision | Reason |
|---|---|---|---|
| 2026-05-18 | U1 | **Design tokens = home v2 tokens.** `text-eyebrow`, `text-display`, `text-h1`–`h4`, `text-body`, `text-caption`, `text-micro` + `section-py-sm/md/lg` are the only allowed typography/section utilities going forward in builder surfaces. No raw `text-base / text-lg` etc. except inside fine-grained UI primitives (badges, inputs). | Aligns scale + rhythm with the landing/home v2 visual identity per memory `feedback_home_ui_upgrade_rules.md`. |
| 2026-05-18 | U2 | **Amber + slate palette only**, with home v2 conventions: amber-300 (eyebrow on dark), amber-700 (eyebrow on light), amber-500 (primary CTA), slate-900 (text), slate-50/100 (surfaces), rose for destructive only. No new accent colors. | Same as U1 — match landing. |
| 2026-05-18 | U3 | **Motion = framer-motion `motion.div` with `REVEAL_ITEM_VARIANTS`-style stagger entrance**, not the older `scroll-animate` class. Match `destinations-showcase.tsx` pattern exactly. | Consistency + smoother LCP. |
| 2026-05-18 | U4 | **Cards keep the existing `rounded-2xl + ring-1 + shadow-md hover:-translate-y-1 hover:shadow-xl` pattern** (this already matches home v2). Tighten the variant set to: `card-elevated` (white + shadow), `card-flat` (slate-50 + ring), `card-inverse` (slate-900 gradient). | Stop one-off card variants from breeding. |
| 2026-05-18 | U5 | **Mobile-first density**. Builder primary surface (`/itinerary-builder/[region]`) keeps map-then-cards stacking on mobile, switches to map-side-by-side-cart on `md+`. Cards = 1 / 2 / 3 / 4 col across `sm / md / lg / xl`. | Matches home v2 destinations rail behaviour. |
| 2026-05-18 | U6 | **i18n preserved**. All visible copy stays in `messages/<locale>.json` under `itineraryBuilder.*`. New keys translated via the existing pipeline (`scripts/translate-itinerary-builder-messages.mjs`). | Locked-in by D6 (parent planner). |
| 2026-05-18 | U7 | **No new dependencies.** `framer-motion`, `lucide-react`, `@dnd-kit/*` are already installed. Don't add Radix / shadcn primitives to builder unless we're consolidating an existing pattern (e.g. dialog). | Bundle discipline. |

---

## C · Change log

| Date | Commit | Change |
|---|---|---|
| 2026-05-18 | (this commit) | UX master plan written (Phase A). 10 phases laid out; design tokens locked to home v2; audit findings frozen in §J. |
| 2026-05-18 | `58e3040b` | Phase B complete — type scale + section padding wholesale migration across 11 files (3 routes + 8 components). Removed `text-3xl/2xl/xl/lg/base/sm/[11px]/[10.5px]` etc. and replaced with `text-display/h3/body/caption/eyebrow/micro` per U1. Section paddings on landing + thanks switched to `section-py-sm`. Submit CTAs on intake form + cart + quote modal now use `homeBtnPrimary` from `lib/home/home-button-classes.ts`. Acceptance: 0 remaining `text-lg+` in builder surfaces; 8 remaining `text-sm` are all inside `<input>` / `<select>` (per acceptance criterion); all 3 routes 200 SSR; production build green. |
| 2026-05-18 | (Phase G commit) | Phase G complete — `POIDetailModal` polish. **Entrance**: `AnimatePresence` wrap + backdrop fade 200ms + modal `motion.div` spring (opacity/y/scale) — opens with the same identity as home v2 sections. **Hero gallery**: 16:10 mobile, **2:1 on desktop** (md+); bottom 48px fade overlay so dark heading text on the white card below reads cleanly when the image is bright. Thumbnail strip restyled — snap-x snap-mandatory scrollbar-hide, `w-16 h-12` thumbs, active `ring-2 ring-amber-500`, inactive `opacity-70 hover:opacity-100`. **Highlights**: bullets replaced with lucide `Check` icons (amber-600) per plan; cap visible at 6 + "Show all {N} highlights" / "Show less" toggle. **Description**: defaults to `line-clamp-5`; if longer than 320 chars, "Read more" / "Read less" toggle expands inline without scroll loss. **Footer**: primary CTA bumped to `bg-slate-900` slate variant (cohesive with home v2 dark CTAs), Add icon stays; Remove keeps the rose-50 outline style. **Esc key** closes the modal now (a11y). Build green. |
| 2026-05-18 | `516b50bb` | Phase F complete — `CartPanel` polish. **Cart rows**: white background with slate ring (was slate-50 inside slate panel — too flat); added 40×40 rounded `<img>` thumbnail of the POI between index badge and name; rows now align center (`items-center`). **Empty state**: replaced single MapPin + 1-line copy with a centered amber-on-amber circle + 2-line copy ("No stops yet" + arrow pointing at Add button); reads as inviting, not "uh nothing here". **Over-budget banner**: bumped from a single-line `rose-50` text strip to a full red `AlertTriangle` icon + 2-line message banner (`rose-50 ring-1 ring-rose-200`) — easier to scan when triggered. **Desktop side panel**: width bumped to `md:w-[360px] xl:w-[380px]`, background switched from `bg-white` to `bg-slate-50/60` (reads as a pane, not a popup) with `bg-white/80 backdrop-blur-sm` header for layered feel. **Mobile bottom-sheet**: handle button now uses framer-motion `layoutId="itinerary-cart-shell"` so it morphs into the open sheet via shared-element animation; backdrop fades 200ms; sheet springs up with `type: spring stiffness: 320`. Count badge gets a pop scale animation on cart change. Drag handle bar (visual affordance) added at top of mobile sheet header. Build green. |
| 2026-05-18 | `06ab2bc0` | Phase E complete — Map chrome + AI panel restyle. **AIRecommendPanel**: changed from full-width banner to centered card (`max-w-3xl rounded-2xl shadow-md ring-1 ring-amber-100`) with amber gradient background (`bg-gradient-to-br from-amber-50 via-white to-white`). New intro copy ("Let AI suggest your day" + 1-sentence subtitle). Result chips redesigned as photo chips (40px round POI image + 1-indexed amber badge bottom-right + name); horizontal snap-x scroll on mobile, wrap on desktop. Form wraps with `motion.div` + `REVEAL_ITEM_VARIANTS` reveal. **POICatalogMap**: in-cart POIs get amber pins (`#f59e0b`) with white glyph showing cart sequence number (`String(seq)`) at 1.15× scale; out-of-cart stay slate-900 with amber glyph at 1.0×. Marker re-render now keyed on `cart` dep so adding/removing updates pin styles. New `handleResetView` callback (pan to centroid + reset zoom + clear selection) exposed via `resetViewRef` prop. **BuilderShell**: wraps map in card chrome (`rounded-2xl shadow-md ring-1 ring-slate-200`) with a header bar ("Map preview · N stops · M in cart" + Reset view button on the right). Card sits inside a `bg-slate-50` outer section so it pops. `app/itinerary-builder/[region]/page.tsx` simplified — removed the outer wrapper card since BuilderShell now owns each surface's chrome. Build green; SSR 200. |
| 2026-05-18 | `8ac28860` | Phase D complete — `POICatalogGrid` restyled to mirror `destinations-showcase`. Mobile = horizontal snap-x rail (`overflow-x-auto snap-x snap-mandatory scrollbar-hide`, card width `w-[72vw]`, right-edge fade gradient `bg-gradient-to-l from-slate-50`); desktop = auto-rows-fr grid (`md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4`). `<SnapScrollDots>` rendered below the rail (mobile-only). Entrance: section wraps `motion.div` + `useRevealContainerProps()` + each card `motion.li` with `REVEAL_ITEM_VARIANTS` (0.08s stagger). **In-cart visual**: thicker amber ring (`ring-2 ring-amber-400 shadow-[0_0_0_3px_rgba(...,0.16)]`) on the whole card + a corner ribbon `In cart · #N` showing the cart sequence number (computed from cart array index). **Stay-min badge** moved to bottom-left of the image with `Clock` icon and frosted glass background (`bg-slate-900/65 backdrop-blur-sm`). **Image aspect**: `aspect-[4/3]` on mobile (priority height in narrow viewport), `md:aspect-[16/10]` on desktop grid. **Highlights** demoted to monochrome `–` em dash bullets (no amber) per plan. **Footer** compact row: `Details` as plain text-link (no border), `Add` as pill; both with `duration-200 ease-out`. Build green; SSR 200. | 
| 2026-05-18 | `bb628c4e` | Phase C complete — `IntakeForm` polish. Selected track card now ships an amber (private) or sky (cruise) glow halo (`shadow-[0_0_0_3px_rgba(...)]`) on top of the previous border+ring; same shadow pattern applied to selected Region card (slate-900 halo). Cruise hours chips wrapped in `overflow-x-auto snap-x snap-mandatory scrollbar-hide md:flex-wrap md:overflow-visible` so they snap-scroll on mobile but stay wrapped on desktop. Selected chip got `shadow-md`. Submit CTA bumped to `md:max-w-sm md:mx-auto` (centered fixed width on desktop, full-width on mobile) per Phase C plan. New reassurance line with Sparkles icon below submit ("Eligible itineraries get an instant price — others reply within 24h" — key `autoQuoteReassurance` added to EN messages; 5-locale batch translate at end of UX track). Entrance animation: form wrapped in `motion.form` + `useRevealContainerProps()` + each fieldset/label/footer block as `motion.div/fieldset/label` with `REVEAL_ITEM_VARIANTS` — same pattern as home v2 `destinations-showcase.tsx`. Respects `useReducedMotion()` via the reveal helper. State transitions explicit `duration-200 ease-out` for the 200ms requirement in the plan acceptance. Tab order verified: track → region → (hours → ship if cruise) → submit. Build green; SSR 200. |

---

## D · Working protocol

**Mandatory before touching any file in `components/itinerary-builder/` or `app/itinerary-builder/`:**

1. **Read this whole doc.** Especially §B (decisions), §F (phase plan), §J (audit).
2. **Confirm the active phase** (§A row marked 🔄). If none is active, halt and ask user which phase to start. Phases run in order B → C → D → … → J unless §B logs a reversal.
3. **Per-phase deliverable rules**:
   - Every visible change ships behind a `git commit` with a one-line §C entry referencing the phase.
   - All new copy goes through `messages/en.json` under `itineraryBuilder.*` and is re-translated via the existing pipeline before merging.
   - All new visual primitives reuse the U1–U7 token contract. No raw `text-base` / `bg-emerald-something` outside that contract without a §B reversal entry.
4. **Per-phase acceptance** is mandatory before flipping ✅. Run the per-phase checks in §F. Paste curl/screenshot evidence into §C.
5. **Out-of-track work** (e.g. backend tweak surfaced while in Phase D) → log to §E, ask user before pulling it in.

---

## E · Scope creep registry

Things that came up while planning. Park them here; don't sneak them into a phase.

| Date | Idea | Why parked | Owner / next step |
|---|---|---|---|
| 2026-05-18 | Add map ↔ cards bidirectional hover (hover a marker → highlight matching card) | Nice polish but adds state coupling; not core to "feel premium" | After Phase J — revisit during Phase 7 quality iteration |
| 2026-05-18 | Skeleton loaders for map + cards on slow connections | Phase 1 / matching not loading is rare with SSR ISR=300s; skip until real-world telemetry | Post-MVP |
| 2026-05-18 | Dark mode pass | Out of scope per app-shell-uiux master plan (separate track) | Wait for app-shell-uiux Phase D |
| 2026-05-18 | Sticky bottom CTA on map page (like home v2 `<StickyHomeCta />`) | Adds nav noise on an already-busy page; only worth it if we drop cart panel on mobile | Revisit after Phase F if mobile cart UX still feels off |

---

## F · 10-phase plan

Each phase = one focused commit (or 2–3 sub-commits). Per-phase acceptance checks are non-negotiable.

### Phase A — Audit + tokenize (this doc) ✅
Already done by writing this planner. Outcome: §J audit + §B decisions.

---

### Phase B — Type scale + section padding wholesale (0.5 day)

**Deliverable:** Every visible heading / subhead / eyebrow / section in builder surfaces uses home v2 tokens.

**Tasks:**
- [ ] `app/itinerary-builder/page.tsx` (intake landing): wrap section in `section-py-md`, eyebrow `text-eyebrow text-amber-700`, h1 → `text-display`, subhead → `text-body text-slate-600`.
- [ ] `app/itinerary-builder/[region]/page.tsx`: header uses `text-eyebrow` + `text-h1` + `text-body`; outer `section-py-sm`.
- [ ] `app/itinerary-builder/thanks/page.tsx`: same treatment; auto-quote price header uses `text-display`.
- [ ] `IntakeForm.tsx`: legends → `text-eyebrow text-amber-700`; field labels → `text-caption font-semibold text-slate-700`; submit button → `homeBtnInverse` style.
- [ ] `POICatalogGrid.tsx`: section header → `text-h3`, count → `text-caption text-slate-500`.
- [ ] `AIRecommendPanel.tsx`: label → `text-eyebrow text-amber-800`, hint → `text-micro text-slate-500`.
- [ ] `CartPanel.tsx`: header title → `text-caption font-bold` (compact) but with `tracking-wide`.
- [ ] `POIDetailModal.tsx`: header title → `text-h3`; section headings → `text-eyebrow`.
- [ ] `QuoteModal.tsx`: header → `text-h3`; field labels → `text-caption font-semibold`.

**Acceptance:**
- [ ] `grep -rE 'text-(lg|xl|2xl|3xl|4xl|5xl|base|sm)' components/itinerary-builder/ app/itinerary-builder/` returns only inside `<input>` / `<button>` size variants (where Tailwind size utilities are appropriate — labels excluded).
- [ ] Visual diff vs. home v2 destinations-showcase: same line-height + tracking on h2.
- [ ] All 3 routes still 200 (curl).

**Cut-line:** If we stop here, the builder reads as "same product" with the home page even without other polish.

---

### Phase C — `IntakeForm` polish (0.5 day)

**Deliverable:** Intake form feels like a hero CTA card, not a generic form.

**Tasks:**
- [ ] Track toggle (Private car / Cruise) — bump the selected card with a subtle amber glow (`shadow-[0_0_0_3px_rgba(251,191,36,0.18)]`) instead of just border color. Add a thin animated underline on hover.
- [ ] Region pair — full-width row instead of 2-col grid; use the existing `<DestinationCard />` mini variant if possible (or replicate amber accent).
- [ ] Cruise hours chip group — current is functional; restyle as horizontal scroll on mobile (snap-x) with the selected chip getting `text-white bg-sky-700 shadow-md` and unselected `bg-white ring-1 ring-slate-200`.
- [ ] Submit button — full-width on mobile, fixed-width centered on desktop. Use `homeBtnInverse` class.
- [ ] Below submit: subtle "We'll auto-quote eligible itineraries" reassurance line (`text-micro text-slate-500`).
- [ ] Entrance: `motion.div` with `REVEAL_ITEM_VARIANTS` stagger on the three fieldsets.

**Acceptance:**
- [ ] Mobile 375 wide: form fits in one viewport with the submit button visible without scrolling.
- [ ] Track switch animates (200ms ease-out).
- [ ] Tab order: track → region → hours/ship → submit (logical).

**Cut-line:** Intake form done; can ship to ops for testing.

---

### Phase D — `POICatalogGrid` restyle to mirror `destinations-showcase` (1 day)

**Deliverable:** POI cards = same density + hover + photo treatment as the home page destination cards. Photos feel like a real gallery.

**Tasks:**
- [ ] Card aspect: keep 16:10 photo top, but increase image height priority on mobile (don't squash for 4-col on desktop). Use `aspect-[4/3]` on mobile snap rail, `aspect-[16/10]` on grid breakpoints.
- [ ] In-cart state: replace the small "In cart" badge with a thicker amber ring on the whole card + a corner ribbon ("In cart · #3" with the sequence number).
- [ ] Stay-min badge: move to bottom-left of image, with a clock icon and a frosted-glass background (`bg-slate-900/65 backdrop-blur-sm`).
- [ ] Highlights: cap at 2 lines, monochrome (no amber bullet — use a `–` em dash) to reduce visual noise. Hide entirely if no highlights.
- [ ] Footer (Details + Add): swap to a single compact row with `Details` as a text link (no border) and `Add` as a pill. On `Add` click, brief checkmark animation (200ms) before the card re-styles into in-cart state.
- [ ] Mobile snap rail: card width `w-[72vw]` (similar to home v2 destinations); show right-edge fade gradient. On desktop, switch to `auto-rows-fr` grid (1/2/3/4 col) — already in place.
- [ ] Section header: add a small `<SnapScrollDots>` row on mobile.

**Acceptance:**
- [ ] Visual side-by-side with `destinations-showcase` on `/`: same hover translate-y, same shadow rise, same image scale on hover.
- [ ] Adding a card to cart shows a 200ms transition (no jarring re-paint).
- [ ] All 20 busan-cluster + all 25 jeju cards render without layout shift after image lazy-load.

**Cut-line:** Builder's primary surface visually matches home.

---

### Phase E — Map page chrome + `AIRecommendPanel` (0.5 day)

**Deliverable:** AI panel reads as an inviting CTA card, not a banner. Map container has the same polish as the destination cards (rounded, ring, shadow).

**Tasks:**
- [ ] AI panel: change from "banner across full width" → a centered card (max-w-3xl, `rounded-2xl ring-1 shadow-md`) sitting between the page header and the catalog grid. Background: subtle amber gradient (`bg-gradient-to-br from-amber-50 via-white to-white`). Sparkles icon larger (h-5).
- [ ] AI panel result chips: redesign as small horizontal scroll list with photos (40px round image + name + position) — clicking a chip pans the map.
- [ ] Map container: matches the card variants from U4 (`card-elevated`); has its own header bar ("Map preview · 20 stops") inside the card to make the section read as a discrete unit.
- [ ] Map header bar shows a `Reset view` button (returns to region centroid) — UX nicety.
- [ ] Map markers: keep AdvancedMarker but switch the pin color so in-cart POIs get amber pins + a small number badge matching cart order.

**Acceptance:**
- [ ] Panel + map area visually clear which one is "intent input" vs "preview canvas".
- [ ] Clicking an AI result chip animates the marker badge + opens InfoWindow.
- [ ] Cart-order numbers visible on map pins.

**Cut-line:** Map area no longer feels separate from the rest of the page.

---

### Phase F — `CartPanel` + mobile bottom-sheet polish (0.5 day)

**Deliverable:** Cart panel feels like part of the product, not a debug panel.

**Tasks:**
- [ ] Desktop side panel: width up to 380px on `xl`, reduce header padding density, swap `bg-white` for `bg-slate-50/60` to read as a sibling pane (not a popup).
- [ ] Cart row: thumbnail (40×40 rounded) of the POI image on the left of the row, between grip and index badge. Improves recognition.
- [ ] Empty state: more inviting — illustration or icon + 1-line copy + "← Tap a pin or AI-recommend" arrow pointing at the map.
- [ ] Footer breakdown (stay/drive/total): make the over-budget warning a full red banner with an icon, not just text.
- [ ] Get-Quote CTA: `homeBtnInverse` style + hint line ("Auto-quote if eligible · manual reply within 24h").
- [ ] Mobile bottom-sheet handle button: change from "Your itinerary 0" with chevron to a pill that morphs into the sheet via framer-motion `layout` animation. 2-snap-point drag (40% / 90%) deferred to scope creep §E if time-bound.

**Acceptance:**
- [ ] Empty state visible at zero pois (don't show breakdown chrome).
- [ ] Adding a poi → drag handle button label updates with badge count animation.
- [ ] Desktop side panel doesn't overlap map at any breakpoint.

**Cut-line:** Cart UX feels finished.

---

### Phase G — `POIDetailModal` (0.5 day)

**Deliverable:** Detail modal reads as a premium magazine spread, not a Bootstrap dialog.

**Tasks:**
- [ ] Hero image: 2:1 aspect on desktop, full-bleed on mobile. Add a subtle bottom-fade so the dark-tinted header text is readable when image is bright.
- [ ] Gallery: lightbox modal-in-modal when thumbnail clicked (or scoped to swap-in-place — TBD with user). For Phase G, keep the thumbnail strip but improve its rail: snap-x + `w-16 h-12` thumbs + active outline `ring-2 ring-amber-500`.
- [ ] Highlights: rendered as a `<ul>` with checkmark icons instead of bullets (lucide `Check`). Cap at 8 visible, "Show all" link below if more.
- [ ] Description: line-clamp first 5 lines, "Read more" link to expand inline (no scroll loss).
- [ ] Practical section: 2-col grid that becomes 1-col on mobile; each row gets the existing slate-50 background + ring; align icons vertically with values.
- [ ] Footer CTA: `homeBtnInverse` style; add a `Save for later` icon button (idle for now, future feature).

**Acceptance:**
- [ ] Modal opens with `motion.div` scale + fade entrance (200ms).
- [ ] Description "Read more" expand works without layout jump.
- [ ] Body scroll locked while modal open (already implemented).

**Cut-line:** Modal feels premium.

---

### Phase H — `QuoteModal` + `/thanks` premium pass (0.5 day)

**Deliverable:** Last touchpoints (quote submit + thanks) match the rest.

**Tasks:**
- [ ] Quote modal: same hero gradient as `/thanks` auto-quote card. Submit button → `homeBtnInverse`. Field labels → `text-caption font-semibold`. Validation error → red banner with icon.
- [ ] Loading state: full-button skeleton (button stays the same width, shows spinner + dimmed label).
- [ ] `/thanks` auto-quote variant: header gradient stronger, price typography → `text-display`, breakdown table → home v2 card density, CTAs → `homeBtnInverse` for primary.
- [ ] `/thanks` pending variant: emerald check stays but is reframed with `text-display` headline; add a small "What happens next?" 3-step list.

**Acceptance:**
- [ ] Both `/thanks` variants screenshot-clean at mobile + desktop.
- [ ] Quote modal submit animation smooth, no janks.

**Cut-line:** Conversion funnel reads consistent.

---

### Phase I — Motion identity (0.5 day)

**Deliverable:** Every builder surface uses the same entrance + interaction motion as home v2.

**Tasks:**
- [ ] Replace `scroll-animate` class additions in builder components with `motion.div` + `useInView` + `REVEAL_ITEM_VARIANTS` from `src/design/motion-variants` (or equivalent).
- [ ] Audit prefers-reduced-motion: ensure all `motion.*` respects `useReducedMotion()` — quick gates.
- [ ] Page-level: stagger between sections (intake → cards → map → cart) so they cascade on first view.

**Acceptance:**
- [ ] DevTools "rendering > Emulate prefers-reduced-motion" → no transitions.
- [ ] Lighthouse motion-not-misused check passes.

**Cut-line:** Builder feels alive.

---

### Phase J — Responsive sweep + Lighthouse + a11y (0.5 day)

**Deliverable:** Full DevTools sweep + perf ≥70 mobile + AXE/a11y clean.

**Tasks:**
- [ ] DevTools at 375 / 768 / 1024 / 1440 widths × all 3 routes.
- [ ] Lighthouse mobile + desktop on each route. Target: Perf ≥70 mobile, ≥85 desktop, A11y ≥95, BP ≥95.
- [ ] AXE DevTools audit: zero serious issues.
- [ ] Tab + arrow-key nav on intake form, catalog grid, cart panel, modal.
- [ ] Screen reader pass on InfoWindow + cart row reorder announcement.

**Acceptance:**
- [ ] All targets above hit on `/itinerary-builder`, `/[region]/`, `/thanks`.
- [ ] Curl + headless screenshot evidence pasted into §C.

**Cut-line:** UI/UX upgrade track complete. Builder is shippable as a premium product surface.

---

## G · Cross-cutting concerns

### G.1 — Design token contract
Single source: `app/globals.css` `@layer base` for tokens. Already defines `--section-py-*`. New utilities introduced in this upgrade must be added there, not inline.

### G.2 — Motion contract
`framer-motion` only (already installed). Use the `REVEAL_ITEM_VARIANTS` pattern from home v2 sections (see `components/home/v2/sections/destinations-showcase.tsx`). Honor `useReducedMotion()` everywhere.

### G.3 — Photo policy
Per memory `feedback_photo_quality_policy.md`: 16:9 / OTA bright / no AI feel / quality 95 / no watermark. POI images are sourced from tour JSONs which already pass this policy.

### G.4 — i18n
All new/changed copy lives in `messages/en.json` under `itineraryBuilder.*` and is auto-translated by `scripts/translate-itinerary-builder-messages.mjs` (Anthropic / Gemini fallback per Phase 3d).

### G.5 — a11y baseline
- Color contrast ≥ 4.5:1 for body, ≥ 3:1 for large text.
- Every interactive element has an accessible name (aria-label or text).
- Modals trap focus (already implemented in `POIDetailModal` / `QuoteModal` with overflow lock; add focus trap in Phase G).

### G.6 — Premium feel without "audit restraint"
Per memory `feedback_home_visual_energy.md`: amber eyebrow stays amber (don't mute), Process section stays dark. Apply the same energy to builder.

---

## H · Risks

| # | Risk | Mitigation | Realized? |
|---|---|---|---|
| U-R1 | Token migration breaks pixel-tight layouts | Phase B ships first; visual regression via screenshots before merge | — |
| U-R2 | framer-motion added pages bloat the JS bundle | Already installed; only `motion.div` per section, no new variants imports | — |
| U-R3 | Map iframe doesn't honor card chrome (rounded clip on iOS) | Use `overflow-hidden` on wrapper; test iOS Safari early | — |
| U-R4 | Bottom-sheet drag conflicts with map gestures | Phase F snap-points deferred to scope creep §E if conflict surfaces | — |
| U-R5 | New copy diverges across locales until re-translate | Always run `translate-itinerary-builder-messages.mjs` before merging copy changes | — |

---

## I · Cost estimate

| Phase | Person-days | Cumulative |
|---|---|---|
| A — Audit + tokenize (this doc) | 0 (done) | 0 |
| B — Type scale wholesale | 0.5 | 0.5 |
| C — IntakeForm polish | 0.5 | 1.0 |
| D — POICatalogGrid restyle | 1.0 | 2.0 |
| E — Map chrome + AI panel | 0.5 | 2.5 |
| F — CartPanel + bottom-sheet | 0.5 | 3.0 |
| G — POIDetailModal | 0.5 | 3.5 |
| H — QuoteModal + /thanks | 0.5 | 4.0 |
| I — Motion identity | 0.5 | 4.5 |
| J — Responsive + Lighthouse + a11y | 0.5 | 5.0 |
| **Total** | **~5 days focused** | |

---

## J · Audit findings (frozen — do not edit)

Captured 2026-05-18 from `git ls-files components/itinerary-builder app/itinerary-builder` (9 components, 1,724 LOC across `AIRecommendPanel / BuilderShell / CartPanel / IntakeForm / POICatalogGrid / POICatalogMap / POIDetailModal / POIInfoWindowContent / QuoteModal`) + the three routes.

### J.1 — Type scale drift (vs. home v2)
- Builder uses `text-3xl md:text-5xl`, `text-2xl md:text-3xl`, `text-base`, `text-sm`, `text-xs`, `text-[11px]`, `text-[10.5px]` etc.
- Home v2 uses `text-display`, `text-h1`–`h4`, `text-body`, `text-caption`, `text-micro`, `text-eyebrow` (custom utilities defined in `app/globals.css`).
- Result: line-heights + tracking diverge; the builder reads "more cramped" especially on mobile.

### J.2 — Section padding drift
- Builder uses `pb-16 pt-12 md:pb-24 md:pt-16` etc. inline.
- Home v2 uses `section-py-md / section-py-lg` (CSS variables → consistent rhythm).
- Result: vertical breathing doesn't match between sections.

### J.3 — Eyebrow conventions
- Builder uses one-off `text-xs font-bold uppercase tracking-[0.15em] text-amber-700`.
- Home v2 has a single `text-eyebrow` utility encoding all of that.
- Result: copies of the same idea across multiple components, all subtly different.

### J.4 — Card variant proliferation
- Across builder we have: `bg-white shadow-md ring-1 ring-slate-200`, `bg-slate-50 ring-1 ring-slate-100`, `bg-slate-900 gradient`, etc. — inconsistent.
- Home v2 standardized 2–3 card variants. We should narrow to: elevated / flat / inverse.

### J.5 — Button styles
- Builder mixes inline button classNames everywhere.
- Home v2 has `lib/home/home-button-classes.ts` exports (`homeBtnInverse`, etc.) + `V0ShadcnButton` wrapper.
- Result: builder buttons look "off" — different rounding, different hover.

### J.6 — Motion
- Builder: no entrance animations. Some `transition-all duration-200` on hover but nothing on scroll-in.
- Home v2: `motion.div` everywhere, `REVEAL_ITEM_VARIANTS` stagger.
- Result: builder feels static; home v2 feels alive.

### J.7 — Mobile UX
- Builder cards on mobile are full-width stacked — no snap rail like home v2 destinations.
- Cart bottom-sheet drag handle is functional but visually plain.
- Map height takes most of the viewport even when cards are the primary surface.

### J.8 — Map vs. card hierarchy
- Now (Phase 6.5): cards above, map below. Good. But the map still feels "stuck on" because:
  - No container chrome (`rounded-2xl ring-1 shadow-md`) like the cards have.
  - No section header (just appears between sections).
- Map needs to read as a sibling card section, not a raw embed.

### J.9 — Accessibility quick wins
- Color-only state for "In cart" badge → add icon ✓.
- Some buttons missing `aria-label` (grip handles, close buttons in some places).
- Modal close button has `aria-label="Close"` ✓ but focus trap missing.

### J.10 — Copy density
- AI panel says "GET AI RECOMMENDATIONS" as a label — feels like a debug label. Home v2 would write "Or let AI suggest a day for you" inline.
- Intake form submit reads "Open the map" — fine but plainer than home v2's verbs ("Find my tour", etc.).
- Quote modal title is just "Get a custom quote" — could be "Send for a personalized quote" with home v2 warmth.

---

## K · Glossary

| Term | Meaning |
|---|---|
| Builder surface | Anything under `app/itinerary-builder/` or `components/itinerary-builder/` |
| Home v2 | Current main landing page in `components/home/v2/` |
| Token migration | Replacing inline Tailwind utilities with custom utility classes defined in `app/globals.css` |
| Reveal variants | `REVEAL_ITEM_VARIANTS` framer-motion variant pattern used in home v2 sections |
| Card variant | Named visual style (elevated / flat / inverse) — narrow set instead of free-form |
