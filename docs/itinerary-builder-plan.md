# Custom Itinerary Builder — Master Planner

> **Single source of truth** for the map + POI + AI-itinerary feature.
> This is a living document: status, decisions, change log, and the
> 6-phase plan all live here. The `/itinerary-builder` skill is wired
> to load this first before any work in this feature area.
>
> **Anyone (Claude or human) starting work on this feature MUST read
> this whole doc, find the current phase, and either advance it or
> update §A (status) and §B (decisions) before deviating.**

---

## A · Status dashboard

| Field | Value |
|---|---|
| **Current phase** | Phase 3 — Map UI + `/tours` restructure + home v2 entry 🔄 in progress |
| **Blocked on** | — (open follow-ups: i18n auto-translate tool choice [§F P3 task], visual review checkpoints during build) |
| **Last updated** | 2026-05-17 |
| **Last commit touching this feature** | `9a873013` — docs(itinerary-builder): sync planner with Phase 2 commit hash e84d15ba |
| **Owner** | simsangsong |
| **Reviewers** | — |

### Phase progress

Revised 2026-05-16 after D1-D8: original 6 phases → 7 phases (new Phase 5 for auto-quote engine; Phase 3 absorbs /tours restructure + home v2 entry; Phase 4 absorbs Q&A intake with cruise/private branch).

| Phase | Status | Started | Done | Commit hash(es) |
|---|---|---|---|---|
| 0 — Audit & plan | ✅ complete | 2026-05-16 | 2026-05-16 | `a732e63f` |
| 1 — POI catalog seed (jeju + busan) | ✅ complete | 2026-05-17 | 2026-05-17 | `98bb99ef` |
| 2 — Coordinate enrichment | ✅ complete | 2026-05-17 | 2026-05-17 | `e84d15ba` |
| 3 — Map UI read-only + `/tours` restructure + home v2 entry section | 🔄 in progress | 2026-05-17 | — | (pending) |
| 4 — Q&A intake (private / cruise branch) + cart + manual quote form | ⏸ not started | — | — | — |
| 5 — Auto-quote engine + admin presets + Slack escalation + quote memory | ⏸ not started | — | — | — |
| 6 — POI matching_profile authoring | ⏸ not started | — | — | — |
| 7 — AI recommendation engine | ⏸ not started | — | — | — |

Legend: ⏸ not started · 🔄 in progress · ✅ complete · ⚠️ blocked · ❌ abandoned

---

## B · Decision log

Append a new row whenever a §5 question gets answered or a new architectural call is made. Never silently change a decision — always log here with date + reason.

| Date | Decision ID | Decision | Reason / context |
|---|---|---|---|
| 2026-05-16 | — | Audit complete; Google Maps confirmed as map vendor (already integrated) | `@react-google-maps/api 2.20.7` + env key already in place — switching cost zero |
| 2026-05-16 | — | Map ID created with **vector** rendering, tilt OFF, rotation OFF | Premium feel, GPU-accelerated cluster perf, top-down clarity for planning UX; mobile gesture safety (§G.2) |
| 2026-05-16 | — | New env var `NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID` (Vercel: Production + Preview + Development) | Map ID is not a secret; security enforced by API-key HTTP referrer restrictions |
| 2026-05-16 | D1 | **jeju + busan** (2 regions for MVP); seoul deferred | Focuses MVP on highest-tourism regions; seoul DMZ/suburbs complexity deferred to post-MVP |
| 2026-05-16 | D3 | **Extend** `match_pois` (add `lat`, `lng`, `matching_profile`, `default_stay_minutes`, `category` cols) — no new tables for POI catalog | Single source of truth; simpler schema; reuses existing `poi_key` indexing |
| 2026-05-16 | D4 | **Auto-quote engine** — admin pre-configures base conditions via Q&A; user intent within scope → auto-quote computed; intent outside scope → Slack escalation to ops; manual quotes saved and reused as precedent for future same-condition requests | **Revises original "email+Slack+DB row" simple model.** Significantly larger scope — promoted to dedicated Phase 5 (was a sub-task of old Phase 4). |
| 2026-05-16 | D5 | **No auth**; URL params carry cart state (share-able links) | Confirmed recommendation |
| 2026-05-16 | D6 | i18n strategy: author **EN messages first**; auto-translate pipeline produces `ko / ja / zh / zh-TW / es` | Reduces Phase 3 i18n authoring cost; human review pass before locale release (see §H R8) |
| 2026-05-16 | D7 | Entry points: (a) new **home v2 section** linking to builder; (b) restructure `/tours` — **remove busan/seoul/jeju private-tour static pages**, keep only shore excursions (with match CTA inside); (c) add "Want a private tour?" **CTA card on top of `/tours`** linking to Q&A intake | Single canonical path to the builder; legacy 5 private-tour static pages superseded. Retirement strategy: 301 redirects to `/itinerary-builder/<region>` to preserve SEO (see §H R7). |
| 2026-05-16 | D8 | Q&A intake has **two branches**: (i) **private-tour track** = land itinerary builder (our main flow), (ii) **cruise track** = shore excursion sequencer with shorter time window (back-to-ship constraint). Branched at first form question | Cruise has a distinct price model + hard time constraint; separate pricing presets in Phase 5 |

---

## C · Change log

One line per material change to this doc or per phase deliverable.

