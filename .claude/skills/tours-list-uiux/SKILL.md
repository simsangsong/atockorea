---
name: tours-list-uiux
description: Drives all work on AtoC Korea's tour catalogue page (`/tours/list`) UI/UX upgrade — Catalogue Hero (240→88 collapsing magazine cover), Contextual Vignette Band (destination 7-accent inheritance from hub), Sticky Filter Rail格상 (ivory + amber + h-11), Active Filter Chip Strip, Results Meta Strip + view toggle, Editorial 3-up grid + 6th-slot Editorial Insert, Conversion Rescue Band (28+ cards), 3-action Empty State Recovery, ivory + amber + italic-serif magazine tone, anti-downgrade protection. Wires every task back to the master planner at `docs/tours-list-uiux-master-plan-2026-05-20.md` so phases advance in order (0 gate → 1 → 2 → 3 → 4 → 6, 5 deferred), B1–B17 binding decisions are honored, code reality is verified, scope creep is parked instead of silently absorbed, and the card visual assets (film grain + vignette + Vogue filter + warm shadow + spring tap) are preserved untouched. Phase 0 is a go/no-go gate — do NOT start Phase 1 until §6.0 checklist 7 items all pass + user approves. Invoke any time the user mentions (in English or Korean) — tours list / tours catalogue / 투어 리스트 / 투어 목록 / 투어 카탈로그 / 카탈로그 페이지 / 카탈로그 / `/tours/list`, catalogue hero / 카탈로그 히어로 / 매거진 표지 / collapsing hero / sticky hero, filter rail / 필터 바 / 필터 레일 / sticky filter, active filter chip / 활성 필터 칩 / dismissible chip / 필터 칩 strip, results meta / 결과 메타 / showing of, view toggle / 뷰 토글 / editorial compact, contextual vignette / 컨텍스추얼 비네트 / destination band / 도시별 배너, editorial insert / 에디토리얼 인서트 / 큐레이터 컷 / editor's pick insert / season note, conversion rescue / 컨버전 레스큐 / rescue band / 빌더 동선 분기, empty state recovery / 빈 상태 복구 / 3-action recovery, destination 7-accent / volcano harbor palace ocean temple blossom signature, ivory amber base / 아이보리 amber / 매거진 톤, anti-downgrade guard / 다운그레이드 가드 / flat 흑백 금지 / 단색화 금지, TourListCard preservation / 카드 자산 보존 / film grain 보존 / 비네트 보존, the tours list master plan / 투어 리스트 마스터 플랜 / 카탈로그 마스터 플랜 / 'read the tours list plan' / '마스터 플랜 읽어줘 (카탈로그 관련)', or any phase labeled Phase 0 / Phase 1 / Phase 2 / Phase 3 / Phase 4 / Phase 5 / Phase 6 in tours-list context (these are unique within this plan — itinerary-builder/landing-page/tour-product-detail use different phase labels). ALSO auto-invoke when the user opens a session and asks to start/continue the tours list master plan or its phases, or when editing any file under `components/tours-list/` or `app/tours/list/`.
---

# Tour Catalogue (`/tours/list`) UI/UX Upgrade skill

You are working inside the atockorea project's "tour catalogue page (`/tours/list`) UI/UX upgrade" feature. The master planner is `docs/tours-list-uiux-master-plan-2026-05-20.md`. **It is the single source of truth for Phase order, binding decisions, scope, anti-downgrade guards, and rollback triggers.**

The plan was created because `/tours/list` is the only consumer page in the site that is NOT magazine-tone — the hub (`/tours`) and detail (`/tour-product/[slug]`) both reached premium magazine tone, but list remained an admin-style search form. The plan elevates list to match the hub's magazine identity while **strictly preserving** the existing `TourListCard` visual assets (film grain / vignette / Vogue filter / warm shadow / spring tap — these are NOT to be touched).

## Step 0 — Always do this first

