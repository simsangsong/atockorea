# Match Engine Stress Test Report

Generated: 2026-04-30T23:13:39.134Z

## Summary

| Metric | Value | Target |
|---|---|---|
| Total scenarios | 107 | — |
| Passed | 103 (96.3%) | — |
| Failed | 4 | 0 |
| **Seasonal leak rate (B+D)** | **0.0%** | 0% |
| **Contradiction leaks (D, hardcoded)** | **0** | 0 |
| Explicit-season top-1 accuracy (C) | 80.0% | ≥80% |
| Latency p50 / p95 / p99 | 0 / 1 / 1 ms | — |

## Category breakdown

| Category | Pass | Total | Pass rate |
|---|---:|---:|---:|
| empty_weak | 10 | 10 | 100.0% |
| season_leak | 17 | 17 | 100.0% |
| season_explicit_match | 8 | 10 | 80.0% |
| season_explicit_mismatch | 10 | 10 | 100.0% |
| season_keyword_only | 9 | 10 | 90.0% |
| region_general | 10 | 10 | 100.0% |
| persona_focus | 10 | 10 | 100.0% |
| conflicting | 5 | 5 | 100.0% |
| multilingual | 15 | 15 | 100.0% |
| long_form | 4 | 5 | 80.0% |
| adversarial | 5 | 5 | 100.0% |

## Failed scenarios (4)

### S045 — season_explicit_match

- **Query**: `10월 단풍 한국 부모님` (locale=ko)
- **today**: 2026-10
- **Rationale**: October foliage — peak month.
- **Response status**: `STRONG_MATCH`, signal=`strong`, floor=1.00
- **Top matches** (3):
  - `seoul-seoraksan-national-park-sokcho-beach-day-trip` score=4 themes=[nature,scenic,seafood,east_coast]
  - `busan-gyeongju-unesco-legacy-tour-national-museum` score=3.05 themes=[unesco,silla_kingdom,gyeongju,from_busan,museum]
  - `jeju-west-south-full-day-authentic-tour` score=2 themes=[jeju,west_south_jeju,alpine_wetland,ramsar_site,double_crater_volcano,west_coast_sunset,tea_culture]
- **Failures**:
  - none of ["autumn_foliage"] found in top primary_themes (got ["nature","scenic","seafood","east_coast","unesco","silla_kingdom","gyeongju","from_busan","museum","jeju","west_south_jeju","alpine_wetland","ramsar_site","double_crater_volcano","west_coast_sunset","tea_culture"])
  - top1_predicate: top-1 themes ["nature","scenic","seafood","east_coast"] missing one of ["autumn_foliage","autumn_seasonal"]

### S049 — season_explicit_match

- **Query**: `11月 紅葉 韓國` (locale=zh-TW)
- **today**: 2026-11
- **Rationale**: Chinese: November foliage Korea.
- **Response status**: `STRONG_MATCH`, signal=`moderate`, floor=1.00
- **Top matches** (3):
  - `seoul-seoraksan-national-park-sokcho-beach-day-trip` score=4 themes=[nature,scenic,seafood,east_coast]
  - `busan-gyeongju-unesco-legacy-tour-national-museum` score=3.05 themes=[unesco,silla_kingdom,gyeongju,from_busan,museum]
  - `jeju-west-south-full-day-authentic-tour` score=2 themes=[jeju,west_south_jeju,alpine_wetland,ramsar_site,double_crater_volcano,west_coast_sunset,tea_culture]
- **Failures**:
  - none of ["autumn_foliage"] found in top primary_themes (got ["nature","scenic","seafood","east_coast","unesco","silla_kingdom","gyeongju","from_busan","museum","jeju","west_south_jeju","alpine_wetland","ramsar_site","double_crater_volcano","west_coast_sunset","tea_culture"])
  - top1_predicate: top-1 themes ["nature","scenic","seafood","east_coast"] missing one of ["autumn_foliage","autumn_seasonal"]

### S057 — season_keyword_only

- **Query**: `단풍 구경` (locale=ko)
- **today**: 2026-11
- **Rationale**: November + foliage (no month) → today fallback PASS.
- **Response status**: `STRONG_MATCH`, signal=`strong`, floor=1.00
- **Top matches** (3):
  - `seoul-seoraksan-national-park-sokcho-beach-day-trip` score=4 themes=[nature,scenic,seafood,east_coast]
  - `busan-gyeongju-unesco-legacy-tour-national-museum` score=3.05 themes=[unesco,silla_kingdom,gyeongju,from_busan,museum]
  - `jeju-west-south-full-day-authentic-tour` score=2 themes=[jeju,west_south_jeju,alpine_wetland,ramsar_site,double_crater_volcano,west_coast_sunset,tea_culture]
- **Failures**:
  - none of ["autumn_foliage"] found in top primary_themes (got ["nature","scenic","seafood","east_coast","unesco","silla_kingdom","gyeongju","from_busan","museum","jeju","west_south_jeju","alpine_wetland","ramsar_site","double_crater_volcano","west_coast_sunset","tea_culture"])
  - top1_predicate: top-1 themes ["nature","scenic","seafood","east_coast"] missing one of ["autumn_foliage","autumn_seasonal"]

### S101_remap_S091 — long_form

- **Query**: `We're a family of 4 with two teenagers traveling end of October. We want to see autumn foliage but also some cultural sites like temples. We have one full day in Jeju and prefer a private car tour with no shopping stops. The kids get carsick so frequent breaks are good. Budget is mid-range, around 400 USD total.` (locale=en)
- **today**: 2026-10
- **Rationale**: October + autumn foliage + family-of-4 + private car + Jeju + no shopping. Foliage season legitimate.
- **Response status**: `STRONG_MATCH`, signal=`strong`, floor=1.61
- **Top matches** (5):
  - `jeju-west-south-full-day-authentic-tour` score=6.44 themes=[jeju,west_south_jeju,alpine_wetland,ramsar_site,double_crater_volcano,west_coast_sunset,tea_culture]
  - `jeju-grand-highlights-loop` score=5.94 themes=[jeju,highlights,unesco,first_time_jeju,island_wide]
  - `jeju-eastern-unesco-spots-day-tour` score=5.74 themes=[jeju,east_jeju,unesco_focused,haenyeo_culture,world_heritage,intangible_heritage,joseon_heritage]
  - `southwest-hallasan-osulloc-aewol` score=4.18 themes=[jeju,southwest,first_time_jeju,tea_culture,cafe_culture,sunset]
  - `east-signature-nature-core` score=3.74 themes=[jeju,east_jeju,signature_nature,mythology,joseon_heritage,tadao_ando]
- **Failures**:
  - none of ["autumn_foliage"] found in top primary_themes (got ["jeju","west_south_jeju","alpine_wetland","ramsar_site","double_crater_volcano","west_coast_sunset","tea_culture","highlights","unesco","first_time_jeju","island_wide","east_jeju","unesco_focused","haenyeo_culture","world_heritage","intangible_heritage","joseon_heritage","southwest","cafe_culture","sunset","signature_nature","mythology","tadao_ando"])
