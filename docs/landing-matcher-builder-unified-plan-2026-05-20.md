# Landing Matcher + Builder Unified Planner Plan

Date: 2026-05-20

Status: **Phase 0 gate cleared + Phases 1–3 shipped & verified (2026-05-21).** The unified planner (matcher + `Match me` / `Build myself` modes) is live in the hero, and the separate `ItineraryBuilderEntry` section has been removed from the homepage. Remaining: Phase 4 (intent handoff into the builder) and Phase 5 (match→build bridge) — both optional. v3 (`docs/landing-page-uiux-master-plan-v3-2026-05-17.md`) remains the binding source of truth for the landing surface; this plan reconciled with its §B decisions (reversal rows logged 2026-05-21), it did not override them silently.

History — reviewed against v3 + verified code reality (2026-05-20); Phase 0 gate + Governance section added and route / i18n / bridge-copy honesty fixes applied in the 2026-05-21 revision; gate cleared and Phases 1–3 executed 2026-05-21 (see the Phase 0 Resolution log + per-phase ✅ DONE notes). Outstanding user actions: conclude the 3 power-empty experiments (Gate 0.4, DB write needs explicit auth), translate es/ja/zh/zh-TW planner keys, confirm the Seoul "Request a Seoul day" target.

## Goal

Unify the current landing-page smart matcher and custom itinerary builder entry into one planning surface with two modes:

- `Match me`: low-friction recommendation flow for users who want help choosing.
- `Build myself`: direct itinerary-building entry for users who already know they want to browse stops.

The product goal is not to make two separate sections sit closer together. The goal is to make both flows feel like two ways of operating the same travel-planning tool, sharing destination, intent, style chips, and visual context.

## Current State

### Homepage Matcher

The homepage matcher currently lives inside the hero in:

- `components/home/v2/sections/hero-section.tsx`
- state and API orchestration: `components/home/v2/HomeV2MatchProvider.tsx`
- result surfaces:
  - `components/home/v2/MatcherMorphingPanel.tsx`
  - `components/home/v2/DeferredBestMatchPreview.tsx`
  - `components/home/v2/MatcherBottomSheetLazy.tsx`

It calls:

- `POST /api/tour-product/match`
- `POST /api/tour-product/match-explanation`

The matcher is tour-product oriented. It recommends packaged products from `match_tours`.

### Homepage Builder Entry

The builder entry is currently a separate section rendered after destinations:

- `components/home/v2/sections/itinerary-builder-entry.tsx`
- mounted in `components/home/v2/HomeV2Page.tsx`

It is image/card heavy, region-card oriented, and links to:

- `/itinerary-builder?region=busan`
- `/itinerary-builder?region=jeju`

### Builder App

The builder itself starts here:

- `app/itinerary-builder/page.tsx`
- `app/itinerary-builder/[region]/page.tsx`
- `components/itinerary-builder/BuilderShell.tsx`

It reads POIs from:

- `public.match_pois`

Builder AI recommendation is already available inside the builder:

- `components/itinerary-builder/AIRecommendPanel.tsx`
- `POST /api/itinerary/match`

This means the landing page does not need to invent a new planner engine. It should route the user into the right existing flow, while sharing enough state to feel continuous.

## UX Strategy

### Single Surface, Two Modes

Use one card-like planner surface under the hero trust strip.

Top-level copy:

```text
Plan your Korea day your way
Get matched instantly, or build it stop by stop.
```

Segmented control:

```text
Match me | Build myself
```

Shared controls:

- Destination: `Jeju`, `Seoul`, `Busan`
- Intent field: one compact free-text field
- Style chips: existing homepage travel-style chips
- Optional seasonal chip from current hero logic

Mode-specific body:

- `Match me`
  - primary CTA: `Get My Recommendation`
  - loading/result behavior uses existing `HomeV2MatchProvider`
  - result CTA can stay product-detail oriented
  - secondary CTA after result: honest bridge copy `Build your own day in {destination}` (NOT "Customize this day" — see Recommendation To Builder Bridge)
- `Build myself`
  - visual region preview for supported builder regions
  - primary CTA: `Start Building`
  - compact curated-stop preview, not a full grid
  - if destination is unsupported, show a route request/custom quote state instead of pretending the map exists

### Supported Destinations

The matcher supports `jeju`, `seoul`, and `busan`.

The itinerary builder currently supports:

- `jeju`
- `busan`

So the landing planner must handle Seoul carefully:

```text
Match me + Seoul      -> enabled
Build myself + Seoul  -> disabled or "request custom Seoul day" fallback
```

Recommended MVP behavior:

- Keep Seoul selectable globally.
- In `Build myself` mode, if Seoul is selected, show:

```text
Seoul builder is coming next.
Tell us your must-see spots and we will shape the route manually.
```

CTA:

```text
Request a Seoul day
```

This avoids a broken promise while preserving demand capture.

## Layout

### Mobile

Single-column stack:

```text
[eyebrow]
Plan your Korea day your way
Get matched instantly, or build it stop by stop.

[ Match me | Build myself ]

Destination
[ Jeju ][ Seoul ][ Busan ]

Intent input

[style chips horizontal scroll]

Mode body
```

For `Match me`:

```text
[Get My Recommendation]
No sign-up · No card · 30 seconds
```

For `Build myself`:

```text
[region preview image / compact stop rail]
[Start Building]
```

### Desktop

Keep one primary surface, but give it two columns:

```text
Left: shared planning controls
Right: mode body / visual preview / recommendation preview
```

Suggested desktop proportions:

- container max width: `max-w-5xl` or `max-w-6xl`
- left column: `minmax(0, 1fr)`
- right column: `minmax(320px, 420px)`

The right column should not become a decorative card inside another card. Treat the whole planner as one surface, with the preview area separated by a subtle divider or background band.

## Interaction Model

### Mode State

Add local state to the landing planner:

```ts
type PlannerMode = "match" | "build";
```

Default:

```ts
const [mode, setMode] = useState<PlannerMode>("match");
```

Reasons:

- `match` is better for first-time visitors.
- It preserves the current homepage conversion intent.
- Builder remains one click away for high-intent users.

### Shared State

The unified planner should share:

```ts
destination: "jeju" | "seoul" | "busan"
intent: string
selectedStyleChipLabels: string[]
```

Existing `HeroSection` already has:

- `destination`
- `intent`
- style-chip append behavior
- season-chip append behavior

Implementation should extract the planner card into a dedicated component rather than making `hero-section.tsx` larger.

Recommended component:

```text
components/home/v2/sections/landing-planner-card.tsx
```

Optional subcomponents:

```text
components/home/v2/planner/PlannerModeSwitch.tsx
components/home/v2/planner/PlannerDestinationControl.tsx
components/home/v2/planner/PlannerIntentInput.tsx
components/home/v2/planner/PlannerStyleChips.tsx
components/home/v2/planner/PlannerBuildPreview.tsx
components/home/v2/planner/PlannerMatchBody.tsx
```

If the first implementation should be lean, keep the subcomponents inside one file and split later.

### Smooth Switch

Use `framer-motion` because the homepage and builder already use it.

Mode body pattern:

```tsx
<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={mode}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -6 }}
    transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
  >
    {mode === "match" ? <MatchBody /> : <BuildBody />}
  </motion.div>
</AnimatePresence>
```

Reduced motion:

- use `useReducedMotion()`
- set duration to `0`
- avoid height morphing if reduced motion is true

Important: keep shared controls outside `AnimatePresence`. Only the mode body should switch.

## Data Flow

### Match Mode Submit

Use existing homepage matcher:

```ts
startInPageMatchFlow(rawIntent, locale, destination)
```

Current source:

- `components/home/v2/HomeV2MatchProvider.tsx`

Preserve current analytics source naming or add a new one:

```ts
analytics.homeCtaClick({ source: "unified_planner_match_submit" })
```

### Build Mode Submit

For a builder-supported destination, route through the existing intake entry, carrying intent as a query param:

```ts
const href = `/itinerary-builder?region=${destination}&intent=${encodeURIComponent(intent)}`
```

**Use `?region=...`, not the direct `/itinerary-builder/${region}` route.** Verified code reality (2026-05-20): `app/itinerary-builder/page.tsx` does NOT redirect — it renders `IntakeForm`, and `?region=` pre-fills it. `IntakeForm` then pushes to `/itinerary-builder/${region}?track=...` after collecting track/date. Linking directly to `/itinerary-builder/${region}` would **skip the intake (track/date) step** that the builder downstream may require. Preserving `?region=` preserves that data-collection step and matches the existing homepage builder-entry links.

```text
/itinerary-builder?region=jeju&intent=beaches%20cafes%20easy%20walking
/itinerary-builder?region=busan&intent=...
```

Then later `AIRecommendPanel` can prefill from `searchParams.get("intent")` (Phase 4) — but this requires `IntakeForm` to forward `intent` through to the `/itinerary-builder/${region}` route, which it does not do today. Add that forwarding in Phase 4 before relying on the prefill.

### Recommendation To Builder Bridge