| Date | Commit | Change |
|---|---|---|
| 2026-05-16 | `a732e63f` | Initial audit + plan written (Phase 0) |
| 2026-05-16 | `e7666abf` | Google Maps API key + vector Map ID setup completed externally; §B decisions D1–D8 logged; §F revised from 6 → 7 phases (new Phase 5 = auto-quote engine; old Phases 5/6 renumbered to 6/7; Phase 3 expanded to include `/tours` restructure + home v2 entry; Phase 4 expanded to include Q&A intake with private/cruise branching) |
| 2026-05-17 | `98bb99ef` | Phase 1 — POI catalog seed complete. Migration `20260517120000_add_match_pois_geo_and_profile.sql` applied (adds lat/lng/matching_profile/default_stay_minutes/category/names_other_locales + region+stop_role indexes). Seed script `scripts/seed-match-pois-from-tour-jsons.mjs` walked 36 tour dirs / 204 locale files and upserted **82 unique attraction POIs**. Verification: 82 rows with name_en, **49 in busan+jeju** (≥40 acceptance ✓), 0 missing region, 0 operational rows (is_operational is generated column = poi_key LIKE 'OPS_%'). 6-locale names populated; 64/82 have default_image_url, 74/82 have parseable default_stay_minutes. Original audit-derived threshold of "≥100" was based on raw audit count of 102 that included operational keys; filtered attraction count is 82 — acceptance threshold updated to reflect reality. |
| 2026-05-17 | (Phase 3 start) | Phase 3 started — implementation plan: (a) audit current `/tours` and 5 legacy private-tour routes; (b) install `@googlemaps/markerclusterer` if not present; (c) build `/itinerary-builder` landing + `/itinerary-builder/[region]` SSR shell with cluster filter (busan-cluster vs jeju); (d) `<POICatalogMap />` client with vector Map ID + AdvancedMarker + clusterer + InfoWindow; (e) EN messages under `itineraryBuilder.*`; (f) i18n auto-translate pipeline TBD; (g) `/tours` restructure with private-tour CTA card + 301 redirects; (h) new home v2 entry section; (i) responsive + Lighthouse check. Will land in 5–8 small commits with visual review checkpoints. |
| 2026-05-17 | `e84d15ba` | Phase 2 — Coordinate enrichment complete. **74 attractions all have lat/lng inside Korea bbox** (33.0–38.7 lat, 124.6–131.0 lng). Pipeline: (1) created separate **server-side Google Maps API key** (`GOOGLE_MAPS_API_KEY`, no app restrictions, Geocoding/Places/Distance/Directions enabled) since the public `NEXT_PUBLIC_*` key is referrer-restricted and Google rejects it from servers. (2) `scripts/geocode-match-pois.mjs` ran forward geocoding (`<name_ko> 한국` primary, `<name_en> South Korea` fallback, 250 ms throttle) → 82 OK / 0 MISS / 0 OUT_OF_BBOX, but inspection revealed 11 hits at Korea-center fallback (35.9078, 127.7669) and `jagalchi_market` mismapped to Cheonan. (3) `scripts/poi-coord-overrides.csv` built with 8 manual coords (`jagalchi`, `hallasan_1100_wetland`, `gyochon_hanok_village`, `hallim_park`, `ilchulland_*` ×2, `incheon_cruise_terminal`, `jeju_tangerine_picking`) re-geocoded with specific Korean queries (yielded ROOFTOP-grade results); applied via `--apply-overrides`. (4) **Region quality pass** (`scripts/audit-poi-regions.mjs` + `reclassify-poi-regions-from-csv.mjs`) — reverse-geocoded all 74 POIs, used `administrative_area_level_1` as authoritative source with word-boundary regex (avoiding the bug where "Minsokchon-ro" hit substring `sokcho`). Discovered **37 region corrections** needed from Phase 1's naive tour-level region tagging: `incheon → seoul` ×6, `seoul → gyeonggi` ×16, `seoul → gangwon` ×4, `busan → gyeongju` ×6, `busan → yangsan/ulsan/miryang` ×3, `seoraksan → gangwon` ×2. All 37 UPDATEs + 8 `route_variant_*` DELETEs (non-POI tour metadata) applied. (5) **Spot-check 15 famous POIs** all match known coords. Final distribution: jeju 25 / gyeonggi 16 / busan 11 / seoul 6 / gyeongju 6 / gangwon 6 / yangsan/ulsan/incheon/miryang 1 each = 74. **Busan-cluster** (busan+yangsan+gyeongju+ulsan+miryang) = **20**, **Jeju** = **25**, MVP-renderable = **45** (≥40 acceptance ✓). Seed script also patched to exclude `route_variant_*` for future runs. |

---

## D · Working protocol

**Mandatory for anyone (Claude or human) about to touch this feature:**

1. **Read this whole doc first.** Especially §A (status), §B (decisions), §F (phase plan).
2. **Confirm which phase is in progress** (§A row marked 🔄). If no phase is active, halt and ask the user which phase to start — do NOT pick one yourself.
3. **Within the active phase**, work on the next unchecked task (§F sub-checklists). Don't skip ahead.
4. **If the user requests work that contradicts the plan** (e.g., "skip Phase 5 and go straight to AI") — first update §B with a logged decision, then update §F with the revised order, THEN execute. Never silently re-route.
5. **After every commit in this feature area**, update:
   - §A "Last commit" field
   - §A phase status (start / progress / complete)
   - §C change log (one line)
   - The relevant §F sub-checklist
6. **Scope discipline:**
   - Do NOT silently bundle unrelated work into a phase commit. If new scope appears mid-phase, log it in §E (Scope creep registry) and ask.
   - Do NOT abandon a phase mid-flight to switch to a "more interesting" piece. Finish or explicitly pause.
7. **Acceptance criteria** at each phase cut-line MUST be verified before marking ✅ — see §F per-phase acceptance.

---

## E · Scope creep / parked ideas registry

Things that came up during this work but aren't in the 6-phase plan. Park them here; don't sneak them into a phase.

