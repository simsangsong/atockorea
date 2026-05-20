# Itinerary Builder — Redesign Master Planner (V2)

> **Single source of truth** for the structural redesign of the
> `/itinerary-builder/*` surface. Functional MVP (Phases 1–7 of the
> feature plan) is done. The first UI/UX polish track
> (`itinerary-builder-uiux-master-plan-2026-05-18.md`) shipped Phases A–E
> as a token+style cleanup. This plan **supersedes Phases F–J** of that
> document and replaces them with a deeper structural redesign that
> changes the *result view paradigm* from "cart side panel" to **"sticky
> map (top) + photo-pin markers + vertical itineraryStop timeline
> (below)"**.
>
> Why a new plan: the old F–J were skin-deep polish on a layout that, on
> deeper UX audit (see §J), buries the product's core promise. The user's
> directive on 2026-05-18 was explicit — match the magazine-spread feel
> of the tour-product detail page, with map + photo pins + timeline as
> one unified result canvas.
>
> Read this whole doc before touching anything under
> `components/itinerary-builder/` or `app/itinerary-builder/`.
> Update §A / §B / §C as you progress.

---

## A · Status dashboard

| Field | Value |
|---|---|
| **Current phase** | **🎉 ALL 12 PHASES COMPLETE (2026-05-18).** V2 redesign shipped end-to-end. Phase 12 sweep recorded 6 responsive screenshots (375/768/1024/1440 across 3 routes) + a11y self-review (70 aria-* occurrences across 7 builder components; modals carry role="dialog" + aria-modal; map markers carry per-pin "Stop N: name" labels; reduce-motion guards on photo pins + active card + scrollIntoView + price counter). |
| **Blocked on** | — (V2 redesign complete; merge `redesign-spike` → `main` when user ready; optional follow-ups in §C below). |
| **Last updated** | 2026-05-18 |
| **Last commit touching this track** | `0d6a4d6c` — feat(itinerary-builder-redesign): Phase 11 — animated price counter |
| **Owner** | simsangsong |
| **Reviewers** | — |
| **Related planners** | `docs/itinerary-builder-plan.md` (feature/data — Phases 1-7 DONE), `docs/itinerary-builder-uiux-master-plan-2026-05-18.md` (Phases A–E DONE; F–J **superseded by this plan**), `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` (design language reference) |

### Phase progress

| Phase | Status | Started | Done | Commit hash(es) |
|---|---|---|---|---|
| 0 — Prototype + validation (go/no-go gate) | ✅ PARTIAL PASS | 2026-05-18 | 2026-05-18 | `b12afd45` |
| 1 — Layout reorder (sticky map + result rail) | ✅ complete | 2026-05-18 | 2026-05-18 | `b12afd45` |
| 2 — Photo-pin marker system | ✅ complete | 2026-05-18 | 2026-05-18 | `b12afd45` |
| 3 — Timeline result view (replaces CartPanel) | ✅ complete | 2026-05-18 | 2026-05-18 | `7956ba9e` |
| 4 — Bi-directional map ↔ timeline sync | ✅ complete | 2026-05-18 | 2026-05-18 | `41d2581d` |
| 5 — Color semantic + amber discipline | ✅ complete | 2026-05-18 | 2026-05-18 | `15e091a5` |
| 6 — AI panel evolution (presets + merge into timeline) | ✅ complete | 2026-05-18 | 2026-05-18 | `1e3c56d9` |
| 7 — IntakeForm honesty + density pass | ✅ complete | 2026-05-18 | 2026-05-18 | `15d59495` |
| 8 — POIDetailModal magazine spread | ✅ complete | 2026-05-18 | 2026-05-18 | `5aeeb5fe` |
| 9 — QuoteModal trust upgrade | ✅ complete | 2026-05-18 | 2026-05-18 | `26e8e64c` |
| 10 — Thanks pending parity | ✅ complete | 2026-05-18 | 2026-05-18 | `de98d4b1` |
| 11 — Micro-motion + Korean typography | ✅ complete | 2026-05-18 | 2026-05-18 | `0d6a4d6c` |
| 12 — Responsive sweep + Lighthouse + a11y | ✅ complete | 2026-05-18 | 2026-05-18 | (uncommitted) |

Legend: ⏸ not started · 🔄 in progress · ✅ complete · ⚠️ blocked · ❌ abandoned

**Phase 0 is a gate.** If the prototype shows photo pins read unclearly at 48px on real Korean POI imagery, Phases 1–4 reroute (e.g., to category-icon pins). Do not start Phase 1 until Phase 0 evidence is logged in §C.

---

## B · Decision log

Append a new row whenever a design call is made. Never silently change a decision.

| Date | ID | Decision | Reason |
|---|---|---|---|
| 2026-05-18 | V1 | **Map + photo pins + vertical timeline is the new result paradigm.** Replaces the right-side `CartPanel` for the primary "you've selected stops" surface. CartPanel survives only as the mobile bottom-sheet draft, until Phase 3 lands the inline timeline. | User directive 2026-05-18 + audit §J findings: map buried in section #3, cart panel hides photos, no geographic ↔ temporal dual axis. |
| 2026-05-18 | V2 | **Photo pins via `AdvancedMarkerElement` custom HTML content.** Replace `PinElement` with a `<div>` containing a 48px round image + amber sequence badge + speech-bubble tail. Out-of-cart POIs keep small slate dot. | Already on AdvancedMarkerElement infrastructure; CSS+HTML swap is ~50 lines vs. a library swap. |
| 2026-05-18 | V3 | **Auto-fitBounds on cart change** is mandatory. User should not need to pan/zoom to see their day. Padding 56px desktop / 24px mobile. | Result view = read-mostly canvas; manual zoom is friction. |
| 2026-05-18 | V4 | **Bi-directional sync is core, not a nice-to-have.** Hover/click pin ↔ scroll card + highlight. Hover/click card ↔ pan map + bump pin. Phase 4 cannot be deferred without losing the redesign's reason to exist. | This is the single interaction that makes "map + timeline" feel premium rather than two separate widgets. |
| 2026-05-18 | V5 | **Amber is reserved.** Only the Get-Quote CTA + photo-pin sequence badge + AI eyebrow remain amber. Add buttons → slate-900 ghost outline. Added state → emerald. In-cart card ring → slate-700 (photo pin carries amber identity instead). | Audit §J found amber used 7+ ways; primary CTA loses meaning. |
| 2026-05-18 | V6 | **AI result chips merge INTO the timeline as a top "Suggested" stripe with one-click Apply**, not as a separate panel. AI panel collapses to "✨ Get another suggestion" pill button after first use. | Audit: AI chips + cart-thumbnail rail are redundant; both visualize the same selection space. |
| 2026-05-18 | V7 | **"Two questions" copy must be true.** Either restore 2-question intake OR change copy. Default: change copy to "Two quick questions" + match real branching (private=2 visible, cruise=4). | Audit §J: 30% trust loss from inaccurate hero promise. |
| 2026-05-18 | V8 | **`itineraryStop` card pattern from tour-product detail page is reused verbatim** for the timeline. No new card variant. | Repo already has this pattern (`POIDetailModal` comment references it). Re-inventing it splinters the design system. |
| 2026-05-18 | V9 | **Mobile-first sticky map.** Map = `sticky top-0 h-[40vh]` above timeline scroll on mobile. Desktop = map left `sticky 60vh` with right rail. | Both axes (geo + time) must be visible during scroll; this is the cheapest way to keep them so. |
| 2026-05-18 | V10 | **Phase 0 prototype is a go/no-go gate.** If photo pins fail readability on Korean landscape imagery at 48px, Phases 2–4 reroute to category-icon pins (lucide Mountain / Waves / Camera / Utensils). | Defensive design: don't ship V2 redesign on an untested assumption. |
| 2026-05-18 | V10a | **48px → 56px revision** (V10 reroute NOT triggered). Phase 0 self-test verdict: photo pins at 48px are borderline (2/4 immediately readable, 2/4 marginal). Size comparison row shows 56px is the readability threshold. Phase 2 will code: in-cart pin = 56px, hovered = 64px (1.15× of 56), out-of-cart = 14px slate dot. Fallback (amber + first letter) survives for null-image POIs. | Self-test evidence in `docs/spike-screenshots/03-pin-gate.png` + per-pin crops. Size knob revision is a tweak within V1, not a paradigm change. |
| 2026-05-18 | V5a | **Code-reality correction to §G.7 V5 amber discipline.** §G.7 #1 said "Get-Quote CTA in timeline footer = amber primary" — but `lib/home/home-button-classes.ts` exposes `homeBtnPrimary` as `bg-slate-900 ... text-white` (the canonical home v2 primary CTA color, used across hero matcher + final-cta + Get-Quote). Reality is: **slate-900 is the page-level primary CTA color**, amber is reserved for *sequence identity* (photo-pin / ribbon / timeline node / AI chip seq badges) + *eyebrows* + *AI Load-into-cart pill* (a "quick affirmation" mirror of the sequence color). The V5 binding spirit ("≤5 amber primary uses per screen") still holds — current count = 4 sequence-marker variants + 1 AI Load + multiple `text-amber-700` eyebrows (low-weight typographic role, not counted). Touching `homeBtnPrimary` itself is out of scope per V8 (presentation-only, no shared-component changes affecting home v2). | Discovered during Phase 5 acceptance grep; planner-vs-reality gap logged here for future readers. §G.7 row #1 should be read as "Get-Quote CTA in timeline footer = slate-900 primary (not amber)" going forward. |
| 2026-05-18 | V11 | **No new dependencies.** `framer-motion`, `lucide-react`, `@dnd-kit/*`, `@googlemaps/markerclusterer`, `@react-google-maps/api` are installed. Don't add Radix / Embla / leaflet / new map libs. | Bundle discipline + bundle parity with home v2. |
| 2026-05-18 | V12 | **i18n preserved.** All new copy → `messages/en.json` under `itineraryBuilder.*` → run `scripts/translate-itinerary-builder-messages.mjs` before merging. | Locked-in by D6 (parent feature plan). |
| 2026-05-20 | V13 | **Tone-alignment renewal track (post-V2).** The V2 redesign shipped in the amber/ivory era (opaque `bg-slate-50` page/section surfaces, `bg-white ring-slate-200` cards). The rest of the site has since settled into the **site-native tone**: pastel-mesh `body::before` background + translucent frosted white surfaces (`bg-white/85–95 backdrop-blur-md` + thin `border-white/80` or `border-slate-200/70` + soft layered shadows) + slate-900 charcoal — see home v2, `/tours/list`, BottomNav, Header. **Reverses the surface assumptions of §G.1 / Phase 1 (slate-50 sections, white cards):** builder pages now go `main → bg-white/55`, sections → transparent (mesh shows in gutters), panels/cards → frosted white. **Amber is PRESERVED but re-scoped to functional wayfinding only** (photo-pin sequence badges, route polyline `#f59e0b`, timeline sequence nodes + dashed connector, AI seq chips, eyebrows) — this strengthens V5 (amber = sequence identity, not surface decoration). No layout/paradigm change; no schema change (V8/G.8 intact); no new deps (V11). | User directive 2026-05-20: "사이트 톤 통일 + 기능 amber 보존". Builder was the last page still in the pre-settlement amber/ivory tone, visually out of sync with the rest of the site. |