1. Read `docs/tours-list-uiux-master-plan-2026-05-20.md` end-to-end. Do NOT skim. Especially:
   - **§A 상태 대시보드** — find the currently active Phase (🔄)
   - **§B 결정 로그 (B1–B17)** — binding decisions you cannot reverse silently. **B1 (ivory+amber base) / B2 (카드 자산 보존) / B11 (scroll-freeze 가드) / B17 (Phase 0 게이트) are the four永구 locks.**
   - **§D 보류 아이디어** — parked ideas; do NOT start any of these without user approval
   - **§6 Phase별 실행 계획** — the active Phase's sub-tasks
   - **§8 안티 다운그레이드 가드** — absolute NO list (8.1) and absolute DO list (8.2)
   - **§9 가족 컬러 약속** — cross-page color/tone inheritance promises
   - **§10 롤백 트리거** — automatic rollback thresholds
   - **§12 안 할 일 (AP1–AP20)** — anti-patterns to refuse
2. From §A, identify the active Phase (🔄). If none is active, the state is "between phases — awaiting direction." Do NOT pick a Phase yourself; ask the user which Phase to begin.
3. **For Phase 1 entry specifically: verify Phase 0 ✅ first.** If §A shows Phase 0 not ✅ but user wants Phase 1, refuse + execute Phase 0 first (B17 binding).
4. From the active Phase's §6 sub-checklist, identify the next unchecked task. That's the next thing you do.
5. **Verify code reality before editing.** §1 (코드 실사 스냅샷) captures the state as of 2026-05-20. Before claiming any component "does X" or "doesn't do Y", re-read the actual file. If reality diverges from §1, update §1 with a "사실 수정" entry and log in §C.

## Working rules (priority order)

1. **Never deviate silently.** If the user asks for something not in the active Phase's task list:
   - (a) It belongs to a later Phase → say "this is Phase N work; we're on Phase M" and ask whether to switch (which means logging the switch in §A + §B).
   - (b) It's genuinely new scope → add it to §D scope creep registry and ask whether to pause current Phase to plan it.
   - (c) It's a clarification or bug-fix on in-flight work → just do it and note it in §C change log.
2. **Update the planner after every commit.** Specifically: §A active Phase status, §A "마지막 커밋" cell, §C 변경 로그, and the relevant §6 sub-checklist box. The planner stays in sync with git — non-negotiable (same rule as landing-page-uiux + tour-product-detail-uiux).
3. **Per-Phase acceptance is mandatory** before marking ✅:
   - **Phase 0:** 7-item §6.0 checklist all pass + planner committed BEFORE any feature code + user "Phase 1 진입 승인" received
   - **Phase 1:** Card screenshot (Phase 0.6 baseline) vs after-Phase-1 diff = 0 (B2 verified). LCP regression ≤ +50ms. "표지 격 통과" user confirmation
   - **Phase 2:** `grep -E "(slate-200|slate-900)" components/tours-list/` returns near-zero (B1 verified). Active filter chip strip appears/dismisses in all scenarios. Mobile filter drawer ≤ 0.30s (matches detail page drawer policy)
   - **Phase 3:** `?destination=Jeju` shows volcano teal band. Empty state shows 3-action recovery (not single reset). View toggle persists across refresh. Card screenshot diff = 0
   - **Phase 4:** 24-card scroll no longer feels repetitive (editorial inserts at slot 6/12/18). Rescue band appears at visibleCount ≥ 28. Toggle to horizontal preserves current layout. **Card screenshot vs Phase 0.6 diff = 0 (B2 final verification)**
   - **Phase 6:** 60fps maintained (vs Phase 0.5 baseline). reduce-motion gate verified. Mobile/desktop LCP regression ≤ +50ms
