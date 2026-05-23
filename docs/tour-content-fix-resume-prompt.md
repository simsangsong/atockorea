# Tour-Product EN Content Fix — Session Resume Prompt

This document is the **master handoff prompt for the next session** of the multi-phase tour-product content fix track started 2026-05-23.

Paste the content of this file (the `## PROMPT` section below) at the start of a new Claude Code session to resume cleanly.

---

## PROMPT

You are resuming the multi-phase **tour-product EN content fix track** started in session 2026-05-23. The previous session shipped **4 PRs to main** covering Phases 1a / 2a / 4a / 5a (EN only). The next phase is **Phase A — catalog/page vs offer/checkout price reconciliation** (P0, customer-pricing-fraud risk).

### 1. Branch / worktree (use, do not recreate)

- Worktree: `C:\Users\sangsong\atockorea-content-fix`
- Branch: `fix/tour-content-en-audit-2026-05-23`
- Always rebase on `origin/main` after every merged PR: `git fetch origin main && git rebase origin/main`
- `gh` CLI is NOT installed — use GitHub REST API + git credential helper (pattern shown below).

### 2. Read first (in this order)

1. `docs/tour-content-fix-plan-2026-05-23.md` — **master plan, source of truth** for phasing, decisions, status. The phase table in §1 has been revised to insert Phase A/B/C/D/Z before Phase 3.
2. `docs/tour-product-en-content-audit-2026-05-23.md` — original audit (input to the plan).
3. `docs/tour-product-en-content-fix-plan-2026-05-23.md` — **parallel-session plan, cross-referenced in master plan §2bis**. Findings adopted: Phase A/B/C/D/Z. Findings rejected: cruise-return-guarantee softening (user directive #4 keeps it strong).
4. `docs/pickup-dropoff-weather-data-correctness-plan-2026-05-23.md` — PR #9 already merged. This track's Phase 2a supersedes its Phase 3/4 for the Jeju cruise "hotel vs port" category error.
5. Memory entries (auto-loaded; respect them):
   - `feedback_data_preservation` — *additive-only* is the default, but for this track **user explicitly authorized surgical corrections** (the 11-point directive on 2026-05-23). Still: change only what is wrong; preserve adjacent copy.
   - `feedback_ship_workflow_authorized` — commit + PR + merge + push without per-task approval; `gh` not installed → REST API + git credential.
   - `feedback_worktree_isolation` — use this worktree, don't touch other sessions' branches.
   - `feedback_i18n_translate_script_drops_keys` — hand-edit locales; **do NOT run `translate-itinerary-builder-messages.mjs`**.
   - `feedback_progress_updates_korean` — progress reports in Korean (code/commits stay English).
   - `feedback_supabase_direct_writes` — `mcp__atockorea__execute_sql` INSERT/UPDATE authorized for tour-migration without per-batch approval.
   - `reference_tour_product_render_source` — **only rendered fields are customer-facing**: `TOUR_PRODUCT_VIEW_MODEL_KEYS` (in `components/product-tour-static/_shared/tourProductFullPageJsonTypes.ts`) + `seo` + `catalog_card`. `page_sections` / `matching_profile` / `matching_metadata` / `priceSource` are NOT rendered (latent data debt only — touch only when convenient via `replace_all`).

### 3. Shipped (do NOT re-ship)

| PR | sha | Phase | Effect |
|---|---|---|---|
| [#10](https://github.com/simsangsong/atockorea/pull/10) | `0fe21c98` | 1a EN | Fabricated reviews + `ratingStars` 5→0 + guide real names + "Love Korea Tours" + "similar local route" stubs + "Seoul-style pickup" leak + "UNESCO Legacy version" leak + bloom-refund "no fees, no questions" softened. **Cruise return guarantee preserved.** |
| [#11](https://github.com/simsangsong/atockorea/pull/11) | `28d68626` | 2a EN | Cruise `pickup_dropoff` → cruise terminals. Jeju: 제주항 + 강정항. Busan: 영도크루즈항 + 부산항국제여객터미널(초량). Incheon: Songdo (Yeongjong = airport, disambiguated). FAQ "hotel lobby" rewritten. **Cruise return guarantee strengthened, not softened.** |
| [#12](https://github.com/simsangsong/atockorea/pull/12) | `98a34706` | 4a EN | Seoraksan "only" → "first"; Tongildaebul "world's" → "Korea's"; Sinheungsa "world's oldest Seon" + "head temple" corrected; Seongeup "(UNESCO)" → "(Korean National Folklore Cultural Heritage)"; Micheon Cave NOT same lava-tube as Manjanggul; "triple-UNESCO" / "Triple Natural designation" site-specific accurate phrasing. 93 substitutions. |
| [#13](https://github.com/simsangsong/atockorea/pull/13) | `117b8f26` | 5a EN | Bomun cherry trees 9,000→2,800; Hallim cave 25 M→250,000 years; Suwon "only walled fortress" → "only walled fortress city with Uigwe records"; "Jewel in Palace 50 M viewers" → "peak ratings ~57%"; Camellia Hill ₩10k→₩12k adult (budget ≈30k→≈32k). |

### 4. Phase A — START HERE (Catalog $59 vs offer $69 — customer-pricing-fraud risk)

Per parallel-session plan §P0 + master plan §1 row "Phase A". 9 Jeju tours show one price on the page/catalog but a different price at the checkout offer.

**Known mismatches:**

| Tour slug | Catalog/page | Offer/checkout |
|---|---|---|
| east-signature-nature-core | $59 | $69 |
| jeju-cherry-blossom-tour-east-route | $59 | $69 |
| jeju-eastern-unesco-spots-day-tour | $59 | $69 |
| jeju-grand-highlights-loop | $79 | $69 |
| jeju-hydrangea-festival-tour-east-route | $59 | $69 |
| jeju-hydrangea-festival-tour-southwest-route | $59 | $69 |
| jeju-southern-top-unesco-spots-tour | $59 | $69 |
| jeju-west-south-full-day-authentic-tour | $59 | $69 |
| southwest-hallasan-osulloc-aewol | $59 | $69 |

**Step-by-step:**

1. **Discovery (read-only):**
   - `mcp__atockorea__execute_sql`: `SELECT slug, price, original_price, price_type FROM tours WHERE slug IN ('east-signature-nature-core', ...);`
   - `mcp__atockorea__execute_sql`: `SELECT tour_id, amount_minor, currency FROM tour_product_offers WHERE tour_id IN (SELECT id FROM tours WHERE slug IN (...));`
   - Cross-reference with each tour's `<slug>.en.json` `price.amountLabel` / `catalog_card.priceLabel`.
   - Build a 4-column table per tour: `catalog $` / `offer $` / `DB tours.price` / canonical decision.

2. **Decide canonical (ASK USER IN KOREAN):** for each of the 9 tours, which price wins? Default recommendation: the catalog/page price (what the customer clicks-through expecting) is canonical; update offer/DB to match. User may prefer the offer.

3. **Apply:** update DB via `mcp__atockorea__execute_sql` (direct-write authorized per memory). JSON edit only if catalog/page is also wrong. Update JSON-LD if it pulls from a different field.

4. **Verify:** post-fix re-query offer + tours rows; spot-check 1-2 page renders.

5. **Ship:** commit + PR + merge + push; update plan doc status table.

### 5. Subsequent phases (in order — each its own PR)

- **Phase B** — busan-plum + busan-spring: seasonal product handling + `$0` recommendations filter + seasonal availability gate.
- **Phase C** — `vehicle` price type code fix (`eastSignatureCheckoutContext.ts` converts to `person`).
- **Phase D** — Jeju cruise `itinerary_variants` → `routeVariants` (port-variant itineraries may not be rendering).
- **Phase 3** — Busan small-group cruise stop content rotation re-mapping (5 stops × 6 fields × correct `poi_key`).
- **Phase 5b** — remaining numerics (Nami admission, Morning Calm gardens count, Bukchon hanok, Herb Island Wednesday, Sanjeong Lake trail, Waujeongsa 4 contradictions, Ahopsan admission, Haenyeo time, schedule impossibilities).
- **Phase 6** — gallery image-location remap (9 tours; src ↔ location/caption alignment; non-English text in EN bundles).
- **Phase 7** — DMZ bridge 220→150m + typos ("A easy-to-follow", "the our … tour tour", "? photo" mojibake) + DMZ refund tone + add cancellation policy to pocheon-sanjeong + lunch-in-included list cleanup.
- **Phase Z** — verification harness: fetch all 33 EN URLs (200), blocked slug → 404, grep rendered HTML for `$0` / `similar local route` / `the our` / `route route` / `A easy` / `Ocean Suites Jeju Hotel` on cruise pages / `Steven` / `Chloe` / `Jina` / `Hays` / `Love Korea Tours` / `4.9/5 across` / `4.8/5 (` / `world's largest seated bronze` / `world's oldest Seon` / `only UNESCO Biosphere` / `Korea's only walled fortress,` (note trailing comma — body uses the longer correct phrasing); confirm Jeju cruise renders Jeju Port + Gangjeong variants; vehicle-priced products: multi-guest total = single fixed; seasonal tours blocked out-of-window; JSON-LD Offer price = booking card.
- **Locale propagation** (Phases 1b–f / 2b–f / 4b–f / 5 locales) — ko / ja / zh / zh-TW / es using retained scripts as templates.

### 6. Decisions to preserve (user-given)

- ✅ Cruise return guarantee = KEEP STRONG (user directive #4). Other plan softens — **REJECT**.
- ✅ Camellia Hill adult = ₩12,000 (user-confirmed).
- ✅ Bomun cherry trees ≈ 2,800 (Visit Gyeongju).
- ✅ Cruise terminals: Jeju (제주항 / 강정항), Busan (영도 / 초량), Incheon (Songdo).
- ✅ Edits in rendered fields only; `page_sections` untouched (latent).
- ✅ 6 locales (en/ko/ja/zh/zh-TW/es) eventually — EN first.

### 7. Reusable scripts already in branch

- `scripts/phase2-en-cruise.mjs` + `scripts/phase2-en-cruise-residuals.mjs` — pickup_dropoff structural replacement, parameterizable per locale.
- `scripts/phase4-en-unesco.mjs` — UNESCO factual sweep.
- `scripts/phase5-en-numerics.mjs` — numeric corrections.

Pattern for any new phase: write `scripts/phase<X>-en-<topic>.mjs` (or `-<locale>-<topic>.mjs`), validate JSON before/after each replacement, run residual scan.

### 8. Ship workflow recipe

```bash
# 1. Edit + validate
cd C:/Users/sangsong/atockorea-content-fix
node -e "JSON.parse(require('fs').readFileSync('<changed-file>','utf8'))"  # per changed file

# 2. Commit
cat > /tmp/p<phase>-commit-msg.txt <<'EOF'
fix(tour-content): <phase summary> (EN, Phase <X>)
<body>
Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
git -C C:/Users/sangsong/atockorea-content-fix add -A
git -C C:/Users/sangsong/atockorea-content-fix commit -F /tmp/p<phase>-commit-msg.txt
git -C C:/Users/sangsong/atockorea-content-fix push origin fix/tour-content-en-audit-2026-05-23

# 3. PR via REST API
cat > /tmp/cred-input.txt <<'EOF'
protocol=https
host=github.com

EOF
TOKEN=$(git credential fill < /tmp/cred-input.txt 2>/dev/null | awk -F= '/^password=/{print $2}')
cat > /tmp/p<phase>-pr-body.txt <<'PRBODY'
<PR body markdown>
🤖 Generated with [Claude Code](https://claude.com/claude-code)
PRBODY
BODY_JSON=$(cat /tmp/p<phase>-pr-body.txt | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>console.log(JSON.stringify(s)))")
PAYLOAD=$(printf '{"title":"<title>","head":"fix/tour-content-en-audit-2026-05-23","base":"main","body":%s}' "$BODY_JSON")
curl -sS -X POST -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" https://api.github.com/repos/simsangsong/atockorea/pulls --data-binary "$PAYLOAD" > /tmp/pr.json
PR_NUM=$(node -e "console.log(require('fs').readFileSync('/tmp/pr.json','utf8'))" | node -e "let s='';process.stdin.on('data',d=>s+=d);process.stdin.on('end',()=>{console.log(JSON.parse(s).number)})")

# 4. Merge via REST API
curl -sS -X PUT -H "Authorization: Bearer $TOKEN" -H "Accept: application/vnd.github+json" -H "X-GitHub-Api-Version: 2022-11-28" -d "{\"merge_method\":\"merge\",\"commit_title\":\"Merge PR #${PR_NUM} — Phase <X>\"}" "https://api.github.com/repos/simsangsong/atockorea/pulls/$PR_NUM/merge"

# 5. Rebase
git -C C:/Users/sangsong/atockorea-content-fix fetch origin main --quiet
git -C C:/Users/sangsong/atockorea-content-fix rebase origin/main

# 6. Update plan doc §1 status table + §4 change log
```

### 9. Constraints / gotchas

- `Edit` tool requires `Read` on the file in the *current session* — Read each target file before editing.
- Bash cwd resets between turns — use absolute paths to the worktree, or `git -C <worktree>`.
- Bash heredocs choke on inline apostrophes (`'`) — write scripts to `scripts/*.mjs` files via `Write` tool, run via `node scripts/<name>.mjs`.
- `JSON.stringify(JSON.parse(file), null, 2)` is a normalize-rewrite — fine for our files; for surgical text substitution prefer `txt.split(from).join(to)` then `JSON.parse(txt)` re-validation.
- Use `replace_all: true` on Edit when both top-level and `page_sections` carry the same wrong string — clean both for data hygiene.
- For locale propagation: each locale file is independently hand-authored; do NOT run the i18n translate script (drops EN keys). Use the retained scripts as templates and supply locale-specific find/replace strings.

### 10. First action when you start

```
1. Read docs/tour-content-fix-plan-2026-05-23.md (§1 status table, §2bis cross-reference, §4 change log)
2. TaskCreate for Phase A discovery, Phase A apply, Phase A ship
3. Begin Phase A discovery via mcp__atockorea__execute_sql
4. Report findings in Korean and ask user for canonical-price decision per tour
```

Good luck. The user's full directive from 2026-05-23 is captured in master plan §0 (결정 로그).
