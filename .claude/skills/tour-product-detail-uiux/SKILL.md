---
name: tour-product-detail-uiux
description: Drives all work on AtoC Korea's tour-product detail page (`/tour-product/[slug]`) UI/UX upgrade — hero, subnav, at-a-glance, atmosphere gallery, day-flow, timeline, pickup/dropoff, included, fit, practical details, booking support, FAQ, reviews, recommendations, desktop booking card, mobile sticky booking bar, and the `tour-product-v2-static-root` scope CSS. Wires every task back to the master planner at `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` (integrated execution plan) so Sprints advance in order, binding decisions are honored, code reality is verified, and scope creep is parked instead of silently absorbed. The 1차 진단(`docs/tour-product-detail-ui-ux-audit.md`) and Codex 리뷰(`docs/tour-product-detail-ui-ux-audit-review-2026-05-17.md`) are reference history only — the response doc is the single source of truth. Invoke any time the user mentions (in English or Korean) — tour product detail / 투어 상세 페이지 / 상세페이지 UI / 상세페이지 UX / 상품 상세 / `/tour-product/[slug]`, booking card / 예약 카드 / 부킹 카드 / right-rail booking, sticky booking bar / sticky CTA / 스티키 CTA / 하단 고정 예약, tour hero / 투어 히어로 / hero auto-slide / Ken Burns, atmosphere gallery / 분위기 갤러리 / bento collage / lightbox, day flow / 데이 플로우 / route flow / 일정 미리보기, timeline / 타임라인 / stop cards / 스톱 카드, pickup dropoff / 픽업 / 드롭오프 / 픽업 카드, included section / 포함사항 / inclusions, fit section / 적합도 / Best For / Less Ideal / Route Logic, practical details / 실용 정보 / weather strip / seasonal variations, booking support / 예약 후 안내 / support steps, FAQ section / 자주 묻는 질문, reviews section / 리뷰 섹션 / review summary, recommendations / 추천 상품 / You might also like, subnav / TourTabsNav / 탭 네비게이션 / sticky subnav, design system / 디자인 시스템 / 토큰 정리 / color tokens / type scale / elevation tokens, 색상 다이어트 / color discipline / palette diet, accordion 다이어트 / accordion 축소, drawer animation / drawer 속도, CTA primary / CTA 색상 / CTA 가격 통합 / Reserve total price, watermark / TourPhotoOverlay, scope CSS / `tour-product-v2-scope.css` / `tour-product-v2-static-root`, the tour-product detail master plan / 투어 상세 마스터 플랜 / 통합 실행 플랜 / 'read the tour detail plan' / '상세페이지 마스터 플랜 읽어줘', or any Sprint labeled Sprint 1 / Sprint 2 / Sprint 3 / Sprint 4 / Sprint 5+ (these labels are unique to this plan — landing-page-uiux uses 0a/0b/0c/B/C/D/E, itinerary-builder uses numeric Phase 1-6). ALSO auto-invoke when the user opens a session and asks to start/continue the tour-product detail master plan or its Sprints, or when editing any file under `components/product-tour-static/`.
---

# Tour-Product Detail UI/UX Upgrade skill

You are working inside the atockorea project's "tour-product detail page (`/tour-product/[slug]`) UI/UX upgrade" feature. The master planner is `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` (the **integrated execution plan** that merges Claude's 1차 audit with Codex's review). **It is the single source of truth for Sprint order, binding decisions, scope, anti-patterns, and rollback guards.**

The other two docs are **reference only — do not act on them directly**:
- `docs/tour-product-detail-ui-ux-audit.md` — 1차 진단 (some of its prescriptions were rolled back by the response doc; treat as diagnostic history)
- `docs/tour-product-detail-ui-ux-audit-review-2026-05-17.md` — Codex peer review (its safer ordering was absorbed into the response doc; refer back only for original reasoning)

## Step 0 — Always do this first

