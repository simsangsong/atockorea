---
name: landing-page-uiux
description: Drives all work on AtoC Korea's main landing page (/) UI/UX upgrade — hero matcher, idle match preview, section order, sticky CTA, season chip, motion identity, copy hierarchy. Wires every task back to the master planner at docs/landing-page-uiux-master-plan-v3-2026-05-17.md so phases advance in order, decisions are logged, code reality is verified, and scope creep is parked instead of silently absorbed. Invoke any time the user mentions (in English or Korean) — landing page / 랜딩 페이지 / 랜딩페이지 / 홈 페이지 / 홈페이지 / 메인 페이지, hero matcher / 히어로 매처 / 히어로 / 매처 카드 / 매칭 카드, best match preview / 베스트 매치 / 매칭 결과 / 매칭 미리보기, idle preview / 아이들 프리뷰 / 추천 예시 / 추천 미리보기, sticky CTA / 스티키 CTA / 하단 고정 CTA / 하단 고정 버튼, season chip / 시즌 칩 / 계절 칩, landing copy / hero copy / 랜딩 카피 / 히어로 카피 / H1 카피, CTA hierarchy / CTA 계층 / CTA 위계, section order / 섹션 순서 / Featured Destinations 순서, home v2 / 홈 v2, any change inside components/home/v2/, the landing page master plan / v3 플랜 / 랜딩 페이지 마스터 플랜 / 랜딩 페이지 업그레이드 / 'read the landing page plan' / '마스터 플랜 읽어줘 (랜딩 관련)', or any phase labeled 0a / 0b / 0c / B / C / D / E (these labels are unique to this plan — itinerary-builder uses numeric Phase 1-6). ALSO auto-invoke when the user opens a session and asks to start/continue the landing page master plan or its phases.
---

# Landing Page UI/UX Upgrade skill

You are working inside the atockorea project's "main landing page (`/`) UI/UX upgrade" feature. The master planner is `docs/landing-page-uiux-master-plan-v3-2026-05-17.md`. **It is the single source of truth for status, decisions, scope, phase order, copy rules, motion values, and rollback triggers.**

## Step 0 — Always do this first

1. Read `docs/landing-page-uiux-master-plan-v3-2026-05-17.md` end-to-end. Do not skim. Especially:
   - **§A 상태 대시보드** — find the currently active Phase
   - **§B 결정 로그** — binding decisions you cannot reverse silently
   - **§D 보류 아이디어** — parked ideas; do NOT start any of these without user approval
   - **§5 Phase별 실행 계획** — the active Phase's sub-tasks
   - **§11 롤백 트리거** — automatic rollback thresholds (LCP/CTR/CLS/etc.)
   - **§13 안 할 일** — anti-patterns
2. From §A, identify the active Phase (🔄). If none is active, the state is "between phases — awaiting direction." In that case do NOT pick a Phase yourself; ask the user which Phase to begin.
3. From the active Phase's §5 sub-checklist, identify the next unchecked task. That's the next thing you do.
4. **Verify code reality before editing.** v2 of this plan failed because it asserted `StickyHomeCta` wasn't gated when it was, and `analytics.ts` was a real provider when it was `console.log` only. Before claiming any component "does X" or "doesn't do Y", read the actual file.

## Working rules (priority order)

1. **Never deviate silently.** If the user asks for something not in the active Phase's task list:
   - (a) It belongs to a different Phase already in the plan → say "this is Phase N work; we're on Phase M" and ask whether to switch (which means logging the switch in §A + §B).
   - (b) It's genuinely new scope → add it to §D scope creep registry and ask whether to pause current Phase to plan it formally.
   - (c) It's a clarification or bug-fix on in-flight work → just do it and note it in §C change log.
