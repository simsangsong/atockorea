# Tour Photo Audit — 2026-05-24

## Summary

- Tour slugs scanned: **34**
- Locale docs scanned: **204** (missing: 0)
- Total photo references in JSONs: **10272**
- Unique photo paths: **391**
- Physical files in /public/images/tours: **479**
- POI folders: **61** (sparse ≤1 photo: 5)
- Cross-POI reuse (same image, multiple POI keys/locations): **21**
- Missing files (referenced but not on disk): **1**
- Orphan files (on disk, never referenced): **108**

## Sparse POI folders (≤1 photo)

- `songdo-beach` — 1 photo · used by [songdo_beach] (36 refs)
- `myeongdong` — 1 photo · used by [myeongdong] (18 refs)
- `jeonnong-ro` — 1 photo · used by [] (6 refs)
- `jeju-private` — 1 photo · used by [] (30 refs)
- `seoraksan` — 1 photo · used by [] (9 refs)

## Top 30 cross-POI reuse cases (review these first)

- `/images/tours/haedong-yonggungsa/haedong-yonggungsa-sunset-cliff.webp` (folder=`haedong-yonggungsa`) used by POI keys [haedong_yonggungsa, un_memorial_cemetery] / locations [Haedong Yonggungsa Temple | 해동 용궁사 | 海東龍宮寺]
- `/images/tours/haedong-yonggungsa/haedong-yonggungsa-haesu-gwaneum.webp` (folder=`haedong-yonggungsa`) used by POI keys [haedong_yonggungsa, un_memorial_cemetery] / locations [Haedong Yonggungsa Temple | 해동 용궁사 | 海東龍宮寺]
- `/images/tours/haedong-yonggungsa/haedong-yonggungsa-dragon-hall.webp` (folder=`haedong-yonggungsa`) used by POI keys [haedong_yonggungsa, un_memorial_cemetery] / locations [Haedong Yonggungsa Temple | 해동 용궁사 | 海東龍宮寺]
- `/images/tours/haedong-yonggungsa/haedong-yonggungsa-main-courtyard.webp` (folder=`haedong-yonggungsa`) used by POI keys [haedong_yonggungsa, un_memorial_cemetery] / locations [Haedong Yonggungsa Temple | 해동 용궁사 | 海東龍宮寺]
- `/images/tours/haedong-yonggungsa/haedong-yonggungsa-zodiac-statues.webp` (folder=`haedong-yonggungsa`) used by POI keys [haedong_yonggungsa, un_memorial_cemetery] / locations [Haedong Yonggungsa Temple | 해동 용궁사 | 海東龍宮寺]
- `/images/tours/taejongdae/chatgpt-image-2026-5-10-12-26-45.webp` (folder=`taejongdae`) used by POI keys [un_memorial_cemetery, taejongdae] / locations [UN Memorial Cemetery in Korea | 재한유엔기념공원 | 韓国国連記念公園]
- `/images/tours/taejongdae/chatgpt-image-2026-5-10-12-27-04.webp` (folder=`taejongdae`) used by POI keys [un_memorial_cemetery, taejongdae] / locations [UN Memorial Cemetery in Korea | 재한유엔기념공원 | 韓国国連記念公園]
- `/images/tours/taejongdae/chatgpt-image-2026-5-10-12-27-19.webp` (folder=`taejongdae`) used by POI keys [un_memorial_cemetery, taejongdae] / locations [UN Memorial Cemetery in Korea | 재한유엔기념공원 | 韓国国連記念公園]
- `/images/tours/taejongdae/chatgpt-image-2026-5-10-12-27-30.webp` (folder=`taejongdae`) used by POI keys [un_memorial_cemetery, taejongdae] / locations [UN Memorial Cemetery in Korea | 재한유엔기념공원 | 韓国国連記念公園]
- `/images/tours/taejongdae/chatgpt-image-2026-5-10-12-27-34.webp` (folder=`taejongdae`) used by POI keys [un_memorial_cemetery, taejongdae] / locations [UN Memorial Cemetery in Korea | 재한유엔기념공원 | 韓国国連記念公園]
- `/images/tours/taejongdae/chatgpt-image-2026-5-10-12-29-06.webp` (folder=`taejongdae`) used by POI keys [un_memorial_cemetery, taejongdae] / locations [UN Memorial Cemetery in Korea | 재한유엔기념공원 | 韓国国連記念公園]
- `/images/tours/ilchulland/chatgpt-image-2026-5-8-07-45-52.webp` (folder=`ilchulland`) used by POI keys [ilchulland_micheon_cave, jeonnong_ro_cherry_blossom_street, noksan_ro_gasiri_blossom_road, ilchulland_themed_gardens] / locations [Ilchul Land (Micheon Cave Lava Tube) | 일출랜드 (미천굴 용암동굴) | イルチュルランド（ミチョン洞窟溶岩チューブ）]
- `/images/tours/dmz/chatgpt-image-2026-5-10-10-36-43.webp` (folder=`dmz`) used by POI keys [third_infiltration_tunnel, dora_observatory, gamaksan_red_bridge] / locations [3rd Infiltration Tunnel (Underground Invasion Tunnel) | 제3땅굴 (지하 침투 땅굴) | 第3浸透トンネル（地下侵入トンネル）]
- `/images/tours/dmz/chatgpt-image-2026-5-10-10-39-00.webp` (folder=`dmz`) used by POI keys [third_infiltration_tunnel, dora_observatory, gamaksan_red_bridge] / locations [3rd Infiltration Tunnel (Underground Invasion Tunnel) | 제3땅굴 (지하 침투 땅굴) | 第3浸透トンネル（地下侵入トンネル）]
- `/images/tours/dmz/chatgpt-image-2026-5-10-10-40-32.webp` (folder=`dmz`) used by POI keys [third_infiltration_tunnel, dora_observatory, gamaksan_red_bridge] / locations [3rd Infiltration Tunnel (Underground Invasion Tunnel) | 제3땅굴 (지하 침투 땅굴) | 第3浸透トンネル（地下侵入トンネル）]
- `/images/tours/suwon-hwaseong/kakaotalk-20260510-222949305.webp` (folder=`suwon-hwaseong`) used by POI keys [hwaseong_fortress, hwaseong_haenggung, suwon_nammun_market] / locations [Suwon Hwaseong Fortress | 수원 화성 | 水原華城]
- `/images/tours/suwon-hwaseong/chatgpt-image-2026-5-11-01-00-57.webp` (folder=`suwon-hwaseong`) used by POI keys [hwaseong_fortress, hwaseong_haenggung] / locations [Suwon Hwaseong Fortress | 수원 화성 | 水原華城]
- `/images/tours/suwon-hwaseong/chatgpt-image-2026-5-11-01-09-43.webp` (folder=`suwon-hwaseong`) used by POI keys [hwaseong_fortress, hwaseong_haenggung] / locations [Suwon Hwaseong Fortress | 수원 화성 | 水原華城]
- `/images/tours/suwon-hwaseong/chatgpt-image-2026-5-11-01-09-58.webp` (folder=`suwon-hwaseong`) used by POI keys [hwaseong_fortress, hwaseong_haenggung] / locations [Suwon Hwaseong Fortress | 수원 화성 | 水原華城]
- `/images/tours/suwon-hwaseong/chatgpt-image-2026-5-11-01-12-24.webp` (folder=`suwon-hwaseong`) used by POI keys [hwaseong_fortress, hwaseong_haenggung] / locations [Suwon Hwaseong Fortress | 수원 화성 | 水原華城]
- `/images/tours/suwon-hwaseong/photo-002.webp` (folder=`suwon-hwaseong`) used by POI keys [hwaseong_fortress, hwaseong_haenggung] / locations [Suwon Hwaseong Fortress | 수원 화성 | Fortaleza Hwaseong de Suwon]

