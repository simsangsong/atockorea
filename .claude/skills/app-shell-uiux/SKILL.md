---
name: app-shell-uiux
description: Drives all work on AtoC Korea's global app shell — dark mode system and iOS PWA/in-app-browser back button. Wires every task back to the master planner at docs/app-shell-uiux-master-plan-2026-05-17.md so phases advance in order (B before D), decisions are logged, code reality is verified, and scope creep is parked instead of silently absorbed. Invoke any time the user mentions (in English or Korean) — dark mode / 다크 모드 / 다크모드 / 야간 모드 / 야간모드 / 라이트 모드 / 라이트모드 / theme toggle / 테마 토글 / 테마 전환 / 색상 모드 / color scheme, prefers-color-scheme / next-themes, back button / 백 버튼 / 백버튼 / 뒤로 가기 / 뒤로가기 / 뒤로가기 버튼 / 이전 페이지 버튼, iOS back / 아이폰 뒤로가기 / 아이폰 백버튼 / PWA back, PWA / standalone mode / 홈 화면 추가 / 홈스크린 / web app manifest / manifest.json / apple-touch-icon / apple-mobile-web-app, 인앱 브라우저 / in-app browser / 카카오톡 인앱 / 인스타 인앱, app shell / 앱 셸 / 앱셸 / SitePageShell / 글로벌 헤더 / global header, theme provider / ThemeProvider / `.dark` class / Tailwind darkMode, any change inside `app/globals.css` `.dark` block / `tailwind.config` darkMode / `components/Header.tsx` / `src/components/layout/SitePageShell.tsx` / new files under `components/app-shell/` or `src/lib/device/`, the app shell master plan / 앱 셸 마스터 플랜 / 다크 모드 마스터 플랜 / 백 버튼 마스터 플랜 / 'read the app shell plan' / '앱 셸 플랜 읽어줘' / '다크 모드 기획 진행' / '백 버튼 기획 진행', or any phase labeled 0 / B.1 / B.2 / B.3 / B.4 / B.5 / D.1 / D.2 / D.3 / D.4 / D.5 / D.6 / D.7 (these labels are unique to this plan — landing-page-uiux uses 0a/0b/0c/B/C/D/E, itinerary-builder uses numeric Phase 1-6, tour-product-detail-uiux uses Sprint labels). ALSO auto-invoke when the user opens a session and asks to start/continue the app shell master plan or any dark-mode / back-button phase.
---

# App Shell UI/UX skill (Dark Mode + iOS Back Button)

You are working inside the atockorea project's "global app shell UI/UX" feature, which covers two related but distinct workstreams:

- **B.* — iOS PWA / in-app-browser back button** (5 phases: B.1 hook → B.2 component → B.3 Header integration → B.4 QA → B.5 PWA manifest)
- **D.* — Dark mode system** (7 phases: D.1 infra → D.2 token completion → D.3 toggle → D.4 visual QA → D.5 page-by-page migration → D.6 tour-product-v2 scope (deferred) → D.7 photo/final QA)

The master planner is `docs/app-shell-uiux-master-plan-2026-05-17.md`. **It is the single source of truth for status, decisions, scope, phase order, token mapping, success criteria, and rollback triggers.**

## Step 0 — Always do this first

1. Read `docs/app-shell-uiux-master-plan-2026-05-17.md` end-to-end. Do not skim. Especially:
   - **§A 상태 대시보드** — find the currently active Phase
   - **§B 결정 로그** — binding decisions you cannot reverse silently (15 rows as of v1)
   - **§D 보류 아이디어** — parked ideas; do NOT start any of these without user approval
   - **§5 Phase별 실행 계획** — the active Phase's sub-tasks
   - **§11 롤백 트리거** — automatic rollback thresholds (LCP/CLS/WCAG/FOUC)
   - **§12 의존성 / 충돌 관리** — cross-plan conflicts (especially tour-product-detail dependency for D.6, and B.3/D.3 Header conflict)
   - **§13 안 할 일** — anti-patterns
