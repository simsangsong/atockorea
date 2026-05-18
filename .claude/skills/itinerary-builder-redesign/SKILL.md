---
name: itinerary-builder-redesign
description: Drives all work on AtoC Korea's "itinerary builder V2 redesign" — the structural pivot from cart-side-panel to sticky-map + photo-pin-markers + vertical itineraryStop timeline + bi-directional map↔card sync, plus amber-discipline color cleanup, IntakeForm honesty pass, POIDetailModal magazine spread, QuoteModal trust upgrade, Thanks pending parity, and micro-motion + Korean typography polish. Wires every task back to the master planner at docs/itinerary-builder-redesign-master-plan-2026-05-18.md so phases advance in order (0 gate → 1 → 2 → … → 12), V1–V12 decisions are honored, code reality is verified, and scope creep is parked instead of silently absorbed. Phase 0 is a go/no-go gate — do NOT start Phase 1 until §C records a pass. Invoke any time the user mentions (in English or Korean) — itinerary builder redesign / 빌더 재설계 / 빌더 리디자인 / 빌더 V2 / 빌더 V2 플랜 / itinerary builder V2, photo pin / 사진 핀 / 사진핀 / 포토 핀 / 사진 마커 / photo marker / image pin, map + timeline / 지도 + 타임라인 / 지도+타임라인, sticky map / 스티키 지도 / 고정 지도, itineraryStop card / 스톱 카드 / itineraryStop / 스톱 타임라인, timeline result view / 타임라인 결과 / 타임라인 뷰 / 결과 타임라인, bi-directional sync / 양방향 동기화 / 양방향 호버 / 지도-카드 연동 / 카드-지도 연동 / map-card sync, AdvancedMarkerElement custom content / 커스텀 마커, photo-pin clustering / 핀 클러스터링 / 핀 묶음 / 핀 오프셋, auto-fitBounds / 지도 자동 줌, polyline gradient / 폴리라인 그라데이션 / 폴리라인 애니메이션, amber inflation / amber 인플레이션 / amber 위계 / amber 절제 / amber discipline, Add/Added color semantic / 추가 버튼 색상 / Added 색상 / 색상 의미, IntakeForm honesty / 인테이크 카피 / "two questions" / 두 질문 약속, POIDetailModal magazine / POI 디테일 모달 / 매거진 스프레드 / bento gallery / 벤또 갤러리, QuoteModal trust / 쿼트 모달 / 견적 모달 / 카트 썸네일 / eligibility indicator / 자동 견적 표시, Thanks pending parity / Thanks 페이지 / 견적 대기 화면 / 24시간 화면, AI preset chips / AI 프리셋 / AI 추천 칩 / Suggested 스트라이프, micro-motion / 마이크로 모션 / 미세 애니메이션 / 가격 카운터, Pretendard / 프리텐다드 / 한국어 타이포그래피, any change inside components/itinerary-builder/ or app/itinerary-builder/ while V2 redesign is active, the itinerary builder redesign master plan / 재설계 마스터 플랜 / 빌더 V2 마스터 플랜 / 'read the redesign plan' / '재설계 플랜 읽어줘' / '빌더 V2 플랜 진행', or any phase labeled 0 / 1 / 2 / 3 / 4 / 5 / 6 / 7 / 8 / 9 / 10 / 11 / 12 in the redesign track (these labels are unique to this plan — the parent itinerary-builder feature plan uses Phase 1-7 for shipped functional work; the prior UI/UX track used A–J letters; landing-page uses 0a/0b/0c/B/C/D/E; tour-product-detail uses Sprint labels). ALSO auto-invoke when the user opens a session and asks to start/continue the redesign master plan or any of its phases.
---

# Itinerary Builder Redesign (V2) skill

You are working inside the atockorea project's **"itinerary builder V2 redesign"** track. The master planner is `docs/itinerary-builder-redesign-master-plan-2026-05-18.md`. **It is the single source of truth for status, decisions, scope, phase order, color discipline (V5), photo-pin contract (V2/V10), and bi-sync protocol (V4).**

This plan **supersedes** Phases F–J of the older `docs/itinerary-builder-uiux-master-plan-2026-05-18.md`. The older plan's Phases A–E (token + style cleanup) shipped and remain valid groundwork. **Do not restart A–E.**

## Step 0 — Always do this first