## Missing files (first 50)

- `/images/tours/seoraksan/photo-001.webp` (9 refs, sample slug: seoul-seoraksan-naksansa-temple-naksan-beach-day-trip)

## Orphan files on disk (first 50)

- `/images/tours/busan-plum-blossom/photo-001.webp`
- `/images/tours/busan-private/busan-private-cruise-terminal-thumbnail.webp`
- `/images/tours/busan-private/busan-private-thumbnail-gwangalli.webp`
- `/images/tours/cheongsando/photo-001.webp`
- `/images/tours/cheongsapo-blue-line/cheongsapo-sky-capsule-interior.webp`
- `/images/tours/daereungwon/chatgpt-image-2026-5-10-01-37-30-2.webp`
- `/images/tours/daereungwon/chatgpt-image-2026-5-10-01-37-30.webp`
- `/images/tours/daereungwon/chatgpt-image-2026-5-10-01-37-33-2.webp`
- `/images/tours/daereungwon/chatgpt-image-2026-5-10-01-37-33.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-36-42-2.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-36-42.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-36-45-2.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-36-45.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-36-56-2.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-36-56.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-37-09-2.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-37-09.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-38-48-2.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-38-48.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-38-57-2.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-38-57.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-45-11-2.webp`
- `/images/tours/everland/chatgpt-image-2026-5-9-11-45-11.webp`
- `/images/tours/everland/photo-008.webp`
- `/images/tours/gamaksan-suspension-bridge/chatgpt-image-2026-5-10-10-36-38-2.webp`
- `/images/tours/gamaksan-suspension-bridge/chatgpt-image-2026-5-10-10-36-38.webp`
- `/images/tours/gamcheon-culture-village/gamcheon-panorama.webp`
- `/images/tours/gamcheon-culture-village/gamcheon-vibrant-viewpoint.webp`
- `/images/tours/hwangnam-bread/photo-001.webp`
- `/images/tours/hwangnam-bread/photo-002.webp`
- `/images/tours/iho-teu/chatgpt-image-2026-5-9-01-17-13-2.webp`
- `/images/tours/iho-teu/chatgpt-image-2026-5-9-01-17-13.webp`
- `/images/tours/iho-teu/chatgpt-image-2026-5-9-01-17-19-2.webp`
- `/images/tours/iho-teu/chatgpt-image-2026-5-9-01-17-19.webp`
- `/images/tours/incheon-cruise/incheon-cruise-terminal-thumbnail.webp`
- `/images/tours/jeju-cruise-terminal/jeju-cruise-terminal-private-pickup.webp`
- `/images/tours/jeju-cruise-tour-coast.png`
- `/images/tours/jeju-eastern-unesco-beach.png`
- `/images/tours/jeju-eastern-unesco-cover.png`
- `/images/tours/jeju-eastern-unesco-haenyeo.png`
- `/images/tours/jeju-eastern-unesco-seongsan.png`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-50-52-2.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-50-52.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-52-28-2.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-52-28.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-52-32-2.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-52-32.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-52-34-2.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-52-34.webp`
- `/images/tours/jeju-ecoland/chatgpt-image-2026-5-8-07-58-24-2.webp`

## Full per-POI photo count (ascending)

| Photos | Folder | Distinct POI keys | Locations |
|-------:|--------|-------------------|-----------|
| 1 | `songdo-beach` | 1 | 12 |
| 1 | `myeongdong` | 1 | 6 |
| 1 | `jeonnong-ro` | 0 | 6 |
| 1 | `jeju-private` | 0 | 6 |
| 1 | `seoraksan` | 0 | 5 |
| 2 | `woljeonggyo` | 1 | 6 |
| 2 | `bukchon-hanok` | 1 | 11 |
| 2 | `insadong` | 1 | 3 |
| 2 | `gwangjang-market` | 1 | 4 |
| 2 | `jeju-tangerine-farm` | 1 | 6 |
| 2 | `naksan-beach` | 1 | 6 |
| 3 | `gyeongju-national-museum` | 1 | 6 |
| 3 | `amethyst-cave` | 1 | 6 |
| 3 | `yeongnam-alps` | 1 | 6 |
| 3 | `seoraksan-national-park` | 1 | 10 |
| 3 | `naksansa-temple` | 1 | 4 |
| 4 | `gamcheon-culture-village` | 1 | 9 |
| 4 | `jagalchi-market` | 1 | 8 |
| 4 | `cheomseongdae` | 1 | 6 |
| 4 | `n-seoul-tower` | 1 | 6 |
| 4 | `hallim-park` | 1 | 6 |
| 4 | `camellia-hill` | 1 | 21 |
| 4 | `osulloc-tea` | 1 | 16 |
| 4 | `sanjeong-lake` | 1 | 5 |
| 4 | `pocheon-art-valley` | 1 | 6 |
| 4 | `korean-folk-village` | 1 | 6 |
| 5 | `haedong-yonggungsa` | 2 | 11 |
| 5 | `bulguksa-temple` | 1 | 9 |
| 5 | `hallasan-eoseungsaengak` | 1 | 17 |
| 5 | `nami-island` | 1 | 8 |
| 5 | `petite-france` | 1 | 5 |
| 5 | `seoul-private-charter` | 0 | 23 |
| 6 | `un-memorial-cemetery` | 1 | 15 |
| 6 | `busan-tower` | 1 | 8 |
| 6 | `ahopsan-bamboo` | 1 | 8 |
| 6 | `jeju-haenyeo-museum` | 1 | 6 |
| 6 | `jeongbang-falls` | 1 | 5 |
| 6 | `hueree` | 1 | 6 |
| 6 | `hyeopjae-beach` | 1 | 14 |
| 6 | `hallasan-1100` | 1 | 6 |
| 6 | `herb-island` | 1 | 6 |
| 6 | `dmz` | 3 | 6 |
| 7 | `cheonjeyeon-falls` | 1 | 21 |
| 7 | `imjingak` | 1 | 6 |
| 7 | `garden-of-morning-calm` | 1 | 9 |
| 7 | `suwon-hwaseong` | 3 | 6 |
| 8 | `hamdeok-beach` | 1 | 7 |
| 8 | `starfield-library-suwon` | 1 | 13 |
| 9 | `jusangjeolli` | 1 | 33 |
| 9 | `aewol-cafe-street` | 1 | 11 |
| 10 | `gyochon-hanok-village` | 1 | 7 |
| 10 | `gwangmyeong-cave` | 1 | 5 |
| 10 | `waujeongsa` | 1 | 6 |
| 11 | `seongsan-ilchulbong` | 1 | 15 |
| 11 | `seongeup-folk-village` | 1 | 14 |
| 12 | `taejongdae` | 2 | 14 |
| 12 | `jeju-stone-park` | 1 | 6 |
| 12 | `seopjikoji` | 1 | 15 |
| 13 | `gyeongbokgung` | 1 | 11 |
| 14 | `cheongsapo-blue-line` | 1 | 6 |
| 17 | `ilchulland` | 4 | 28 |