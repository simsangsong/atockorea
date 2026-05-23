# Next-session master prompt — i18n 191-key gap cleanup

Paste the **PROMPT** section below into a new session to resume work.

---

## CONTEXT (read first, then execute the PROMPT)

### State as of 2026-05-23 EOD

| Component | Status |
|---|---|
| **EN tour-content fix track** | ✅ Phase 1a / 2a / 3 / 4a / 5a / 5b / 6 / 7 / A / B / C / D / Z all shipped |
| **Locale propagation (ko/ja/zh/zh-TW/es)** | ✅ Phase loc-A (PR #37) + loc-B (PR #38) shipped — 74 cross-locale offenders → 0 fabrications (5 residuals are legitimate correction-citations in description body) |
| **Phase Z jest test** | ✅ CI guard — 6/6 assertions, blocks regression on EN bundles |
| **i18n 191-key gap (this session's target)** | ⏳ pending |
| Phase 5b deferred (Waujeongsa / schedule arithmetic / Haenyeo) | ⏳ verify-then-fix, external source required |
| Phase 6 deferred (143 src↔location attribution) | ⏳ per-photo verify required |

### The problem to fix

The discovery audit found that **ja / zh / zh-TW / es each carry ~191 fewer keys than en / ko** in `messages/*.json`. Build stays green because next-intl falls back to the literal key string at runtime, but specific UI surfaces in non-EN locales render the bare key (e.g. `nav.tours.list`) or fall back to English. The user explicitly flagged this in /tours/list shelf labels work as a separate cleanup phase.

### Where the gap lives

- **Files**: `C:/Users/sangsong/atockorea/messages/{en,ko,ja,zh,zh-TW,es}.json`
- **Surfaces likely affected** (per memory + tours-list shelves work):
  - `/tours/list` shelf section labels (the curated shelves Phase 7 i18n)
  - Tour-product-detail booking-card / pickup / sticky-bar copy
  - Header / Footer recent additions (legal entity disclosure ones probably OK — those were 6-locale gated)
  - Matcher result page steps + best-match-preview block
  - Itinerary-builder unified planner / R0-R3 result-richness track
- **Memory rule**: `feedback_i18n_translate_script_drops_keys` — DO NOT run `scripts/translate-itinerary-builder-messages.mjs`. It rewrites `en.json` to its managed subset and silently drops keys. **Prefer hand-editing locale files** with a parity script.

### What the user wants

> *"i18n 191-key gap cleanup (non-EN locales)"* — explicitly listed as P1 next step in the previous session. The user said "가장 즉시 효과적인 건 #1 (다국어 UI 텍스트 누수 차단)".

### Constraints (binding from memory)

1. `feedback_data_preservation` — additive-only by default. Do not delete or restructure existing locale strings unless they're empty/identical-to-key duplicates.
2. `feedback_i18n_translate_script_drops_keys` — never auto-regenerate `en.json`. Hand-edit locale files.
3. `feedback_progress_updates_korean` — progress updates in Korean (code/commits English).
4. `feedback_ship_workflow_authorized` — when work is done + verified (build green / tests pass), commit + PR + merge + push without per-task approval. Use GitHub REST API via `git credential fill` token (gh CLI not installed).
5. `feedback_worktree_isolation` — use a dedicated git worktree. Default to `C:/Users/sangsong/atockorea-content-fix` (currently on `main`, clean) OR create a new one for i18n work.
6. Card SHA preservation does NOT apply (no `components/tour/TourListCard.tsx` edits).

### Resources

- Tour-content fix master plan: `C:/Users/sangsong/atockorea-content-fix/docs/tour-content-fix-plan-2026-05-23.md` — see §1 row "1b–f / 2b–f / 4b–f / 5 locales 잔여" (parent track for i18n work)
- Audit reference: `C:/Users/sangsong/atockorea-content-fix/scripts/phase-locale-audit.mjs` (Phase Z-style pattern audit, can be adapted to key-parity audit)
- Phase Z jest sweep: `C:/Users/sangsong/atockorea-content-fix/__tests__/tour-content/phase-z-known-bad-strings.test.ts`

### Recent ship history (for context, do NOT re-do)

- PR #36 — Phase Z verification harness (jest known-bad strings sweep)
- PR #37 — Locale propagation Phase A (mechanical: encoding / EN literal / review aggregates)
- PR #38 — Locale propagation Phase B (guide names / DMZ / Bukchon / cruise port pickup + EN Phase 7 residual)

### Out of scope for this session (parked)

- Phase 5b verify-then-fix items (need external source verification)
- Phase 6 photo-attribution mismatches (per-photo verify required)
- pocheon-sanjeong cancellation policy schema addition
- "recently" → "since 2024" sweep
- tour-room Phase 1 QA (commit `f9313539` pushed to `origin/feat/tour-room-adaptive-tab`, awaiting interactive QA)
- template branch (5 unpushed-now-pushed commits at `origin/template/master-plan-2026-05-19`, awaiting QA)

### Worktree map

| Path | Branch | State |
|---|---|---|
| `C:/Users/sangsong/atockorea` | `fix/tour-pickup-dropoff-weather-correctness` | Clean (reset to origin/main 2026-05-23) |
| `C:/Users/sangsong/atockorea-content-fix` | `main` | Clean — **USE THIS or create new worktree** |
| All others | various feature branches | Already merged to origin/main; do not touch |

---

## PROMPT (paste this into the new session)

You are resuming the tour-content fix track. Read `C:/Users/sangsong/atockorea/docs/next-session-master-prompt-i18n-191-key-gap-2026-05-23.md` (this file) end-to-end first.

**Today's goal**: close the i18n 191-key gap between en/ko (canonical) and ja/zh/zh-TW/es. Build stays green via next-intl key-string fallback, but non-EN locales render bare keys or English on several UI surfaces — that's a trust-damaging leak.

### Step 1 — Discovery

Work from `C:/Users/sangsong/atockorea-content-fix` (currently on `main`, clean). Create a new branch: `git checkout -B fix/i18n-191-key-gap-2026-05-23`.

Write `scripts/i18n-key-parity-audit.mjs` that:
1. Reads all 6 locale files (`messages/{en,ko,ja,zh,zh-TW,es}.json`)
2. Flattens each to dot-paths (`section.subsection.key`)
3. Reports per-locale: how many keys are present vs `en.json` baseline
4. Reports missing-key list per locale, grouped by top-level section so you can see which surfaces leak (`nav.*`, `footer.*`, `home.*`, etc.)
5. Reports any key present in a non-EN locale but absent in `en.json` (orphan keys — should be deleted)

Run it. Confirm the ~191-key gap. Note which sections concentrate the gap.

### Step 2 — Translate

For each missing key in ja/zh/zh-TW/es:
- Use the `en.json` (or `ko.json` if it's a Korean concept) value as source
- Hand-translate to target language matching the existing tone in that locale (compare against nearby strings)
- Avoid `scripts/translate-itinerary-builder-messages.mjs` — it silently drops keys (`feedback_i18n_translate_script_drops_keys`)

Group translations into a single `scripts/phase-loc-c-key-parity.mjs` that:
- Reads each non-EN locale file
- For each missing path, sets the translated value via property-path mutation (not literal-string replace)
- JSON.parse round-trip per file before write
- Per-file delta counter

### Step 3 — Verify

1. `node scripts/i18n-key-parity-audit.mjs` — confirm 0 missing keys across all locales
2. `npx jest __tests__/tour-content/phase-z-known-bad-strings.test.ts` — confirm EN sweep still green
3. `npm run build` — confirm Next.js build green
4. Spot-check 3-5 surfaces in browser: `/`, `/tours/list`, `/match`, `/itinerary-builder/jeju` in each locale (URL prefix `/ko`, `/ja`, `/zh`, `/zh-TW`, `/es`)

### Step 4 — Ship

Update `C:/Users/sangsong/atockorea-content-fix/docs/tour-content-fix-plan-2026-05-23.md` §1 with a new row "loc-C i18n key parity" + §4 change-log row including per-locale key-count delta.

Commit, push, open PR, merge via REST API (gh CLI not installed; use `git credential fill` token + Node https request, see PR #38 for the exact pattern).

PR title: `fix(i18n): close 191-key gap across ja/zh/zh-TW/es locales`

Per `feedback_ship_workflow_authorized`: when build green + audit green + Phase Z passing + spot-check confirmed, commit + PR + merge + push without per-task approval.

### Step 5 — Update memory

After merging, add a memory entry under `feedback_i18n_translate_script_drops_keys` updating "drift" → "closed 2026-05-XX via PR #XX". This is a one-line update; don't create a new file.

### Done

Tell the user (in Korean): "i18n 191-key gap 정리 완료. PR #XX 머지. 다음 후보는 Phase 5b 잔여 (verify-then-fix 외부 출처 검증 필요) 또는 Phase 6 잔여 (143 photo attribution per-photo verify). 어느 쪽 진행할까?"