1. Read `docs/itinerary-builder-redesign-master-plan-2026-05-18.md` end-to-end. Do not skim. Especially:
   - **§A Status dashboard** — find the currently active Phase (0–12)
   - **§B Decision log** — V1–V12 binding decisions you cannot reverse silently
   - **§E Scope creep registry** — parked ideas; do NOT start any of these without user approval
   - **§F Phase plan** — the active Phase's sub-tasks and acceptance
   - **§G Cross-cutting concerns** (G.7 amber discipline is binding)
   - **§H Risks** — V-R1 through V-R10 with mitigations
   - **§J Audit findings (frozen)** — the diagnosis we are correcting
   - **§K Additional visual upgrade opportunities** — what's promoted vs. parked
2. From §A, identify the active Phase (🔄). If none is active, the state is "between phases — awaiting direction." In that case do NOT pick a Phase yourself; ask the user which Phase to begin.
3. From the active Phase's §F sub-checklist, identify the next unchecked task. That's the next thing you do.
4. **Phase 0 is a gate.** If §A active Phase is "1" or higher, verify §C contains the Phase 0 PASS verdict + 4 screenshots. If not — halt and complete Phase 0 first.
5. **Verify code reality before editing.** Don't trust the planner's `file:line` references blindly — they were captured 2026-05-18; if subsequent commits shifted lines, re-locate the target.

## Working rules (priority order)

1. **Never deviate silently.** If the user asks for something not in the active Phase's task list:
   - (a) It belongs to a different Phase already in the plan → say "this is Phase N work; we're on Phase M" and ask whether to switch (which means logging the switch in §A + §B).
   - (b) It's genuinely new scope → add it to §E scope creep registry and ask whether to pause current Phase to plan it formally.
   - (c) It's a clarification or bug-fix on in-flight work → just do it and note it in §C change log.
2. **Update the planner after every commit.** Specifically: §A active Phase status, §A "Last commit" cell, §C change log, and the relevant §F sub-checklist box. The planner stays in sync with git — non-negotiable.
3. **Per-Phase acceptance is mandatory** before marking a Phase ✅. Run the verification specified in §F for that Phase (curl, screenshot, dev-server visual check, Lighthouse, etc.) and paste evidence into §C.
4. **One Phase at a time.** Don't start Phase N+1 tasks while Phase N has unchecked boxes. Phases 2, 3, 4 in particular form a tight chain — completing 2 without 3 leaves the user with photo pins but no timeline to sync to.
5. **Decisions in §B (V1–V12) are binding.** Examples:
   - V5: amber is reserved for ≤5 primary uses per screen. Do not add new amber accents.
   - V8: timeline reuses tour-product `itineraryStop` card pattern. Do not invent a new card variant.
   - V11: no new dependencies. Don't `npm install` anything.
   - To change a §B decision, log a reversal row in §B first (do not delete the old row).
6. **Phase 0 outcome routes Phase 2.** If Phase 0 verdict is "FAIL (photo pins unreadable)," Phase 2 reroutes to category-icon pins per V10. Do not proceed with photo-pin tasks if §C records FAIL.
7. **V4 bi-sync is core, not optional.** Phase 4 cannot be deferred without losing the redesign's reason to exist. If user wants to skip Phase 4 to "ship faster," push back — the map + timeline without sync is just two adjacent widgets.
8. **V8 data shape stability is binding.** This is a presentation-only redesign. No schema changes. No new API routes. No new tables. If a phase requires a data change to ship cleanly, halt and ask.
9. **Cut-line discipline.** Each Phase has a cut-line. After completing a Phase, ask the user whether to continue or pause — don't auto-advance.
10. **Code reality > plan assertion.** If you read code that contradicts a §J audit point (e.g., line numbers shifted), update §A change log + adjust the Phase task instead of mis-editing.

## Specific protocols

### When starting a Phase
- Update §A: set status to 🔄, fill "Started" date.
- Add one-line §C entry: "Phase X started — <one-line summary>."
- Commit the planner edit BEFORE writing any Phase code.
- **For Phase 0 specifically**: create `redesign-spike` branch first; everything Phase 0 builds is throwaway.
- **For Phases 1–12**: work on `main` (or feature branches per user preference) with planner sync in every commit.

### When advancing within a Phase
- After each sub-task commit:
  - Tick the checkbox in §F.
  - Update §A "Last commit" with new hash.
  - Add one-line §C entry.
  - Write a one-line visual changelog: `2.3 done — photo-pin clustering offset lands (POICatalogMap.tsx:212-240); jagalchi + nampo-dong now render at 28px offset arc.`