| Date | Idea | Why parked | Owner / next step |
|---|---|---|---|
| 2026-05-16 | Merge `poi_search_profile` (TourAPI 576-row table) with `match_pois` | Different ID scheme (TourAPI content_id vs poi_key); not blocking MVP | Post-MVP, after Phase 7 ships and beta feedback in |
| 2026-05-16 | `/admin/pois` browse + edit UI | Nice-to-have for tuning; not user-facing | Post-MVP |
| 2026-05-16 | ~~Auto-pricing for quotes (vehicle + driver + distance)~~ **PROMOTED → Phase 5 (D4 revised 2026-05-16)** | Originally parked as out-of-scope; D4 revision made it core | — |
| 2026-05-16 | Save itinerary to user account | Requires auth flow; URL params carry MVP value | Post-MVP |
| 2026-05-16 | Seoul region rollout (DMZ + suburbs + main) | D1 limited MVP to jeju + busan | After Phase 7 beta validates jeju/busan |
| 2026-05-16 | Admin UI for Phase 5 base-condition Q&A setup | Phase 5 may start with config-as-data (Supabase jsonb) before building an admin page | Decide during Phase 5 — escalate to admin UI only if rules get complex enough that JSON editing is error-prone |
| 2026-05-16 | Cruise shore-excursion match flow detail (reuse `/match` page or new surface?) | D8 split cruise into a separate intake branch but the result surface is TBD | Phase 4 design step |
| 2026-05-16 | Legacy private-tour static pages (busan, jeju, seoul-suburbs, incheon-seoul, seoul-dmz) — retirement timing & redirect map | D7 says remove from `/tours`; redirect mapping detail deferred | Phase 3 task — 301 redirects to `/itinerary-builder/<region>` (where region exists) or to `/itinerary-builder` landing |

---

## F · 6-phase plan

Each phase delivers a shippable artifact and has a clear "stop here if needed" cut-line. Sub-checklists are append-only — never delete completed items, just check them off so the change history is visible.

### Phase 1 — POI catalog seed (1-2 days)

**Scope per D1 2026-05-16:** jeju + busan only for MVP seed. (Seoul rows in source JSONs are seeded as-is for future, but Phase 3/4 UIs only render jeju + busan.)

**Deliverable:** `match_pois` rows fully populated for all unique poi_keys from tour JSONs.

**Migration to write first:** `supabase/migrations/<timestamp>_add_match_pois_geo_and_profile.sql`
- `ALTER TABLE match_pois ADD COLUMN lat numeric, ADD COLUMN lng numeric, ADD COLUMN matching_profile jsonb, ADD COLUMN default_stay_minutes integer, ADD COLUMN category text;`