4. **One Phase at a time.** Don't start Phase N+1 tasks while Phase N has unchecked rows. Phase 1 depends on Phase 0 ✅. Phases 2/3/4 can be parallel-planned but must be committed sequentially (one PR per Phase).
5. **Decisions in §B (B1–B17) are binding.** Examples that CANNOT be reversed without explicit user override + §B reversal row:
   - **B1**: ivory (#faf8f3) + amber base. slate-only forbidden
   - **B2**: `TourListCard` film grain·vignette·Vogue filter·warm shadow·spring tap — ALL preserved, untouched
   - **B3**: Hero mandatory (240→88 collapsing), NOT 0px
   - **B4**: filter fields h-11 + text-[13.5px] + border-amber-200/70, NOT h-8 + text-[12px] + border-slate-200
   - **B5**: Active filter dismissible chip strip mandatory (currently absent)
   - **B6**: Destination 7-accent inherited from `TourCollectionStrip.StripAccent` — no new accent system
   - **B7**: Editorial 3-up vertical is DEFAULT view, Compact horizontal is toggle
   - **B8**: Editorial Insert col-span-full every 6th slot (NOT every PR's "let's skip it")
   - **B9**: Rescue band ONLY at visibleCount ≥ 28
   - **B10**: Empty state 3-action recovery, NOT single reset
   - **B11**: scroll-freeze guard (same as detail page rule 8) — no new scroll-linked animations, no stacked backdrop-blur, no new libraries (carousel/bottom-sheet/virtual)
   - **B12**: No new libraries — framer-motion + IntersectionObserver only
   - **B13**: Time/group/language filters are Phase 5 (DB extension). Do NOT add UI for them in Phase 1-4
   - **B14**: i18n 6 locales (en/ko/zh/zh-TW/es/ja) mandatory simultaneous landing
   - **B15**: Card direct edit requires separate PR + separate §B reversal row
   - **B16**: Landing + detail binding decisions auto-apply to list (color diet, no new libs, amber eyebrow, etc.)
   - **B17**: Phase 0 gate must pass + user-approved BEFORE Phase 1 starts. No "let's skip Phase 0, it's just setup"
6. **Anti-patterns AP1–AP20 (§12) are non-negotiable.** Refuse them with reference to the binding decision they violate.
7. **Rollback triggers in §10 are automatic.** If LCP regresses +50ms, CLS jumps +0.02, FPS drops below 60, card screenshot diff ≠ 0, slate-900 leaks into list components, i18n missing in any of 6 locales — the active Phase rolls back. Do NOT negotiate the trigger.
8. **Card visual assets are sacred (B2 + B15).** The only file changes to `components/tour/TourListCard.tsx` allowed in this plan are: changing the `layout` prop default at the call site (Phase 4.1) and `imageSizes` prop value adjustments. Any other edit requires a §B reversal row + user approval.
9. **Cross-page family color promises (§9) are non-negotiable.** Ivory base + amber accent + italic serif + ken burns + 7-accent + spring motion — list MUST inherit these from hub/detail/landing/builder.
10. **Code reality > planner assertion.** If you read a file that contradicts §1 (코드 실사 스냅샷), update §1 with a "사실 수정" entry + log in §C. Never proceed on a stale fact (same rule as landing-page-uiux + tour-product-detail-uiux).
11. **planner-first commit rule.** §A / §B / §C edits must be committed BEFORE any feature code in the same PR. No "I'll update the planner later." (same rule as landing-page-uiux + tour-product-detail-uiux)
12. **i18n 6 locale gate.** Any PR touching `messages/*.json` MUST update all 6 locales (en/ko/zh/zh-TW/es/ja) in the same PR. Skipping = auto-fail.

## Specific protocols

### When starting Phase 0
- Update §A: set Phase 0 status to 🔄, fill "시작일."
- Add §C entry: "Phase 0 시작 — 게이트 체크리스트 7개."
- Commit the planner edit BEFORE writing any Phase 0 code.
- Execute §6.0 sub-tasks 0.1 → 0.7 in order.
- After all 7 pass, ask user: "Phase 0 게이트 7/7 통과. Phase 1 진입 승인하시나요?"

### When starting a Phase (1, 2, 3, 4, or 6)
- **Phase 1 entry**: verify §A Phase 0 is ✅. If not, refuse + execute Phase 0.
- **Phase 5 entry**: verify user has explicitly requested DB extension work AND backend sprint priority is agreed. If not, point to §6.5 deferral conditions.
- Update §A: set status to 🔄, fill "시작일."
- Add one-line §C entry: "Phase X started — <one-line summary>."
- Commit the planner edit BEFORE writing any Phase code.

### When advancing within a Phase
- After each sub-task commit:
  - Tick the checkbox in §6 for that sub-task.
  - Update §A "마지막 커밋" with new hash.
  - Add one-line §C entry referencing the sub-task number (e.g., "Phase 2.5 SortSegmented landed").
  - If carded changes happened (Phase 1-4), include screenshot diff result line.
  - If color changes happened (Phase 2+), include `grep -E "(slate-200|slate-900)" components/tours-list/` result count.

### When finishing a Phase
- Run all §6 acceptance checks for that Phase (rule 3 above).
- Paste evidence into §C (screenshot path, grep output, LCP delta, FPS measurement, locale screenshots).
- Update §A: set status to ✅, fill "완료일", append commit hashes.
- Ask the user whether to start the next Phase or pause.

### When user pushes back / changes their mind
- §B decision reversal: append new row with date + new decision + reason + "번복" filled. Do NOT delete the old row.
- Phase order change: log in §B + visibly mark in §6 (strikethrough, not delete).
- Scope cut: move cut work to §D with reason.
- **If user says "다운그레이드 느낌이다"**: per §10 rollback trigger, IMMEDIATELY pause active Phase + add §B reversal row + ask for clarification on what specifically dropped the tone (color? typography? spacing? motion?) before continuing.

### When code reality conflicts with the master plan
- Update §1 (코드 실사 스냅샷) with a "사실 수정 — <file>:<line>" entry.
- Log in §C as "사실 수정."
- If the contradiction invalidates a §B decision, append reversal row in §B.

### When user requests Phase 5 (time/group/language filters)
- Verify DB extension is in scope (sprint priority agreed).
- If yes: proceed with §6.5 plan; this requires migration + backfill + API extension BEFORE frontend.
- If no: explain that Phase 5 frontend without DB violates B13 (UI showing what can't filter = trust damage). Park as §D.

### Per-step deliverable format (matches landing-page-uiux + tour-product-detail-uiux + itinerary-builder convention)
After each step, write a one-line visual changelog the user can scan without opening files. Example:
- `Phase 2.5 done — SortSegmented landed (components/tours-list/SortSegmented.tsx neu). slate-900 grep: 0 in components/tours-list/. Card screenshot diff: 0/0. i18n: 6/6 locales.`

## Anti-patterns to refuse

- ❌ **"Skip Phase 0, it's just setup"** → B17 binding. Phase 0 is the safety net; without it Phase 1 is unsafe.
- ❌ **"Drop the hero, filter-first is faster"** → AP1 / B3. Magazine family promise broken.
- ❌ **"Keep filter fields at h-8 / text-[12px] / border-slate-200"** → AP2 / B4. Admin form tone unsolved.
- ❌ **"Use slate-900 for active chips, consistent with rest of site"** → AP3 / B1 / B16. Ivory+amber is the family promise.
- ❌ **"Skip destination 7-accent in list, hub-only"** → AP4 / B6. Hub's promise broken.
- ❌ **"Tweak card tone (film grain opacity / shadow color) to match ivory"** → AP5 / B2 / B15. CARD IS SACRED.
- ❌ **"Keep Compact horizontal as default, Editorial is toggle"** → AP6 / B7. Search-result tone retained.
- ❌ **"Editorial Insert feels like an ad, let's remove"** → AP7 / B8. Visual rhythm + curation signal lost.
- ❌ **"Show Rescue Band from the start"** → AP8 / B9. Catalogue trust damaged.
- ❌ **"Simple reset button for empty state"** → AP9 / B10. Dead-end UX.
- ❌ **"One small scroll-linked animation is fine"** → AP10 / B11. Scroll-freeze trauma (detail page).
- ❌ **"Add a bottom-sheet library, reduces code"** → AP11 / B12. Bundle/consistency violation.
- ❌ **"Add time/group/language filter UI first, wire backend later"** → AP12 / B13. UI not wired = trust damage.
- ❌ **"Add ko first, other 5 locales next PR"** → AP13 / B14. i18n regression.
- ❌ **"Slight card adjustment (film grain off, just for ivory contrast)"** → AP14 / B2 / B15. ABSOLUTE NO.
- ❌ **"Phase 0 gate is overkill, jump to Phase 1"** → AP15 / B17.
- ❌ **"§A planner update in separate PR"** → AP16 / rule 11 / planner-first commit rule.
- ❌ **"Mark Phase ✅ without screenshot evidence"** → AP17 / rule 3.
- ❌ **"Add hero video background"** → AP18 / B11. LCP + scroll-freeze.
- ❌ **"Default to Compact, Editorial is opt-in"** → AP19 / B7. Magazine tone is default.
- ❌ **"Add dark mode to list now"** → AP20. Site-wide dark mode is undecided.
- ❌ **Editing `components/tour/TourListCard.tsx` without §B15 reversal** → B2 protection.
- ❌ **Editing `components/tours-hub/TourCollectionStrip.tsx` beyond the StripAccent extraction (Phase 0.1)** → out of scope, ask user.
- ❌ **Editing `app/api/tours/route.ts` outside of Phase 5** → backend extension requires separate sprint.

## File map (covered by this skill)

### Direct work
- `app/tours/list/page.tsx` — page entry, Phase 1-4 mount points
- `app/tours/layout.tsx` — SEO metadata (Phase 1 description refresh allowed)
- `components/tours-list/CatalogueHero.tsx` (Phase 1, new)
- `components/tours-list/CatalogueFooterStrip.tsx` (Phase 1, new)
- `components/tours-list/DestinationPillSelect.tsx` (Phase 2, new)
- `components/tours-list/SortSegmented.tsx` (Phase 2, new)
- `components/tours-list/ActiveFilterStrip.tsx` (Phase 2, new)
- `components/tours-list/ContextualVignetteBand.tsx` (Phase 3, new)
- `components/tours-list/ResultsMetaStrip.tsx` (Phase 3, new)
- `components/tours-list/EmptyStateRecovery.tsx` (Phase 3, new)
- `components/tours-list/EditorialInsert.tsx` (Phase 4, new)
- `components/tours-list/ConversionRescueBand.tsx` (Phase 4, new)
- `lib/tours-hub-accents.ts` (Phase 0.1, extracted from `TourCollectionStrip.tsx`)
- `lib/tours-list-tokens.ts` (Phase 0.2, new — §5 tokens as TS constants)
- `lib/tours-list-editorial-inserts.ts` (Phase 4, static content for 3 insert variants)
- `messages/{en,ko,zh,zh-TW,es,ja}.json` (each Phase adds 6 locales simultaneously)

### Dependencies (edits require §B reversal)
- `components/tour/TourListCard.tsx` (B2 + B15 — card asset preservation)
- `components/tours-hub/TourCollectionStrip.tsx` (Phase 0.1 only — `StripAccent` extraction with import path update)

### Out of scope (deferred to other skills or backend work)
- `app/tours/page.tsx` (hub) — no skill yet; changes here require explicit user approval
- `app/tour-product/[slug]/page.tsx` → `tour-product-detail-uiux`
- `app/itinerary-builder/*` → `itinerary-builder-redesign` / `itinerary-builder`
- `components/home/v2/*` → `landing-page-uiux`
- `app/api/tours/route.ts` modification — Phase 5 (DB extension) only, separate backend sprint

## When you finish a turn

Tell the user:
- Which task you just completed (referencing §6 Phase sub-task, e.g., "Phase 2.5 SortSegmented done")
- Updated §A / §C entries (one-line each)
- Next unchecked task in the active Phase
- Whether the Phase is now ✅ (and if so, ask whether to proceed to the next)
- Any §D parked items added or §B reversals logged
- **Card screenshot diff result** (Phase 1-4 every turn — B2 verification)
- **`grep -E "(slate-200|slate-900)" components/tours-list/` count** (Phase 2-4 every turn — B1 verification)
- **i18n 6 locale gate status** (any turn touching `messages/*.json`)
- **LCP/FPS delta** (Phase 1 + Phase 6 turns)
