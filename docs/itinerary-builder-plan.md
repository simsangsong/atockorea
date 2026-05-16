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
| **Current phase** | Phase 0 — audit & plan ✅ complete. Awaiting approval to start Phase 1. |
| **Blocked on** | User decision on §B open questions (region scope, vendor, table shape, quote model, auth). |
| **Last updated** | 2026-05-16 |
| **Last commit touching this feature** | `a732e63f` — docs: itinerary-builder full audit + 6-phase plan |
| **Owner** | simsangsong |
| **Reviewers** | — |

### Phase progress

| Phase | Status | Started | Done | Commit hash(es) |
|---|---|---|---|---|
| 0 — Audit & plan | ✅ complete | 2026-05-16 | 2026-05-16 | `a732e63f` |
| 1 — POI catalog seed | ⏸ not started | — | — | — |
| 2 — Coordinate enrichment | ⏸ not started | — | — | — |
| 3 — Map UI read-only | ⏸ not started | — | — | — |
| 4 — Cart + sequencing + quote | ⏸ not started | — | — | — |
| 5 — POI matching_profile authoring | ⏸ not started | — | — | — |
| 6 — AI recommendation engine | ⏸ not started | — | — | — |

Legend: ⏸ not started · 🔄 in progress · ✅ complete · ⚠️ blocked · ❌ abandoned

---

## B · Decision log

Append a new row whenever a §5 question gets answered or a new architectural call is made. Never silently change a decision — always log here with date + reason.

| Date | Decision ID | Decision | Reason / context |
|---|---|---|---|
| 2026-05-16 | — | Audit complete; Google Maps confirmed as map vendor (already integrated) | `@react-google-maps/api 2.20.7` + env key already in place — switching cost zero |
| | D1 | (region scope for MVP) | pending |
| | D3 | (extend `match_pois` vs new tables) | pending — recommendation: extend |
| | D4 | (quote endpoint model) | pending — recommendation: email + Slack + DB row |
| | D5 | (auth requirement) | pending — recommendation: no auth, URL params carry state |

---

## C · Change log

One line per material change to this doc or per phase deliverable.

| Date | Commit | Change |
|---|---|---|
| 2026-05-16 | `a732e63f` | Initial audit + plan written (Phase 0) |

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
| 2026-05-16 | Merge `poi_search_profile` (TourAPI 576-row table) with `match_pois` | Different ID scheme (TourAPI content_id vs poi_key); not blocking MVP | After Phase 6 ships and beta feedback in |
| 2026-05-16 | `/admin/pois` browse + edit UI | Nice-to-have for tuning; not user-facing | Phase 7 (post-MVP) |
| 2026-05-16 | Auto-pricing for quotes (vehicle + driver + distance) | Requires ops costing logic; out of scope | Real product call, post-MVP |
| 2026-05-16 | Save itinerary to user account | Requires auth flow; URL params carry MVP value | Phase 8 (post-MVP) |

---

## F · 6-phase plan

Each phase delivers a shippable artifact and has a clear "stop here if needed" cut-line. Sub-checklists are append-only — never delete completed items, just check them off so the change history is visible.

### Phase 1 — POI catalog seed (1-2 days)

**Deliverable:** `match_pois` rows fully populated for all ~102 unique poi_keys.

**Migration to write first:** `supabase/migrations/<timestamp>_add_match_pois_geo_and_profile.sql`
- `ALTER TABLE match_pois ADD COLUMN lat numeric, ADD COLUMN lng numeric, ADD COLUMN matching_profile jsonb, ADD COLUMN default_stay_minutes integer, ADD COLUMN category text;`