2. From §A, identify the active Phase (🔄). If none is active, state is "between phases — awaiting direction." In that case do NOT pick a Phase yourself; ask the user which Phase to begin.
3. From the active Phase's §5 sub-checklist, identify the next unchecked task. That's the next thing you do.
4. **Verify code reality before editing.** §2 of the planner snapshots files at write time. Before claiming any component "does X" or "doesn't do Y", read the actual file. If reality differs, log "사실 수정" in §C and update §2.

## Working rules (priority order)

1. **Phase order is binding — B → D.** Do not start any D.* phase while any B.* phase is unchecked. If the user wants to start dark mode first, say "이 플랜의 §B #2가 B 전체 ✅ → D 진입을 binding으로 잡았어. 번복하려면 §B에 reversal row를 먼저 추가해야 해" and ask whether to reverse.
2. **One Phase at a time, one PR at a time.** Especially D.5 — each page migration is its own PR (§B #6).
3. **B.3 must complete before D.3.** Both modify `components/Header.tsx`. Concurrent edits = conflict (§12).
4. **D.6 stays ⏸ until `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` ✅** (§B #7). Do not touch `tour-product-v2-scope.css` for dark mode before that.
5. **Never deviate silently.** If the user asks for something not in the active Phase's task list:
   - (a) It belongs to a different Phase already in the plan → say "this is Phase X work; we're on Phase Y" and ask whether to switch (which means logging the switch in §A + §B).
   - (b) It's genuinely new scope → add it to §D scope creep registry and ask whether to pause current Phase to plan it formally.
   - (c) It's a clarification or bug-fix on in-flight work → just do it and note it in §C change log.
6. **Update the planner after every commit.** Specifically: §A active Phase status, §A "마지막 커밋" cell, §C 변경 로그, and the relevant §5 sub-checklist box. The planner stays in sync with git — non-negotiable.
7. **Per-Phase acceptance is mandatory** before marking a Phase ✅. Run the verification specified in §5 for that Phase (5-UA-fixture test for B.1, CDP screenshot for B.4, WCAG check for D.2/D.7, FOUC measurement for D.1, etc.) and paste evidence into §C.
8. **Decisions in §B are binding.** All 15 rows. Especially:
   - #3 default theme = `system` (no manual override before opt-in)
   - #5 `dark:` prefix incremental, no mass CSS-variable rewrite
   - #8 iOS Safari excluded from back button (only standalone + in-app)
   - #10 Admin excluded from back button
   - #12 no new theme libraries beyond `next-themes`
   - #15 dark colors only via globals.css `.dark { ... }` CSS variable redefinition
9. **Rollback triggers in §11 are automatic.** LCP +100ms / CLS +0.02 / WCAG AA violation / FOUC 200ms+ / external referrer leak → active Phase ❌, revert, log reason in §C. Do not negotiate the trigger.
10. **No new dependencies except `next-themes`** (§B #12). If the user asks for chakra-ui / theme-ui / mui / radix-themes / vanilla-extract / styled-components / etc., refuse and point to §B #12.
11. **Code reality > planner assertion.** If you read code that contradicts a §2 stated fact (e.g., `Header.tsx` already has back-button logic), update §2 to reflect reality + log "사실 수정" in §C. Never proceed on a stale fact.

## Specific protocols

### When starting a Phase
- Update §A: set status to 🔄, fill "시작일."
- Add one-line §C entry: "Phase X started — <one-line summary>."
- Commit the planner edit BEFORE writing any Phase code.

### When advancing within a Phase
- After each sub-task commit:
  - Tick the checkbox in §5.
  - Update §A "마지막 커밋" with new hash.
  - Add one-line §C entry.

### When finishing a Phase
- Run all acceptance checks in §5 for that Phase.
- Paste evidence into §C (CDP screenshot path, UA fixture pass log, WCAG result, FOUC measurement, etc.).
- Update §A: set status to ✅, fill "완료일", append commit hashes.
- Ask the user whether to start the next Phase or pause.
- **If the just-completed Phase is the last B.* phase**: explicitly confirm "Phase B 전체 ✅ — D.1 진입해도 될까?" before any D work starts.

### When user pushes back / changes their mind
- §B decision reversal: append new row in §B with date + new decision + reason. Do not delete the old row.
- Phase order change: log in §B + update §5 ordering visibly (strikethrough, not delete).
- Scope cut: move cut work to §D with reason.

### When code reality conflicts with the plan
- Update §2 (코드 실사 스냅샷) to reflect reality.
- Log the correction in §C as "사실 수정 — <component> <line refs>."
- If the contradiction invalidates a §B decision, append reversal row in §B.

### Per-step deliverable format (matches other plans' convention)
After each step, write a one-line visual changelog the user can scan without opening files.
Example: `B.2 done — BackButton 컴포넌트 신규 (components/app-shell/BackButton.tsx). history.length 가드 + 44px touch target + 6 locale a11y label.`

## Cross-plan coordination

This plan touches files governed by other plans. Be careful at the boundary:

- **`components/home/v2/*`** (landing-page-uiux v3) — D.5.a 진입 시 landing 플랜의 §11 LCP/CLS 임계값 공유. 위반 시 양쪽 §A 모두 ❌.
- **`tour-product-v2-static-root`** (tour-product-detail-uiux) — D.6 ⏸ 의존. 다른 페이지 다크화 중 이 스코프가 회귀하면 즉시 alarm.
- **itinerary-builder** (`docs/itinerary-builder-plan.md`) — D.5.h 진입 시 Google Maps 다크 스타일·POI 핀 색상 별도 검토. 맵 다크화 결정은 itinerary-builder 스킬과 협의.

If a task could fall under multiple skills, this skill handles work scoped to global shell concerns (Header, SitePageShell, globals.css, manifest, device detection). Page-specific UI work that happens to be dark-mode-related (e.g., adding dark variants to a landing component while editing it for another reason) defers to that page's skill.

## Anti-patterns to refuse

- ❌ "Let's start dark mode first, back button can wait" → §B #2 binding. Reversal row required.
- ❌ "Just do dark mode for the whole site in one PR" → §B #6 + §5 D.5 page-by-page.
- ❌ "Add a chakra-ui ThemeProvider" / "use theme-ui" / "add radix-themes" → §B #12. `next-themes` only.
- ❌ "While you're in Header, also add the back button" (during D.3) → §12 conflict. B.3 must be ✅ first.
- ❌ "Add dark to tour-product-v2-scope while we're at it" → §B #7 + D.6 ⏸. Tour-product-detail master plan must be ✅ first.
- ❌ "Show the back button in regular iOS Safari too" → §B #8. Safari has bottom ←, duplication.
- ❌ "Add back button to admin pages" → §B #10. Admin has its own breadcrumb.
- ❌ "Skip the manifest, just do the back button" → §B #11. PWA manifest is what makes standalone mode (the back button's reason) work.
- ❌ "Use inline `style={{ backgroundColor: ... }}` for the dark variant" → §13. CSS variables / Tailwind only.
- ❌ "Make a `HeaderDark.tsx` separate component" → §13. Single component, theme-aware.
- ❌ Mass-converting all 1,200 hardcoded color classes in one PR → §B #5 + §13.
- ❌ Committing feature code without updating the planner in the same PR → §6 working rule.
- ❌ Marking a Phase ✅ without running acceptance checks → §7 working rule.
- ❌ Reading just §0 of the planner — you MUST read §A + §B + §5 (active Phase) + §13 every session.
- ❌ Starting Phase D while any B.* is ⏳ or 🔄 → §B #2 binding.
- ❌ Starting D.3 while B.3 is ⏳ or 🔄 → §12 Header conflict.
- ❌ Announcing dark mode "feels right" without WCAG AA verification → §10 success criteria.
- ❌ Editing `components/Header.tsx` / `SitePageShell.tsx` / `app/globals.css .dark` / `app/layout.tsx` ThemeProvider / `public/manifest.json` without invoking this skill first.

## When you finish a turn

Tell the user:
- Which task you just completed (referencing §5 item, e.g., "B.2 BackButton 컴포넌트 done")
- Updated §A / §C entries (one-line each)
- Next unchecked task in the active Phase
- Whether the Phase is now ✅ (and if so, ask whether to proceed to the next; if it was the last B.* phase, explicitly confirm before any D work)
- Any §D entries added or §B reversals logged
- Any cross-plan signal (e.g., "D.5.a 진입 시 landing 플랜의 §11 LCP 임계값 공유 — 측정 필요")
