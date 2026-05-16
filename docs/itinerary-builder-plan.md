# Custom Itinerary Builder — Audit & Plan

> Single source of truth for the "map + POI + AI-recommended day itinerary" feature.
> Last reviewed: 2026-05-16.

## 0 · Executive summary

The user wants travelers to land on the private-tour page, see a **map with all curated POIs pinned**, click any pin to read details + photos, **build their own day-itinerary** by selecting/sequencing POIs, and optionally **let the matcher AI auto-propose a starting itinerary** from their preferences (reusing the existing Gemini intent parser + tour matching_profile scoring).

This is genuinely differentiated against Klook/GYG (packaged tours only) and Inspirock/TripIt (blank-canvas planner without curation). It is **also genuinely large** — ~2 weeks of focused work for an MVP, ~3-4 weeks for full polish across 3 regions.

The plan below is intentionally split into 6 phases with clear acceptance criteria at each cut-line so we can pause / pivot / ship partially with confidence.

## 1 · What already exists (audit results)

### 1.1 — Matcher v2 (highly portable to POI-level)

| Subsystem | State | POI-level reusability |
|---|---|---|
| `lib/tour-match-v2/parser.ts` + `parser-haiku.ts` + `parser-rule.ts` | Production, Gemini Haiku 4.5 + rule fallback | ✅ Reuse as-is. Output `ParsedQueryV2` is tour-agnostic (regions / season_locks / personas / themes / anchor_pois / pace / format / hard_constraints / boost_dimensions). |
| `matching_dimensions_taxonomy.json` | Multilingual taxonomy (regions, seasons, personas, themes, anchor_pois) | ✅ Reuse as-is. |
| `lib/tour-match-v2/matcher.ts` — `hardFilter` + `scoreTour` + `matchTours` | 8 score components (anchor_poi, themes, persona, sub_region, season_lock, format, slug_tokens, charter_intent) + negative_signals + a_grade bonus + signal-strength gating | ⚠️ Iteration pattern needs POI-aware wrapper. Score components are dimension-agnostic (read arbitrary `matching_profile[key]`), so adding POI-level dims = data work, not code work. |
| `seasonal-gate.ts`, `signal-strength.ts` | Hard gates + match_status classification | ✅ Reuse — apply same filter to POI catalog instead of tours. |
| `explainer-haiku.ts` | 2nd Haiku pass that writes natural-language "why this match" | ✅ Reuse for "why we recommended this POI sequence". |
| `/api/tour-product/match` | Returns `top_matches[]` (tour-level), `match_status`, `notes`, telemetry | 🔧 Add sibling `/api/itinerary/match` that returns `top_pois[]` + auto-sequenced `itinerary_draft[]`. |

**Verdict:** The matcher engine is portable. Adding POI-level matching ≈ 1-2 days of code + N days of data work (POI matching_profile authoring).

### 1.2 — Tour content (POI extraction source)

| Source | Quantity | Per-stop fields |
|---|---|---|
| `components/product-tour-static/<slug>/<slug>.<locale>.json` — `itineraryStops[]` | 34 tours × 6 locales = 204 files. ~150 stops in EN. **102 unique `_poi_meta.poi_key`** values. | name, time, duration, number, category, **_poi_meta** (poi_key, sources, verified, kb_version), highlights, smartNotes, visitBasics, convenience, description (1200-2100 chars), whyOnRoute (context-specific per parent tour), image, images[], imageCredits |
| Same JSONs — `routeFlowStops[]` | Same length per tour | Minimal (`name, theme, type`). Derived UI layer. **Ignore for catalog.** |
| `lat/lng` | None on itineraryStops. Only on `pickup_dropoff.departure[]/return[]` in 12 of 204 files. | ❌ Need to source. |

**Cross-tour consistency:** Core POI fields (name / category / description / highlights / images) are identical across tours that reuse the same poi_key (verified Bulguksa, Tongdosa). `whyOnRoute` is per-tour (justifies why _this_ tour visits the POI in this order — not a stable POI attribute).

### 1.3 — Supabase schema (POI infrastructure partially exists)