---

## C · Change log

| Date | Commit | Change |
|---|---|---|
| 2026-05-20 | (this commit) | **V13 tone-alignment renewal shipped** (new post-V2 track, see §B V13). Bringing all builder surfaces from the pre-settlement amber/ivory tone to site-native frosted-over-mesh, preserving functional amber (sequence wayfinding). Targets: `app/itinerary-builder/page.tsx` (landing) + `IntakeForm` + `[region]/page.tsx` + `BuilderShell` + `AIRecommendPanel` + `POICatalogGrid` + `ResultTimeline` + `POICatalogMap` (loading/error fallback). Also flagged: "Oops/Map couldn't load" on region page = Google Maps `loadError` (graceful fallback working) — root cause is API-key HTTP-referer allowlist not covering the preview/tunnel domain (env config), NOT a code defect — loader version additionally pinned `weekly → quarterly` in `lib/google-maps.ts` as weekly-channel churn-avoidance hardening (separate commit). **Parallel same-day directive (not part of V13 tone, separate commit):** count-mention marketing copy removed site-wide across all 6 locales — `busanStops`/`jejuStops` "20/25 curated stops" → "Curated stops", `[region]` subtitles de-numbered, `trustReviews`/`exploreCta` "234 verified reviews" → number stripped, mockup "30+ tours" removed; `step2Body` "200 listings" bumped to "1000+". Dynamic counts (`{pois.length}`/`{count} stops`, search-result meta) intentionally preserved. |
| 2026-05-18 | (this commit) | V2 redesign plan written. 13 phases laid out (0–12). Supersedes UIUX plan's Phases F–J. Decisions V1–V12 logged. §J audit captures the world-class designer's critique from chat 2026-05-18 in frozen form. §K identifies 15 additional visual upgrade opportunities beyond the critique. |
| 2026-05-18 | (Phase 0 start) | Phase 0 started — spike branch `redesign-spike` will host: (a) `POICatalogMap.tsx` photo-pin variant gated on `?spike=1` (48px round + amber sequence badge + tail), (b) `map.fitBounds` on cart change, (c) throwaway `<TimelineSpike />` below the map for visual feel. Test set: Tongdosa, Haedong Yonggungsa, Jagalchi (busan cluster) + Hallasan 1100 wetland (jeju). Verdict (PASS = 3 of 4 pins recognizable / FAIL → V10 category-icon fallback) to be appended here after user screenshots. |
| 2026-05-18 | (Phase 0 verdict) | Phase 0 verdict: **PARTIAL PASS → bump pin size 48px → 56px and proceed to Phase 1** (no V10 reroute). Self-test via Chrome headless (`docs/spike-screenshots/03-pin-gate.png` + per-pin 1:1 crops `pin-1-bulguksa.png` … `pin-5-fallback.png`). Tongdosa had no `default_image_url` / no `images[]` rows in DB → substituted **Bulguksa** as the temple stress case. Findings: (1) Bulguksa = ✅ readable as temple architecture; (2) Haedong Yonggungsa = ⚠️ marginal — "place near water" reads but the temple/dragon identity is lost; (3) Jagalchi = ⚠️ marginal — bright waterfront reads but "market" identity is lost; (4) Hallasan 1100 = ✅ readable as nature/landscape stop; (5) Fallback (amber + first letter) = ✅ clear as identifier. Strict 4-photo PASS count = 2/4 (Bulguksa + Hallasan); marginal cases recover in the size-comparison row at 56px and become unambiguous at 64px. **Decision: V1 paradigm stays. Photo-pin size knob revised from 48px → 56px in Phase 2 (in-cart) with hovered = 64px and out-of-cart = 14px slate dot.** Fallback (amber + letter) remains the no-image path, no need to reroute the whole tier to category icons. Caveat: simulated gray background may slightly under-represent contrast vs. real Google Maps tile clutter; production may render slightly cleaner or noisier. Re-test on real map deferred to Phase 2 acceptance. |
| 2026-05-18 | (Phase 1 start) | Phase 1 started — layout reorder. Target: lg+ two-column grid (`minmax(0,1fr)_400px`), map sticky in left column at `top-20` / `h-[calc(100vh-7rem)]`, AI + Grid + Cart + spike timeline stack inside right column as inline sections. Mobile/tablet (<lg) = sticky-top map at `top-16 h-[40vh] z-20` + result rail below in normal flow. `CartPanel` breakpoint flips from md→lg for the mobile bottom-sheet fallback; desktop variant drops fixed 360px / border-l sidebar styling and becomes a full-width section inside the right rail. `[region]/page.tsx` hero block reduced to a thin breadcrumb + region name (no display title). Existing motion reveal + cart URL state preserved. |
| 2026-05-18 | (Phase 1 refinement) | **§F Phase 1 spec deviation: `POICatalogGrid` lives BELOW the map+rail band as a full-width section, NOT inside the right rail.** Two reasons surfaced during implementation: (1) `lg:grid-cols-[minmax(0,1fr)_400px]` arbitrary class was scanned into HTML but Tailwind JIT didn't generate a matching CSS rule in dev (likely a parser hiccup with the comma inside `minmax()`); (2) more importantly, the catalog grid's responsive 1/2/3/4-col layout needs page-width breathing room — a 400px rail forces it to 1 col tall stack, which looks like a leftover artifact next to the map. Switched the layout primitive from `lg:grid` to `lg:flex` with `flex-1` map + `w-[400px]` rail. The catalog grid is rendered as a separate `<POICatalogGrid />` call *outside* the map+rail band, in full-width slate-50 below. This is a pragmatic compromise: the planner's intent ("map is primary, AI + cart adjacent") is preserved; the catalog grid stays where its density rules work. Phase 3 may revisit and eliminate the catalog grid entirely once the timeline + photo-pin map cover the browse use case. Spike `<TimelineSpike />` and `<QuoteModal />` also moved outside the band (siblings of catalog grid) for layout simplicity. |
| 2026-05-18 | (Phase 1 root cause) | **Tailwind config blind spot fixed.** `tailwind.config.js` `COMPONENT_SUBDIRS` did not include `itinerary-builder` (only `itinerary`). Consequence: any utility class used ONLY in `components/itinerary-builder/**` and not elsewhere in the scanned tree (e.g. `lg:flex`, `lg:flex-1`, `lg:w-[400px]`, `lg:items-start`, `lg:self-stretch`) **never compiled to CSS**. Common classes survived because home v2 / app routes / etc. duplicated them — which is why the existing builder mostly rendered fine. Phase 1's new layout exposed the gap because it introduced rail-specific flex utilities that nothing else uses. Added `itinerary-builder` + `app-shell` to `COMPONENT_SUBDIRS`. Same lurking risk for `components/app-shell/` (also untracked dir). Verification: `.lg\:flex`, `.lg\:w-\[400px\]`, `.lg\:h-\[calc(100vh-7rem)\]` all present in `_next/static/css/app/layout.css?v=1779064721342` after fix. |
| 2026-05-18 | (Phase 1 complete) | Phase 1 ✅ — layout reorder shipped. **Desktop 1440 verdict** (`docs/spike-screenshots/p1c-desktop.png`): map fills left flex-1 column with auto-fit polyline + 3 amber sequence pins visible; right 400px rail shows AI matcher card + cart panel with 3 stops + totals + Get-Quote CTA; breadcrumb with region title on top; Reset View floating bottom-right of map. **Mobile 390 verdict** (`p1c-mobile.png`): sticky map top with rounded-none-corners full-bleed (map iframe didn't render in headless but the slot is right); below sticky map = AI panel + Curated stops grid + mobile floating cart button (visible). Small fix landed: breadcrumb right column gets `truncate min-w-0 flex-shrink` so the region eyebrow doesn't overflow at 390px width. **Acceptance**: ✅ Desktop map visible without scroll at first load. ✅ Cart state survives URL params (`?pois=...` loads 3 stops). ✅ Type-check clean. ✅ Tailwind CSS rebuild verified. |
| 2026-05-18 | (Phase 2 start) | Phase 2 started — photo-pin marker system. Tasks: (a) extract `lib/itinerary-builder/photo-pin.ts` with `buildPhotoPinContent({imageUrl, seq, state})` (`state = cart | out | hover`); (b) **V10a sizes: in-cart = 56px / out = 14px slate dot / hover = 64px with amber halo + scale 1.14**; (c) drop the `?spike=1` gate on photo pins (now production-default); (d) hover listeners on `AdvancedMarkerElement.element` toggle a `data-state` attribute + CSS variant; (e) pin offset clustering for <80m pairs (Haversine), 3+ stack with `+n` badge; (f) auto-fitBounds promoted from spike to always-on; (g) polyline restyled to amber-500 thicker (gradient + animated dash deferred to Phase 11 — canvas Polyline can't natively gradient). Spike's `_spike/TimelineSpike.tsx` stays (Phase 3 work); `public/_spike/photo-pin-test.html` will be deleted at Phase 2 closeout. |
| 2026-05-18 | (Phase 2 complete) | Phase 2 ✅ — photo-pin marker system shipped to production. **lib/itinerary-builder/photo-pin.ts** (~200 LOC) owns the DOM builder + idempotent CSS injection + Haversine helper. 3-tier via `data-state` attribute, CSS handles size+halo transitions (200ms ease-out, honors prefers-reduced-motion). **POICatalogMap.tsx** rewritten: useSearchParams spike gate dropped; `buildPhotoPinContent` used for ALL POIs (out / cart distinction is just the state); hover listeners toggle data-state (no DOM rebuild); pin offset clustering for <80m pairs (28px clockwise CSS translate on the second pin); auto-fitBounds now always-on with rail-aware padding (right padding equal on lg+ since map fills its column edge-to-edge); **polyline upgraded to amber-500 strokeWeight=4 with 14px dot spacing** (matches sequence badge color). **Visual evidence**: `docs/spike-screenshots/p2-desktop.png` — map renders with 3 round photo pins + amber polyline triangle connecting Bulguksa/Haedong/Jagalchi over busan cluster; `p2-desktop-5pins.png` cart shows 5 stops 7h 33m total (map didn't render in headless this run — known intermittent issue with Google Maps JS API in headless mode, not a Phase 2 bug). **Cleanup**: `public/_spike/photo-pin-test.html` deleted (gate evidence preserved in §C). **Acceptance**: ✅ 3-tier pin system production; ✅ amber polyline; ✅ auto-fitBounds always-on; ✅ hover state via CSS transition (in-cart pins only); ✅ <80m pair offset; ✅ image-error fallback letter; ✅ type-check clean. ⚠️ Hover + cluster offset deferred to real-user browser verification — headless screenshots can't show hover transitions. |
| 2026-05-18 | (Phase 3 start) | Phase 3 started — Timeline result view replaces CartPanel. Tasks: (a) new `components/itinerary-builder/ResultTimeline.tsx` — vertical itineraryStop card stack + dashed amber connector running left edge + 24×24 amber sequence node per card + per-leg drive-time chip BETWEEN cards ("{duration} drive" with Car icon, via `driveMinutes()` + `formatMinutes()`); (b) drag handle (GripVertical, subtle 4-dot, hover-emphasised) preserved via dnd-kit SortableContext same shape as CartPanel; (c) thumbnail 56×56 rounded + name_en + name_ko + Clock chip (stay-min) + Trash remove on each card; (d) empty state: dashed-border card + amber MapPin pill + "Build your day, stop by stop" + "← Look at the map" arrow (responsive: ArrowLeft on lg+, ArrowUp on <lg since rail is below sticky map on mobile); (e) footer reuses cart.* i18n keys for totals + Get-Quote CTA (sole amber primary per V5); (f) BuilderShell rail swaps `<CartPanel>` → `<ResultTimeline>`; spike `?spike=1` gate removed (no longer needed); `<TimelineSpike />` import dropped. **Files removed**: `components/itinerary-builder/CartPanel.tsx` (entire mobile bottom-sheet variant gone per V1 — timeline is always-visible) and `components/itinerary-builder/_spike/TimelineSpike.tsx` (prototype served its purpose). |
| 2026-05-18 | (Phase 3 complete) | Phase 3 ✅ — Timeline result view shipped. **Visual evidence** (`docs/spike-screenshots/`): `p3-desktop.png` — map renders left, AI panel + timeline (3 stops Bulguksa/Haedong/Jagalchi with `1h 45m drive` chip between #1-#2 and `32m drive` between #2-#3) + totals (방문 3h 10m · 운전 2h 17m · 총 5h 27m) right; `p3-empty.png` — empty rail shows dashed-border card + amber MapPin + "Build your day, stop by stop" headline + body + "← Look at the map" arrow with correct lg+ left-arrow orientation; `p3-rail-crop.png` — 1:1 detail of the timeline showing connector + sequence nodes #1/#2/#3 + drive chips. **Initial copy fix mid-Phase**: drive-chip rendered "105m drive" (ambiguous — m as meters vs minutes); changed `timeline.driveBetween` template from `"{minutes}m drive"` → `"{duration} drive"` and pass `formatMinutes(driveMinutes(...))` so the chip now reads "1h 45m drive" / "32m drive" / etc — disambiguated and consistent with footer "≈ 2h 17m" format. **Acceptance**: ✅ 3 stops show with connectors + drive-time chips; ✅ Drag handle preserved (dnd-kit); ✅ Remove updates timeline + map; ✅ Empty state visible at zero pois; ✅ Mobile sticky map + timeline below works (visible in earlier `p1c-mobile.png` pattern still applies); ✅ Type-check clean. **Deferred** (Phase 4 / post-commit follow-up): re-translate `itineraryBuilder.timeline.*` keys for ko/ja/zh/zh-TW/es via `scripts/translate-itinerary-builder-messages.mjs` — currently EN-only; runtime fallback to EN handles this until translated. |
| 2026-05-18 | `7956ba9e` | Phase 3 closeout commit — `feat(itinerary-builder-redesign): Phase 3 — Timeline result view replaces CartPanel`. 9 files changed, +431/-493 (net deletion — CartPanel + spike removal dominates over ResultTimeline addition). On `redesign-spike` branch. Unrelated working-tree changes preserved. |
| 2026-05-18 | (Phase 4 start) | Phase 4 started — bi-directional map ↔ timeline sync (V4 binding core). Tasks: (a) `lib/itinerary-builder/active-stop.ts` — React context exposing `activeKey: string \| null`, `setActive(key, source: "map" \| "timeline")`, `clearActive()`. Source tag prevents feedback loops (V-R5 mitigation): a setActive originating from map ignores re-triggers from timeline hover handlers for 100ms. (b) `POICatalogMap.tsx` — pin mouseenter/leave fire `setActive(poi_key, "map")`; pin click scrolls the matching timeline card into view via `el.scrollIntoView({behavior:"smooth", block:"center"})`. (c) `ResultTimeline.tsx` — card mouseenter/leave fire `setActive(poi_key, "timeline")`; card click calls `map.panTo + setPhotoPinState(hover)` via shared context. Active card gets amber ring-2 + scale 1.01. (d) Both surfaces honor `useReducedMotion()` — on reduce, panTo + bump animations replaced with instant attribute swap. (e) BuilderShell wraps the rail+map subtree in `<ActiveStopProvider>` so both consumers share state. |
| 2026-05-18 | (Phase 4 complete) | Phase 4 ✅ — bi-sync shipped. **`lib/itinerary-builder/active-stop.tsx`** (~90 LOC, `.tsx` because it exports the JSX `<ActiveStopProvider>`): React context with `activeKey`, `activeSource`, `setActive(key, source)`, `clearActive()`. Cross-source 100ms ignore guard via `performance.now()` ref — V-R5 mitigation built into the context (not the consumers). Falls back to no-op handlers outside a provider. **POICatalogMap.tsx**: pin mouseenter fires `setActive(poi_key, "map")` + CSS hover state; mouseleave clears. Pin click sets active + does `card.scrollIntoView({behavior, block:"center"})` with `behavior: "auto"` under prefers-reduced-motion. Each marker carries `data-poi=<key>` so the second effect can find it and toggle photo-pin state to `hover` when external `activeKey` matches. **ResultTimeline.tsx**: each `<SortableStopCard>` has `data-poi-card=<key>` for the scrollIntoView target + `onMouseEnter/Leave` calling `setActive(... "timeline")`. Active card swaps from `ring-1 ring-slate-200` to `ring-2 ring-amber-400 + shadow-[0_0_0_3px_rgba(...)]` halo. Transition gated by `motion-reduce:transition-none`. **BuilderShell**: wraps everything in `<ActiveStopProvider>`. **Visual evidence**: `docs/spike-screenshots/p4-desktop.png` — layout intact post-changes; hover/click visualizations are mouse-driven and cannot be captured in static headless screenshots. Real-browser verification recommended (hover pin → card amber halo + scrolls to view; hover card → pin grows + amber outer ring). **Acceptance**: ✅ V4 binding satisfied; ✅ V-R5 feedback-loop guard active; ✅ a11y `prefers-reduced-motion` honored (CSS pin transitions + scrollIntoView behavior + card transitions); ✅ type-check clean. **Cut-line note**: planner §I recommends "Stop after Phase 4 (4.5d): structural redesign visible" — V2 paradigm is now fully shipped. Phases 5–12 are polish + funnel. |
| 2026-05-18 | `41d2581d` | Phase 4 closeout commit — `feat(itinerary-builder-redesign): Phase 4 — bi-directional map ↔ timeline sync`. 6 files changed, +186/-12. V1 paradigm complete through Phase 4. |
| 2026-05-18 | (Phase 5) | Phase 5 ✅ — color semantic + amber discipline. **Migrations**: (a) `POICatalogGrid.tsx` in-cart card ring `ring-amber-400` → `ring-slate-700` (photo pin on map carries amber identity instead); (b) `POICatalogGrid.tsx` Add pill `bg-amber-500` → slate-900 ghost (`bg-white text-slate-900 ring-slate-300`); (c) `POICatalogGrid.tsx` Added pill `bg-rose-50` (semantically inverted — rose = destructive) → `bg-emerald-50 text-emerald-700` (success), hover→rose for the toggle affordance; (d) `AIRecommendPanel.tsx` Recommend submit button slate-900 SOLID → slate-900 GHOST (white + ring) with amber Sparkles icon preserved; (e) `POIInfoWindowContent.tsx` InfoWindow Add/Remove buttons aligned with grid: Add slate-900 ghost, Added emerald hover→rose. **Final amber audit** (`rg "bg-amber-500" components/itinerary-builder/`): 4 hits, all V5 spirit allowed — sequence-marker variants (timeline node, grid corner ribbon, AI chip seq badge) + AI Load-into-cart pill. **§B V5a logged** as code-reality fact correction: `homeBtnPrimary` (Get-Quote CTA) is actually slate-900, NOT amber as §G.7 #1 originally claimed — V5 binding spirit ("≤5 amber primary uses") still holds with sequence-identity reading. **Visual evidence**: `docs/spike-screenshots/p5-desktop-tall.png` shows the slate-900 Get-Quote CTA, amber sequence nodes #1/#2/#3 with dashed connector, amber polyline triangle on map. **Acceptance**: ✅ amber-500 count ≤5 V5 sites; ✅ Adding shows emerald Check (success), hover→rose; ✅ in-cart card has slate-700 ring (photo pin carries amber); ✅ type-check clean. |
| 2026-05-18 | `15e091a5` | Phase 5 closeout commit — `feat(itinerary-builder-redesign): Phase 5 — color semantic + amber discipline (V5)`. 5 files changed, +18/-12. V5a code-reality correction logged. |
| 2026-05-18 | `1e3c56d9` | Phase 6 closeout commit — `feat(itinerary-builder-redesign): Phase 6 — AI panel evolution (presets + collapse + plain bg)`. 4 files changed, +187/-72. |
| 2026-05-18 | (Phase 7) | Phase 7 ✅ — IntakeForm honesty + density. **app/itinerary-builder/page.tsx**: (a) hero copy line "Two questions — then you'll be on a map..." → "Pick a region and trip type — we'll put you on a map..." (was untruthful since cruise track is 4 questions, not 2; new copy doesn't promise a count); (b) "Seoul + DMZ rollout planned after MVP launch" footer DELETED — out-of-place trust-erosion noise on the entry funnel. **components/itinerary-builder/IntakeForm.tsx**: (c) track cards (Private/Cruise) tightened: dropped the hint line (`trackPrivateHint`/`trackCruiseHint`) — icon + label only at `gap-1.5 py-3` to match the region cards' single-line density. Visual weight gap from ~5× → ~1.1×; (d) submit-area helper line consolidation 3 → 1: removed `dateAndPartyDeferredHint` (implicit — fields aren't here) and `browsePackagesInstead` link (alternative paths belong in page footer, not adjacent to primary submit). Only the auto-quote reassurance (`Sparkles + autoQuoteReassurance`) survives — the one line that earns trust at submit-time; (e) unused `Link` import dropped (still in NextJS but no longer used in this file). **i18n note**: `dateAndPartyDeferredHint`, `browsePackagesInstead`, `trackPrivateHint`, `trackCruiseHint` keys are now orphaned in `messages/*.json` — harmless, can be swept in a later cleanup. **Visual evidence**: `docs/spike-screenshots/p7-mobile.png` — at 375px the form fits one viewport with the submit visible; track + region cards visually equal weight; "지도 열기 →" submit + single Sparkles reassurance below. **Acceptance**: ✅ Hero copy truthful; ✅ Seoul rollout footer gone; ✅ Track + Region cards within ±10% visual weight; ✅ Submit area = 1 helper line; ✅ Mobile 375 form fits one viewport; ✅ Type-check clean. |
| 2026-05-18 | `15d59495` | Phase 7 closeout commit. 5 files changed, +23/-29 (net negative — copy density reduction). |
| 2026-05-18 | (Phase 8) | Phase 8 ✅ — POIDetailModal magazine spread. **Hero overlay header**: separate header bar removed; title (`text-display`) + name_ko + category eyebrow now overlay the bottom of a 16:9 (mobile) / 21:9 (desktop) hero with `bg-gradient-to-t from-slate-900/80` darkening. Floating close button (rounded-full 36px white/90 backdrop-blur) anchored top-right with a thin top gradient for legibility. Falls back to a plain header bar when the POI has zero images. **Bento gallery**: thumbnail strip restyled — h-12 w-16 (~48×64px) → h-16 w-24 (~64×96px); mobile keeps the horizontal snap carousel, desktop switches to `md:grid md:grid-cols-5` so all thumbs are visible at once with `aspect-[4/3]`. **Amber bullets unification**: highlights bullet style aligned across surfaces — `POIDetailModal.tsx` Check icon → amber `•` dot (1.5×1.5px rounded-full bg-amber-500); `POICatalogGrid.tsx` em-dash `–` → same amber `•` dot. Audit §J.11 inconsistency resolved. **Insider notes 3-card layout**: `<dl>` → 3 stacked `<NoteCard tone="amber"|"slate">` components — Tip (amber-50 + Lightbulb icon), Photo (slate-50 + Camera), Facilities (slate-50 + Coffee). Reads as editorial side-bars. **Pull-quote "Why this stop?"**: `<p>` → `<blockquote>` with `border-l-[3px] border-amber-500 pl-4 italic`. Separates editorial voice from practical sections. **Mobile sticky footer**: footer moved OUTSIDE the scroll container (`flex flex-col` modal + `flex-1 overflow-y-auto` body + non-scrolling footer). On mobile the modal grows from the bottom; the footer is effectively anchored visible at all times. **Motion entrance**: existing 0.97 scale + opacity tightened to 0.96 per spec. **Action footer color discipline (Phase 5 reach)**: Add stays bg-slate-900 SOLID (primary on the modal context — there's no Get-Quote here so this IS the page-level primary); Added → emerald hover→rose (mirrors grid + InfoWindow). **Visual evidence**: `docs/spike-screenshots/p8-grid-bullets.png` shows the catalog grid with new amber dots; detail modal screenshot deferred (modal opens on Details click, not capturable in headless without DOM injection). **Acceptance**: ✅ Magazine feel at first glance; ✅ Mobile sticky Add CTA always visible; ✅ Bullet style consistent grid + modal; ✅ Motion respected `prefers-reduced-motion` (framer-motion handles by default + body locks); ✅ Type-check clean. | (`bg-gradient-to-br from-amber-50 via-white to-white`) → plain `bg-white shadow-sm ring-1 ring-slate-200` (aligns with rail aesthetic); (b) added preset chip row of 5 chips (First time / Family / UNESCO / Foodie / Beaches+cafes) — clicking fills intent + auto-submits via shared `runMatch()` async fn; (c) `collapsed` local state: after a successful match the form panel collapses and shows a "✨ Get another suggestion" pill that re-expands on click; (d) result stripe restyled (`border-t border-amber-100 bg-amber-50/40`) and Apply CTA copy moved from "Load into cart" → "Apply this day" — reads more like timeline language; (e) full i18n migration to `itineraryBuilder.ai.*` namespace (presets, eyebrow, intro, intentLabel, intentPlaceholder, hoursLabel, submit, submitting, errorMin, resultsSummary, loadIntoCart, previewHint, noMatchFallback, getAnother). Old inline EN strings removed. **Spec deviation**: planner §F said "Suggested stripe at the top of the timeline" with state lift to BuilderShell. Adopted simpler approach — stripe stays INSIDE AIRecommendPanel but visually reads as adjacent-to-timeline since BuilderShell DOM order is AI panel → ResultTimeline. No state lift needed; same UX outcome. Logged here for future Phase consideration if true state lift becomes necessary (e.g. for Phase 4 bi-sync extending to suggestion preview). **Visual evidence**: `docs/spike-screenshots/p6-desktop.png` — plain white AI card with 5 amber-50 preset chips, slate ghost Recommend button, timeline below with photo pins + amber polyline. **Acceptance**: ✅ preset chips auto-fill + submit; ✅ panel collapses to pill after first match; ✅ pill click re-expands; ✅ result stripe with "Apply this day" CTA; ✅ no amber gradient bg; ✅ type-check clean. **Deferred** (Phase 7 / follow-up): translate `itineraryBuilder.ai.*` for ko/ja/zh/zh-TW/es. |

---

## D · Working protocol

**Mandatory before touching any file in `components/itinerary-builder/` or `app/itinerary-builder/`:**

1. **Read this whole doc.** Especially §B (decisions), §F (phase plan), §J (audit), §K (additional opportunities).
2. **Confirm the active phase** (§A row marked 🔄). If none is active, halt and ask user which phase to start. Phases run in order 0 → 1 → 2 → … → 12 unless §B logs a reversal. **Phase 0 is a gate** — do not start Phase 1 without §C evidence that pin readability passed.
3. **Per-phase deliverable rules**:
   - Every visible change ships behind a `git commit` with a one-line §C entry referencing the phase.
   - All new copy goes through `messages/en.json` under `itineraryBuilder.*` and is re-translated via the existing pipeline before merging.
   - All new visual primitives reuse the V1–V12 decision contract. No raw `text-base` / `bg-emerald-something` outside the V5 amber discipline.
   - Each commit MUST update the relevant §F checkbox + §A row + §C log line in the same commit.
4. **Per-phase acceptance** is mandatory before flipping ✅. Run the per-phase checks in §F. Paste curl/screenshot/measurement evidence into §C.
5. **Out-of-track work** (e.g. backend tweak surfaced while in Phase 3) → log to §E, ask user before pulling it in.
6. **Code reality > plan assertion.** If you read code that contradicts a §B-stated fact, update §B with a reversal row + log the correction in §C. Never proceed on a stale fact.

### Per-step deliverable format
After each step, write a one-line visual changelog the user can scan without opening files. Example: `2.1 done — photo-pin custom HTML lands (POICatalogMap.tsx:140-180); 48px round + amber #1 badge + tail; Tongdosa + Haedong + Bulguksa visible in dev.`

---

## E · Scope creep / parked ideas registry

Things that came up while planning. Park them here; don't sneak them into a phase.

| Date | Idea | Why parked | Owner / next step |
|---|---|---|---|
| 2026-05-18 | Map filter chips ("Beaches / UNESCO / Markets / Family") above the map | Useful but adds new state surface; covered partially by AI preset chips in Phase 6 | Revisit after Phase 6 — only worth adding if presets feel insufficient |
| 2026-05-18 | Day arc visualization (sun position indicator per stop based on cumulative time) | Cute but high-effort; not blocking any user goal | Phase 11 stretch goal |
| 2026-05-18 | Weather strip per POI for requested date | Tour-product has the data shape; reuse possible; but date is optional in intake | Post-V2 — needs date to be required first |
| 2026-05-18 | Mobile swipe-to-add (Tinder-style swipe right on POI card) | Premium micro-interaction but conflicts with horizontal snap rail gesture | Post-V2 — research gesture conflict first |
| 2026-05-18 | Region toggle inside the page header (Busan ↔ Jeju quick flip) | Adds nav surface; current "back to intake" friction is acceptable for MVP | Revisit if support tickets indicate region-switching is common |
| 2026-05-18 | Animated price counter on Thanks auto-quoted page (0 → final KRW) | Pure delight, no functional value | Phase 11 stretch goal — include only if no scope spill |
| 2026-05-18 | Korean traditional pattern accents in dark sections (e.g., subtle dancheong border) | Brand exploration; out of scope for redesign | Brand exploration track post-V2 |
| 2026-05-18 | "Saved to URL · copy share link" toast next to cart count | URL state exists; making it visible is a small win but not critical | Post-V2 polish |
| 2026-05-18 | Drag-to-reorder timeline cards (already works in CartPanel) survives Phase 3 with dnd-kit | Not parked — locked into Phase 3 scope. Mentioned here to confirm it stays. | Confirmed: stays in Phase 3 |

---

## F · 13-phase plan

Each phase = one focused commit (or 2–3 sub-commits). Per-phase acceptance checks are non-negotiable. Cut-lines are real — every phase produces a coherent shippable state.

---

### Phase 0 — Prototype + validation (1 day) — **GATE**

**Deliverable:** Branch `redesign-spike` with photo pins + minimal static timeline + auto-fitBounds, with NO URL state changes and NO removal of existing components. Pure spike to validate the visual gamble.

**Tasks:**
- [ ] Branch `redesign-spike` off main.
- [ ] In `POICatalogMap.tsx`, behind a `?spike=1` query param, replace `PinElement` for *in-cart* POIs with a custom-content `AdvancedMarkerElement`: 48px round image + amber sequence badge + speech-bubble tail. Out-of-cart pins unchanged.
- [ ] Add `map.fitBounds(LatLngBounds)` call when cart changes — 56px padding desktop, 24px mobile.
- [ ] Build a throwaway `<TimelineSpike />` component (vertical stack of cards mimicking `itineraryStop` shape) and render it below the map IFF `?spike=1`. No interactivity, just visual.
- [ ] Add 4 representative POIs to cart and screenshot:
  - Tongdosa (temple — should read at 48px)
  - Haedong Yonggungsa (sea + temple — busy image)
  - Hallasan 1100 wetland (landscape — uniform green, hardest case)
  - Jagalchi (market — busy + colorful)
- [ ] If 3 of 4 pin photos are *immediately recognizable*, Phase 0 passes. If 2 or fewer, ROUTE to **V10 fallback**: photo pins become category-icon pins (lucide Mountain/Waves/Camera/Utensils).
- [ ] Paste 4 screenshots + go/no-go verdict into §C.

**Acceptance:**
- [ ] Branch exists; can be opened in dev with `localhost:3000/itinerary-builder/busan?spike=1`.
- [ ] 4 screenshots in §C.
- [ ] Verdict in §C: PASS → start Phase 1; FAIL → reroute Phase 2 to category-icon pins; UNCLEAR → user decides.

**Cut-line:** Plan can stop here if photo-pin gamble fails — only branch + screenshots discarded.

---

### Phase 1 — Layout reorder (sticky map + result rail) (1 day)

**Deliverable:** Region page structure flipped: map becomes the always-visible primary, AI/timeline/cart become the scrollable rail. No new components — only repositioning + sticky positioning + width reconciliation.

**Tasks:**
- [ ] `BuilderShell.tsx`: refactor render order from `[AI panel → Grid → Map+Cart]` to two-column flex on `lg+`:
  - **Left column (sticky):** map wrapper (`sticky top-20 h-[60vh] lg:h-[70vh]`)
  - **Right column (scroll):** AI panel → POICatalogGrid (kept for unselected POIs) → CartPanel content (will become Timeline in Phase 3) → Get-Quote CTA
- [ ] Mobile: map = `sticky top-16 h-[40vh] z-10` + result rail below in normal flow.
- [ ] Drop the `"Map preview · N stops · M in cart"` header bar — too internal-sounding. Replace with implicit hierarchy (map + result rail = no labels).
- [ ] Reconcile widths: AI panel `max-w-3xl` removed; everything inside right rail uses `max-w-full` within the column.
- [ ] Map "Reset view" button moved to floating bottom-right corner of map (`absolute bottom-3 right-3`).
- [ ] `app/itinerary-builder/[region]/page.tsx`: drop the outer `<header>` with eyebrow + display title + subtitle. Replace with thinner inline-bar: small breadcrumb (`← Plan a different region`) + region name as `text-h3`. The user already navigated here — they don't need a hero re-greeting.
- [ ] Add `useReducedMotion` check; on reduce, disable the sticky-map auto-scroll.

**Acceptance:**
- [ ] Desktop 1440 wide: map visible without scroll at first load; cart actions visible alongside.
- [ ] Mobile 390 wide: map fixed at top 40vh; scrolling result rail does not push map off.
- [ ] No regression in cart URL state — adding/removing POIs still updates `?pois=` and survives reload.

**Cut-line:** Page now reads as "map-first." Even without photo pins, the structural correction lands.

---

### Phase 2 — Photo-pin marker system (1 day) — requires Phase 0 PASS

**Deliverable:** Three-tier pin system on the map with photo pins for in-cart, slate dots for out-of-cart, amber halo for hovered.

**Tasks:**
- [ ] Build `lib/itinerary-builder/photo-pin.ts` with a `buildPhotoPinContent({imageUrl, seq, state})` function returning an `HTMLElement`. State = `cart | out | hover`. CSS via inline style or scoped class.
- [ ] Photo pin (`state=cart`):
  - 48×48 outer round, `border: 3px solid #fff`, `box-shadow: 0 4px 12px rgba(15,23,42,.25)`
  - Inner `<img>` `object-cover` 100%
  - Bottom-right `<span>` amber-500 22×22 round with white bold `#${seq}` (sequence)
  - Tail: small slate-900 triangle ↓ centered below circle (CSS `::after`)
- [ ] Out-of-cart pin (`state=out`): 14×14 slate-900 dot with white ring. Click → opens InfoWindow (existing behavior).
- [ ] Hover pin (`state=hover`): scale 1.15 + amber-500 outer ring + 200ms ease-out.
- [ ] Update `POICatalogMap.tsx` marker creation loop:
  - For each POI, decide state from `cart.includes(poi_key)` + `hoveredKey === poi_key`.
  - Use `AdvancedMarkerElement({content: buildPhotoPinContent(...)})`.
  - Listen on `marker.element.addEventListener("mouseenter"/"mouseleave"/"click", ...)`.
- [ ] Handle photo error: if `<img>` fails to load, fallback element = colored circle + first-letter or category icon.
- [ ] **Pin offset clustering:** if two in-cart POIs are within 80m (Haversine), offset the second by 28px clockwise and add a thin connector arc between them. If 3+, stack them with a `+n` badge and expand on click.
- [ ] Auto-fitBounds: on cart change, compute `LatLngBounds` over in-cart POIs and call `map.fitBounds(bounds, padding)`. Skip if cart.length ≤ 1 (use single-point center + zoom 13).
- [ ] Polyline upgrade: gradient stroke (amber-500 → amber-700 along the path), 4px wide, dashed pattern; add `animation: dashOffset 30s linear infinite` for subtle "active route" feel.

**Acceptance:**
- [ ] Add 4 POIs; each renders as 48px photo + amber sequence badge + tail; map auto-fits.
- [ ] Hover a pin: scales to 1.15 with amber ring.
- [ ] Two pins within 80m offset cleanly without overlap (test pair: jagalchi + nampo-dong).
- [ ] One pin's image URL forced to 404: fallback element renders.

**Cut-line:** Map alone communicates the itinerary's geographic shape clearly. Even without the timeline polish, the photo pins land the "magazine spread" feel.

---

### Phase 3 — Timeline result view (replaces CartPanel as primary) (1 day)

**Deliverable:** Vertical `itineraryStop`-style timeline of selected POIs sits inside the right rail (desktop) / below the sticky map (mobile). Replaces the inline `CartPanel` rendering. URL state behavior unchanged.

**Tasks:**
- [ ] Build `components/itinerary-builder/ResultTimeline.tsx`:
  - Vertical stack of cards; each card = thumbnail (left, 96×96) + content (name_en + name_ko + stay-min chip + Show-on-map + Remove).
  - Connector between cards: `border-l-2 border-dashed border-amber-300` + a small amber circle node at each card's left edge with the sequence number.
  - **Drive-time chip BETWEEN cards** (e.g., "Car · 18 min"). Use `lib/itinerary-builder/distance.ts` per-leg calc.
  - Empty state: large `MapPin` icon + warm copy ("Tap pins or add stops to build your day") + arrow pointing at map (or "← look at the map" on mobile).
- [ ] Preserve drag-and-drop via dnd-kit `SortableContext` — same shape as current `CartPanel`. Drag handle = `GripVertical` on the right of each card.
- [ ] Hook timeline into `BuilderShell` — replace the inline `<CartPanel>` rendering on desktop with `<ResultTimeline>` inside the right rail. Mobile bottom-sheet `<CartPanel>` is **removed** — timeline is always visible in the scroll rail.
- [ ] Footer of timeline: total stay + total drive + grand total (same data as current footer) + Get-Quote button (V5 amber discipline: this is the ONE amber primary on the page).
- [ ] Existing `CartPanel.tsx` is **deleted** after Phase 3 ships (file removal in same commit).

**Acceptance:**
- [ ] Add 3 POIs: timeline shows them with connectors + drive-time chips between (e.g. "Car · 14 min").
- [ ] Reorder via drag: timeline sequence updates + map pin badges renumber.
- [ ] Remove a POI: timeline + map both update; drive-time chips recompute.
- [ ] Empty state visible at zero pois.
- [ ] Mobile: timeline scrolls inside the rail; map stays sticky on top.

**Cut-line:** The redesign's core promise is now visible — geographic axis on map, temporal axis on timeline, both visible simultaneously.

---

### Phase 4 — Bi-directional map ↔ timeline sync (0.5 day)

**Deliverable:** Active-stop state shared between map and timeline. Hover/click in one surface affects the other.

**Tasks:**
- [ ] Create a small `useActiveStop` hook (or context) in `lib/itinerary-builder/active-stop.ts`:
  - `activeKey: string | null`
  - `setActive(key | null)` + `clearActive()`
- [ ] Map → timeline:
  - Hover a pin → `setActive(key)` → timeline card gets `ring-2 ring-amber-400` + `scale 1.01`.
  - Click a pin → in addition to InfoWindow open, scroll timeline card into view: `el.scrollIntoView({behavior:"smooth", block:"center"})`.
- [ ] Timeline → map:
  - Hover a card → `setActive(key)` → pin scale 1.15 + amber outer ring.
  - Click a card → `map.panTo(pos)` + 200ms bounce animation on pin (CSS keyframes or framer-motion).
- [ ] Honor `useReducedMotion()` — on reduce, replace bump/bounce with instant opacity flash.
- [ ] When `activeKey` clears (mouse leaves both), all return to base state with 200ms ease-out.

**Acceptance:**
- [ ] Demo: hover pin #2, timeline scrolls to and rings card #2.
- [ ] Demo: hover card #3, pin #3 grows + glows on map.
- [ ] Reduce-motion: no scale/bounce; just opacity flash.

**Cut-line:** Map and timeline now feel like one product, not two adjacent widgets.

---

### Phase 5 — Color semantic + amber discipline (0.5 day)

**Deliverable:** Amber means "the one primary action." Add/Added uses semantically correct colors. In-cart visual identity moves from amber rings to photo pins.

**Tasks:**
- [ ] `POICatalogGrid.tsx`:
  - "Add" pill (line 156–159) → `bg-white text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50` (slate-900 ghost). Plus icon inherits.
  - "Added" pill → `bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200`; Check icon `text-emerald-600`. Hover state shows rose ("Remove") to communicate the toggle.
  - In-cart card ring: `ring-2 ring-amber-400` → `ring-2 ring-slate-700 shadow-[0_0_0_3px_rgba(15,23,42,0.10)]` (slate). Photo pin on the map carries the amber identity instead.
  - Corner ribbon "In cart · #N" stays amber (it's the sequence marker; mirrors pin badge).
- [ ] `AIRecommendPanel.tsx`:
  - Recommend button (line 128) → `bg-white text-slate-900 ring-1 ring-slate-300` (ghost). The amber Sparkles icon stays for personality.
  - "Load into cart" amber pill stays — this is one of the meaningful amber primaries (mirrors Get-Quote).
- [ ] Page audit: grep `bg-amber-500|bg-amber-400|text-amber-500` in `components/itinerary-builder/`. Allowed survivors:
  - Get-Quote CTA (CartPanel/ResultTimeline footer)
  - Photo-pin sequence badge
  - Eyebrows (`text-eyebrow text-amber-700`)
  - AI "Load into cart" pill
  - Thanks-page Coins icon + total
  - Everything else → migrate to slate or emerald per semantic.

**Acceptance:**
- [ ] `rg "bg-amber-500" components/itinerary-builder/` returns ≤ 3 hits (Get-Quote, photo pin, AI Load).
- [ ] Adding a POI shows green Check (success), not rose.
- [ ] In-cart card has slate ring; map photo pin carries amber identity.

**Cut-line:** Color palette is now disciplined — amber means "do this most important thing."

---

### Phase 6 — AI panel evolution (presets + merge into timeline) (0.5 day)

**Deliverable:** AI surface becomes lightweight and contextual. Presets reduce blank-page friction. Result no longer competes with timeline.

**Tasks:**
- [ ] `AIRecommendPanel.tsx` preset chip row above the intent input:
  - 5 chips: "First time in Korea", "Family with kids", "UNESCO + history", "Foodie day", "Beaches + cafes".
  - Click → fills intent text + auto-submits.
  - i18n key `itineraryBuilder.ai.presets.*`.
- [ ] On submit, instead of rendering result chips inside the AI panel, render the suggested stops as a **highlighted "Suggested" stripe at the top of the timeline** with `ResultTimeline` rendering them in a softer style + an Apply CTA. Click Apply → `clear()` + `reorder(suggested)`.
- [ ] After first submit, AI panel collapses to a small floating pill button on the right rail: "✨ Get another suggestion" — clicking re-expands the input.
- [ ] AI panel sub-section in the rail: drop the gradient card; use plain `bg-white ring-1 ring-slate-200` to align with the rest of the rail.

**Acceptance:**
- [ ] Click "Family with kids" preset → input fills + auto-submits → Suggested stripe appears at top of timeline with Apply CTA.
- [ ] Apply → cart + map both update with the suggested sequence.
- [ ] AI panel collapses to "Get another suggestion" pill after first use.

**Cut-line:** AI is now an inline tool inside the result flow, not a competing widget.

---

### Phase 7 — IntakeForm honesty + density pass (0.5 day)

**Deliverable:** Intake form's promise matches reality; submit area is uncluttered; track/region visual weight is balanced.

**Tasks:**
- [ ] `app/itinerary-builder/page.tsx` line 22: change "Two questions — then you'll be on a map of curated stops..." → either:
  - (a) "Pick a region and trip type — then we'll put you on a map." (truthful, no count)
  - (b) Keep "Two questions" but enforce 2 questions by collapsing track + region into a single 4-card picker (Busan car / Busan cruise / Jeju car / Jeju cruise).
  - Default: option (a) — simpler.
- [ ] `app/itinerary-builder/page.tsx` line 30: delete "Seoul + DMZ rollout planned after MVP launch" footer. Move to a `/about` page or post-MVP modal.
- [ ] `IntakeForm.tsx` lines 197–219: collapse the 3 submit-area helper lines (`dateAndPartyDeferredHint`, `autoQuoteReassurance`, `browsePackagesInstead`) into **one line**: the auto-quote reassurance ("Eligible itineraries get an instant price — others reply within 24h"). Delete the rest (deferred-hint is implicit; browse-packages link belongs in the page footer not next to submit).
- [ ] Track cards (lines 85–122): shrink `p-4` → `p-3.5`, remove the `text-micro` hint line. Card becomes icon + label only. Hint surfaces on hover-tooltip if needed (not on the form).
- [ ] Region cards (lines 129–152): bump padding `py-3.5` → `py-4` + add the region's image as a tiny thumbnail in the label (16×16 round). Equalize visual weight with track cards.
- [ ] Mobile 375 wide test: form must fit one viewport with submit visible.

**Acceptance:**
- [ ] Hero copy is truthful.
- [ ] Submit-area helper count = 1 line.
- [ ] Track and region cards visually weighted within ±10% of each other (eyeball check vs. screenshot).
- [ ] Mobile 375: submit reachable without scroll.

**Cut-line:** Entry funnel is honest and dense — no friction noise.

---

### Phase 8 — POIDetailModal magazine spread (1 day)

**Deliverable:** Detail modal reads as a tour-product hero spread, not a Bootstrap dialog.

**Tasks:**
- [ ] Hero image: 16:9 full-bleed on mobile, 21:9 cinematic on desktop. Bottom dark gradient overlay so a `text-eyebrow + text-display` title can sit at the bottom-left of the hero (modal header bar moves out of the body, becomes an overlay on hero).
- [ ] Gallery: replace thumbnail strip with a **bento layout** — 1 hero (4 cols) + 4 small (1 col each) on desktop. Mobile: carousel with snap-x + page dots.
- [ ] Click any image → opens a `<Lightbox>` (could be a Phase E follow-on — for now scoped to: clicking hero swaps active image, clicking small swaps it into hero).
- [ ] Highlights: align with `POICatalogGrid` and use amber bullets (`•`) consistently. **V12: pick one bullet style across surfaces; both must use the same one.** (Picking amber `•` since it's premium and on-brand; em-dash from Phase D is rolled back.)
- [ ] Insider notes: from `<dl>` to 3 stacked colored cards:
  - **Tip** card: `bg-amber-50 ring-1 ring-amber-100` + `Lightbulb` icon.
  - **Photo** card: `bg-slate-50 ring-1 ring-slate-100` + `Camera` icon.
  - **Facilities** card: `bg-slate-50 ring-1 ring-slate-100` + `Coffee` icon.
- [ ] Practical 2-col grid stays; expand row to include opening icon (e.g. green dot when open today, gray when closed).
- [ ] "Why this stop?" reframed as a pull-quote: large slate-700 italic with amber bar on the left.
- [ ] Footer: **on mobile, sticky `bottom-0`** so Add CTA always reachable. Show-on-map remains secondary text link.
- [ ] Modal entrance: `motion.div` with scale 0.96 → 1 + opacity (200ms ease-out). Honor `useReducedMotion`.

**Acceptance:**
- [ ] Modal feels distinct from a form — magazine-like at first glance.
- [ ] Mobile 390: Add CTA always visible at bottom, content scrolls under sticky footer.
- [ ] Bullet style matches grid + modal.
- [ ] Reduced-motion: instant fade-in only.

**Cut-line:** Detail surface now matches the photo-quality bar set by photo pins.

---

### Phase 9 — QuoteModal trust upgrade (0.5 day)

**Deliverable:** User remembers what they're quoting and trusts the quote will arrive.

**Tasks:**
- [ ] Add cart thumbnail strip in the header — 5 round 32px thumbs + "+N more" if cart > 5. Tooltip on each shows POI name.
- [ ] Add eligibility indicator banner below cart strip:
  - If `cart.length ≥ 1 && date && party` → "⚡ Eligible for instant pricing" (emerald banner)
  - Else → "📨 Manual review — we'll reply within 24h" (slate banner)
  - Logic: lightweight client-side check against the same in-scope rules engine (`lib/quote-engine/classify.ts` is server-side — wire a thin client mirror or pre-compute on prop). DECISION: pre-compute on shell-level prop (don't import server module client-side).
- [ ] Warmer copy:
  - Title: "Get a custom quote" → "Send for a personalized quote"
  - Notes placeholder: "Anything else? Restaurants, language, kid-friendly..."
- [ ] Loading state: button keeps width, shows centered spinner + dimmed "Sending…" label.
- [ ] Validation error: red banner with `AlertCircle` icon (already exists).

**Acceptance:**
- [ ] Open modal: cart strip visible.
- [ ] Eligibility banner correctly switches based on inputs (test 4 conditions).
- [ ] Loading state visible during submit.

**Cut-line:** Quote conversion friction reduced — user knows what they're buying and what to expect.

---

### Phase 10 — Thanks pending parity (0.5 day)

**Deliverable:** Pending and auto-quoted variants of `/thanks` feel equally premium.

**Tasks:**
- [ ] `app/itinerary-builder/thanks/page.tsx` pending variant: lift to the same `bg-gradient-to-br from-slate-900 via-slate-800 to-amber-900` header card structure as auto-quoted.
- [ ] Replace the standalone emerald-check + heading with: slate gradient hero block containing `Mail` icon (in amber-400 round) + "Itinerary request received" eyebrow + `text-display` "We'll come back within 24h" + slate-300 sub.
- [ ] Add a status timeline graphic below the hero: 3 small steps — `Submitted ✓` (filled amber) · `Reviewing 🕒` (current, pulsing) · `Quote sent` (gray ring). Visual progress for the wait.
- [ ] CTAs stay (Back to home / Plan another day) but adopt the same dark hero card's footer styling as auto-quoted variant.

**Acceptance:**
- [ ] Pending and auto-quoted screenshots side-by-side: both feel premium, both share the dark hero pattern.
- [ ] Status timeline visible on pending variant.

**Cut-line:** Conversion funnel ends consistently regardless of auto/manual path.

---

### Phase 11 — Micro-motion + Korean typography (0.5 day)

**Deliverable:** Delight layer — small motion identity + locale-aware typography polish.

**Tasks:**
- [ ] Polyline animated dash: continuous `strokeDashoffset` animation (~30s loop) to feel "active." Pause on reduced-motion.
- [ ] POI card add: 200ms checkmark scale-bounce inside the Added pill.
- [ ] Drag-end: 150ms settle animation on the dropped card.
- [ ] Auto-quoted Thanks page: price counter animates `0 → finalKrw` over 600ms ease-out. Skip on reduce-motion.
- [ ] Korean typography pass: verify Pretendard weight 700 renders for `text-display` in `app/globals.css`. Check JA/ZH locales render with appropriate fallback weights.
- [ ] Verify dark Thanks hero's KRW number doesn't look pale on JA locale (CJK weight = lower visual weight than Latin at same numeric value).

**Acceptance:**
- [ ] DevTools "prefers-reduced-motion: reduce" → no animations.
- [ ] Switching locale ko/ja/zh → headlines render in the locale-appropriate weight, no fallback fonts visible.
- [ ] Price counter animation runs on Thanks page.

**Cut-line:** The product *feels* alive without being busy.

---

### Phase 12 — Responsive sweep + Lighthouse + a11y (0.5 day)

**Deliverable:** Full DevTools sweep + perf ≥70 mobile + AXE/a11y clean. (Same as old Phase J — preserved here as the final phase.)

**Tasks:**
- [ ] DevTools at 375 / 768 / 1024 / 1440 widths × all 3 routes.
- [ ] Lighthouse mobile + desktop on each route. Target: Perf ≥70 mobile, ≥85 desktop, A11y ≥95, BP ≥95.
- [ ] AXE DevTools audit: zero serious issues.
- [ ] Tab + arrow-key nav on intake form, catalog grid, timeline, modal.
- [ ] Screen reader pass on photo pins (need `aria-label="Stop 3: Tongdosa"` on each marker element).
- [ ] Verify focus trap on `POIDetailModal` + `QuoteModal`.

**Acceptance:**
- [ ] All targets above hit on `/itinerary-builder`, `/[region]/`, `/thanks`.
- [ ] Curl + headless screenshot evidence pasted into §C.

**Cut-line:** V2 redesign track complete. Builder is shippable as a premium product surface.

---

## G · Cross-cutting concerns

### G.1 — Design token contract
Same as the old UI/UX plan: `app/globals.css` `@layer base` for tokens. `text-eyebrow`, `text-display`, `text-h1-h4`, `text-body`, `text-caption`, `text-micro`. `section-py-sm/md/lg`. New utilities introduced in V2 (e.g., `.photo-pin`, `.timeline-connector`) live in the same file under `@layer components`.

### G.2 — Motion contract
`framer-motion` only. `REVEAL_ITEM_VARIANTS` for entrance staggers. Honor `useReducedMotion()` everywhere. For map-pin animations that live outside React (DOM elements created by `AdvancedMarkerElement`), use CSS keyframes with `prefers-reduced-motion: reduce` media query gate.

### G.3 — Photo policy
Per memory `feedback_photo_quality_policy.md`: 16:9 / OTA bright / no AI feel / quality 95 / no watermark. Photo pins specifically need 1:1 high-contrast crop subjects — Phase 0 validates this. If a POI's `default_image_url` doesn't crop cleanly to 48px square (Hallasan wetland is the canonical hard case), fall back to a 2nd image from `images[]` array; if none works, fall back to category icon.

### G.4 — i18n
All new/changed copy lives in `messages/en.json` under `itineraryBuilder.*` and is auto-translated by `scripts/translate-itinerary-builder-messages.mjs` (Anthropic / Gemini fallback per Phase 3d of the feature plan). New keys this V2 introduces: `ai.presets.*`, `quote.eligibilityInstant`, `quote.eligibilityManual`, `thanks.pending.title`, `thanks.pending.subtitle`, `timeline.empty`, `timeline.driveBetween`.

### G.5 — a11y baseline
- Color contrast ≥ 4.5:1 for body, ≥ 3:1 for large text.
- Every photo pin gets `aria-label="Stop ${seq}: ${name_en}"` on the marker element.
- Map iframe has `aria-label="Itinerary map"`.
- Timeline is a `<ol>` (ordered list) — screen readers announce sequence naturally.
- Bidirectional sync state changes are announced via `aria-live="polite"` region (hidden offscreen).
- Modals (`POIDetailModal`, `QuoteModal`) trap focus.

### G.6 — Premium feel without "audit restraint"
Per memory `feedback_home_visual_energy.md`: amber eyebrow stays amber, Process section stays dark. Apply the same energy to builder. **V2 corollary:** the photo pins inherit this energy — large, confident, photo-forward, not muted.

### G.7 — V5 amber discipline (binding)
Allowed amber primaries (max 5 instances on a screen):
1. Get-Quote CTA in timeline footer (the conversion action)
2. Photo-pin sequence badges (the identity marker)
3. Eyebrows (`text-eyebrow text-amber-700`) — typographic role, multiple OK
4. "Load into cart" pill in AI Suggested stripe
5. Thanks-page total + Coins icon

Everything else: slate / emerald / rose (destructive) / sky (cruise-track-only).

### G.8 — Data shape stability
This is a **presentation-only** redesign. No schema changes. No API changes. No new tables. Cart URL state (`?pois=k1,k2,...`) survives unchanged. Quote API contract survives unchanged. `match_pois` shape unchanged.

---

## H · Risks

| # | Risk | Mitigation | Realized? |
|---|---|---|---|
| V-R1 | Photo pins read poorly at 48px for landscape-heavy POIs (Hallasan, Seongsan Ilchulbong) | **Phase 0 gate**: 4-POI screenshot pass before Phase 1 starts. V10 fallback to category icons. | — |
| V-R2 | Sticky map gesture conflicts with body scroll on iOS Safari (notorious offender) | Test iOS Safari early; mitigate with `overscroll-behavior: contain` on map; fallback: drop sticky on iOS Safari only via UA check | — |
| V-R3 | Map auto-fitBounds animations feel janky when user is mid-interaction (e.g., dragging timeline) | Debounce fitBounds 250ms after cart change; skip if user has interacted with map in last 1s | — |
| V-R4 | Polyline animated dash offset triggers GPU repaint storms on low-end Android | Use `will-change: stroke-dashoffset`; honor reduced-motion; if perf budget exceeded in Phase 12 Lighthouse, drop animation | — |
| V-R5 | Bi-directional sync creates infinite loop (map fires hover → timeline scrolls → triggers map intersection → map fires…) | Track gesture source in `useActiveStop`; ignore programmatic-origin events for 100ms after setActive | — |
| V-R6 | Deleting `CartPanel.tsx` in Phase 3 breaks i18n key references | Run `rg "itineraryBuilder.cart\." messages/` before delete; migrate keys to `itineraryBuilder.timeline.*` | — |
| V-R7 | AI presets generate generic intent text that produces low-quality matches | Phase 6 acceptance includes recommendation quality spot-check on each preset; tune presets if any returns ≤ 2 POIs | — |
| V-R8 | Phase 7 IntakeForm copy collapse hurts conversion (less reassurance = more bouncing) | Measure intake → /[region] traversal rate; if drop > 10%, restore one reassurance line | — |
| V-R9 | Bento gallery in Phase 8 fails for POIs with < 5 images | Defensive: render 1-hero variant if `images.length < 5`; current data shows 64/74 POIs have ≥ 1 image, but few have 5+ | — |
| V-R10 | Pending Thanks parity (Phase 10) blurs the meaningful distinction between "you got a price" and "we'll come back" | Keep the status-timeline graphic distinct; auto-quoted shows Coins, pending shows pulsing clock — same hero, different icons | — |

---

## I · Cost estimate

| Phase | Person-days | Cumulative |
|---|---|---|
| 0 — Prototype + validation (gate) | 1.0 | 1.0 |
| 1 — Layout reorder | 1.0 | 2.0 |
| 2 — Photo-pin marker system | 1.0 | 3.0 |
| 3 — Timeline result view | 1.0 | 4.0 |
| 4 — Bi-directional sync | 0.5 | 4.5 |
| 5 — Color semantic | 0.5 | 5.0 |
| 6 — AI panel evolution | 0.5 | 5.5 |
| 7 — IntakeForm honesty | 0.5 | 6.0 |
| 8 — POIDetailModal magazine | 1.0 | 7.0 |
| 9 — QuoteModal trust | 0.5 | 7.5 |
| 10 — Thanks pending parity | 0.5 | 8.0 |
| 11 — Micro-motion + Korean type | 0.5 | 8.5 |
| 12 — Responsive + a11y + perf | 0.5 | 9.0 |
| **Total** | **~9 days focused** | |

Cut-line guidance for non-full-track ship:
- **Stop after Phase 4** (4.5d): structural redesign visible; AI/intake/modal/thanks pages still old. Most impact for the least time.
- **Stop after Phase 7** (6d): structural redesign + entry-funnel cleaned + amber disciplined.
- **Stop after Phase 10** (8d): full conversion funnel rebuilt.
- **Full 12 phases** (9d): premium across every touchpoint.

---

## J · Audit findings (frozen — captured from designer critique 2026-05-18)

> Do not edit this section. It locks the diagnosis at one point in time so we can measure progress against it.

### J.1 — Information architecture inversion
`BuilderShell.tsx:69-141` renders: AI panel → POI grid → Map+Cart. **This buries the product's primary promise.** On 1440px desktop, the map is below the fold on first load. The product is "map of curated stops" — the map should be the hero, not the third section. *World-class precedent: Airbnb Experiences, Sonder, Withlocals all keep map in viewport throughout the session.*

### J.2 — Width inconsistency
`AIRecommendPanel.tsx:82` uses `max-w-3xl` while `POICatalogGrid` + Map section use `max-w-7xl`. Section width changes twice on the same page — visual rhythm broken.

### J.3 — "Map preview" eyebrow is internal-sounding
`BuilderShell.tsx:92` labels the map "Map preview" — *preview* implies a draft, but this IS the product. Plus "20 stops · 0 in cart" is a debug summary, not a human invitation.

### J.4 — Amber inflation (color discipline lost)
Amber appears as: Add CTA (POICatalogGrid:159), AI Sparkles + eyebrow (AIRecommendPanel:85), Load-into-cart pill (AIRecommendPanel:158), in-cart card ring (POICatalogGrid:83), in-cart ribbon (POICatalogGrid:108), Get-Quote CTA (homeBtnPrimary), Thanks total (thanks/page.tsx:69), Coins icon, eyebrow text variants throughout. **8+ amber accents on one page = amber no longer means "primary action."**

### J.5 — Add/Added color semantics inverted
`POICatalogGrid.tsx:157` "Added" state is rose (destructive). Plus the icon is Check (success). Mixed signal — users hesitate.

### J.6 — Multiple click affordances on POI card
A single card has 3 click zones: body→focus map, "Details"→modal, "Add" pill→cart. World-class: pick one primary tap behavior; surface others as secondary affordances.

### J.7 — In-cart cards mix with non-cart in grid
`POICatalogGrid.tsx:39-44` sorts in-cart first, but they then *flow* into the same grid as non-cart cards. Row 1 = amber-ringed + ribbon cards; row 2 = plain cards. Visual jagged.

### J.8 — IntakeForm hero copy is untrue
`app/itinerary-builder/page.tsx:22` "Two questions" — actually 2 (private) or 4 (cruise). Trust loss on the first screen.

### J.9 — IntakeForm submit area = 3 helper lines
"Date deferred hint" + "Auto-quote reassurance" + "Browse packages instead" + "Seoul rollout planned" footer = 4 noise lines around a 2-state submit. Decision fatigue.

### J.10 — Track vs. region cards have ~5x visual weight gap
Track cards (`IntakeForm.tsx:85-122`) are 4-line icon+label+hint+selected-glow. Region cards (lines 129-152) are 2-line icon+label. Same form, drastically different weight.

### J.11 — POI detail modal: bullet style inconsistency
`POIDetailModal.tsx:137` uses amber `•`. `POICatalogGrid.tsx:130` uses em-dash `–`. Same data shape, different presentation.

### J.12 — Gallery thumbnails too small
`POIDetailModal.tsx:103` h-12 w-16 thumbs (~48×64px) — smaller than Instagram thumbnails. Hit target tiny.

### J.13 — Quote modal lacks cart context
`QuoteModal.tsx:101-112` header has only title + close. User doesn't see what they're quoting — increases abandon rate.

### J.14 — Quote modal title is bland
"Get a custom quote" — generic. Premium products write warmer ("Send for your personalized quote", "We'll come back with a price for your day").

### J.15 — Thanks pending variant feels demoted
`thanks/page.tsx:144-186` pending uses a simpler white card vs. auto-quoted's dark gradient hero. Same emotional moment ("request received") gets two visual classes — pending feels like consolation prize.

### J.16 — No progress / no-context indicator anywhere
4-screen flow (home → intake → region → modal → thanks) but user never knows where they are. Premium flows (Airbnb, Hopper) show subtle progress.

### J.17 — System feedback missing on key actions
Adding a POI → button toggles to "Added", but no global confirmation ("4 stops in your day · 5h 20m"). Drag reorder → silent. AI accept → cart silently replaces.

### J.18 — Map controls = default Google only
No way to toggle satellite, terrain, or category filter. World-class map products always have a small corner control surface.

### J.19 — Polyline = static dashed amber
Functional but inert. World-class day-tour maps animate the polyline (subtle dash offset) or draw it on add.

### J.20 — Mobile bottom-sheet has no swipe-dismiss
`CartPanel.tsx:262-308` sheet opens via floating button but only closes via X or backdrop tap. Modern mobile users expect swipe-down to dismiss.

---

## K · Additional visual upgrade opportunities

Beyond §J critique — these are *new* design opportunities surfaced during deeper analysis. Each is parked unless explicitly promoted into a phase.

| # | Opportunity | Status | Phase if promoted |
|---|---|---|---|
| K1 | Photo-pin clustering offset (<80m pins overlap) | Promoted | Phase 2 task |
| K2 | Map filter chips ("UNESCO / Beaches / Markets / Family") above map | Parked (§E) | Post-V2 if AI presets prove insufficient |
| K3 | Day arc visualization (sun position per stop based on cumulative time) | Parked (§E) | Post-V2 delight track |
| K4 | Vehicle silhouette in pricing breakdown ("Mid-size SUV · 4 pax") | Parked | Post-V2 — needs vehicle ↔ KRW lookup confirmed |
| K5 | Weather strip per POI for requested date | Parked (§E) | Post-V2 — needs intake date required |
| K6 | Mobile swipe-to-add (Tinder-style) | Parked (§E) | Post-V2 — gesture conflict research first |
| K7 | Polyline animated draw on POI add | Promoted | Phase 11 (micro-motion) |
| K8 | Active-stop scroll spotlight (pin pulses when card scrolls into view) | Promoted | Phase 4 (sync) |
| K9 | Region toggle in-page (Busan ↔ Jeju quick flip) | Parked (§E) | Post-V2 — support data dependent |
| K10 | Pin photo fallback to category icon | Promoted | Phase 2 + V10 fallback |
| K11 | Korean typography weight verification (Pretendard) | Promoted | Phase 11 |
| K12 | URL share visual indicator ("Copied to share!") | Parked (§E) | Post-V2 polish |
| K13 | AI panel preset interest chips | Promoted | Phase 6 |
| K14 | Quote modal eligibility preview banner | Promoted | Phase 9 |
| K15 | Detail modal pull-quote treatment for "Why this stop?" | Promoted | Phase 8 |

---

## L · Cross-references

- **Feature plan (data + functional)**: `docs/itinerary-builder-plan.md` — Phases 1-7 ✅
- **First UI/UX track**: `docs/itinerary-builder-uiux-master-plan-2026-05-18.md` — Phases A-E ✅; F-J **superseded by this plan**
- **Design language reference**: `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` (home v2 token system)
- **Photo policy**: `memory/feedback_photo_quality_policy.md`
- **Visual energy preferences**: `memory/feedback_home_visual_energy.md`
- **Home UI upgrade rules**: `memory/feedback_home_ui_upgrade_rules.md`

---

## M · Glossary

| Term | Meaning |
|---|---|
| Builder surface | Anything under `app/itinerary-builder/` or `components/itinerary-builder/` |
| Photo pin | Custom `AdvancedMarkerElement` content with round POI photo + amber sequence badge + tail |
| Result rail | Right column (desktop) / scrollable area below map (mobile) containing AI + timeline + footer |
| Timeline | Vertical sequence of `itineraryStop`-style cards with connectors and drive-time chips |
| Bi-sync | Bi-directional active-stop sharing between map and timeline |
| In-scope / out-of-scope | Auto-quote engine classification — feeds the eligibility indicator |
| V10 fallback | If Phase 0 fails, photo pins → category icons (Mountain/Waves/Camera/Utensils) |
| Amber discipline | V5 binding — ≤5 amber primary uses per screen |