### When finishing a Phase
- Run all acceptance checks in §F for that Phase.
- Paste evidence into §C (screenshot path or pasted curl output or measurement value).
- Update §A: set status to ✅, fill "Done" date, append commit hashes.
- Ask the user whether to start the next Phase or pause at this cut-line.
- **For Phase 0 specifically**: write the verdict (PASS / FAIL / UNCLEAR) explicitly. If FAIL, propose Phase 2 reroute to V10 category-icons. If UNCLEAR, list specific ambiguities and ask user to adjudicate.

### When user pushes back / changes their mind
- §B decision reversal: append new row in §B with date + new decision + reason. Do not delete the old row.
- Phase order change: log in §B + update §F ordering visibly (strikethrough, not delete).
- Scope cut: move cut work to §E with reason.

### When code reality conflicts with the plan
- Update §J only if a new audit finding emerges (existing §J is frozen — do not edit existing rows; only append).
- Log the correction in §C as "Fact correction — <component> <line refs>."
- If the contradiction invalidates a §B decision, append reversal row in §B.

### Per-step deliverable format
After each step, write a one-line visual changelog the user can scan without opening files. Example: `4.1 done — useActiveStop hook lands (lib/itinerary-builder/active-stop.ts); pin hover now scrolls timeline card into view via scrollIntoView({block:"center"}).`

## Anti-patterns to refuse

- ❌ "Let's just skip Phase 0 and start Phase 1" → Phase 0 is a gate. The photo-pin readability gamble must be validated first. Without the screenshot evidence, we don't know if we're building on solid ground.
- ❌ "Let's do Phase 4 (sync) before Phase 3 (timeline)" → sync needs the timeline to sync TO. §F is sequential.
- ❌ "Defer Phase 4 to save time" → §B V4 says bi-sync is core, not optional. Without it, the map and timeline are two adjacent widgets.
- ❌ "Add map filter chips above the map" → §E parked (K2); ask before promoting.
- ❌ "Use Mapbox / Leaflet / Embla / Radix for this" → §B V11 says no new dependencies. Reversal required.
- ❌ "Make in-cart cards have amber rings AND amber ribbons AND amber Add button" → §B V5 amber discipline. Maximum 5 amber primaries per screen.
- ❌ "Set Added state to rose" → §J.5 audit finding; Added is success (emerald), not destructive.
- ❌ "Just keep CartPanel as the desktop side panel after timeline ships" → §F Phase 3 deletes CartPanel. Both panels = redundant. Don't ship the redundant state.
- ❌ "Change `match_pois` schema to add a `pin_label` column" → §B V8 binding: presentation-only redesign, no schema changes.
- ❌ "Skip i18n re-translation for new strings" → §G.4 + parent plan D6. Always re-run the translate script before merging new copy.
- ❌ Committing Phase code without updating the planner in the same PR.
- ❌ Marking a Phase ✅ without running acceptance checks.
- ❌ Reading just §A of the planner — you MUST read the active Phase's full §F + §B + §J every session.
- ❌ Editing `components/itinerary-builder/*` or `app/itinerary-builder/*` while V2 redesign is active without reading the master plan first.
- ❌ Restarting Phases A–E of the older UIUX plan — they shipped and stay valid. Their work is the *floor*, not the ceiling.

## When you finish a turn

Tell the user:
- Which task you just completed (referencing §F item, e.g., "2.4 photo-pin auto-fitBounds done")
- Updated §A / §C entries (one-line each)
- Next unchecked task in the active Phase
- Whether the Phase is now ✅ (and if so, ask whether to proceed to the next at the cut-line)
- Any §E entries added or §B reversals logged
- For Phase 0 specifically: the PASS/FAIL/UNCLEAR verdict + screenshot paths

## Quick reference — the V1–V12 binding decisions

| # | One-line |
|---|---|
| V1 | Result paradigm = sticky map + photo pins + vertical itineraryStop timeline (replaces CartPanel) |
| V2 | Photo pins via AdvancedMarkerElement custom HTML content |
| V3 | Auto-fitBounds on cart change (padding 56/24) |
| V4 | Bi-directional sync is core, not optional |
| V5 | Amber reserved for ≤5 primary uses per screen |
| V6 | AI result merges INTO timeline as Suggested stripe; AI panel collapses to pill after first use |
| V7 | "Two questions" copy must be true (or change copy) |
| V8 | `itineraryStop` pattern reused verbatim — no new card variant |
| V9 | Mobile-first sticky map (top 40vh on mobile, left 60vh on desktop) |
| V10 | Phase 0 is a gate; FAIL routes to category-icon pins |
| V11 | No new dependencies |
| V12 | i18n preserved — all copy through messages/en.json + translate script |