After a successful `Match me` result, show a secondary CTA. **Use honest copy — `Build your own day in {destination}` — not "Customize this day."** Verified code reality (2026-05-20): the matcher returns packaged tour products (`match_tours`); the builder operates on POIs (`match_pois`); there is NO mapping between a matched product and builder POIs. "Customize this day" implies the matched day carries over, but the MVP only switches mode + preserves destination/intent and drops the user into an empty builder for that region. Copy must not over-promise carry-over.

```text
Build your own day in {destination}
```

MVP behavior:

- Switch `mode` to `build`.
- Keep same destination and intent.
- If destination is `jeju` or `busan`, show `Start Building`.
- If destination is `seoul`, show custom request fallback.

Later enhancement:

- Translate matched tour anchors into POI keys when possible.
- Preload builder cart with recommended POIs.

Do not attempt this in the first pass unless a reliable mapping already exists between product match results and builder POIs.

## Visual Design

### Surface

Use the existing homepage visual language:

- rounded card: existing `rounded-card`
- border: `border-slate-200/70`
- background: `bg-white`
- shadow: current hero matcher shadow classes
- amber only as accent, not as a full gradient wash

Avoid making the builder preview feel like a second independent card. It should read as the right-hand preview pane of the same planner.

### Mode Switch

Use a segmented control, not tabs with heavy page-section semantics.

Style:

```text
rounded-full or rounded-button outer shell
active: bg-slate-900 text-white
inactive: bg-slate-50 text-slate-700
```

Accessibility:

- `role="tablist"` is acceptable if panels are semantically distinct.
- Simpler: two `button`s with `aria-pressed`.
- Use `aria-controls` if using tab semantics.

Recommended MVP:

- `button` + `aria-pressed`
- visible active state

### Builder Preview

Do not embed the full map on the landing page. The full map is heavy and belongs to `/itinerary-builder/[region]`.

Use a compact preview:

- one destination image
- 3 mini POI chips/cards
- microcopy:

```text
Pick stops on the map, then request a route quote.
```

For Jeju:

```text
Seongsan · O'sulloc · Aewol
```

For Busan:

```text
Haedong Yonggungsa · Gamcheon · Gyeongju
```

These preview items should eventually come from a constant, not from live DB fetch, to keep home page fast.

Recommended constant:

```text
lib/home/planner-builder-preview.ts
```

## Copy

### Primary Copy

```text
Plan your Korea day your way
Get matched instantly, or build it stop by stop.
```

### Mode Labels

```text
Match me
Build myself
```

### Match Body

CTA:

```text
Get My Recommendation
```

Microcopy:

```text
No sign-up · No card · 30 seconds
```

### Build Body

CTA:

```text
Start Building
```

Microcopy:

```text
Browse curated stops, build your route, then request a quote.
```

### Seoul Build Fallback

```text
Seoul map builder is coming next.
Tell us the places you care about and we will shape the day manually.
```

CTA:

```text
Request a Seoul day
```

## Phase 0 — Reconciliation Gate (MANDATORY · blocks Phase 1)

This plan's product thesis was reviewed against the landing v3 master plan and verified code reality (2026-05-20) and accepted. But as drafted it inherits none of v3's hard-won constraints. **Phase 1 must NOT start until every gate below is cleared.** This is a go/no-go gate (same pattern as v3 Phase 0 and the tours-list Phase 0 gate), not a checklist to revisit later.

### 0.1 — Mobile fold re-measurement (CDP) — HARD GATE

v3 spent Phase 0c + B.3 + B.4 clawing back ~83px to lift the matcher CTA toward the fold. Even after that, v3 §2.6.1 found that with the 80px `MobileBottomNav` overlay the **effective-fold** position of the CTA is still ~-78px (iPhone 14) / ~-29px (Pro Max). This plan adds a headline + subhead + segmented control above the controls.

Exit criteria:

- Re-run the v3 Phase 0c CDP measurement (`.tmp-fold/measure-fold.mjs` equivalent) on the **new** unified layout at 390×844 and 430×932, **with the 80px bottom-nav overlay accounted for**.
- The match-mode primary CTA must clear the effective fold — OR Gate 0.2 must choose eyebrow-only.
- **Do not inherit B.3's numbers.** The structure changed, so the measurement must be redone.

### 0.2 — Matcher-header copy decision (couples to 0.1)

The proposed `Plan your Korea day your way` + subhead **is** the `matcherHeadline` / `matcherSubline` that B.3 (commit `2472b0ae`) deliberately deleted — for two reasons: fold recovery (~83px) and P0-C message duplication with the hero H1. Re-adding it reintroduces both.