**Tasks:**
- [ ] Write migration `supabase/migrations/<timestamp>_add_match_pois_geo_and_profile.sql`
- [ ] Apply migration via `mcp__atockorea__apply_migration`
- [ ] Write `scripts/seed-match-pois-from-tour-jsons.mjs` — walk all `components/product-tour-static/**/<slug>.<locale>.json`, dedupe by `_poi_meta.poi_key`, write `name_en, name_ko, names_other_locales jsonb, region, default_image_url, poi_meta, stop_role='attraction'` to `match_pois`. Skip operational keys (prefix `OPS_`).
- [ ] Run script; verify row count ≥ 100; spot-check 5 POIs across 6 locales.
- [ ] Add a verification SQL block to the script that prints (a) total rows (b) per-region count (c) any poi_keys without name_en (should be 0).

**Acceptance:**
- [ ] `SELECT COUNT(DISTINCT poi_key) FROM match_pois WHERE name_en IS NOT NULL;` ≥ 100
- [ ] Every populated row has `region IN ('seoul', 'busan', 'jeju', 'gyeongju', 'incheon', 'yangsan', ...)` (no nulls)
- [ ] No row has `stop_role = 'operational'` (filtered at seed time)

**Cut-line:** If we stop here, we have a clean POI inventory for any future product (admin browse, analytics).

---

### Phase 2 — Coordinate enrichment (0.5-1 day)

**Deliverable:** Every POI in `match_pois` has lat/lng populated.

**Tasks:**
- [ ] Write `scripts/geocode-match-pois.mjs` using existing `lib/google-maps.geocodeAddress`.
- [ ] For each POI without lat/lng: query `"<name_ko> 한국"` first, fall back to `<name_en> South Korea`. Throttle ≥ 100ms between requests to respect Google rate limit.
- [ ] Output a CSV `scripts/poi-coord-audit.csv` with poi_key, name_en, geocoded_lat, geocoded_lng, formatted_address, confidence — for manual review.
- [ ] Manual spot-check ~20 random POIs against Google Maps; flag misses.
- [ ] Create `scripts/poi-coord-overrides.csv` for any POI where geocoder missed (e.g., specific viewpoint inside a park).
- [ ] Re-run with overrides applied.

**Acceptance:**
- [ ] 100% of `match_pois.stop_role='attraction'` rows have non-null lat AND lng.
- [ ] All lat values in range 33.0–38.7 (Korea), all lng in 124.6–131.0. Rows outside this range → block + manual fix.
- [ ] Visual spot-check of 10 random POIs in Google Maps confirms address match.

**Cut-line:** If we stop here, the catalog is ready for any map UI later.

---

### Phase 3 — Map UI read-only (2-3 days)

**Deliverable:** `/itinerary-builder/[region]` renders a map with all POI pins; click → popup with photo + name + short description + "Add" button (button no-op for now).

**Tasks:**
- [ ] New route `app/itinerary-builder/[region]/page.tsx` (SSR shell, client child component)
- [ ] Resolve `region` param against allowed list (`seoul | busan | jeju`); 404 otherwise.
- [ ] Read `match_pois` for region via Supabase server client.
- [ ] Build `<POICatalogMap />` client component:
  - Google Map centered on region centroid (Seoul 37.5665,126.9780; Busan 35.1796,129.0756; Jeju 33.4996,126.5312)
  - Marker per POI
  - `@googlemaps/markerclusterer` for cluster behavior on zoom-out
  - InfoWindow on marker click: image (`default_image_url`), name (locale-aware via next-intl pattern), summary line (first 140 chars of POI description), "Add to itinerary" button (disabled in Phase 3, enabled in Phase 4)
- [ ] i18n keys under `messages/<locale>.json` key `itineraryBuilder.*`: page title, intro, marker popup labels.
- [ ] Add CTA to existing private-tour detail pages (one new section component) → "Build your own itinerary on the map" link to `/itinerary-builder/<region>`.
- [ ] Mobile-first sizing: map 100vh on mobile, side-by-side on md+.

**Acceptance:**
- [ ] Page loads at `/itinerary-builder/busan`; map shows ≥ 20 pins (Busan catalog size).
- [ ] Clicking any pin opens InfoWindow with image + name + 1-line desc + Add button.
- [ ] Page is responsive (DevTools mobile + tablet + desktop tested).
- [ ] No console errors; Lighthouse perf ≥ 70 on mobile.