1. Read `docs/tour-product-detail-ui-ux-audit-response-2026-05-17.md` end-to-end. Do not skim. Especially:
   - **§1 내가 수용하는 부분** — what was rolled back from the 1차 plan (these are binding reversals)
   - **§2 더 강하게 밀어야 하는 부분** — binding strong-form decisions (color diet 17→5, type scale enforcement, accordion 8→2, CTA+price integration, At-A-Glance text pills)
   - **§3 통합 실행 플랜 (Sprint 1-4)** — the active Sprint's task table
   - **§5 즉시 실행 Top 8** — the recommended first PR
   - **§6 가드레일** — token enforcement, feature flag, multi-locale LCP, animation tempo
2. If a `## §A 상태 대시보드` section does **not yet exist** in the master plan, ADD it at the top before starting any code work. Template:
   ```
   ## §A 상태 대시보드
   | Sprint | 상태 | 시작일 | 완료일 | 마지막 커밋 |
   |---|---|---|---|---|
   | Sprint 1 (컨버전 안전) | ⏳ | — | — | — |
   | Sprint 2 (토큰 + 색상) | ⏳ | — | — | — |
   | Sprint 3 (콘텐츠 접근성) | ⏳ | — | — | — |
   | Sprint 4 (Hero / Gallery) | ⏳ | — | — | — |
   | Sprint 5+ (장기 polish) | 📦 | — | — | — |

   ## §B 결정 로그 (binding)
   | 날짜 | 결정 | 이유 |
   |---|---|---|

   ## §C 변경 로그
   | 날짜 | 작업 | 커밋 | 비고 |
   |---|---|---|---|

   ## §D 보류 / parked
   | 항목 | 이유 | 재검토 시점 |
   |---|---|---|
   ```
   Commit the planner edit BEFORE writing any feature code.
3. From §A, identify the active Sprint (🔄). If none is active, the state is "between sprints — awaiting direction." In that case do NOT pick a Sprint yourself; ask the user which Sprint to begin.
4. From the active Sprint's task table in §3, identify the next unchecked row. That's the next thing you do.
5. **Verify code reality before editing.** The 1차 audit asserted things like "TourPhotoOverlay watermark on every photo" and "Recommendations cards photo dark gradient" — re-read the actual files (`grep`/`Read`) before claiming a section "does X" or "needs Y". File paths are in the master plan's 부록.

## Working rules (priority order)

1. **Never deviate silently.** If the user asks for something not in the active Sprint's task list:
   - (a) It belongs to a later Sprint → say "this is Sprint N work; we're on Sprint M" and ask whether to switch (log the switch in §A + §B).
   - (b) It's genuinely new scope → add it to §D and ask whether to pause current Sprint to plan it.
   - (c) It's a clarification or bug-fix on in-flight work → just do it and note it in §C.
2. **Update the planner after every commit.** Specifically: §A active Sprint status, §A "마지막 커밋" cell, §C 변경 로그, and the relevant §3 Sprint table checkbox. The planner stays in sync with git — non-negotiable.
3. **Per-Sprint acceptance is mandatory** before marking ✅:
   - **Sprint 1:** booking checkout flow 5종 QA pass (date 선택 / guest 변경 / duration / available / unavailable / 결제 진입). Drawer animation measured ≤ 0.34s. CTA price-integration QA in 5 locales (ko/en/ja/zh/es).
   - **Sprint 2:** `grep -E "(rose|amber|orange|sky|violet)-[0-9]+" components/product-tour-static/` returns near-zero decoration usage. Color count ≤ 5 (brand/accent/success/danger/neutral).
   - **Sprint 3:** accordion count ≤ 2 (FAQ + Practical). Eyebrow class count = 1.
   - **Sprint 4:** Hero autoplay = OFF. Mobile LCP regression ≤ +50ms vs baseline. Scroll-freeze re-test passes.
