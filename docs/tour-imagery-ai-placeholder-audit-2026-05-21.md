# Tour Imagery — AI Placeholder Audit

**Date:** 2026-05-21
**Scope:** READ-ONLY inventory. Static tour catalog under `components/product-tour-static/`.
**Status:** Inventory only — no files were changed. This doc exists so the team can prioritize replacing AI placeholder images with real photos later.

## Executive summary

The static tour catalog is heavily illustrated with AI-generated placeholder images whose filenames match `chatgpt-image-*.webp`. A grep on 2026-05-21 (worktrees excluded) found **12,499 occurrences across 193 files**, spanning **32 distinct tour-slug folders** (every locale of those tours, plus one generated catalog file `catalog/catalogCards.generated.ts`). On disk, these references resolve to **138 distinct AI image files** stored in **41 POI-named folders** under `public/images/tours/`.

The high occurrence-per-tour counts (up to 150 refs in a single locale file) are NOT a sign of 150 distinct images — they are caused by the same handful of AI files being referenced repeatedly across parallel data structures inside each tour JSON (tour-level identity fields, a top-level `galleryItems[]`, every `itineraryStops[]` entry's `image`/`images[]`/`galleryItems[]`/`imageCredits[]`, and a duplicate `page_sections[]` rendering tree). One hero file is commonly reused for many itinerary stops within the same tour.

Of the 32 affected tours, **6 are AI-ONLY** (no real photographs anywhere in the file — hardest to fix, photos must be sourced from scratch) and **26 are a MIX** (some real photography already present — typically `kakaotalk-*.webp` field photos and named thumbnails — so they need partial top-up rather than a full shoot).

## Methodology / caveats

- **Grep-based.** Counts come directly from ripgrep over `components/product-tour-static/**` and a recursive file listing of `public/images/**/chatgpt-image-*.webp`. The headline 12,499 / 193 figure is the all-locale total; the per-tour "en.json AI refs" column uses the English file as a single representative locale.
- **"Placeholder vs intended art" is a content judgment not made here.** Every `chatgpt-image-*` reference is reported as an AI placeholder by filename convention. Whether any given one is acceptable as final art is a human call the team should make per tour.
- **Per-locale counts vary for some tours** (e.g. `jeju-hydrangea-festival-tour-east-route` is en=119 but es/ja/ko/zh/zh-TW=150). The extra refs in non-English locales are additional translated caption/`imageCredits` blocks pointing at the same files. The en.json count is therefore a conservative floor, not a ceiling. Where this matters it is flagged in the table.
- **All 32 tours have all 6 locales present** (en, es, ja, ko, zh, zh-TW). No locale files are missing for any affected tour.
- **`.claude/worktrees/` was excluded** per task constraint — only the canonical `components/product-tour-static/` tree was analyzed.
- **One non-tour file is included in the 193:** `components/product-tour-static/catalog/catalogCards.generated.ts` (214 refs). This is a generated catalog feeding the booking/list cards, so several tours' AI `heroImage`/`thumbnail` propagate into booking-visible catalog cards. It is generated output, not a hand-edited tour folder, so it is not counted as one of the 32 tour folders.

## How the field spread works (why counts are so high)

Each tour JSON references the same AI files from several places. Classified into the task's buckets:

- **Tour-level identity** — `ogImage`, `heroImage`, `thumbnail` (SEO/social + catalog card) and `hero.imageUrl` (page hero). These are the booking-visible images. ~4 refs per tour when AI.
- **Top-level `galleryItems[]`** — the atmosphere/photo strip (`{type:"photo", src:...}`).
- **`itineraryStops[]`** — each stop carries up to four image surfaces: `.image`, `.images[]`, `.galleryItems[]` (with both `url` and nested `src`), and `.imageCredits[]` (`url`). This is the biggest multiplier.
- **`page_sections[]`** — a second, duplicate rendering tree (hero / atmosphere gallery / timeline) that re-references the same files. Present in 30 of the affected en.json files; absent in `busan-cruise-shore-excursion-bus-tour` and `seoul-seoraksan-nami-island-morning-calm-day-tour`.

Representative field-key histogram (highest-count tour, `seoul-suwon-…-gwangmyeong-cave`, en=123): `src`×47, `url`×34, `image`×4, plus 1 each of `ogImage`/`heroImage`/`thumbnail`/`imageUrl`. The `src`+`url` pair (galleries + imageCredits, duplicated in page_sections) dominates every tour.

## Master table

Region key: BUS=Busan/Gyeongju, JEJ=Jeju, SEL=Seoul, INC=Incheon, POC=Pocheon. Field-spread legend: **ID** = AI in tour-level identity (ogImage/heroImage/thumbnail/hero.imageUrl) → booking-visible; **gal** = top-level galleryItems; **itin** = itineraryStops image/images/galleryItems/imageCredits; **§** = duplicate page_sections tree.

| Tour slug | Region | Locales | en.json AI refs | Field spread | Real photos? (AI-only / mix) |
|---|---|---|---|---|---|
| busan-gyeongju-unesco-legacy-tour-national-museum | BUS | 6 (en103 / es,ja,ko,zh,zh-TW 114) | 103 | ID + gal + itin + § + imageCredits×8 | **AI-ONLY** |
| busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju | BUS | 6 (all 70) | 70 | ID + gal + itin + § + imageCredits×5 | **AI-ONLY** |
| busan-spring-cherry-blossom-gyeongju-highlights-day-tour | BUS | 6 (all 79) | 79 | ID + gal + itin + § + imageCredits×6 | **AI-ONLY** |
| from-busan-gyeongju-ancient-capital-day-tour | BUS | 6 (en103 / others 114) | 103 | ID + gal + itin + § + imageCredits×8 | **AI-ONLY** |
| pocheon-sanjeong-lake-herb-island-art-valley | POC | 6 (all 65) | 65 | ID + gal + itin + § + imageCredits×6 | **AI-ONLY** |
| seoul-dmz-private-3rd-tunnel-suspension-bridge | SEL | 6 (en89 / es83 / others 89) | 89 | ID + gal + itin + § + imageCredits×8 | **AI-ONLY** |
| busan-top-attractions-day-tour | BUS | 6 (en89 / es,ko 99 / ja,zh,zh-TW 90) | 89 | ID + gal + itin + § + imageCredits×6 | mix (~9 real) |
| busan-small-group-sightseeing-tour-cruise-passengers | BUS | 6 (en60 / es96 / ko102 / ja,zh,zh-TW 88) | 60 | ID + gal + itin + § + imageCredits×4 | mix (~10 real) |
| busan-cruise-shore-excursion-bus-tour | BUS | 6 (all 16) | 16 | ID + gal + itin (no §) | mix (~11 real) |
| busan-private-car-charter-cruise-shore | BUS | 6 (en38 / es,ko 52 / ja,zh,zh-TW 46) | 38 | gal + itin + § + imageCredits×3 (identity real) | mix (~14 real) |
| busan-outskirts-tongdosa-amethyst-yeongnam-day-tour | BUS | 6 (en,ja,zh,zh-TW 4 / es,ko 8) | 4 | itin only (identity real) | mix (~7 real) |
| from-incheon-seoul-day-tour-cruise-guests | INC | 6 (all 48) | 48 | ID + gal + itin + § + imageCredits×6 | mix (~5 real) |
| incheon-seoul-private-car-shore-excursion-cruise | INC | 6 (en,es,ko 35 / ja,zh,zh-TW 25) | 35 | gal + itin + § + imageCredits×4 (identity real) | mix (~10 real) |
| jeju-cherry-blossom-tour-east-route | JEJ | 6 (all 61) | 61 | ID + gal + itin + § + imageCredits×2 | **in progress — separate task** (~5 real) |
| jeju-hydrangea-festival-tour-east-route | JEJ | 6 (en119 / others 150) | 119 | ID + gal + itin + § + imageCredits×9 | mix (~9 real) |
| jeju-hydrangea-festival-tour-southwest-route | JEJ | 6 (all 97) | 97 | gal + itin + § + imageCredits×8 (identity real) | mix (~8 real) |
| jeju-southern-top-unesco-spots-tour | JEJ | 6 (all 97) | 97 | gal + itin + § + imageCredits×10 (identity real) | mix (~10 real) |
| jeju-west-south-full-day-authentic-tour | JEJ | 6 (all 85) | 85 | ID + gal + itin + § + imageCredits×10 | mix (~14 real) |
| jeju-eastern-unesco-spots-day-tour | JEJ | 6 (en70 / others 123) | 70 | gal + itin + § + imageCredits×5 (identity real) | mix (~12 real) |
| southwest-hallasan-osulloc-aewol | JEJ | 6 (all 50) | 50 | gal + itin + § + imageCredits×5 (identity real) | mix (~14 real) |
| seoul-private-nami-morning-calm-petite-france | SEL | 6 (all 37) | 37 | gal + itin + § + imageCredits×6 (identity real) | mix (~4 real) |
| jeju-cruise-shore-excursion-bus-tour | JEJ | 6 (all 29) | 29 | gal + itin + § + imageCredits×3 (identity real) | mix (~11 real) |
| jeju-cruise-shore-excursion-small-group-tour | JEJ | 6 (all 29) | 29 | gal + itin + § + imageCredits×3 (identity real) | mix (~12 real) |
| jeju-winter-southwest-tangerine-snow-camellia-tour | JEJ | 6 (all 29) | 29 | ID + gal + itin + § + imageCredits×7 | mix (~9 real) |
| seoul-seoraksan-nami-island-morning-calm-day-tour | SEL | 6 (all 15) | 15 | ID + gal + itin (no §) | mix (~2 real) |
| seoul-suburbs-private-chartered-car-10hr | SEL | 6 (all 7) | 7 | itin + § + imageCredits×1 (identity real) | mix (~5 real) |
| jeju-grand-highlights-loop | JEJ | 6 (all 5) | 5 | itin + § + imageCredits×4 (identity real) | mix (~13 real) |
| jeju-island-private-car-charter-tour | JEJ | 6 (all 2) | 2 | itin only (identity real) | mix (~7 real) |
| seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library | SEL | 6 (all 123) | 123 | ID + gal + itin + § + imageCredits×8 | mix (~1 real) |
| seoul-suwon-hwaseong-folk-village-starfield-library | SEL | 6 (all 102) | 102 | ID + gal + itin + § + imageCredits×8 | mix (~1 real) |
| seoul-suwon-hwaseong-waujeongsa-starfield | SEL | 6 (en99 / es95 / others 99) | 99 | ID + gal + itin + § + imageCredits×6 | mix (~1 real) |
| east-signature-nature-core | JEJ | 6 (all 70) | 70 | gal + itin + § + imageCredits×10 (identity real) | mix (~21 real) |

> Note on the three `seoul-suwon-hwaseong-*-starfield*` tours: classified as "mix" only on a technicality — they each contain a single real photo (`kakaotalk-20260510-222949305.webp`) and are otherwise AI throughout, including booking-visible identity. Treat them as near-AI-only for prioritization.

## Tours that are AI-ONLY (hardest — photos must be sourced from scratch)

These 6 tours have **zero** real photographs anywhere in the file. Every surface (identity, gallery, itinerary, page_sections) is AI. They need a full real-photo sourcing effort:

1. `busan-gyeongju-unesco-legacy-tour-national-museum` (BUS) — 103 en refs
2. `from-busan-gyeongju-ancient-capital-day-tour` (BUS) — 103 en refs
3. `busan-spring-cherry-blossom-gyeongju-highlights-day-tour` (BUS) — 79 en refs
4. `busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju` (BUS) — 70 en refs
5. `pocheon-sanjeong-lake-herb-island-art-valley` (POC) — 65 en refs
6. `seoul-dmz-private-3rd-tunnel-suspension-bridge` (SEL) — 89 en refs

**Near-AI-only (single token real photo, treat as AI-only):** the three Suwon-Hwaseong+Starfield tours (`…-gwangmyeong-cave-…` 123, `…-folk-village-…` 102, `…-waujeongsa-…` 99) — each has only one real photo and AI booking-visible identity.

## Tours that are a MIX (partial real coverage — top-up, not from scratch)

The remaining 26 tours already carry real photography (mostly `kakaotalk-*.webp` field photos plus named thumbnails like `*-thumbnail.webp`, `haedong-yonggungsa-*.webp`, `amethyst-cave-*.webp`). Two sub-groups by difficulty:

- **Identity already real (AI only in galleries/itinerary)** — lowest urgency, not booking-visible: `busan-private-car-charter-cruise-shore`, `busan-outskirts-tongdosa-amethyst-yeongnam-day-tour`, `incheon-seoul-private-car-shore-excursion-cruise`, `jeju-hydrangea-festival-tour-southwest-route`, `jeju-southern-top-unesco-spots-tour`, `jeju-eastern-unesco-spots-day-tour`, `southwest-hallasan-osulloc-aewol`, `seoul-private-nami-morning-calm-petite-france`, `jeju-cruise-shore-excursion-bus-tour`, `jeju-cruise-shore-excursion-small-group-tour`, `seoul-suburbs-private-chartered-car-10hr`, `jeju-grand-highlights-loop`, `jeju-island-private-car-charter-tour`, `east-signature-nature-core`.
- **Identity is AI (booking-visible) but body has real photos** — higher urgency: `busan-top-attractions-day-tour`, `busan-small-group-sightseeing-tour-cruise-passengers`, `busan-cruise-shore-excursion-bus-tour`, `from-incheon-seoul-day-tour-cruise-guests`, `jeju-hydrangea-festival-tour-east-route`, `jeju-west-south-full-day-authentic-tour`, `jeju-winter-southwest-tangerine-snow-camellia-tour`, `seoul-seoraksan-nami-island-morning-calm-day-tour`, plus the three Suwon tours noted above.

(`jeju-cherry-blossom-tour-east-route` is being fixed under a separate current task and is excluded from the work lists above.)

## Shared AI image files (138 files on disk, reuse pattern)

The references resolve to **138 distinct `chatgpt-image-*.webp` files in 41 POI-named folders** under `public/images/tours/`. Folders are named per point-of-interest (not per tour), so tours that visit the same POI share the same AI files — and within one tour the same file is reused across that stop's `image` + `images[]` + `galleryItems[]` + `imageCredits[]` + the page_sections duplicate. That reuse is what inflates a ~5-stop tour to 60–150 refs.

Files per POI folder (descending):

| Files | POI folder | | Files | POI folder |
|---|---|---|---|---|
| 10 | osulloc-tea | | 3 | un-memorial-cemetery |
| 10 | ilchulland | | 3 | saryeoni-forest |
| 7 | seongeup-folk-village | | 3 | hueree |
| 7 | everland | | 3 | herb-island |
| 6 | taejongdae | | 3 | gyeongju-national-museum |
| 6 | jeju-ecoland | | 3 | dmz |
| 6 | cheongsapo-blue-line | | 3 | bulguksa-temple |
| 5 | waujeongsa | | 3 | ahopsan-bamboo |
| 5 | gyeongbokgung | | 2 | sanjeong-lake, pocheon-art-valley, korean-folk-village |
| 5 | gwangmyeong-cave | | 2 | imjingak, iho-teu, gamcheon-culture-village |
| 4 | suwon-hwaseong | | 2 | daereungwon, cheomseongdae, camellia-hill |
| 4 | starfield-library-suwon | | 1 | songdo-beach, nami-island, myeongdong, jusangjeolli |
| 4 | n-seoul-tower | | 1 | jeju-fantasy-forest, gwangjang-market, gamaksan-suspension-bridge |
| 4 | gyochon-hanok-village | | 1 | busan-tower, aewol-cafe-street |
| 4 | garden-of-morning-calm | | | |

**Reuse hotspots** (a single file used as the hero/og/thumbnail and then repeated for many stops): `imjingak/chatgpt-image-2026-5-10-10-40-40.webp` is the DMZ tour's og/hero/thumbnail AND is reused for multiple itinerary stops + the whole page_sections block. The Gyeongju cluster (`gyeongju-national-museum`, `bulguksa-temple`, `daereungwon`, `cheomseongdae`) and the Jeju POI clusters (`osulloc-tea`, `ilchulland`, `jeju-ecoland`, `seongeup-folk-village`) are shared across several tours each, so replacing one POI's files fixes that POI across every tour that visits it.

## Suggested prioritization (suggestions only — not decisions)

1. **Booking-visible identity images first.** Replace AI `ogImage`/`heroImage`/`thumbnail`/`hero.imageUrl` (and the resulting `catalog/catalogCards.generated.ts` cards) on the tours where identity is AI — these are what shoppers see on the list, hero, and social shares. That set = the 6 AI-only + the 3 near-AI-only Suwon tours + the 8 "identity-is-AI" mix tours.
2. **Then the 6 AI-only (+3 near-AI-only) tours in full**, because they have no real photo to fall back on anywhere. Bias Busan/Gyeongju first (4 of the 6 AI-only tours are the Busan↔Gyeongju cluster and share POI folders, so a single Gyeongju POI shoot — `gyeongju-national-museum`, `bulguksa-temple`, `daereungwon`, `cheomseongdae`, `cheomseongdae` — lifts all four at once).
3. **Fix by shared POI folder, not by tour.** Because folders are POI-named and shared, replacing the files in one POI folder repairs every tour that references it. High-leverage POI folders by reference fan-out: the Jeju set (`osulloc-tea`, `ilchulland`, `jeju-ecoland`, `seongeup-folk-village`, `saryeoni-forest`) and the Seoul-suburbs set (`suwon-hwaseong`, `starfield-library-suwon`, `waujeongsa`, `gwangmyeong-cave`, `korean-folk-village`, `garden-of-morning-calm`).
4. **Mix tours where identity is already real are lowest urgency** — AI only shows inside galleries/itinerary, not on booking surfaces; batch these last.
5. **Photo standard:** apply the existing tour-photo quality policy (16:9, OTA-bright, no AI feel, real-photo sharpness) when sourcing replacements.

---
*Generated 2026-05-21. Inventory only; no source files were modified.*
