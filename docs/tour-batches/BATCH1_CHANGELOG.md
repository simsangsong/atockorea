# Batch 1 Changelog — Migrated Jeju Tour Deep Enhancement

**Date:** 2026-04-28
**Scope:** 2 tours, 7 unique POIs, 11 attraction stops + 2 lunch stops
**Goal:** Raise migrated v1→v7 tours to Step 3 quality level

## Tours enhanced

| Tour | Stops | Before (median desc) | After (median desc) |
|---|---|---|---|
| `jeju-grand-highlights-loop` | 5 | 217c | **1,165c** ✓ |
| `southwest-hallasan-osulloc-aewol` | 6 | 211c | **1,170c** ✓ |

Reference Step 3 quality target: 842–1,173c — **MET / EXCEEDED**.

## POI Knowledge Base v1.2 → v1.3

Added 7 verified POIs (each cross-validated against 4–7 sources):

| POI | Key Verified Facts |
|---|---|
| **Hallasan Eoseungsaengak** | 1.3 km / 200 m gain / 1,169 m summit / FREE / no reservation needed / Tochika 1945 ruins |
| **Daepo Jusangjeolli Cliff** | National Monument No. 443 (2005-01-06) / 30–40 m hexagonal columns / 1 km coastline / ₩2,000 |
| **Cheonjeyeon Falls** | Natural Monument No. 378 (1993) / 3 tiers (22m + 30m + smaller) / Seonimgyo Bridge 120 m × 78 m high / ₩2,500 |
| **O'Sulloc Tea Museum** | Opened Sep 2001 / Amorepacific / 2M visitors/yr / 700 tonnes tea/yr / FREE / designboom Top-10 |
| **Aewol Cafe Street** | Jang Han Chul Promenade officially / Jeju Olle 15A / Bus 202 / sunset coast |
| **Jeongbang Falls** | 23 m / Only Asia waterfall into ocean / Yeongjusipgyeong / Seobulgwacha legend / ₩2,000 / 130 stairs |
| **Seongsan Ilchulbong** | Triple UNESCO crown (WHS 2007 + Biosphere + Geopark 2010) / 182 m / 600m × 90m crater / ₩2,000 / haenyeo show 13:30 & 15:00 |

## Sources consulted (all verified)

- VisitKorea (english.visitkorea.or.kr) — official hours, admission, descriptions
- Wikipedia — geological/historical facts, designation dates
- Hallasan National Park (Jeju Special Self-Governing Province)
- AllTrails — verified trail measurements (length, elevation gain)
- Trazy — admission pricing
- Inside Jeju, World of Waterfalls, Trip.com Korea — operational details
- Brit Adventures, Expatolife — visitor experience verification

## Matching Profile Adjustments

All deltas anchored to verified facts and documented in `_publication.fix_passes.v17_batch1_enhancement._score_audit`.

### `jeju-grand-highlights-loop`

| Field | Old | New | Reason |
|---|---|---|---|
| `weather_sensitivity` | 4 | **5** | 3 of 4 stops weather-exposed (Hallasan winter ice, Jusangjeolli high-tide spray, Jeongbang slippery rocks) |
| `young_kids_fit` | 3 | **2** | 3 stair-heavy stops (Eoseungsaengak 200m gain + Jeongbang 130 stairs + Seongsan 300–500 steps) exceeds under-7 tolerance |
| `stroller_fit` | 2 | **1** | Only Jusangjeolli stroller-accessible per official sources |
| `mobility_friendly_fit` | 3 | **2** | 3 of 4 stops require significant stairs/elevation |
| `rain_fit` | 3 | **2** | 3 of 4 stops compromised by rain (verified slippery wooden stairs and rock terrain) |

### `southwest-hallasan-osulloc-aewol`

| Field | Old | New | Reason |
|---|---|---|---|
| `walking_level` | 3 | **4** | Total ~6 km + ~250 m elevation across Eoseungsaengak (200m gain) + Cheonjeyeon stairs |
| `culture_level` | 3 | **4** | Two genuine cultural anchors: O'Sulloc 25-yr tea heritage + Cheonjeyeon Seven-Nymphs legend |
| `young_kids_fit` | 4 | **3** | Eoseungsaengak + Cheonjeyeon multi-tier stairs both demanding for under-7s |
| `weather_sensitivity` | 3 | **4** | Eoseungsaengak (winter ice) + Jusangjeolli (spray) + Aewol coast all weather-exposed |

## Schema Inconsistency Flagged for Jason

⚠ **Action item for separate decision:** 24 of 30 tours use 1–5 integer matching scores; 3 NEW Step 3 tours (Step 3a/b/c) use 0–1 float scores. This Batch 1 maintained the 1–5 integer scale to avoid breaking the 24-tour majority. **Decision needed before any production deployment** — recommend either:
- (A) Convert all 30 tours to 0–1 float (more granular, modern), or
- (B) Convert the 3 new tours to 1–5 integer (consistency with majority).

This is a 1-day mechanical migration once the direction is chosen.

## Files modified

- `tours_v17_working/jeju-grand-highlights-loop_en.json`
- `tours_v17_working/southwest-hallasan-osulloc-aewol_en.json`
- `poi_knowledge_base.json` (v1.2 → v1.3)

## Verification — all schema checks pass

- ✓ Both tours retain all required top-level keys (32 keys)
- ✓ Both have `schema_version: 7` / `_publication.schema_version: v4_canonical`
- ✓ Both have 68-key `matching_profile`
- ✓ All attraction stops have `visitBasics`, `convenience`, `smartNotes`, `_poi_meta`
- ✓ All attraction stops have description ≥ 1,150 chars (vs target 700+ from Step 3 reference)
- ✓ All highlights are 4 fact-anchored bullets per attraction
- ✓ `_score_audit` fully documents every score change with verified-source reasoning

## Remaining batches (estimated 13 more)

| Batch | Tours | Est. POIs to research |
|---|---|---|
| 2 | east-signature-nature-core + jeju-eastern-unesco-spots | ~7 |
| 3 | jeju-southern-unesco + jeju-west-south | ~6 |
| ... | ... | ... |
| 14 | from-busan-gyeongju-ancient + from-incheon-seoul-cruise (highlights only) | ~4 |

Total estimated: ~80–100 POIs reaching the KB at completion.