**Cut-line:** Users can browse the curated POI map. Can't build/save yet.

---

### Phase 4 — Cart + manual sequencing + quote (2-3 days)

**Deliverable:** End-to-end manual builder. User picks POIs, reorders, sees drive estimate, submits a quote request.

**Tasks:**
- [ ] Cart state in URL params: `?pois=tongdosa,bulguksa&date=2026-05-20&party=4` (so itineraries are share-able without auth).
- [ ] Cart UI: side panel on desktop, bottom-sheet on mobile (snap points 30%/90%).
- [ ] Drag-and-drop reorder via `@dnd-kit/core` (install if not present).
- [ ] Drive estimate: Haversine distance × 1.3 road factor × 50 km/h average → ETA per leg. Show total drive minutes + summed POI `default_stay_minutes`.
- [ ] Polyline overlay on map showing selected POI sequence in order.
- [ ] Quote form modal: name / email / requested date / party size / language / notes.
- [ ] `POST /api/itinerary/quote` route:
  - Write to new `tour_quote_requests` table (migration in this phase)
  - Send Slack webhook notification to ops channel
  - Send confirmation email to user via existing email service (`lib/email.ts`)
- [ ] Success page: "We'll respond within X hours" + saved URL of the itinerary.

**Migration:** `<timestamp>_create_tour_quote_requests.sql` — id uuid PK, poi_keys text[], requested_date date, party_size int, contact_email text, contact_name text, language text, notes text, locale text, region text, source_url text, created_at timestamptz.

**Acceptance:**
- [ ] Add 3 POIs from map → cart shows them in order
- [ ] Drag to reorder → URL updates → polyline redraws
- [ ] "Get quote" → form submit → DB row appears → Slack notification fires → email sent
- [ ] Share URL → reopen → cart restored from URL params

**Cut-line:** Ship-able as v1 even if AI recommendation (Phases 5-6) lags.

---

### Phase 5 — POI matching_profile authoring (1-2 days)

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

**Cut-line:** POI catalog is now matchable. Phase 6 becomes possible.

---

### Phase 6 — AI recommendation engine (2-3 days)

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
- [ ] UI: "AI 추천 받기" button on `/itinerary-builder/[region]` → calls endpoint → fills cart with recommended POIs in order → map polyline updates
- [ ] Optional 2nd Haiku pass via `explainer-haiku.ts` for natural-language rationale shown above the cart
- [ ] Telemetry: log to existing `match_queries` table with `flow='itinerary_builder'` tag

**Acceptance:**
- [ ] EN intent "first time / family / scenic / Busan" → returns 5-7 POIs in Busan, ≤6 hours, mix of UNESCO + nature + market
- [ ] KO intent "벚꽃 시즌 / 커플 / 경주" → returns Gyeongju cherry-blossom POI set
- [ ] Swap one POI manually → polyline updates; rationale section updates if Haiku 2nd-pass enabled
- [ ] Cost telemetry shows Haiku spend per request (~$0.001-0.003)

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
| R4 | Manual tuning is long-tail | Ship Phase 6 derived-only; tune bottom 10% based on engagement | — |
| R5 | `poi_search_profile` (TourAPI) overlap | Treat as separate; revisit post-MVP | — |

---

## I · Cost estimate

| Phase | Person-days | Cumulative |
|---|---|---|
| 1 — POI catalog seed | 1-2 | 1-2 |
| 2 — Coordinate enrichment | 0.5-1 | 1.5-3 |
| 3 — Map UI read-only | 2-3 | 3.5-6 |
| 4 — Cart + manual sequencing + quote | 2-3 | 5.5-9 |
| 5 — POI matching_profile derivation | 1-2 | 6.5-11 |
| 6 — AI recommendation engine | 2-3 | 8.5-14 |
| **Total (full feature, 1 region MVP)** | **8.5-14 days** | **~2 weeks focused** |
| Polish + 3-region rollout | +3-7 days | **3-4 weeks total** |

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