**Tasks:**
- [x] Write migration `supabase/migrations/20260517120000_add_match_pois_geo_and_profile.sql`
- [x] Apply migration via `mcp__atockorea__apply_migration`
- [x] Write `scripts/seed-match-pois-from-tour-jsons.mjs` — walk all `components/product-tour-static/**/<slug>.<locale>.json`, dedupe by `_poi_meta.poi_key`, write `name_en, name_ko, names_other_locales jsonb, region, default_image_url, poi_meta, stop_role='attraction'` to `match_pois`. Skip operational keys (prefix `OPS_` AND `_poi_meta.match='transit_only'`). NOTE: `is_operational` turned out to be a generated column (`poi_key LIKE 'OPS_%'`); the seed writes `stop_role='attraction'` only and the flag is computed automatically.
- [x] Run script; **82 unique attractions seeded** (audit's 102 raw count included operational); spot-check 5 POIs across 6 locales — names populated for en/ko/ja/zh/zh-TW/es.
- [x] Verification SQL run via `execute_sql`: total rows, per-region count (busan 20 / jeju 29 / seoul 23 / incheon 7 / seoraksan 2 / suwon 1), 0 rows with null `region`, 0 rows with `stop_role='operational'`.

**Acceptance (revised after seed):**
- [x] `SELECT COUNT(DISTINCT poi_key) FROM match_pois WHERE name_en IS NOT NULL;` = **82** (≥80 — real attraction count after filtering `OPS_*` + `transit_only`)
- [x] `SELECT COUNT(*) FROM match_pois WHERE region IN ('busan', 'jeju') AND name_en IS NOT NULL;` = **49** (≥40 ✓)
- [x] Every populated row has non-null `region` (0 missing)
- [x] No row has `stop_role = 'operational'` (generated column `is_operational` confirms via `poi_key LIKE 'OPS_%'` pattern, 0 such rows in seed)

**Cut-line:** If we stop here, we have a clean POI inventory for any future product (admin browse, analytics).

---

### Phase 2 — Coordinate enrichment (0.5-1 day)

**Deliverable:** Every POI in `match_pois` has lat/lng populated.

**Tasks:**
- [x] Create separate server-side Google Maps API key (`GOOGLE_MAPS_API_KEY`, no app restrictions, Geocoding API enabled) — required because the `NEXT_PUBLIC_*` key has HTTP referrer restrictions which Google rejects from servers.
- [x] Write `scripts/geocode-match-pois.mjs` (replicates `lib/google-maps.geocodeAddress` pattern as standalone `.mjs` since the script doesn't go through next.js bundling).
- [x] For each POI without lat/lng: query `"<name_ko> 한국"` first, fall back to `<name_en> South Korea`. Throttle 250 ms between requests.
- [x] CSV audit `scripts/poi-coord-audit.csv` with poi_key, name_en, geocoded coords, formatted_address, location_type (ROOFTOP / GEOMETRIC_CENTER / RANGE_INTERPOLATED / APPROXIMATE), in_bbox flag, status.
- [x] Spot-check revealed 11 hits at Korea-center fallback (35.9078, 127.7669) for ambiguous queries, plus `jagalchi_market` mismapped to Cheonan.
- [x] `scripts/poi-coord-overrides.csv` built with 8 manual coords re-geocoded with specific Korean queries (`경주 교촌마을`, `제주 한림공원`, `인천항 국제여객터미널`, etc.) yielding ROOFTOP-grade results. Applied via `--apply-overrides`.
- [x] **Region quality pass**: `scripts/audit-poi-regions.mjs` reverse-geocodes every POI's stored lat/lng → derives `formatted_address` + `administrative_area_level_1` + `locality`; `scripts/reclassify-poi-regions-from-csv.mjs` uses admin1 as authoritative source with word-boundary regex (avoiding substring false-positives like "Minsokchon-ro" matching `/sokcho/`).
- [x] 37 region corrections applied: `incheon → seoul` ×6 (priority bug in initial seed), `seoul → gyeonggi` ×16, `seoul → gangwon` ×4, `busan → gyeongju` ×6, `busan → yangsan/ulsan/miryang` ×3, `seoraksan → gangwon` ×2.
- [x] 8 `route_variant_*` rows DELETEd (tour route metadata, not POIs — seed script also patched to exclude going forward).

**Acceptance:**
- [x] 100% of `match_pois` attractions have non-null lat AND lng (74/74).
- [x] All lat values in range 33.0–38.7, all lng in 124.6–131.0 (0 violations).
- [x] Visual spot-check of 15 famous POIs (Bulguksa, Tongdosa, Haedong Yonggungsa, Jagalchi, Seongsan Ilchulbong, Gyeongbokgung, N Seoul Tower, Cheomseongdae, Bomun Lake, Hwaseong Fortress, Dora Observatory, Nami Island, Seoraksan, Gamcheon, Songaksan) confirms address match — all within ±0.001° of known coordinates.
- [x] Final region distribution: jeju 25 / gyeonggi 16 / busan 11 / seoul 6 / gyeongju 6 / gangwon 6 / yangsan 1 / ulsan 1 / incheon 1 / miryang 1 = 74.

**Cut-line:** Catalog has accurate geographic data and clean region tags. Ready for Phase 3 map UI.

**Note for Phase 3:** Region filter must use **clusters**, not single literal region match:
- `/itinerary-builder/busan` → `region IN ('busan','yangsan','gyeongju','ulsan','miryang')` = 20 POIs
- `/itinerary-builder/jeju` → `region = 'jeju'` = 25 POIs
- (future) `/itinerary-builder/seoul` → `region IN ('seoul','gyeonggi','gangwon','incheon')` = 29 POIs

---

### Phase 3 — Map UI read-only + `/tours` restructure + home v2 entry (3-4 days)

**Per D6/D7 2026-05-16:** expanded from "just the map page" to include i18n pipeline, `/tours` restructure, and home v2 entry section.

**Deliverable:** `/itinerary-builder/[region]` renders the map with POI pins; `/tours` page restructured to surface the builder as the canonical path; home v2 has a new entry section.

**Tasks — map UI:**
- [ ] New route `app/itinerary-builder/[region]/page.tsx` (SSR shell, client child component)
- [ ] Resolve `region` param against allowed list (`busan | jeju` per D1); 404 otherwise.
- [ ] Read `match_pois` for region via Supabase server client.
- [ ] Build `<POICatalogMap />` client component:
  - Google Map with `mapId={NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID}` (vector rendering, tilt/rotate OFF — set in code via `gestureHandling`/`disableDefaultUI` partials)
  - Centered on region centroid (Busan 35.1796,129.0756; Jeju 33.4996,126.5312)
  - **AdvancedMarkerElement** per POI (vector path requires this, not legacy Marker)
  - `@googlemaps/markerclusterer` for cluster behavior on zoom-out
  - InfoWindow on marker click: image (`default_image_url`), name (locale-aware), summary line (first 140 chars of POI description), "Add to itinerary" button (disabled in Phase 3, enabled in Phase 4)
- [ ] Mobile-first sizing: map 100vh on mobile, side-by-side on md+.

**Tasks — i18n pipeline (D6):**
- [ ] Author EN strings in `messages/en.json` under `itineraryBuilder.*` (page title, intro copy, marker popup labels, CTA labels).
- [ ] Wire auto-translate pipeline (existing? new?) to fan out → `messages/{ko,ja,zh,zh-TW,es}.json`. Confirm pipeline location/tooling first.
- [ ] Human review pass on `ko` (highest traffic) before merge; other 4 locales reviewed async.

**Tasks — `/tours` restructure (D7):**
- [ ] Audit existing `/tours` page content + 5 legacy private-tour detail routes (busan, jeju, seoul-suburbs, incheon-seoul, seoul-dmz).
- [ ] Remove private-tour cards from `/tours` grid; keep shore excursions section + add Match CTA banner inside shore excursions.
- [ ] Add **"Want a private tour?" CTA card on top of `/tours`** linking to `/itinerary-builder` Q&A intake (intake form lands in Phase 4 — Phase 3 lands the card with `href` pointing to an interim "coming soon" or direct to `/itinerary-builder/[region]` selector).
- [ ] Add 301 redirects in `next.config.js` from legacy private-tour slugs → `/itinerary-builder/<region>` (where region matches) or `/itinerary-builder` selector (where not). SEO preservation.
- [ ] Delete the 5 legacy static-tour page components only after redirects verified live.

**Tasks — home v2 entry section:**
- [ ] New home v2 section (under `components/home/v2/sections/`) headlining the builder. Visual treatment follows memory `feedback_home_visual_energy.md` (amber eyebrow default, premium feel — not muted).
- [ ] Wire section into `components/home/v2/HomeV2Page.tsx` section order; default position TBD (recommend above ProcessSection).
- [ ] Section CTA → `/itinerary-builder` selector → user picks busan/jeju → routes to `/itinerary-builder/[region]`.

**Acceptance:**
- [ ] Page loads at `/itinerary-builder/busan` and `/itinerary-builder/jeju`; map shows ≥ 20 pins each.
- [ ] Vector rendering confirmed (smooth zoom, AdvancedMarker visible).
- [ ] Clicking any pin opens InfoWindow with image + name + 1-line desc + (disabled) Add button.
- [ ] `/tours` shows shore excursions only + "Want private tour?" CTA card on top; private-tour cards removed.
- [ ] Legacy private-tour URLs return 301 → builder route (curl `-I` verifies).
- [ ] Home v2 has new section visible in screenshot.
- [ ] `messages/en.json` complete; `messages/ko.json` reviewed; other 4 locales auto-translated.
- [ ] Page is responsive (DevTools mobile + tablet + desktop tested).
- [ ] No console errors; Lighthouse perf ≥ 70 on mobile.

**Cut-line:** Users can browse the curated POI map AND can find it from home + `/tours`. Can't build/save yet.

---

### Phase 4 — Q&A intake (private/cruise) + cart + manual quote form (3-4 days)

**Per D8 2026-05-16:** intake branches into private-tour vs cruise tracks at the first question (cruise has a shorter time window and different price model). Auto-quote pricing logic is **NOT** in this phase — that's Phase 5. Phase 4 only saves the request and routes to Slack (manual quote fallback) until Phase 5 lands the auto-quote engine.

**Deliverable:** End-to-end manual builder. User answers intake Q&A → routed to private OR cruise flow → picks POIs, reorders, sees drive estimate, submits a quote request that creates a DB row + Slack notification.

**Tasks — intake Q&A:**
- [ ] New route `app/itinerary-builder/page.tsx` (intake landing — region + cruise question + party + date).
- [ ] First question: "Are you arriving by cruise?" → branches:
  - **No (private-tour track):** standard land builder. Region question (busan/jeju). Party size. Date. Language. Special interests (multi-select).
  - **Yes (cruise track):** which port? (busan-cruise-port / jeju-cruise-port). Ship name + date. Time available (e.g., 6h / 8h / 10h). Onward language.
- [ ] Form persists answers to URL params (consistent with D5 share-able links): `?track=private&region=busan&date=...&party=4&lang=en&interests=temples,markets`
- [ ] On submit → route to `/itinerary-builder/[region]?...` (map view) with intake context preloaded into cart prompt.

**Tasks — cart + sequencing (carried over from old Phase 4):**
- [ ] Cart state in URL params: `?pois=tongdosa,bulguksa&date=2026-05-20&party=4&track=private` (so itineraries are share-able without auth).
- [ ] Cart UI: side panel on desktop, bottom-sheet on mobile (snap points 30%/90%).
- [ ] Drag-and-drop reorder via `@dnd-kit/core` (install if not present).
- [ ] Drive estimate: Haversine distance × 1.3 road factor × 50 km/h average → ETA per leg. Show total drive minutes + summed POI `default_stay_minutes`.
- [ ] **Cruise track only:** enforce hard time-budget — sum(stay + drive) ≤ user-selected window; warn if exceeded; refuse submit if exceeded by >30 min.
- [ ] Polyline overlay on map showing selected POI sequence in order.

**Tasks — manual quote form (Phase 5 will layer auto-quote on top):**
- [ ] Quote form modal: name / email / requested date / party size / language / notes (intake answers prefilled).
- [ ] `POST /api/itinerary/quote` route:
  - Write to new `tour_quote_requests` table (migration in this phase) with intake answers as `intake jsonb` column
  - Send Slack webhook notification to ops channel (`SLACK_QUOTE_WEBHOOK_URL`)
  - Send confirmation email to user via existing email service (`lib/email.ts`)
  - Return `{ quote_id, status: 'pending_manual' }` — auto-quote status added in Phase 5
- [ ] Success page: "We'll respond within X hours" + saved URL of the itinerary.

**Migration:** `<timestamp>_create_tour_quote_requests.sql` — id uuid PK, poi_keys text[], requested_date date, party_size int, contact_email text, contact_name text, language text, notes text, locale text, region text, track text CHECK (track IN ('private','cruise')), intake jsonb, source_url text, status text DEFAULT 'pending_manual', created_at timestamptz, manual_quote_amount_krw int NULL, manual_quote_response jsonb NULL, manual_responded_at timestamptz NULL.

**Acceptance:**
- [ ] Intake form at `/itinerary-builder` lands → answer Q&A → routes to map with prefilled context
- [ ] Cruise track enforces time budget; warning fires if exceeded
- [ ] Add 3 POIs from map → cart shows them in order
- [ ] Drag to reorder → URL updates → polyline redraws
- [ ] "Get quote" → form submit → DB row in `tour_quote_requests` (status=`pending_manual`) → Slack notification fires → user email sent
- [ ] Share URL → reopen → cart + intake context restored from URL params

**Cut-line:** Ship-able as v1 — every quote goes through Slack manual response. Phase 5 layers auto-quote on top without changing this flow.

---

### Phase 5 — Auto-quote engine + admin presets + Slack escalation + quote memory (3-5 days)

**Per D4 2026-05-16 (revised):** admin pre-configures base pricing conditions; in-scope itineraries get auto-quoted instantly; out-of-scope ones escalate to Slack; manual responses become reusable precedent.

**Deliverable:** Quote submission either returns an instant computed price OR escalates with a precedent reference; admin can configure presets without code changes.

**Architecture sketch:**
```
POST /api/itinerary/quote
  ├─ classify(intake + cart) → in_scope | out_of_scope (rule engine over admin presets)
  ├─ if in_scope:
  │   ├─ price = computeQuote(presets, intake, cart)   // base + per-POI + per-hour + per-person
  │   ├─ status = 'auto_quoted'
  │   └─ email user with price + "book" CTA, log row
  └─ if out_of_scope:
      ├─ lookup precedent in quote_memory (similar past quotes)
      ├─ Slack ops with intake + cart + suggested-precedent-price
      ├─ status = 'pending_manual'
      └─ email user "we'll respond within X hours"

POST /api/admin/quotes/[id]/respond  (ops manually responds via admin route)
  ├─ writes manual_quote_amount + condition_fingerprint
  ├─ emails user with quote
  └─ adds row to quote_memory keyed by fingerprint (track, region, party_band, hours_band, has_temple, ...)
```

**Tasks — schema:**
- [ ] Migration `<timestamp>_create_quote_presets_and_memory.sql`:
  - `quote_presets` (id, track, region, base_krw, per_poi_krw, per_hour_krw, per_person_krw, in_scope_rules jsonb, active boolean, updated_at) — admin-editable rows
  - `quote_memory` (id, condition_fingerprint text, intake jsonb, cart_poi_keys text[], manual_amount_krw int, notes, created_by, created_at) — precedent log
  - Extend `tour_quote_requests` (Phase 4 table): add `auto_quote_amount_krw`, `auto_quote_breakdown jsonb`, `precedent_quote_id uuid REFERENCES quote_memory(id)`.

**Tasks — admin Q&A presets (config-as-data first; admin UI parked in §E):**
- [ ] Define preset schema. Seed two rows: `track=private,region=busan` and `track=private,region=jeju` (+ later `track=cruise,*`).
- [ ] `in_scope_rules` jsonb examples: `{"max_hours": 10, "max_pois": 8, "party_size_max": 8, "allowed_categories": ["temple","nature","market","viewpoint"], "disallowed_pois": ["restricted_military_zone_*"]}`.
- [ ] Document seed values in `docs/quote-presets-seed.md` (separate file) so ops can review.

**Tasks — classification + auto-quote pipeline:**
- [ ] `lib/quote-engine/classify.ts` — pure function `classify(presets, intake, cart) → { in_scope: bool, violations: string[] }`.
- [ ] `lib/quote-engine/compute.ts` — pure function `computeQuote(preset, intake, cart) → { amount_krw, breakdown }`.
- [ ] `lib/quote-engine/fingerprint.ts` — produces stable hash of normalized intake+cart for memory lookup.
- [ ] `lib/quote-engine/memory-lookup.ts` — k-nearest precedent fetch (start with exact fingerprint match; expand to similarity later).
- [ ] Wire into `POST /api/itinerary/quote` (extending Phase 4 route — not replacing it).

**Tasks — Slack escalation + admin response:**
- [ ] Slack message includes: intake summary, cart POI list, suggested precedent price (if any), "Respond" link → `/admin/quotes/[id]`.
- [ ] `/admin/quotes/[id]` route — auth-gated (existing admin auth pattern); ops sees request + precedent; submits final price + notes.
- [ ] On ops submit: writes `quote_memory` row + emails user + closes request.

**Tasks — user UX:**
- [ ] Auto-quoted: instant price card on success page, "Book now" CTA → Stripe (reuse existing flow if exists in Phase 5 scope, else stub).
- [ ] Manual-pending: "We'll respond within X hours" + optimistic precedent estimate if available ("similar past quotes ranged $X-Y").

**Acceptance:**
- [ ] **In-scope private-tour request** (jeju, 6h, party 4, 3 POIs all in allowed categories) → auto-quote within <500ms, email contains computed price.
- [ ] **Out-of-scope request** (party 12, 12h, includes a disallowed POI) → Slack message fires within <2s, includes suggested precedent if memory has one.
- [ ] **Admin responds via `/admin/quotes/[id]`** → user email fires + `quote_memory` row created with fingerprint.
- [ ] **Second similar out-of-scope request** → Slack message references precedent_quote_id with prior amount.
- [ ] **Preset editing in Supabase Studio** (no admin UI yet) → next quote uses new prices without redeploy.

**Cut-line:** Auto-quote engine live for jeju+busan private track. Cruise auto-quote rules can be added incrementally as ops collects manual cruise quotes.

---

### Phase 6 — POI matching_profile authoring (1-2 days)

**Deliverable:** Every POI in `match_pois` has a `matching_profile` jsonb populated.

**Strategy:** Auto-derive from parent tours, then manual review pass.

**Tasks:**
- [ ] Write `scripts/derive-poi-matching-profiles.mjs`:
  - For each poi_key, find all `match_tours` rows that reference it via `anchor_poi_keys` OR via `match_itinerary_stops` join.
  - Weighted-average their `matching_profile` jsonbs (dimension-by-dimension; weight = `1 / N` where N = stops in that tour, so a POI in a 7-stop tour contributes less than the same POI as anchor of a 3-stop tour).
  - Filter to POI-relevant dimensions only — DROP tour-level dims (`private_fit`, `cruise_shore_excursion_fit`, `one_day_fit`, `family_pace_fit`, etc.) — KEEP `scenic_level`, `nature_fit`, `cafe_fit`, `family_fit`, `iconic_landmark_fit`, `cherry_blossom_fit`, `wheelchair_accessible_anchor_fit`, etc.
- [ ] Run; CSV export `scripts/poi-matching-profile-audit.csv` (poi_key, name_en, derived profile dimensions).
- [ ] Manual review — 10 obvious miscalibrations (gut check); hand-tune in an overrides JSON; re-import.

**Acceptance:**
- [ ] 100% of attraction POIs have non-empty `matching_profile` jsonb
- [ ] Spot-check: `scenic_level` is high for viewpoints, `nature_fit` high for parks/mountains, `iconic_landmark_fit` high for UNESCO sites
- [ ] No tour-wrapper dimensions leaked into POI profiles

**Cut-line:** POI catalog is now matchable. Phase 7 becomes possible.

---

### Phase 7 — AI recommendation engine (2-3 days)

**Deliverable:** "AI 추천 받기" button calls Gemini Haiku, parses intent, returns a recommended 5-7 POI sequence with rationale + drive route.

**Tasks:**
- [ ] New route `app/api/itinerary/match/route.ts`:
  - Body: `{ intent: string, region: string, locale: string, max_pois?: number = 7, max_hours?: number = 6 }`
  - Pipeline:
    1. Call existing `parseQuery()` (parser-haiku) → `ParsedQueryV2`
    2. Hard-filter `match_pois` by region + season relevance
    3. Score each POI: reuse v2 `scoreTour` logic — adapt to read `poi.matching_profile` instead of tour's
    4. Diversity pass: top-N with soft penalty for >2 same-category POIs
    5. Sequence: greedy nearest-neighbor TSP starting from region centroid
    6. Time budget: trim from the tail until `sum(stay) + sum(drive) ≤ max_hours`
  - Output: `{ recommended_pois: poi_key[], per_poi_score_breakdown, total_drive_time_min, rationale }`
- [ ] UI: "AI 추천 받기" button on `/itinerary-builder/[region]` → calls endpoint → fills cart with recommended POIs in order → map polyline updates → flows through Phase 5 auto-quote engine
- [ ] Optional 2nd Haiku pass via `explainer-haiku.ts` for natural-language rationale shown above the cart
- [ ] Telemetry: log to existing `match_queries` table with `flow='itinerary_builder'` tag

**Acceptance:**
- [ ] EN intent "first time / family / scenic / Busan" → returns 5-7 POIs in Busan, ≤6 hours, mix of UNESCO + nature + market
- [ ] KO intent "벚꽃 시즌 / 커플 / 제주" → returns Jeju POI set with seasonal weighting
- [ ] Swap one POI manually → polyline updates; rationale section updates if Haiku 2nd-pass enabled
- [ ] Cost telemetry shows Haiku spend per request (~$0.001-0.003)
- [ ] Recommended itinerary auto-quotes via Phase 5 engine without manual step

**Cut-line:** Full feature. Ship internal beta, gather feedback, iterate `match_pois.matching_profile` quality.

---

## G · Cross-phase concerns

### G.1 — i18n
- POI name jsonb structure: `name_en` (column), `name_ko` (column), `names_other_locales: {ja, zh, zh-TW, es}` jsonb (one column). Keeps `match_pois` slim.
- UI strings under `messages/<locale>.json` key `itineraryBuilder.*`.
- Per memory `feedback_home_visual_energy.md`: home v2 amber eyebrow / dark Process / restraint rules also apply to itinerary builder UI.

### G.2 — Mobile
- Map+cart side-by-side: tablet+ only. Mobile: map fills viewport; cart slides up as bottom-sheet (50%/90% snap points); pin popup → modal not InfoWindow.
- Test iOS Safari quirks with Google Maps inside scroll containers early.

### G.3 — Performance
- 100+ markers without clustering tanks initial paint → `@googlemaps/markerclusterer` mandatory.
- Default image preload only for the first ~10 in-viewport markers.

### G.4 — Analytics
- Reuse `src/design/analytics.ts`. New events: `itinerary_builder_open`, `poi_pin_click`, `poi_add_to_cart`, `poi_drag_reorder`, `itinerary_ai_request`, `itinerary_quote_submit`.

### G.5 — Photo policy (per memory)
- All new POI photos for `match_pois.default_image_url` follow `feedback_photo_quality_policy.md`: 16:9 / OTA bright / no AI feel / sharp quality 95 / no watermarked sources.
- Photos already in `/public/images/itinerary/*.webp` (Jagalchi, Tongdosa, Bomun, Woljeonggyo, Seoraksan, Bukchon, Songdo, Songaksan) are reusable.

---

## H · Risks (carried from audit; update as we hit them)

| # | Risk | Mitigation | Realized? |
|---|---|---|---|
| R1 | POI profiles derived from tour profiles are lossy | Ship derived, instrument click-through, manually retune worst | — |
| R2 | Mobile UX hard (map+cart+popup) | Phase 3 desktop-first to soft URL; Phase 4 adds mobile sheet | — |
| R3 | Distance Matrix API cost at scale | Haversine for previews; Distance Matrix only at quote submit | — |
| R4 | Manual tuning is long-tail | Ship Phase 7 derived-only; tune bottom 10% based on engagement | — |
| R5 | `poi_search_profile` (TourAPI) overlap | Treat as separate; revisit post-MVP | — |
| R6 | **Auto-quote engine (Phase 5) misconfigures pricing rules → wrong auto-quote sent to customer** | Hard threshold: auto-quote requires ALL preset rules satisfied (any uncertainty → escalate). Email user before any payment step. Admin sees auto-quotes-issued log daily. Dry-run mode for new presets before enabling `active=true`. | — |
| R7 | **`/tours` restructure (Phase 3) breaks SEO from inbound links to legacy private-tour slugs** | 301 redirects from all 5 legacy slugs → builder route or selector. Audit Search Console for top inbound URLs before deletion. Keep redirects live ≥ 12 months. | — |
| R8 | **Auto-translation pipeline (Phase 3 D6) produces awkward KO/JA/ZH copy** | Human review pass on `ko` (highest traffic) before merge. `ja/zh/zh-TW/es` flagged for async review; gate locale-switcher visibility on review-complete flag if needed. | — |
| R9 | **Quote-memory precedent reuse misleads ops** (old quote for different party size used as anchor) | Fingerprint MUST include party_size_band + hours_band + has_premium_poi flags. Slack message shows precedent confidence score, never auto-applies the price. | — |

---

## I · Cost estimate

Revised 2026-05-16 after §B decisions D1-D8 — Phases 3/4 expanded, new Phase 5 added.

| Phase | Person-days | Cumulative |
|---|---|---|
| 1 — POI catalog seed (jeju + busan) | 1-2 | 1-2 |
| 2 — Coordinate enrichment | 0.5-1 | 1.5-3 |
| 3 — Map UI + `/tours` restructure + home v2 entry + i18n pipeline | 3-4 | 4.5-7 |
| 4 — Q&A intake (private/cruise) + cart + manual quote | 3-4 | 7.5-11 |
| 5 — Auto-quote engine + presets + Slack escalation + memory | 3-5 | 10.5-16 |
| 6 — POI matching_profile derivation | 1-2 | 11.5-18 |
| 7 — AI recommendation engine | 2-3 | 13.5-21 |
| **Total (full feature, jeju+busan MVP)** | **13.5-21 days** | **~3-4 weeks focused** |
| Polish + Seoul rollout post-MVP | +3-7 days | **4-5 weeks total** |

**Cost delta vs original plan** (was 8.5-14 days): +5-7 days from D4 auto-quote engine (3-5d new) + D7 `/tours` restructure (~1d added to Phase 3) + D8 cruise branch + Q&A intake (~1d added to Phase 4) + D6 i18n pipeline (~0.5d added to Phase 3).

---

## J · Original audit findings (frozen — do not edit)

Captured at audit completion. If facts change, write a new dated section below with `### J.2 audit update 2026-XX-XX` rather than mutating this section.

### J.1 — 2026-05-16 audit

**Matcher v2:**
- `parser.ts` + `parser-haiku.ts` + `parser-rule.ts` — Gemini Haiku 4.5 + rule fallback; output `ParsedQueryV2` (regions, sub_regions, months, season_locks, personas, themes, anchor_pois_mentioned, pace, format, duration_constraint, user_max_hours, hard_constraints, wants_cruise, wants_charter_customization, is_multi_day_request, boost_dimensions, negative_signals, confidence, parser_notes, _telemetry).
- `matcher.ts` — 8 score components: anchor_poi_match (6.0/POI), boost_dimension_sum, theme_overlap (Jaccard×3.0 + count×1.0), persona_alignment (±4.0 to ±6.0), sub_region_match, season_lock_match (2.0/lock), format_match (0.5-2.0), a_grade_bonus (0.5), slug_token_match (0.7/token), charter_intent_match (6.0), negative_signal_penalty (−4.0/match).
- `matching_dimensions_taxonomy.json` — multilingual taxonomy (regions, sub_regions, seasons, season_locks, personas, themes, hard_constraints, anchor_pois).
- Pipeline: `hardFilter` → `scoreTour` per tour → sort with tie-break → signal-strength gating → hybrid score floor → `match_status` classification.
- Tests in `__tests__/lib/tour-match-v2/`: smoke, parser-rule-month-preserve, seasonal-gate, signal-strength. Stress corpus in `data/scenarios/a-*.ts` through `k-*.ts`.

**Tour content:**
- 34 tours × 6 locales = 204 JSON files under `components/product-tour-static/**/`.
- 102 unique `_poi_meta.poi_key` values; 157 unique stop names.
- itineraryStops fields: name, time, duration, number, category, _poi_meta (poi_key, sources, verified, kb_version), highlights, smartNotes, visitBasics, convenience, description, whyOnRoute, image, images, imageCredits, galleryItems, liveStatusWidget, timeUsed.
- routeFlowStops = minimal derived view (name, theme, type only). Ignore for catalog.
- POI consistency across parent tours: name/category/description/highlights identical; whyOnRoute is per-tour context.
- 12 of 204 files have lat/lng — but only on `pickup_dropoff.departure/return`, NOT on itineraryStops.

**Supabase:**
- `match_tours` — 30 tours × ~6 locales. Per-tour `matching_profile` (jsonb), arrays for themes, best_for, anchor_poi_keys. Embedding column unpopulated.
- `match_pois` — 84 rows, mostly EMPTY except poi_key. Designed as POI catalog.
- `match_itinerary_stops` — 208 rows, metadata-only (no body content).
- `poi_search_profile` — 576 rows, KO-locale, TourAPI content_id keyed, mostly empty tags. Separate system.
- `pickup_points` — 0 rows. Has lat/lng columns ready.
- PostGIS not enabled (pgvector is, for future semantic search).

**Map:**
- `@react-google-maps/api 2.20.7` installed. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` configured.
- `components/maps/HotelMapPicker.tsx` — modal Places Autocomplete picker.
- `components/product-tour-static/_shared/TourPickupMapSection.tsx` — read-only pickup map.
- `lib/google-maps.ts` — `geocodeAddress`, `reverseGeocode`.

**Private-tour surface:**
- 5 private-tour product pages live as static JSON detail routes (busan / jeju / seoul-suburbs / incheon-seoul / seoul-dmz).
- `/match` page exists (hero matcher result).
- No dedicated "build your own" route yet.

---

## K · Glossary

| Term | Meaning |
|---|---|
| POI | Point of interest — an itinerary stop that's a real visitable place (vs. operational stops like pickup/lunch/return) |
| `poi_key` | Stable slug identifier for a POI, e.g., `tongdosa_temple`. Lives in `_poi_meta.poi_key` and `match_pois.poi_key` |
| matching_profile | A jsonb of numeric dimension scores (0-5) that describe how well a tour or POI satisfies different traveler preferences (scenic, family-friendly, cherry-blossom, accessible, etc.) |
| Matcher v2 | The current production matcher in `lib/tour-match-v2/` — Gemini Haiku intent parser + dimension scoring |
| Hard filter | Pre-scoring elimination based on hard constraints (region, season-gate, cruise, wheelchair) |
| Signal strength | Classification of how confident the parsed intent is (strong/moderate/weak/empty), used to gate match aggressiveness |
| Cut-line | The point at which a phase delivers a shippable artifact and we can pause without throwing work away |