| Table | Rows | Status | Notes |
|---|---|---|---|
| `match_tours` | 30 tours × ~6 locales | Populated. Per-tour `matching_profile` (jsonb), `primary_themes`, `secondary_themes`, `best_for`, `not_recommended_for`, `anchor_poi_keys`, `destination_region`, `pickup_region`, `duration_hours`, `vehicle_type`, `a_grade`, `is_cruise_excursion`, `is_charter_route_options`. `embedding vector` exists but unpopulated. | Core matcher reads from here. |
| `match_pois` | 84 rows | **Schema exists, mostly empty** — only `poi_key` is set; `name_en/name_ko/region/stop_role/default_image_url/poi_meta` are null/empty. | Designed as POI catalog. Needs population. |
| `match_itinerary_stops` | 208 rows | **Metadata-only** — `tour_slug, stop_index, poi_key, title, description_length, highlights_count, why_on_route_length, time_used_count, sources_count, is_operational`. No content body. | Designed as tour→POI junction. Sufficient for the matcher's "which tours visit this POI" lookup. |
| `poi_search_profile` | 576 rows | KO-locale only, mostly empty tags. Keyed by TourAPI `content_id` (numeric, e.g. 1206420). | **Separate POI system** built for 한국관광공사 TourAPI search. Not linked to `match_pois`. Possible future merge; out of scope for MVP. |
| `pickup_points` | 0 rows | Empty. Has `lat`, `lng`, `pickup_time`, `display_order`. | Adjacent infrastructure (per-tour pickup coords). Out of scope. |
| PostGIS extension | Not enabled | `pgvector` is enabled (for embeddings); no PostGIS. | Not needed — numeric lat/lng + Haversine in JS is fine for our radius queries. |

