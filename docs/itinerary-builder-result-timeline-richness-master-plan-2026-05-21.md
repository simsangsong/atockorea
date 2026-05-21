# Itinerary Builder — Result Timeline Richness Master Plan (V2.1 · tour-product parity)

> **Single source of truth** for the post-V2 follow-up track that brings the
> `/itinerary-builder/*` **result surfaces** up to the richness of the
> tour-product detail page's `itineraryStop` timeline.
>
> **Why this plan exists:** The V2 redesign
> (`docs/itinerary-builder-redesign-master-plan-2026-05-18.md`) shipped all 12
> phases, but two of its binding decisions were under-delivered:
> - **V8** ("reuse the tour-product `itineraryStop` card verbatim") actually
>   shipped as a **56×56 single-thumbnail one-line row** (`ResultTimeline.tsx`
>   `SortableStopCard`), not the magazine-style multi-photo card.
> - **V6** ("AI result merges INTO the timeline as a Suggested stripe") shipped
>   as a **small badge horizontal-drag rail INSIDE `AIRecommendPanel`**.
>
> User feedback 2026-05-21 (with 2 screenshots) was explicit and strong: the
> result reads as "tiny badges you drag left-right, can't tell what's what,"
> and the page tone "plays totally differently from the main site." The user
> wants the **tour-product timeline feel**: stops composed from several photos,
> shown large, **tap → detail drawer**, unified with the main design tone.
>
> This plan does NOT reopen the V2 redesign (it's complete). It is a new track.
> Read this whole doc before touching anything under
> `components/itinerary-builder/` or `app/itinerary-builder/`.

---

## A · Status dashboard

| Field | Value |
|---|---|
| **Current phase** | **🔄 R1 (CORE) in progress — timeline card → tour-product StopCard + tap→drawer (started 2026-05-21). R0 ✅.** |
| **Active track** | Result Timeline Richness (RR1–RR7 decisions; Phases R0–R3) |
| **Blocked on** | — (ready to start R0/R1) |
| **Last updated** | 2026-05-21 |
| **Last commit touching this track** | `aeb296b0` (R0 data-reality verdict, 2026-05-21) |
| **Owner** | simsangsong |
| **Parent plan** | `docs/itinerary-builder-redesign-master-plan-2026-05-18.md` (V2 redesign, COMPLETE — V1–V13 binding decisions still apply as the floor) |
| **Skill** | reuse the existing `itinerary-builder-redesign` skill (it governs `components/itinerary-builder/*`); this plan is the active sub-track. |

### Phase progress

| Phase | Status | Started | Done | Commit |
|---|---|---|---|---|
| R0 — Data reality check (images[] depth) — GATE-lite | ✅ complete | 2026-05-21 | 2026-05-21 | (R0 planner sync) |
| R1 — Timeline card → tour-product `StopCard` pattern + tap→drawer | 🔄 in progress | 2026-05-21 | — | — |
| R2 — AI suggest result → same large timeline (kill badge rail) | ⏸ not started | — | — | — |
| R3 — Page tone/layout unification with main site + curated-stops cleanup | ⏸ not started | — | — | — |

Legend: ⏸ not started · 🔄 in progress · ✅ complete · ⚠️ blocked · ❌ abandoned

---

## B · Decision log (RR-series)

These extend, never override, the parent plan's V1–V13. Append reversal rows; never delete.

| Date | ID | Decision | Reason |
|---|---|---|---|
| 2026-05-21 | RR1 | **Builder timeline card = port the tour-product `StopCard` pattern** (`TourTimelineSection.tsx` lines ~20–137): horizontal multi-photo compose strip (`photos.map`, ~80×56 thumbs, `scrollbar-hide`) + numbered node + vertical connector + time·duration row + large title (~15px semibold) + category + `ChevronRight`. This finally delivers parent **V8**. | User directive 2026-05-21 + screenshot 2 is literally this component. |
| 2026-05-21 | RR2 | **Card tap → reuse `POIDetailModal`** (already a Phase-8 magazine-spread drawer, props `{poi, inCart, onClose, onAdd, onRemove, onFocus}`). Do NOT build a new drawer (parent V11: no new deps / no new card variant sprawl). Requires lifting a `detailPoi` state into `BuilderShell` (or passing `onOpenDetail` into `ResultTimeline`). | Drawer already exists + carries the rich `MatchPoiRow` content (`description`/`highlights`/`why_on_route`/`smart_notes`/`visit_basics`/`convenience`). |
| 2026-05-21 | RR3 | **AI suggest result renders as the SAME large card timeline**, not the badge horizontal-drag rail. Realises parent **V6** properly: the suggestion previews as stacked large cards with one-click Apply. | User: "tiny badges dragged left-right" is the #1 complaint. |
| 2026-05-21 | RR4 | **Compose photos = as many as `MatchPoiRow.images[]` has** (0 → fallback letter/icon, 1 → single, N → strip). POI image quality/qty improvement is a SEPARATE track (POI data-quality), not this one. | `images?: string[]` exists (Phase 6.5 enrichment) but depth varies; R0 measures it. |
| 2026-05-21 | RR5 | **Page tone/layout unified with main site** (frosted-white-over-pastel-mesh, slate-900 charcoal, soft layered shadows — same language as home v2 / tours-list) — strengthening parent V13 where it still reads off. | User: "page tone plays totally differently from the main site; layout not liked." |
| 2026-05-21 | RR6 | **Inherit parent constraints unchanged:** V11 (no new deps — framer-motion / lucide / dnd-kit / @react-google-maps/api only), V12 (i18n via `messages/en.json` `itineraryBuilder.*` + translate script, all 6 locales before merge), V8/G.8 (presentation-only — NO schema change, NO new API route, NO new table), V5 (amber = sequence wayfinding only, ≤5 primaries/screen). | Continuity with the shipped redesign. |
| 2026-05-21 | RR7 | **Preserve drag-to-reorder + remove** on the new large card (dnd-kit). Card BODY tap = open drawer; a distinct drag handle + a distinct remove control stay. Tap vs drag gesture must not conflict (handle owns drag; body owns tap). | Reorder is existing builder value; don't regress it for richness. |

---

## C · Change log

| Date | Commit | Change |
|---|---|---|
| 2026-05-21 | (R1 start) | **Phase R1 started + VERIFY-FIRST confirmed.** (1) `POIDetailModal` currently mounts **inside `POICatalogGrid`** (`detailPoi` state L33, `<POIDetailModal>` L190–207, opened by the "Details" button L141–150); `BuilderShell` has NO modal/state. → R1 lifts ONE modal to `BuilderShell` + passes `onOpenDetail(poi)` to BOTH `ResultTimeline` and `POICatalogGrid` (RR-R3 single-instance). (2) Modal props = `{poi, inCart, onClose, onAdd, onRemove, onFocus}` — self-contained (own gallery from `images`/`default_image_url`, Esc-close, body-scroll-lock); `onAdd`/`onFocus` close, `onRemove` stays open. (3) `AIRecommendPanel` result = badge `<ol>` rail (L283–325) over `result.per_poi_score[]` (`{poi_key,name_en,total,rationale[]}`) + "Load into cart"→`onAccept(recommended)` — R2 swaps the rail for the R1 card via `poiByKey` lookup (data sufficient). **R1 design decisions:** (a) *time→duration* — builder has no `time`/`duration` string, only `default_stay_minutes` → card shows `formatMinutes(stay)` in the duration row, NO fake clock-time. (b) *gesture (RR7)* — card body = `<button onClick=onOpenDetail(poi)>` (compose strip + header); drag handle + remove are ABSOLUTE siblings (not nested) with `stopPropagation`; handle owns drag (dnd-kit listeners), body owns tap. (c) *bi-sync (V4)* — `<li>` keeps `data-poi-card`, `onMouseEnter/Leave`→`setActive(...,"timeline")`, `activeKey===poi_key`→amber ring-2. (d) *fallback (RR4)* — 0 images → one slate first-letter thumb (NOT amber, per V5). (e) *no new user-facing copy* → translate script not required for R1 (RR6 satisfied; card uses data + existing `formatMinutes` / `t("remove")`). (f) Footer / EmptyState / DriveChip / connector / sequence node / dnd wiring preserved verbatim. |
| 2026-05-21 | (R0 planner sync) | **Phase R0 ✅ — data-reality measured (builder-cluster accurate).** `jeju` (25 POIs): 3+ imgs ×16, 2 imgs ×2, 1 img ×1, 0 imgs ×6 (24% no-image), `default_image_url` ×19, avg 3.36, max 12. `busan` cluster (busan/yangsan/gyeongju/ulsan/miryang = 20 POIs): 3+ imgs ×15, 2 imgs ×3, 1 img ×1, 0 imgs ×1, default ×19, avg 3.75, max 14. **Combined 45 POIs: 69% ≥3 imgs, 80% ≥2 imgs, 16% (7) no-image. VERDICT = GO** — compose strip (RR1) justified by real data; RR4 fallback (letter/icon) covers the 7 no-image POIs; drawer carries full gallery regardless. No code shipped (gate-lite). |
| 2026-05-21 | (R0 fact corrections) | **Fact corrections to §J/RR4 (logged here; §J frozen rows untouched):** (1) `match_pois.images` is **jsonb**, NOT `string[]`/text[] — measure via `jsonb_array_length(...)`; R1 card must coerce jsonb→`string[]` safely (guard `Array.isArray`). (2) Builder **busan page = 5-region cluster** `["busan","yangsan","gyeongju","ulsan","miryang"]` = 20 POIs (`lib/itinerary-builder/regions.ts:17–20`), NOT just `busan` (11). `jeju` cluster = `["jeju"]` = 25. (3) Long-form orphan regions ("Jeju East — …", attraction=false) do NOT leak into the builder (cluster matches exact `jeju`). (4) `is_operational` is false for ALL rows — not a builder filter (builder uses `.in("region", cluster)` only). (5) The 7 no-image POIs (`biff_square`, `hallasan_eorimok_trail`, `hallim_park`, `jeju_cruise_port`, `jeju_tangerine_picking_experience`, `jeonnong_ro_cherry_blossom_street`, `noksan_ro_gasiri_blossom_road`) — 6 overlap the existing POI data-quality Track B backlog; `jeju_cruise_port` is an intentional return-marker. Photo backfill stays on that separate track (RR4 + §E). |
| 2026-05-21 | (this doc) | Plan authored. Diagnosis frozen in §J. RR1–RR7 logged. Phases R0–R3 laid out. No code yet. |

---

## D · Working protocol

Same discipline as the parent plan:
1. **Read this whole doc** + the parent plan's §B (V1–V13) before editing builder files.
2. **Confirm active phase** (§A). Phases run R0 → R1 → R2 → R3. One phase at a time; cut-line after each.
3. **Per-phase**: every visible change = a commit with a one-line §C entry + the §F checkbox + §A row updated in the SAME commit.
4. **i18n**: new copy → `messages/en.json` `itineraryBuilder.*` → run `scripts/translate-itinerary-builder-messages.mjs` → 6-locale parity before merge (RR6/V12).
5. **Per-phase acceptance is mandatory** before ✅. Paste evidence (screenshot path / curl / measurement) into §C.
6. **Code reality > plan assertion.** Line numbers below were captured 2026-05-21; re-locate before editing. Verify the VERIFY-FIRST items in §J.
7. **Out-of-track work** → log to §E, ask before pulling in. The builder-map google-maps crash is a SEPARATE track ([[project_builder_map_gmaps_compat_crash]]) — do not fold it in here unless R3 layout work forces a map-area touch.

---

## E · Scope creep / parked

| Date | Idea | Why parked |
|---|---|---|
| 2026-05-21 | POI photo quality/quantity backfill so compose strips have ≥3 photos | Separate POI data-quality track; RR4 says use what exists |
| 2026-05-21 | Builder-map google-maps compat crash (Polyline setAt / marker getRootNode) | Separate track [[project_builder_map_gmaps_compat_crash]]; not a result-richness concern |
| 2026-05-21 | Per-stop weather / day-arc / drive-vehicle-tier enrichments | Parent plan §E parked items; revisit post-RR |

---

## F · Phase plan (R0 → R3)

### Phase R0 — Data reality check (½ day) — GATE-lite
**Deliverable:** Know how many photos real builder POIs actually have, so RR1's compose strip isn't designed for data that doesn't exist.
**Tasks:**
- [x] Query `match_pois` for jeju + busan: distribution of image count (0 / 1 / 2 / 3+) and `default_image_url` presence. ⚠ `images` is **jsonb** → measured via `jsonb_array_length` (not `array_length`). Measured against the real builder **clusters** (busan = 5 regions), not raw `region='busan'`. Numbers in §C.
- [x] Verdict: **most POIs have ≥2 images (80%), 69% have ≥3 → compose strip is worth it as-is.** R1 proceeds with the multi-photo strip; RR4 fallback (letter/icon) handles the 16% (7) no-image POIs; photo backfill flagged to the POI data-quality track.
**Acceptance:** ✅ distribution numbers + fact corrections pasted into §C (2026-05-21 rows); ✅ GO note for R1 below.
**Cut-line:** informs R1's photo layout; no code shipped. **→ R1 photo layout = compose strip when `images.length ≥ 1`, fallback letter/icon when 0; drawer always carries full gallery.**

### Phase R1 — Timeline card → tour-product StopCard pattern + tap→drawer (1.5 day) — CORE
**Deliverable:** `ResultTimeline` cards become the large compose-photo card; tapping a card opens `POIDetailModal`.
**Tasks:**
- [ ] Extract/port the `StopCard` visual from `TourTimelineSection.tsx` into a builder card (multi-photo strip + numbered node + connector + time/duration + large title + category + chevron). Keep it driven by `MatchPoiRow` (photos = `images[]` ?? `[default_image_url]`).
- [ ] Map `MatchPoiRow` → card fields: `images[]`→photo strip, `name_en`/`name_ko`→title, `category`→category line, `default_stay_minutes`→duration chip. (No `time` field in builder — omit clock-time or compute cumulative; decide in R1, log in §C.)
- [ ] Preserve RR7: distinct drag handle (dnd-kit) + distinct remove (Trash) controls; card body tap = `onOpenDetail(poi)`.
- [ ] Lift `detailPoi` state into `BuilderShell` (or add `onOpenDetail` prop to `ResultTimeline`) and render the existing `<POIDetailModal>` with `{poi, inCart, onClose, onAdd, onRemove, onFocus}`. **VERIFY FIRST:** where `POIDetailModal` currently opens (likely inside `POICatalogGrid`) — unify so both grid + timeline use one modal instance.
- [ ] Keep bi-sync (parent V4): card hover/active still drives the map pin (`useActiveStop`).
- [ ] i18n any new copy (RR6).
**Acceptance:** screenshot of timeline with 3 stops as large compose cards; tap opens drawer; drag reorder still works; remove works; map sync intact; type-check + eslint clean.
**Cut-line:** the user's #1 and #2 complaints (small cards, no tap-drawer) are resolved.

### Phase R2 — AI suggest result → same large timeline (1 day)
**Deliverable:** AI "suggest your day" result stops render as the R1 large card timeline (preview), not the badge horizontal-drag rail. One-click Apply loads them into the itinerary.
**Tasks:**
- [ ] **VERIFY FIRST:** read `AIRecommendPanel.tsx` result rendering (the "3 stops matched · Apply this day" + badge rail) — identify the suggested-POI list shape.
- [ ] Render suggested stops using the R1 card (read-only / preview variant — no drag, Apply instead of remove), per parent V6 (merge into timeline).
- [ ] Keep "Get another suggestion" + "Apply this day". Tap a suggested card → drawer (reuse RR2).
- [ ] i18n (RR6).
**Acceptance:** AI result shows large cards (no badge drag); Apply populates the itinerary timeline; screenshot; type-check + eslint clean.
**Cut-line:** the badge-rail complaint is gone.

### Phase R3 — Page tone/layout unification + curated-stops cleanup (1 day)
**Deliverable:** Builder region page reads as the same design system as the main site; curated-stops surface stops feeling like a foreign carousel.
**Tasks:**
- [ ] Audit builder region page surfaces vs home v2 / tours-list tone (frosted white over pastel mesh, slate-900, soft shadows). Close remaining gaps (RR5, strengthening V13).
- [ ] `POICatalogGrid` "Curated stops" — reconcile the horizontal carousel feel with the main grid language (decide: vertical grid vs. restrained rail; log in §C).
- [ ] Layout pass: spacing/hierarchy so map + timeline + curated-stops read as one canvas, not three foreign widgets.
- [ ] i18n (RR6).
**Acceptance:** side-by-side screenshots (builder vs home v2) showing tonal match at 390 + 1440; type-check + eslint clean.
**Cut-line:** the "plays differently from the main site" complaint is resolved.

---

## G · Cross-cutting
- **i18n** (RR6/V12): all new strings through `messages/en.json` `itineraryBuilder.*` + translate script, 6 locales before merge.
- **Amber discipline** (V5): amber stays sequence-wayfinding only (numbered node, polyline, connector). New large cards must not add amber surface decoration.
- **No new deps** (V11). No schema/API changes (V8/G.8).
- **Reduced motion**: honor `useReducedMotion()` / `motion-reduce:` on any new card transitions (parent precedent).
- **Builder-map crash is OUT of scope** — separate track.

---

## H · Risks
| ID | Risk | Mitigation |
|---|---|---|
| RR-R1 | POIs have ≤1 image → compose strip looks empty | R0 measures first; RR4 fallback (single photo large + drawer carries rest); flag photo backfill to data-quality track |
| RR-R2 | Tap (open drawer) vs drag (reorder) gesture conflict on the large card | RR7: drag handle owns drag, card body owns tap; dnd-kit activation distance already 5px |
| RR-R3 | Lifting `detailPoi` to `BuilderShell` double-renders modal if grid also owns one | R1 unifies to ONE modal instance (VERIFY-FIRST) |
| RR-R4 | Large cards push mobile timeline very tall | R3 layout pass; consider compact density knob; sticky map already handles scroll |
| RR-R5 | Touching result surfaces overlaps the still-relevant parent V4 bi-sync | Keep `useActiveStop` wiring on the new card (R1 task) |

---

## J · Diagnosis (frozen) + code reality snapshot (2026-05-21)

**The gap (frozen):** parent V8/V6 under-delivered — see top-of-doc. Screenshots: current = small badge drag rail (AI) + 56px thumbnail rows (timeline) + foreign-feeling carousel + map crash banner; target = tour-product `itineraryStop` timeline (compose photos, large, tap→drawer).

**Code reality (re-verify line numbers before editing):**
- `components/itinerary-builder/ResultTimeline.tsx` — `SortableStopCard` (~L189–302) is the 56×56 single-thumb one-line row to REPLACE. Footer/empty-state/drive-chip/dnd wiring stays. Uses `useActiveStop` (V4 bi-sync) — preserve.
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourTimelineSection.tsx` — `StopCard` (~L20–137) is the PORT SOURCE (compose strip + node + connector + time/duration + title + category + chevron; body `onClick` → drawer). `TourStopDetailDrawer` is its drawer (reference; builder uses `POIDetailModal` instead).
- `components/itinerary-builder/POIDetailModal.tsx` — `export default function POIDetailModal({ poi, inCart, onClose, onAdd, onRemove, onFocus })` (L47); magazine spread; `poi.images` gallery (L48). REUSE for RR2 tap-drawer.
- `components/itinerary-builder/BuilderShell.tsx` — assembles `AIRecommendPanel` (L136) + `ResultTimeline` (L144) in the rail + `POICatalogGrid` (L161) full-width. **VERIFY-FIRST:** no `detailPoi`/`setDetail` here — find where `POIDetailModal` currently mounts (likely inside `POICatalogGrid`); R1 lifts/unifies it.
- `components/itinerary-builder/AIRecommendPanel.tsx` — owns the AI suggest badge rail (R2 target). VERIFY-FIRST: result list shape.
- `components/itinerary-builder/POICatalogGrid.tsx` — "Curated stops" surface (R3). Likely also opens `POIDetailModal` via a "Details" button.
- `lib/itinerary-builder/types.ts` — `MatchPoiRow` has `images?: string[]`, `description`, `highlights`, `why_on_route`, `smart_notes`, `visit_basics`, `convenience`, `category`, `default_stay_minutes`, `name_en`, `name_ko` — enough for both the compose card and the drawer. No `time` field (decide cumulative-time vs omit in R1).

---

## K · Next-session master prompt

Paste this as the first message next session to start cold:

> 빌더 결과 타임라인 리치니스 트랙 시작하자. `itinerary-builder-redesign` skill을 띄우고, 부모 플랜의 V1–V13 결정을 floor로 존중하되, 이 후속 트랙의 마스터플랜 `docs/itinerary-builder-result-timeline-richness-master-plan-2026-05-21.md`를 끝까지 읽어줘. 그 다음 §F Phase R0(데이터 reality — match_pois.images 장수 분포)부터 진행하고, R1(ResultTimeline 카드를 tour-product StopCard 패턴 + 탭→POIDetailModal drawer로 교체)로 넘어가. §J의 VERIFY-FIRST 항목(POIDetailModal이 현재 어디서 열리는지, AIRecommendPanel 결과 구조)을 편집 전에 코드로 재확인하고, RR6(i18n 6locale + 새 deps 금지 + 스키마 변경 없음)·RR7(드래그/삭제 보존, 본체 탭=drawer)·V5 amber 규율을 지켜. 각 Phase는 커밋마다 플랜 §A/§C/§F 동기화 + acceptance 증거(스크린샷). 빌더 맵 google-maps 크래시는 별도 트랙이니 이 트랙에서 건드리지 마. 진행상황은 한국어로 보고.