4. **One Sprint at a time.** Don't start Sprint N+1 tasks while Sprint N has unchecked rows. Sprint 2 depends on Sprint 1 conversion baseline being measured. Until Sprint 1 ✅, Sprint 2 is "boxed" not "started."
5. **Decisions in §B + the response doc §1 + §2 are binding.** Examples that CANNOT be reversed without explicit user override + §B reversal row:
   - Hero NOT raised to 60vh
   - Trust strip stays in current location (only color + repetition reduced)
   - Radius is role-based (chip 8 / control 10-12 / card 12-16 / booking 18-20 / modal 20) — NOT mechanical 8/12/16
   - Color count 17 → 5 (brand/accent/success/danger/neutral) is non-negotiable
   - Accordion 8 → 2 (FAQ + Practical only) is non-negotiable
   - CTA must use `bg-primary` (#2e5c8a), not `bg-foreground`
   - CTA label includes total price (Airbnb pattern)
   - Drawer animation 0.78s → 0.30s
   - Watermark policy: lightbox first, hero/gallery policy-pending
   - Token enforcement (ESLint rule for inline pixel/hex) is required for Sprint 2 ✅
6. **Conversion-first ordering is binding** (Codex absorbed). Sprint 1 (CTA / drawer / booking card) MUST precede Sprint 2 (visual system) MUST precede Sprint 3 (content) MUST precede Sprint 4 (hero/gallery). Reordering requires §B reversal + user approval.
7. **Multi-locale QA gate.** Any PR touching CTA label, hero overlay text, or section heading copy MUST verify rendering in 5 locales (ko/en/ja/zh/es). Skipping this gate auto-fails the PR.
8. **Scroll-freeze guardrail.** Prior user-reported regression: detail page scroll freeze. NEVER add: new scroll-linked animation, stacked backdrop-blur, new slider/carousel library, hero video, heavy IntersectionObserver layout reads. The existing Ken Burns + slide crossfade is the ceiling.
9. **Anti-patterns (below) are non-negotiable.** No 60vh hero. No mechanical radius. No trust-strip removal. No 13-item Phase-1 megabundle. No new libraries. No accordion preservation in §3.
10. **Code reality > planner assertion.** If a file's actual state contradicts what the audit doc claims, update the audit doc's §1 with a "사실 수정" note + log in §C. Never proceed on a stale fact.

## Specific protocols

### When starting a Sprint
- Update §A: set status to 🔄, fill "시작일."
- Add one-line §C entry: "Sprint X started — <one-line summary>."
- Commit the planner edit BEFORE writing any Sprint code.

### When advancing within a Sprint
- After each sub-task commit:
  - Tick the checkbox in §3 for that row.
  - Update §A "마지막 커밋" with new hash.
  - Add one-line §C entry.

### When finishing a Sprint
- Run all acceptance checks (rule 3 above) for that Sprint.
- Paste evidence into §C (QA log, screenshot path, color grep output, drawer ms measurement, LCP delta, locale screenshots).
- Update §A: set status to ✅, fill "완료일", append commit hashes.
- Ask the user whether to start the next Sprint or pause.

### When user pushes back / changes their mind
- §B decision reversal: append new row with date + new decision + reason. Do not delete the old row.
- Sprint order change: log in §B + visibly mark in §3 (strikethrough, not delete).
- Scope cut: move cut work to §D with reason.

### When code reality conflicts with the master plan
- Update the master plan's §1 (코드 실사 메모) — add a "사실 수정 — <file>:<line>" entry.
- Log in §C as "사실 수정."
- If the contradiction invalidates a §B decision, append reversal row in §B.

### Per-step deliverable format (matches landing-page-uiux + itinerary-builder convention)
After each step, write a one-line visual changelog the user can scan without opening files. Example: `Sprint 1.1 done — drawer animation 0.78s→0.30s landed (TourStickyBookingBar.tsx:319,334). Verified on 390×844 iOS Safari + 412×915 Pixel.`

## Anti-patterns to refuse

- ❌ "Just bundle all Phase-1 visual changes into one PR" → that's the 1차-plan mistake Codex rolled back. Split into ≤ 6 changes per PR.
- ❌ "Raise hero to 60vh, like Airbnb" → §1.2 rollback. Tour detail ≠ landing. Booking info would be pushed below fold. Max allowed: data 360 → 420 desktop only.
- ❌ "Move trust strip into booking card and remove the hero-adjacent one" → §1.4 rollback. Keep location, only monochrome + reduce repetition from 5→2.
- ❌ "Use radius 8/12/16 universally" → §1.3 rollback. Role-based scale (chip 8 / control 10-12 / card 12-16 / booking 18-20 / modal 20).
- ❌ "Keep some decoration colors (rose / amber / sky / violet / orange)" → §2.1 binding. 17→5 is non-negotiable. Success/danger only for state.
- ❌ "Keep Included / Fit / Pickup / Support accordions, just style them better" → §2.3 binding. Accordion count must drop to 2 (FAQ + Practical).
- ❌ "Use At-A-Glance dots in monochrome instead of text pills" → §2.5 binding. Replacement is text pills (Easy/Moderate/Vigorous), not dots-in-one-color.
- ❌ "Add Hero overlay with title + price + ★ + location all together" → §1.2 conditional. Only rating + location may be tried in Sprint 4, and only after multi-locale QA. Title and price overlay are parked in §D.
- ❌ "Add interactive Mapbox / Google JS map now" → §3 Sprint 5+. Cost / scroll-freeze / mobile gesture conflict guard.
- ❌ "Add dark mode now" → §3 Sprint 5+.
- ❌ "Skip the multi-locale QA, it's just a CTA label change" → rule 7 violation. Auto-fail.
- ❌ "Define tokens first, apply later" → §1.5 rollback. Tokens are defined inside the same PR that uses them, never alone.
- ❌ "Add framer-motion `<AnimatePresence>` to hero" → scroll-freeze guard (rule 8). Existing animations are the ceiling.
- ❌ "Skip §A planner update, I'll do it later" → rule 2 violation. Planner + code in same PR or no PR.
- ❌ Marking a Sprint ✅ without running its acceptance checks (rule 3).
- ❌ Editing anything under `components/product-tour-static/` without reading the master plan first.
- ❌ Reading just §0 + §3 of the plan — you MUST read §1 + §2 + §6 each session because those are the binding decisions and guardrails.

## File map (covered by this skill)

- `app/tour-product/[slug]/page.tsx` (page entry, SSR)
- `components/product-tour-static/_shared/TourProductDetailClient.tsx` (orchestrator)
- `components/product-tour-static/east-signature-nature-core/tour-detail-sections/` (all 17 section components)
- `components/product-tour-static/east-signature-nature-core/tour-product-v2-scope.css` (scope tokens)
- `components/product-tour-static/_shared/bookingShared.ts` + booking helpers
- `components/product-tour-static/_shared/TourPhotoOverlay.tsx` (watermark)
- `components/product-tour-static/_shared/TourStopDetailDrawer.tsx` (drawer)
- Anything under `components/product-tour-static/` that affects detail page visual / interaction

Out of scope (defer to other skills or ask user):
- `components/home/v2/*` → `landing-page-uiux`
- Itinerary-builder feature → `itinerary-builder`
- Admin / merchant / checkout flows → no skill yet, plan separately

## When you finish a turn

Tell the user:
- Which task you just completed (referencing §3 Sprint row, e.g., "Sprint 1.2 CTA bg-primary done")
- Updated §A / §C entries (one-line each)
- Next unchecked task in the active Sprint
- Whether the Sprint is now ✅ (and if so, ask whether to proceed to the next)
- Any §D parked items added or §B reversals logged
- Locale QA status if the change touched user-visible copy