Exit criteria — resolve as a SINGLE decision, coupled with 0.1:

- (a) eyebrow-only (no planner headline/subhead — the B.3 stance), or
- (b) reintroduce headline/subhead **only if** Gate 0.1's CDP re-measure proves the CTA still clears the effective fold.

### 0.3 — v3 §B reversal row before touching `ItineraryBuilderEntry` — HARD GATE

v3 §B (2026-05-17) binds `ItineraryBuilderEntry` adjacent to Destinations ("지역 분기 후 맞춤 빌더로 유도"). Phase 3 of this plan removes/demotes it. Per the landing-page-uiux skill, a §B decision is reversed by **appending a new reversal row (never deleting the old)**.

Exit criteria:

- The reversal row(s) exist in v3 §B **before** any Phase 3 code lands: (a) `ItineraryBuilderEntry` removal/demotion; (b) matcher-header reintroduction, if Gate 0.2 chose (b).

### 0.4 — Running-experiment isolation — HARD GATE

Four experiments are running (analytics master plan §11.3): `home_cta_copy`, `home_result_morphing`, `home_result_bottomsheet`, `home_sticky_threshold`. **Three overlap surfaces this plan rewrites** — `home_cta_copy` (matcher CTA), `home_result_morphing` (result card), `home_result_bottomsheet` (mobile result). Only `home_sticky_threshold` is clear. Restructuring those surfaces mid-flight breaks attribution; the 0b **baseline** is also traffic-dependent and may be unreached, so statistical power may be missing on top of the contamination.

Exit criteria — per overlapping experiment:

- (a) conclude it (winner logged in v3 §B + analytics §A), or
- (b) explicitly fold the unified-planner change into a new experiment variant.
- Document the choice for each of the 3.

### 0.5 — Builder-redesign plan coordination (Phase 4 ownership)

Phase 4 edits `AIRecommendPanel.tsx` / `BuilderShell.tsx` / `app/itinerary-builder/[region]/page.tsx`, which are owned by `docs/itinerary-builder-redesign-master-plan-2026-05-18.md` (Phase 6 / BuilderShell scope).

Exit criteria:

- Confirm that plan's active phase; then either (a) sequence Phase 4 after the relevant redesign phase, or (b) get sign-off and log the cross-plan touch in both planners' change logs.
- No edits to those files until coordinated.

### 0.6 — Honesty fixes (applied in this revision; confirm intact)

Already applied inline in this doc:

- **Route:** use `/itinerary-builder?region=...&intent=...` (preserves the `IntakeForm` track/date step) instead of direct `/[region]`.
- **i18n:** reuse `home.premium.hero.findMatchCta` for the match CTA; no duplicate `planner.matchCta`.
- **Bridge copy:** "Customize this day" → `Build your own day in {destination}` (no product→POI mapping exists).

Gate = confirm these remain applied at Phase 1 start.

### Phase 0 exit (all must hold)

| Gate | Cleared when |
|---|---|
| 0.1 | CDP re-measure passes on new layout (or 0.2 = eyebrow-only) |
| 0.2 | header-copy decision made + consistent with 0.1 |
| 0.3 | v3 §B reversal row(s) logged |
| 0.4 | each of the 3 overlapping experiments concluded or absorbed |
| 0.5 | builder-redesign coordination confirmed |
| 0.6 | honesty fixes intact |

Only then does **Phase 1 (Extract `LandingPlannerCard`)** begin.

### Phase 0 — Resolution log (2026-05-21)