**Verdict:** `match_pois` is the right home for the POI catalog. We need to populate it: name (en/ko), region, lat/lng (new field in `poi_meta` or as columns), default_image_url, and the new `matching_profile` jsonb (which doesn't exist yet — to be added).

### 1.4 — Private-tour surface (where the feature lives)

| Route | Current state |
|---|---|
| `/tour-product/busan-private-car-charter-cruise-shore` | Static JSON detail page. "Choose places that matter most" framing already in copy. |
| `/tour-product/jeju-island-private-car-charter-tour` | Same. |
| `/tour-product/seoul-suburbs-private-chartered-car-10hr` | Same. |
| `/tour-product/incheon-seoul-private-car-shore-excursion-cruise` | Same. |
| `/tour-product/seoul-dmz-private-3rd-tunnel-suspension-bridge` | Same. |
| `/match` | Existing hero matcher result page (returns winning tour). |
| `HOME_CTA_MATCHING_HREF = "/match"` | No dedicated "build your own itinerary" link in home config. |

**Recommendation:** New route `/itinerary-builder/[region]?seed=<intent>` (e.g., `/itinerary-builder/busan`). Each existing private-tour detail page adds a prominent CTA → "Build my own itinerary on the map". Hero matcher gains a second CTA → "Or design my own day instead".

### 1.5 — Map / geocoding (Google already integrated)

- `@react-google-maps/api v2.20.7` installed.
- `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` env present.
- `components/maps/HotelMapPicker.tsx` — modal map with Places Autocomplete + click-to-select. Reusable pattern for our cluster + popup + select UX.
- `components/product-tour-static/_shared/TourPickupMapSection.tsx` — read-only pickup map at 260px height. Reference for embedded map sizing on detail pages.
- `lib/google-maps.ts` — `geocodeAddress(text)`, `reverseGeocode(lat, lng)` already wrapped.

**Verdict:** Google Maps is the path of least resistance. No vendor swap needed. (Kakao would be more accurate for Korean POI fuzzy-search, but we're using curator-supplied POIs so coordinate precision is what matters, and Google's geocoder is fine for that.)

## 2 · Architecture (target)

```
┌────────────────────────────────────────────────────────────┐
│  /itinerary-builder/[region]?seed=<intent>                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Top bar: intent input ─────────────── "AI 추천 받기" ▶ │  │
│  └──────────────────────────────────────────────────────┘  │
│  ┌─────────────────────────┐ ┌────────────────────────────┐│
│  │                         │ │  Selected itinerary (cart) ││
│  │  Google Map             │ │                            ││
│  │  ─────────────          │ │  1. Tongdosa Temple   ⋮    ││
│  │  • POI pins clustered   │ │  2. Bulguksa Temple   ⋮    ││
│  │    by region            │ │  3. Bomun Lake        ⋮    ││
│  │  • Click pin → popup    │ │                            ││
│  │    speech bubble        │ │  Total: ~6h 20m            ││
│  │    (photo + name +      │ │  Drive: ~85 km             ││
│  │     short desc + ⊕)     │ │                            ││
│  │  • Optional route       │ │  [ Get quote ]             ││
│  │    polyline overlay     │ │                            ││
│  └─────────────────────────┘ └────────────────────────────┘│
│                                                            │
│  Mobile: map ⇌ cart bottom-sheet, pin popup → modal       │
└────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────────┐
│ Data layer                                                 │
│                                                            │
│   match_pois  ─────────────────────► UI map markers        │
│   (poi_key, name, region, lat, lng,                        │
│    default_image, matching_profile)                        │
│                                                            │
│   GET /api/poi/catalog?region=busan&locale=ko              │
│   POST /api/itinerary/match                                │
│        body: { intent, region, locale }                    │
│        out:  { recommended_sequence: poi_key[],            │
│                rationale_per_poi, total_drive_time }       │
│   POST /api/itinerary/quote                                │
│        body: { poi_keys: [...], date, party_size, ... }   │
│        out:  { quote_id, estimated_price, contact_link }   │
└────────────────────────────────────────────────────────────┘
```

## 3 · Phased plan

Each phase delivers a shippable artifact and has a clear "stop here if needed" cut-line.

### Phase 1 — POI catalog seed (1-2 days)

**Deliverable:** `match_pois` rows fully populated for all 102 unique poi_keys.

Steps:
1. Write a one-shot Node script `scripts/seed-match-pois-from-tour-jsons.mjs` that walks every `<slug>.en.json` + locale variants, dedupes by `_poi_meta.poi_key`, and writes to `match_pois`:
   - `name_en`, `name_ko` (other locales held in a sibling `match_poi_translations` table OR jsonb `names: {ko, ja, zh, zh-TW, es}`)
   - `region` derived from parent-tour `destination_region` (Busan / Jeju / Seoul / etc.)
   - `default_image_url` from canonical tour's `itineraryStops[i].image`
   - `poi_meta` = first occurrence's `_poi_meta` (poi_key, sources, kb_version, verified, verified_date)
   - `stop_role` = "attraction" (operational stops excluded — `_poi_meta.poi_key` starts with `OPS_` filtered out)
2. Verify: 84 → 100+ unique poi_keys; spot-check 5 POIs in 6 locales.
3. NEW columns on `match_pois` (migration):
   - `lat numeric`, `lng numeric` (NULL allowed)
   - `matching_profile jsonb` (NULL allowed)
   - `default_stay_minutes integer` (NULL allowed)
   - `category text` (temple / beach / market / viewpoint / park / village / museum / nature / city_walk — small enum)

**Cut-line:** If we stop here, we have a clean POI inventory for any future product (admin browse, analytics).

### Phase 2 — Coordinate enrichment (0.5-1 day)

**Deliverable:** Every POI in `match_pois` has lat/lng populated.

Approach:
1. Write `scripts/geocode-match-pois.mjs` using existing `lib/google-maps.geocodeAddress`.
2. For each POI without lat/lng: query `"<name_ko> 한국"` first (better Korean recall), fall back to `<name_en> South Korea`.
3. Manual review pass (CSV export → spot-check ~20 POIs against Google Maps). 102 POIs is small enough to do this in 1-2 hours.
4. Override file `scripts/poi-coord-overrides.csv` for any POI where geocoder misses (e.g., a specific viewpoint inside a park).

**Cut-line:** If we stop here, the catalog is ready for any map UI later.

### Phase 3 — Map UI (read-only — pins + popups) (2-3 days)

**Deliverable:** `/itinerary-builder/[region]` page renders Google Map with all POI pins, click → popup with photo + name + short desc.

Steps:
1. New route `app/itinerary-builder/[region]/page.tsx`. Resolve `region` against `match_pois.region`.
2. Build `<POICatalogMap />` component (client):
   - Google Map centered on region (Seoul ≈ 37.5665,126.9780; Busan ≈ 35.1796,129.0756; Jeju ≈ 33.4996,126.5312)
   - Marker per POI; cluster on zoom-out via `@react-google-maps/api`'s built-in clustering OR `@googlemaps/markerclusterer`.
   - InfoWindow on marker click: image (default_image_url), name (locale-aware), `summary_line` (new column in Phase 1 or derive from description's first 140 chars), "추가" button.
3. Sidebar / bottom-sheet: empty state initially. Adding a POI = local state only (no DB).
4. i18n: page text + popup text use the existing next-intl pattern. POI names already in `match_pois` per locale.

**Cut-line:** If we stop here, users can browse the curated POI map but can't build/save.

### Phase 4 — Itinerary cart + manual sequencing (2-3 days)

**Deliverable:** User can select POIs, drag-and-drop to reorder, see total drive time, request a quote.

Steps:
1. Cart state in URL params (`?pois=tongdosa,bulguksa,bomun_lake&date=2026-05-20&party=4`) so itineraries are share-able without auth.
2. Drag-and-drop with `@dnd-kit/core` (already installed if Next.js shadcn flow has it; otherwise install).
3. Distance / drive-time row: compute straight-line distance from POI coords (Haversine) and multiply by 1.3 for road factor; or call Google Distance Matrix API (1 request per leg, batched). Start with Haversine — accurate enough for an estimate.
4. Polyline overlay on the map showing the selected sequence.
5. `POST /api/itinerary/quote` — minimal payload to `tour_quote_requests` (new table) with `pois[]`, `requested_date`, `party_size`, `contact_email`, `locale`, `notes`. Auto-email to ops + Slack webhook.
6. Final CTA: "Get quote" → form modal → submit → success page.

**Cut-line:** End-to-end manual builder works. Ship-able as v1 even if AI recommendation (Phase 5-6) lags.

### Phase 5 — POI matching_profile authoring (1-2 days, mostly data work)

**Deliverable:** Every POI has a `matching_profile` jsonb in `match_pois`.

Two-step strategy:
1. **Auto-derive** (script `scripts/derive-poi-matching-profiles.mjs`):
   - For each poi_key, find all `match_tours` rows that reference it via `match_itinerary_stops` OR `anchor_poi_keys`.
   - Weighted-average their `matching_profile` jsonbs (dimension-by-dimension).
   - Drop dimensions that are tour-level only ("private_fit", "cruise_shore_excursion_fit", "one_day_fit") because they describe the wrapper, not the POI.
   - Keep dimensions that are POI-relevant ("scenic_level", "cafe_fit", "nature_fit", "family_fit", "iconic_landmark_fit", "wheelchair_accessible_anchor_fit", "cherry_blossom_fit" — POI-specific season fits stay because the POI is what's bloomy).
2. **Manual review** sheet — export to CSV, surface 5-10 obvious miscalibrations, hand-tune, re-import. (Optional second pass once we have real user click data.)

**Cut-line:** POI catalog is now matchable. Phase 6 (recommendation UI) becomes possible.

### Phase 6 — AI recommendation engine (2-3 days)

**Deliverable:** "AI 추천 받기" button calls Gemini Haiku, parses intent, returns a recommended 5-7 POI sequence with rationale.

Steps:
1. `POST /api/itinerary/match` route:
   - Body: `{ intent: string, region: string, locale: string, max_pois?: 7, max_hours?: 6 }`
   - Internally:
     a. Call existing `parseQuery()` (parser-haiku) → `ParsedQueryV2`.
     b. Hard-filter `match_pois` by region + (if season_locks set) season-relevant POIs.
     c. Score each POI: reuse the v2 score components, applied to `poi.matching_profile` instead of tour's. Persona, theme, anchor_poi, season_lock, sub_region scoring all map directly.
     d. Diversity pass: top-N candidates with a soft penalty for >2 same-category POIs (avoid 5 temples in a row).
     e. Sequence: greedy nearest-neighbor TSP starting from region centroid; or call Google Distance Matrix for the top 7 if budget allows.
     f. Time budget check: sum each POI's `default_stay_minutes` + drive time, trim from the tail until it fits `max_hours`.
   - Output: `{ recommended_pois: poi_key[], per_poi_score_breakdown, total_drive_time_min, rationale }`.
2. UI: pressing the AI button calls the endpoint → cart fills with the recommended POIs in order → map shows the polyline → user can swap/drop/reorder.
3. Optional 2nd Haiku pass (reuse `explainer-haiku.ts`) → natural-language "why we picked these" shown above the cart.

**Cut-line:** Full feature. Ship internal beta, gather feedback, iterate POI matching_profile quality.

## 4 · Cross-phase concerns

### 4.1 — i18n

- POI catalog `name` is already per-locale in tour JSONs. Phase 1 script writes `name_en`, `name_ko` columns + a jsonb `names_other_locales: {ja, zh, zh-TW, es}` to keep `match_pois` slim.
- UI strings (page chrome, button labels, "Get quote" form) go through standard next-intl flow under a new `messages/<locale>.json` key `itineraryBuilder.*`.

### 4.2 — Mobile

- Side-by-side map+cart works on tablet/desktop only. Mobile = map fills viewport; cart slides up as a bottom-sheet (50%/90% snap points); pin popup = modal not InfoWindow.
- iOS Safari quirks with Google Maps inside scroll containers — test early.

### 4.3 — Performance

- 100+ markers without clustering tanks initial paint. Use `@googlemaps/markerclusterer`.
- Default image preload only for the first ~10 in-viewport markers.

### 4.4 — Analytics

- Reuse `src/design/analytics.ts`. New events: `itinerary_builder_open`, `poi_pin_click`, `poi_add_to_cart`, `itinerary_ai_request`, `itinerary_quote_submit`.

### 4.5 — Admin

- `/admin/pois` browse view (Phase 1+) — list match_pois, edit lat/lng/category/matching_profile inline.
- Not required for MVP user flow; nice-to-have for ongoing tuning.

## 5 · Risks & open decisions

| # | Risk / decision | Recommendation |
|---|---|---|
| R1 | POI profiles derived from tour profiles are lossy (a tour scores 5/5 scenic because of ONE viewpoint, but my derive script averages it across all that tour's stops) | Ship the derived version, instrument click-through, manually retune the worst miscalibrations. Tour-level scoring took years to settle; expect same. |
| R2 | Mobile UX with map+cart+popup is genuinely hard. | Phase 3 ships desktop-first to a soft URL; Phase 4 adds mobile bottom-sheet. Don't try to nail both in one PR. |
| R3 | Distance Matrix API cost at scale | Use Haversine × 1.3 for client-side preview; call Distance Matrix only when user submits "Get quote" (1 call per quote). |
| R4 | Manual `matching_profile` tuning for 102 POIs is a tail of work | Ship Phase 6 with derived-only profiles. Tune the bottom 10% based on real engagement. |
| R5 | `poi_search_profile` (TourAPI POIs) overlap or future merge | Out of scope for this feature. Treat the two systems as separate; revisit after this ships. |
| D1 | Region scope for MVP | Recommend **Busan first** (smallest POI set ~25, most engaged user base based on Songdo / Jagalchi photo curation in flight). |
| D2 | Map vendor | Recommend **Google Maps** — already integrated, lowest switching cost. |
| D3 | New tables vs extend existing | Recommend **extend `match_pois`** (add lat, lng, matching_profile, default_stay_minutes, category columns). Avoid table proliferation. |
| D4 | Quote endpoint output | Recommend **email + Slack webhook + DB row** — no auto-pricing in MVP. Real pricing requires per-vehicle costing logic; out of scope. |
| D5 | Auth requirement | Recommend **no auth for MVP** — URL params carry the itinerary, email captures the lead. Adds auth later if save-to-account becomes a value. |

## 6 · Suggested commit cadence

Each phase = its own PR. Inside each phase, prefer small commits with shipped Definition-of-Done:

- Phase 1: 1 migration + 1 script + 1 verification query. ~3 commits.
- Phase 2: 1 script + 1 CSV override file + smoke check. ~2 commits.
- Phase 3: 1 route + 1 component + 1 marker module + i18n keys. ~6-8 commits.
- Phase 4: cart state + DnD + polyline + quote API + form. ~8-12 commits.
- Phase 5: 1 derive script + 1 override CSV + DB write. ~3 commits.
- Phase 6: 1 API route + matcher adapter + UI hook + Haiku rationale. ~6-8 commits.

## 7 · Total cost estimate

| Phase | Person-days | Cumulative |
|---|---|---|
| 1 — POI catalog seed | 1-2 | 1-2 |
| 2 — Coordinate enrichment | 0.5-1 | 1.5-3 |
| 3 — Map UI read-only | 2-3 | 3.5-6 |
| 4 — Cart + manual sequencing + quote | 2-3 | 5.5-9 |
| 5 — POI matching_profile derivation | 1-2 | 6.5-11 |
| 6 — AI recommendation engine | 2-3 | 8.5-14 |
| **Total (full feature)** | **8.5-14 days** | **~2 weeks focused** |
| Polish + 3-region rollout | +3-7 days | **3-4 weeks total** |

## 8 · Next step (when ready)

Approve this plan (or push back on specific decisions in §5). On approval, the first concrete commit is Phase 1 — `scripts/seed-match-pois-from-tour-jsons.mjs` + migration `2026XXXX_add_match_pois_geo_and_profile_columns.sql`.