2. **Update the planner after every commit.** Specifically: §A active Phase status, §A "마지막 커밋" cell, §C 변경 로그, and the relevant §5 sub-checklist box. The planner stays in sync with git — non-negotiable.
3. **Per-Phase acceptance is mandatory** before marking a Phase ✅. Run the verification specified in §5 for that Phase (analytics event firing in console, mobile fold screenshot, LCP measurement, etc.) and paste evidence into §C.
4. **One Phase at a time.** Don't start Phase N+1 tasks while Phase N has unchecked boxes. Phase D depends on Phase 0b baseline being available — until then, Phase D is "boxed" not "started."
5. **Decisions in §B are binding.** If §B says "idle preview must be 2-3 cards cycling, not 1 card", do not propose a single card. To change, log a reversal row in §B first (do not delete the old row).
6. **Rollback triggers in §11 are automatic.** If LCP regresses +50ms, CTR drops -5%, CLS jumps +0.02, etc., the active Phase rolls back. Do not negotiate the trigger.
7. **Brand voice guardrails (사용자 피드백 — §B 영구 결정):** amber eyebrow stays, Process dark stays, premium > 절제. Audit recommendations that conflict with these are rejected.
8. **Anti-patterns (§13) are non-negotiable**: no fake recommendation card, no "최적/Best" CTA copy, no single-card idle preview, no baseline-less A/B announcement, no new libraries, no Phase mixing in one PR.
9. **Phase D needs Phase 0b baseline.** If user wants to start Phase D before 0b baseline exists, ask first whether to (i) wait, (ii) accept the result as "directional only — no quant claim," or (iii) escalate provider decision.
10. **Code reality > planner assertion.** If you read code that contradicts a §2 stated fact (like StickyHomeCta gating), update §2 to reflect reality + log the correction in §C as "사실 수정." Never proceed on a stale fact.

## Specific protocols

### When starting a Phase
- Update §A: set status to 🔄, fill "시작일."
- Add one-line §C entry: "Phase X started — <one-line summary>."
- Commit the planner edit BEFORE writing any Phase code.

### When advancing within a Phase
- After each sub-task commit:
  - Tick the checkbox in §5 / §6.
  - Update §A "마지막 커밋" with new hash.
  - Add one-line §C entry.

### When finishing a Phase
- Run all acceptance checks in §5 for that Phase.
- Paste evidence into §C (event log snippet, screenshot path, measured fold position, A/B variant key, LCP delta, etc.).
- Update §A: set status to ✅, fill "완료일", append commit hashes.
- Ask the user whether to start the next Phase or pause.

### When user pushes back / changes their mind
- §B decision reversal: append new row in §B with date + new decision + reason. Do not delete the old row.
- Phase order change: log in §B + update §5 ordering visibly (strikethrough, not delete).
- Scope cut: move cut work to §D with reason.

### When code reality conflicts with the plan
- Update §2 (코드 실사 스냅샷) to reflect reality.
- Log the correction in §C as "사실 수정 — <component> <line refs>."
- If the contradiction invalidates a §B decision, append reversal row in §B.

### Per-step deliverable format (matches itinerary-builder convention)
After each step, write a one-line visual changelog the user can scan without opening files. Example: `B.1 done — Featured ↔ Destinations swap landed (HomeV2Page.tsx:27-29). Sticky QA pass on 390x844.`

## Anti-patterns to refuse

- ❌ "Let's just skip Phase B and do Phase D first" → §B + §A switch flow; explain why D needs 0b.
- ❌ "While you're in there, also do X" → §D parked idea, ask first.
- ❌ "Make idle preview a single card, simpler" → §B says no (cycling required). Decision must be reversed in §B first.
- ❌ "Change CTA to 'Find Best Match' / '최적 매치 보기'" → §B says no (expectation inflation). Reversal flow.
- ❌ "Add a season chip onClick — quick fix" → that's Phase C work, not Phase B. Phase order applies.
- ❌ "Mute the amber eyebrow / lighten Process dark" → §B says no (user feedback). Will not reverse without explicit user override.
- ❌ Committing feature code without updating the planner in the same PR.
- ❌ Marking a Phase ✅ without running acceptance checks.
- ❌ Reading just §0 of the planner — you MUST read the active Phase's full §5 + §B + §13 every session.
- ❌ Recommending new libraries (carousel, bottom-sheet, slider) — use framer-motion that's already installed.
- ❌ Announcing "+15% CTR improvement" or any quant claim before Phase 0b baseline is in place.
- ❌ Editing `components/home/v2/*` without reading the master plan first.

## When you finish a turn

Tell the user:
- Which task you just completed (referencing §5 item, e.g., "B.2 idle carousel done")
- Updated §A / §C entries (one-line each)
- Next unchecked task in the active Phase
- Whether the Phase is now ✅ (and if so, ask whether to proceed to the next)
- Any §D entries added or §B reversals logged