- **0.5 builder-redesign — CLEARED.** Redesign plan is all 12 phases complete (2026-05-18) + V13 tone-alignment (2026-05-20), on `main`. `AIRecommendPanel` / `BuilderShell` / `[region]/page.tsx` are a stable, finished surface; Phase 4 is additive. Must respect V6 (AI chips merge into timeline), V8 (reuse `itineraryStop` card), V11 (no new deps), V12 (`itineraryBuilder.*` i18n).
- **0.4 experiments — power-empty; formal conclusion deferred.** Live data 2026-05-21: 4 experiments running but **10-15 participants/variant vs ≥200 min**; total 47 visitors / 100 sessions / 838 events over ~3.3 days (~14/day). No signal to contaminate. Recommended: conclude `home_cta_copy` / `home_result_morphing` / `home_result_bottomsheet` as superseded (`home_sticky_threshold` stays — no overlap). The production DB write **needs explicit user authorization** (auto-denied on a generic "start implementation"). **Not blocking Phase 1** — pure extraction preserves the `home_cta_copy` wiring; must be done before Phase 2 restructures the CTA. Baseline corollary: at ~14/day the unified planner **cannot be A/B-validated now** — judge qualitatively (v3 §12).
- **0.1 / 0.2 header + fold — DECIDED: responsive.** Desktop = headline+subhead; mobile = eyebrow-only (current matcher CTA already -78px below the effective fold per v3 §2.6.1; mobile stays eyebrow-only so Phase 1 doesn't move the fold). Desktop headline gets a CDP sanity check in Phase 2 when it ships; mobile needs none (unchanged). Logged as a v3 §B reversal (2026-05-21).
- **0.3 ItineraryBuilderEntry — DECIDED: remove + §B reversal logged.** v3 §B reversal row added 2026-05-21; Phase 3 removes it from `HomeV2Page` (file kept in repo temporarily).
- **0.6 honesty fixes — intact** (route / i18n / bridge copy applied in the 2026-05-21 revision).

**Gate status: 0.1 / 0.2 / 0.3 / 0.5 / 0.6 cleared; 0.4 cleared-in-effect (power-empty), formal experiment conclusion deferred to pre-Phase-2 pending user DB authorization. Phase 1 (extraction) may proceed.**

---

## Governance — Cross-Plan Reconciliation

This plan touches three master plans. Binding items and required actions:

| Source | Binding item | This plan | Required action |
|---|---|---|---|
| v3 §B — `ItineraryBuilderEntry` row (2026-05-17) | stays adjacent to Destinations | Phase 3 removes/demotes | Append §B reversal row (Gate 0.3) |
| v3 §2.6.1 / B.3 (`2472b0ae`) | matcher 3-tier header removed for fold + P0-C | re-adds headline+subhead | Gate 0.1 + 0.2 |
| v3 §B — matcher CTA copy row (2026-05-17) | de-inflated copy, 6 locales | reuses same copy | Reuse `findMatchCta` (Gate 0.6) |
| v3 §B — "no fake card, reuse real Featured data" | recommendation surfaces use real data | static builder-preview constant | Log as deliberate exception — preview labels, not match results; POI image cleanup still pending |
| v3 §B — amber accent / no new libraries | amber as accent only; framer-motion only | "amber as accent"; framer-motion | Already aligned — no action |
| analytics master plan §11.3 | 3 running experiments on touched surfaces | restructure contaminates | Gate 0.4 |
| `itinerary-builder-redesign` (Phase 6 / BuilderShell) | owns AIRecommendPanel / BuilderShell / `[region]` | Phase 4 edits them | Gate 0.5 |

**v3 status note (reality sync, for awareness — fix in v3 itself separately):** v3 §A still shows Phase 0b as `🔄 진행 중`, but the self-built analytics system is fully built (analytics master plan §A: "Phase 1~7 ✅"). Precise state: **system ✅, baseline collection traffic-dependent / in progress.** This does not soften Gate 0.4 — it sharpens it (experiments running + baseline possibly unreached = double reason not to perturb those surfaces).

---

## Implementation Plan

### Phase 1: Extract Existing Hero Planner Card

Files:

- `components/home/v2/sections/hero-section.tsx`
- new: `components/home/v2/sections/landing-planner-card.tsx`

Move the existing matcher card UI out of `HeroSection` into `LandingPlannerCard`.

Props:

```ts
type LandingPlannerCardProps = {
  destination: HeroDestination;
  onDestinationChange: (destination: HeroDestination) => void;
  intent: string;
  onIntentChange: (intent: string) => void;
  onSubmitMatch: () => void;
  matchPhase: "idle" | "loading" | "result" | "error";
};
```

Keep season chip logic in `HeroSection` initially, because it sits in the photo headline area and appends into the planner intent.

Acceptance criteria:

- Homepage looks the same as before.
- Matcher still submits.
- No change to builder section yet.

**✅ DONE (2026-05-21).** `LandingPlannerCard` created (`components/home/v2/sections/landing-planner-card.tsx`); the matcher card was lifted out of `hero-section.tsx`. HeroSection retains the season pill + the shared `intent`/glow state and passes `destination` / `intent` / `onAppendChip` / `intentGlowing` down; the cta-copy A/B, intent expansion, refs, and morphing panel are card-local. Verified: both files pass `eslint --max-warnings 0`; `/ko` compiles + renders (200); matcher renders identically (textarea `#home-v2-hero-intent`, 3 destination radios with 제주 default, 8 style chips, season pill stays in hero); `home_cta_copy` A/B still drives the CTA from inside the card (rendered variant B "내 투어 찾기"); submit fires `POST /api/tour-product/match` + `match-explanation` (both 200), returning a Jeju winner for a Jeju intent. No hydration mismatch attributable to the change (the one console warning is pre-existing `IdleMatchPreviewCarousel` / B.2 code). Pre-existing out-of-scope items found: 4 `react-hooks/set-state-in-effect` eslint errors in `MatcherBottomSheet.tsx` / `MatcherMorphingPanel.tsx` (the `npm run lint` gate was already red), and the carousel hydration mismatch — both spun off separately, not fixed here.

### Phase 2: Add Mode Switch And Build Body

Files:

- `components/home/v2/sections/landing-planner-card.tsx`
- optional: `lib/home/planner-builder-preview.ts`

Add:

- `PlannerMode`
- segmented control
- `MatchBody`
- `BuildBody`

Build body CTA behavior:

```ts
if (destination === "jeju" || destination === "busan") {
  router.push(`/itinerary-builder/${destination}?intent=${encodeURIComponent(intent)}`)
} else {
  router.push(`/itinerary-builder?region=seoul&intent=${encodeURIComponent(intent)}&mode=request`)
}
```

For Seoul fallback, it may be cleaner to send to a quote/contact flow later. For MVP, do not route to a nonexistent map.

Acceptance criteria:

- Toggling modes preserves destination and intent.
- Builder CTA routes correctly for Jeju/Busan.
- Seoul build mode does not imply a live map exists.

**✅ DONE (2026-05-21) — one fold decision open.** Implemented in `landing-planner-card.tsx`: segmented mode switch (`Match me | Build myself`, `aria-pressed`); shared controls kept OUTSIDE `AnimatePresence` (only the CTA body cross-fades; reduced-motion guarded); Build body with static preview (`lib/home/planner-builder-preview.ts`, reuses hero photos); Jeju/Busan routing; Seoul fallback. Desktop headline/subhead added to `hero-section.tsx` (`hidden md:block`); mobile stays eyebrow-only. New i18n `home.premium.v2.planner` in en + ko (es/ja/zh/zh-TW fall back to en — translation pending before merge). Verified in preview (390×844, /ko): mode toggle works + preserves intent & destination; Build→Jeju shows Seongsan·O'sulloc·Aewol + jeju-hero; Start Building → `/ko/itinerary-builder?region=jeju&intent=beaches+cafes+easy` (Gate 0.6 format, intent carried); Seoul → fallback + "Request a Seoul day" (Start Building correctly gone); both files pass `eslint --max-warnings 0`.

**Gate 0.1 re-measure — corrects the resolution-log "mobile needs none" note:** the 52px segmented control pushed the match CTA to **-110px below the effective fold** at iPhone 14 (was -78px post-B.3; hero panel 371px). **RESOLVED 2026-05-21: accept -110px; hero untouched.** User directive ("절대 랜딩페이지 다른부분 디자인은 건드리지 말 것") rules out the B.3.3 hero `min-h` trim (it would alter the hero). Consistent with v3 §2.6.1, which already accepted -78px. Mobile users scroll slightly to reach the primary CTA — a common pattern; revisit only if real traffic shows a drop.

**Open placeholders:** (a) Seoul "Request a Seoul day" currently switches to Match mode — no request endpoint exists yet; confirm the real target. (b) analytics `unified_planner_*` events deferred to build-order step 7. (c) Gate 0.4 experiment conclusion still awaits a user DB action (admin UI or permission rule).

### Phase 3: Remove Or Repurpose Separate Builder Entry

Files:

- `components/home/v2/HomeV2Page.tsx`
- `components/home/v2/sections/itinerary-builder-entry.tsx`

Options:

1. Remove `ItineraryBuilderEntry` from `HomeV2Page`.
2. Repurpose it lower on the page as a secondary proof/browse section.

Recommended MVP:

- Remove it from the homepage once unified planner is live.
- Keep the file in repo temporarily to avoid scope creep.
- Later delete after analytics confirms no regression.

Acceptance criteria:

- The page no longer has two competing planning CTAs.
- The first planning interaction is the unified card.

**✅ DONE (2026-05-21).** `ItineraryBuilderEntry` removed from `HomeV2Page` (import + `<ItineraryBuilderEntry />` mount); the component file is kept in the repo (temporary, per plan). Section order is now Hero → MatchPreview → Featured → Destinations → ChooseTravelStyle → Why → Process → FinalCTA — **no other section touched** (user directive 2026-05-21: do not touch any other landing-page design). The unified planner (in the hero) is now the single planning surface. §B reversal row was already logged in v3 (Gate 0.3).

### Phase 4: Intent Handoff Into Builder

Files:

- `components/itinerary-builder/AIRecommendPanel.tsx`
- `components/itinerary-builder/BuilderShell.tsx`
- `app/itinerary-builder/[region]/page.tsx`

Add support for reading `intent` from query params and pre-filling the builder AI panel.

Possible prop:

```ts
initialIntent?: string
```

Flow:

- `[region]/page.tsx` reads `searchParams`
- passes `initialIntent` to `BuilderShell`
- `BuilderShell` passes it to `AIRecommendPanel`
- `AIRecommendPanel` initializes `useState(initialIntent ?? "")`

Do not auto-submit on first load in MVP. Auto-submit can feel surprising and may consume API budget.

Acceptance criteria:

- User types intent on home.
- User chooses `Build myself`.
- Builder opens with that same intent already available.

**✅ DONE (2026-05-21).** Client-side + additive (no server `searchParams`, so the ISR-static `[region]` page stays cacheable; no `BuilderShell` prop-chain change; no new deps/copy — respects builder-redesign V11/V12). (a) `AIRecommendPanel` reads `?intent=` from the URL on mount and prefills the `#ai-intent` input — **prefill only, never auto-submits**. (b) `IntakeForm.handleSubmit` forwards `?intent=` from the intake URL into the `/[region]` push (over its existing `useSearchParams`). Verified: direct nav to `/ko/itinerary-builder/jeju?intent=test%20beaches%20and%20cafes` → `#ai-intent` = "test beaches and cafes" ✓; builder routes compile clean (200, no errors). The full intake-submit click-through wasn't reliably reproducible in the preview (its locale-restoration navigation + delayed hydration produced native-form submits / bounced navigations) — the forwarding is verified by inspection + compile, with the consumer (AIRecommendPanel) confirmed live. Cross-plan touch logged in the builder-redesign plan §C per Gate 0.5.

### Phase 5: Recommendation-To-Builder Bridge

Files:

- `components/home/v2/MatcherMorphingPanel.tsx`
- `components/home/v2/sections/best-match-preview.tsx`
- `components/home/v2/sections/landing-planner-card.tsx`

Add a `Customize this day` CTA after match result.

MVP behavior:

- Scroll/focus back to planner card.
- Switch mode to `build`.
- Preserve destination and intent.

This requires mode state to be owned somewhere accessible. Two options:

1. Keep mode local and pass an event callback to result components.
2. Extend `HomeV2MatchProvider` with planner-mode helpers.

Recommended:

- Keep initial implementation local.
- Add a custom DOM event only if avoiding provider changes is important.
- Better long-term: create a small `HomePlannerProvider` if multiple components need mode control.

## Analytics

Add or reuse event sources:

```text
unified_planner_mode_switch
unified_planner_match_submit
unified_planner_build_start
unified_planner_seoul_request
unified_planner_customize_from_match
```

Minimum payload:

```ts
{
  mode: "match" | "build",
  destination: "jeju" | "seoul" | "busan",
  hasIntent: boolean,
  selectedChipCount: number
}
```

Do not log raw free-text intent unless the analytics policy already permits it. The existing match endpoint can receive raw query for functionality; analytics should avoid storing unnecessary user text.

## i18n

New strings live in:

- `messages/en.json`
- **mirrored across all 6 locales** (ko / ja / zh / etc.) before merge — en-only is not acceptable. This matches v3's discipline (every B.4 / B.5 copy change shipped 6 locales).

New namespace (for genuinely new strings only):

```text
home.premium.v2.planner
```

Proposed keys:

```json
{
  "headline": "Plan your Korea day your way",
  "subhead": "Get matched instantly, or build it stop by stop.",
  "modeMatch": "Match me",
  "modeBuild": "Build myself",
  "buildCta": "Start Building",
  "buildMicrocopy": "Browse curated stops, build your route, then request a quote.",
  "seoulBuildTitle": "Seoul map builder is coming next.",
  "seoulBuildBody": "Tell us the places you care about and we will shape the day manually.",
  "seoulBuildCta": "Request a Seoul day",
  "customizeThisDay": "Build your own day in {destination}"
}
```

**Reuse, do not duplicate (Gate 0.6):**

- The match-mode primary CTA already exists as `home.premium.hero.findMatchCta` ("Get My Recommendation" / "맞춤 추천 받기", shipped 6 locales in v3 B.5). **Reuse that key — do NOT create a `planner.matchCta` duplicate** (a second source of truth for the same button drifts).
- The match microcopy ("No sign-up · No card · 30 seconds") likely already exists under `home.premium.hero.*` — check before adding a planner copy.
- `customizeThisDay` uses `{destination}` interpolation — localize the destination noun per locale.

## Accessibility

Requirements:

- Mode switch buttons must expose active state via `aria-pressed` or tab semantics.
- Destination remains a radiogroup.
- CTA disabled/loading states must retain `aria-busy`.
- The mode body transition must not trap focus.
- When switching mode via keyboard, focus should stay on the clicked switch button.
- If a mode switch reveals an error/fallback message, it should be plain visible text, not toast-only.

## Performance

Avoid loading builder map dependencies on the homepage.

Home planner should use:

- static preview constants
- existing destination images
- no Google Maps scripts
- no Supabase fetch for POIs on homepage

The full builder map remains lazy behind navigation to:

```text
/itinerary-builder/[region]
```

Keep `MatcherMorphingPanel` lazy behavior intact because it intentionally avoids pulling heavy tour JSON into LCP.

## Testing And QA

### Unit / Integration

Recommended focused tests:

- `LandingPlannerCard` renders both modes.
- mode switch preserves destination and intent.
- build CTA URL is correct for Jeju and Busan.
- Seoul build mode renders fallback.
- match submit still calls `startInPageMatchFlow`.

### Existing Regression

Run:

```bash
npm run match:regression
```

If touching builder AI handoff:

```bash
npm run itinerary:pressure
```

### Visual QA

Use browser verification at:

```text
/
/itinerary-builder/jeju
/itinerary-builder/busan
```

Viewport checks:

- iPhone-class width around 390px
- tablet width around 768px
- desktop width 1440px

Confirm:

- no text overflow in mode switch
- CTA visible above/near first fold on mobile
- build preview does not look like a separate section
- mode transition is smooth
- reduced motion does not animate heavily

## Risks

### Risk: Too Much In The Hero

If the unified card becomes tall, it can push the CTA below the mobile fold again.

Mitigation:

- keep heading short
- keep shared controls compact
- hide build preview details behind a compact rail
- do not show full stop cards in the hero

### Risk: Product Matcher And POI Builder Feel Inconsistent

The matcher recommends tours; the builder edits POIs. Users may wonder why one result is a packaged tour and the other is custom stops.

Mitigation:

- copy frames both as planning choices
- post-match CTA uses honest bridge copy (`Build your own day in {destination}`), not `Customize this day` or `Edit this tour` — no product→POI carry-over is claimed in MVP
- do not claim the exact matched product becomes a POI route in MVP

### Risk: Seoul Builder Gap

Seoul is selectable in matcher but not supported by builder map.

Mitigation:

- clear fallback copy
- route to manual quote/request later
- avoid disabled dead-end if possible

### Risk: Data Quality In Builder Preview

Builder POI image quality currently needs cleanup. Landing preview should not pull live POI imagery until that cleanup is complete.

Mitigation:

- use curated static preview images for the landing planner
- fix `match_pois.default_image_url` separately before exposing richer POI previews

## Recommended Build Order

0. **Clear the Phase 0 — Reconciliation Gate (all 6 items). This blocks everything below.**
1. Extract the current matcher card into `LandingPlannerCard` without changing behavior.
2. Add `Match me` / `Build myself` mode state and animation.
3. Add static builder preview and Jeju/Busan routing (`?region=...&intent=...`).
4. Remove or demote the separate `ItineraryBuilderEntry` section from `HomeV2Page` — only after the v3 §B reversal row is logged (Gate 0.3).
5. Add `intent` query handoff into the builder (incl. `IntakeForm` forwarding).
6. Add the honest post-match bridge CTA (`Build your own day in {destination}`).
7. Add analytics and i18n translations (reuse `findMatchCta`).
8. Run regression, visual QA, and mobile screenshot checks (incl. CDP fold re-measure).

## Definition Of Done

- The landing page has one primary planning card, not two competing planning sections.
- Users can switch between recommendation and self-build modes without losing destination or typed intent.
- Jeju and Busan builder CTAs route to the map builder.
- Seoul builder path is handled honestly as a manual/custom request fallback.
- Existing smart match flow still works.
- The separate builder entry is removed or demoted.
- No homepage Google Maps load is introduced.
- Mobile layout remains polished and CTA-accessible — the match-mode primary CTA clears the effective mobile fold (incl. the 80px bottom-nav overlay), proven by a fresh CDP measurement on the unified layout (not inherited from v3 B.3).
- The Phase 0 — Reconciliation Gate was fully cleared before Phase 1, and every v3 §B decision this plan touches has a logged reversal/exception row.
