# Tour Photo Overnight Audit — 2026-05-23

This audit covered every tour-product JSON (6 locales × 34 tours = 204 docs)
and every photo file under `/public/images/{tours,itinerary,hero}/`.

## TL;DR

- **24 tour-product JSON files cleaned**: removed 11 mismatched photos per
  doc (haedong-yonggungsa + taejongdae photos that were incorrectly stacked
  into the UN Memorial Cemetery stop in 4 Busan tours × 6 locales).
- **5 landing-page hero slides** replaced with photogenic existing imagery
  drawn from `/images/tours/` covering Busan sunset, Busan colour, Gyeonggi
  autumn, Seoul palace, Jeju waterfall.
- **31 POI folders flagged as photo-sparse** (≤3 photos) — boost candidate
  list at `docs/tour-photo-boost-candidates-2026-05-23.json`.
- **3 POI folders are missing entirely** (referenced via `stop.image` but
  no folder on disk) — these stops currently fall back to a borrowed image
  and were left untouched to avoid breaking the UI:
  - `jeonnong-ro` (Jeonnong-ro Cherry Blossom Street, Jeju)
  - `noksan-ro` (Noksan-ro Gasi-ri Cherry + Canola Road, Jeju)
  - `suwon-nammun-market` (Suwon Nammun / Paldalmun Market)

## Audit scope

| Metric                                  | Value |
|-----------------------------------------|------:|
| Tour slugs scanned                      | 34    |
| Locale docs scanned                     | 204   |
| Photo references in JSONs               | 7,062 |
| Unique photo paths                      | 214   |
| Physical files on disk                  | 277   |
| POI folders                             | 57    |
| POIs flagged as sparse (≤3 photos)      | 31    |
| Real cross-POI mismatches (post-fix)    | 9     |
| Missing files (referenced w/o disk file)| 0     |
| Orphan files (disk-only, never used)    | 63    |

Methodology + raw numbers: see `tour-photo-audit-2026-05-23.{md,json}`.

## What was fixed

### Cross-POI mismatches stripped

The UN Memorial Cemetery stop in each of these tours was carrying 11 extra
photos that belonged to other Busan POIs (haedong-yonggungsa + taejongdae).
The script `scripts/fix-cross-poi-mismatches.mjs` reverted those stops to
their three native UN-cemetery photos:

- `busan-cruise-shore-excursion-bus-tour` × 6 locales
- `busan-private-car-charter-cruise-shore` × 6 locales
- `busan-small-group-sightseeing-tour-cruise-passengers` × 6 locales
- `busan-top-attractions-day-tour` × 6 locales

### Landing-page hero slides (3 → 5)

Replaced `HERO_SLIDES` in `components/home/v2/sections/hero-section.tsx`
with five existing high-quality photos sourced from
`/public/images/tours/`. Old `/images/hero/{jeju|seoul|busan}-hero.jpg`
remain on disk (still referenced by SEO / other pages) but no longer used
by the home hero crossfade.

The chosen five (verified visually):

1. `/images/tours/haedong-yonggungsa/haedong-yonggungsa-sunset-cliff.webp`
   — Busan seaside temple at golden hour (Korean tourism signature).
2. `/images/tours/gamcheon-culture-village/gamcheon-panorama.webp`
   — Busan colourful hillside village panorama.
3. `/images/tours/garden-of-morning-calm/chatgpt-image-2026-5-10-10-43-58.webp`
   — Gyeonggi autumn explosion with suspension bridge.
4. `/images/tours/gyeongbokgung/chatgpt-image-2026-5-11-12-21-26.webp`
   — Seoul palace with hanbok-clad visitors.
5. `/images/tours/cheonjeyeon-falls/kakaotalk-20260510-230009595-08.webp`
   — Jeju emerald-pool waterfall.

## What was left for follow-up

### Cross-POI mismatches retained (safe to share)

These were intentionally NOT stripped because the photo correctly
represents both stops sharing a geographic/operational complex:

| Photo folder         | Shared POI keys                                                | Reason                                |
|----------------------|----------------------------------------------------------------|---------------------------------------|
| `suwon-hwaseong`     | `hwaseong_fortress`, `hwaseong_haenggung`                      | Same fortress complex (Suwon Hwaseong) |
| `dmz`                | `third_infiltration_tunnel`, `dora_observatory`                | Same DMZ tour zone                    |
| `ilchulland`         | `ilchulland_micheon_cave`, `ilchulland_themed_gardens`         | Same property                         |

### Mismatches left in place because no native folder exists yet

| Stop                                                   | Currently borrows from | Needs folder            |
|--------------------------------------------------------|------------------------|-------------------------|
| Jeonnong-ro Cherry Blossom Street                      | `ilchulland`           | `jeonnong-ro`           |
| Noksan-ro Gasi-ri Cherry + Canola Road                 | `ilchulland`           | `noksan-ro`             |
| Suwon Nammun Market                                    | `suwon-hwaseong`       | `suwon-nammun-market`   |
| Gamaksan Red (Suspension) Bridge                       | `dmz`                  | `gamaksan-suspension-bridge` (only 1 photo today) |

These are listed in the boost-candidate doc so the next photo-import pass
(`scripts/import-atoc-modified-photos.mjs`) can drop sourced photos into
the correct folder and unblock the strip-and-replace step.

### Photo boost priority — 31 POI folders with ≤3 photos

Full machine-readable list in `tour-photo-boost-candidates-2026-05-23.json`.
Headline targets (1 photo only):

- `songdo-beach` (Busan)
- `gwangjang-market` (Seoul)
- `bukchon-hanok` (Seoul)
- `myeongdong` (Seoul)
- `incheon-cruise` (Incheon terminal)
- `jeju-cruise-terminal` (Jeju terminal)

Sourcing URLs from VisitKorea / 대한민국 구석구석 / Wikimedia were
collected in a sibling document; see `tour-photo-boost-urls-2026-05-23.md`
once available.

### Orphan files on disk (63)

Listed in section "Orphan files on disk" of `tour-photo-audit-2026-05-23.md`.
Heavy concentrations under `everland/`, `jeju-ecoland/`, `saryeoni-forest/`,
and several `*.png` cover renders under `jeju-private-tour-*`,
`jeju-eastern-unesco-*`. These can either be wired into matching stops or
deleted in a cleanup pass — not done here to keep the diff focused.

## Scripts shipped

- `scripts/audit-tour-photos.mjs` — full inventory + sparse/orphan/mismatch
  report. Re-run any time to refresh the audit doc.
- `scripts/fix-cross-poi-mismatches.mjs` — applies the ALLOWED_FOLDERS rule
  to strip cross-POI photo reuse. Supports `--dry-run`.
