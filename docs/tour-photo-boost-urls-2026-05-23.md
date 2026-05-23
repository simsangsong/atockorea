# Photo Boost URLs — 11 Sparse POIs (2026-05-23)

Source priorities (in this order):

1. **`api.cdn.visitjeju.net`** — direct `.webp` URLs, hotlink-friendly
2. **`upload.wikimedia.org`** — Wikimedia Commons, CC0 / CC BY-SA, attribution required for BY-SA
3. **`korean.visitkorea.or.kr`** — reference pages only (gallery is JS-rendered, cannot be parsed with WebFetch; pull manually or via KTO Tourapi `detailImage1`)

Run `scripts/import-atoc-modified-photos.mjs` after downloading each URL set
into `D:\Atoc Photos\modified\<Korean place name>\` to push through the
normal pipeline (WebP + Supabase Storage + JSON wiring).

---

## 1. 전농로 벚꽃길 (Jeonnong-ro Cherry Blossom Street, Jeju)

- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/a0fbc6e2-bcbb-4c34-bb76-e1beda263df5.webp — Cherry blossoms in full bloom, street view
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/da7bc396-e798-4fd9-8946-49e5250a83e1.webp — Cherry blossom tunnel
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/14583e43-c2da-40a4-8221-916d60410677.webp — Daytime street
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/124a246d-426f-49c6-a26b-7592466a423e.webp — Cherry blossom close-up
- https://api.cdn.visitjeju.net/photomng/imgpath/202603/17/f18c0594-5eae-4925-8186-e994ba1acc66.webp — 19th festival main visual (2026)
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/c5f31522-cc19-4c05-a46e-51570d5ab957.webp — Night lighting

Reference: https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=4ebfb9fe-ca5d-460b-a6f5-3b37b4ef6315

## 2. 녹산로 가시리 벚꽃·유채꽃길 (Noksan-ro Gasi-ri, Jeju)

- https://api.cdn.visitjeju.net/photomng/imgpath/202111/02/de9bff1b-ebd5-4aaa-9a95-e1b9203aec07.webp — Main wide canola road (recommended)
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/ec6051cc-c759-4374-b20a-067190abe7b8.webp — Canola + cherry blossom combo
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/47f13d34-f8dc-48d9-89ff-a192e200f632.webp — Cherry blossoms + canola road
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/8700282f-017e-4408-af21-195a88d3402f.webp — Canola field + oreum backdrop
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/0c08faf0-3a8a-4879-854a-9dc4f3155ffc.webp — Yellow+pink combo street
- https://api.cdn.visitjeju.net/photomng/imgpath/201908/28/0491dc32-ce42-4590-82d4-4582d0f45d65.webp — Gasi-ri village canola
- https://api.cdn.visitjeju.net/photomng/imgpath/202111/02/be1f5777-27d3-4ea8-bb2d-d87edfb8e312.webp — Noksan-ro road view

## 3. 수원 남문시장 / 팔달문시장 (Suwon Nammun Market / Paldalmun Market)

> KR-구석구석 gallery is JS-rendered. Wikimedia Commons stand-ins below.

- https://upload.wikimedia.org/wikipedia/commons/f/f6/Paldalmun_20240929_001.jpg — Paldalmun Gate (6000×4000), CC BY-SA 4.0 (Mobius6)
- https://upload.wikimedia.org/wikipedia/commons/1/10/Paldalmun_20240929_003.jpg — Paldalmun other angle
- https://upload.wikimedia.org/wikipedia/commons/3/3e/Paldalmun_20240929_002.jpg — Paldalmun side view
- https://upload.wikimedia.org/wikipedia/commons/2/26/Paldal-mun%28gate%29_in_Suwon_Hwaseoung_Fortress.jpg — 1440×810 16:9, CC BY-SA 3.0
- https://upload.wikimedia.org/wikipedia/commons/b/bd/Suwon_Marketplace%2C_Suwon%2C_Gyeonggi-do%2C_Republic_of_Korea.jpg — Market interior, CC BY-SA 4.0
- https://upload.wikimedia.org/wikipedia/commons/a/af/Ji-dong_Market%2C_Suwon_2018-09-01.jpg — Ji-dong Market entrance (one of the 9 sub-markets)

References:
- https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=71eabd87-5109-4b84-8198-6fa8e22c3f92
- https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=97ca74b9-d045-4dc1-b14b-8be68afc5cca

## 4. 감악산 출렁다리 (Gamaksan Suspension Bridge / Red Bridge, Paju)

- https://upload.wikimedia.org/wikipedia/commons/b/b8/Gamaksan_Suspension_Bridge_-_54972915976.jpg — 7684×5125 (Gage Skidmore, CC BY-SA 4.0)
- https://upload.wikimedia.org/wikipedia/commons/d/d8/Gamaksan_Suspension_Bridge_-_54973096378.jpg — 8192×5464 (max resolution)
- https://upload.wikimedia.org/wikipedia/commons/a/a5/Gamaksan_Suspension_Bridge_in_Paju_South_Korea.jpg — 4080×3072
- https://upload.wikimedia.org/wikipedia/commons/c/cf/Gamaksan_Suspension_Bridge_in_Paju.jpg — 3072×4080 (Suohros)
- https://upload.wikimedia.org/wikipedia/commons/0/0d/Gamaksan_Suspension_Bridge.jpg — additional angle

## 5. 송도해수욕장 (Songdo Beach, Busan)

- https://upload.wikimedia.org/wikipedia/commons/c/c2/Songdo_Beach_Area_and_Namhang_Bridge_in_Busan.jpg — Beach + Namhang Bridge (6000×4000), 2024 (recommended)
- https://upload.wikimedia.org/wikipedia/commons/b/ba/Busan_-_Songdo_beach.jpg — Beach view, CC BY-SA 3.0
- https://upload.wikimedia.org/wikipedia/commons/8/8c/Songdo_Cloud_Trails_Skywalk_Songdo_Beach_Busan_%2845749115681%29.jpg — Cloud Trails Skywalk (6720×4480)
- https://upload.wikimedia.org/wikipedia/commons/9/9a/Songdo_Cloud_Trails_Skywalk_Songdo_Beach_Busan_%2845024034094%29.jpg — Skywalk + beach
- https://upload.wikimedia.org/wikipedia/commons/e/e1/Songdo_Cloud_Trails_Skywalk_Songdo_Beach_Busan_%2830809004917%29.jpg — Wide skywalk
- https://upload.wikimedia.org/wikipedia/commons/b/bd/Busan_songdo_beach.jpg — Alt beach angle
- https://upload.wikimedia.org/wikipedia/commons/3/39/Songdo_Beach_-_panoramio.jpg — Panorama

## 6. 광장시장 (Gwangjang Market, Seoul Jongno)

- https://upload.wikimedia.org/wikipedia/commons/9/94/Gwangjang_Market%2C_Seoul_01.jpg — Market entrance (5184×3456), **CC0** (Bernard Gagnon) (recommended)
- https://upload.wikimedia.org/wikipedia/commons/f/fd/Gwangjang_Market.JPG — Market overview (5472×3648, 7.67MB)
- https://upload.wikimedia.org/wikipedia/commons/0/05/Korea_GwangjangMarket_Eats_16_%2813885172213%29.jpg — Food alley (5696×3736), Korea.net CC BY-SA 2.0
- https://upload.wikimedia.org/wikipedia/commons/2/2a/Yukhoe_in_Gwangjang_Market%2C_Seoul.jpg — Signature yukhoe (5312×2988)
- https://upload.wikimedia.org/wikipedia/commons/f/fb/Korea_GwangjangMarket_Eats_17_%2813885505724%29.jpg — Food alley 17 (5648×3597)

## 7. 북촌한옥마을 (Bukchon Hanok Village, Seoul)

- https://upload.wikimedia.org/wikipedia/commons/4/41/Bukchon-ro_11-gil_street_with_hanok_houses_at_blue_hour_in_Bukchon_Hanok_Village_Seoul.jpg — Blue-hour alley (6404×4269), Featured Picture, Basile Morin, CC BY-SA 4.0 (recommended)
- https://upload.wikimedia.org/wikipedia/commons/d/db/Bukchon-ro_11-gil_street_with_hanok_houses_at_sunrise_in_Bukchon_Hanok_Village_Seoul.jpg — Sunrise (6674×4449), Quality Image
- https://upload.wikimedia.org/wikipedia/commons/a/a6/Traditional_hanok_house_with_wooden_doors_along_a_steeply_sloping_street_in_Bukchon_Hanok_Village_Seoul.jpg — Wooden doors + steep alley
- https://upload.wikimedia.org/wikipedia/commons/2/23/Gyedong-gil_street_with_climbing_plants_at_golden_hour_in_Seoul_South_Korea.jpg — Gyedong-gil golden hour
- https://upload.wikimedia.org/wikipedia/commons/b/b6/Bukchon-ro_11-gil_street_with_hanok_houses_in_Bukchon_Hanok_Village_Seoul.jpg — Daytime hanok alley
- https://upload.wikimedia.org/wikipedia/commons/3/3c/Traditional_hanok_houses_at_golden_hour_in_Bukchon_Hanok_Village_in_Seoul.jpg — Hanok rooftops + sunset

## 8. 명동 (Myeongdong, Seoul)

- https://upload.wikimedia.org/wikipedia/commons/6/6f/Myeongdong_at_night.jpg — Night view (3264×1840, 16:9) (recommended)
- https://upload.wikimedia.org/wikipedia/commons/b/b2/Streets_in_Myeong-dong_Seoul.jpg — Street wide (3264×1836, 16:9)
- https://upload.wikimedia.org/wikipedia/commons/7/73/Myeongdong_2012-05-03.jpg — Daytime (6000×4000)
- https://upload.wikimedia.org/wikipedia/commons/b/b6/Crowd_at_Myeongdong%2C_Seoul.jpg — Crowd at night (3920×2204, 16:9)
- https://upload.wikimedia.org/wikipedia/commons/b/be/Myeongdong_overview_201502.JPG — Overview (1600×1200)

## 9. 인천 크루즈 터미널 (Incheon Cruise Terminal)

> Direct URLs are scarce — recommend manual capture from the KR-구석구석
> gallery page or Visit Incheon Tourism Organization official press kit.

- https://upload.wikimedia.org/wikipedia/commons/e/ee/1st_Incheon_International_Ferry_Terminal.jpg — Adjacent 1st Int'l Ferry Terminal (3264×2448), CC BY-SA 4.0
- https://upload.wikimedia.org/wikipedia/commons/2/26/Port_of_Incheon.jpg — Port of Incheon from Freedom Park (1024×768), Public Domain

References (manual capture):
- https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=d1a0de74-ae90-4467-983c-a3dde0a18f7c
- https://korean.visitkorea.or.kr/detail/ms_detail.do?cotid=530d6b32-c4a0-4a9e-adb0-32a5250bef1c
- https://english.visitkorea.or.kr/svc/contents/contentsView.do?vcontsId=190456

## 10. 제주 크루즈 터미널 (Jeju Cruise Terminal)

### 10a. 서귀포 강정 크루즈항 (Seogwipo Gangjeong Cruise Port — main, large-cruise berth)

- https://api.cdn.visitjeju.net/photomng/imgpath/202311/22/c42559a5-c909-4603-ae16-24c2e03893a0.webp — Main image
- https://api.cdn.visitjeju.net/photomng/imgpath/202311/22/6855f400-1ded-446f-b857-3fe97b58d864.webp
- https://api.cdn.visitjeju.net/photomng/imgpath/202311/22/2b5ba8f3-6728-4732-8bff-9f9e8b53458f.webp
- https://api.cdn.visitjeju.net/photomng/imgpath/202311/22/6c543533-e249-4069-8965-da29aa67742a.webp
- https://api.cdn.visitjeju.net/photomng/imgpath/202311/22/734b20f0-c117-4b83-a970-d270649b0c8f.webp
- https://api.cdn.visitjeju.net/photomng/imgpath/202311/23/f6d06f64-60c6-4ac8-8fca-2cea29f97330.webp

### 10b. 제주항 국제크루즈터미널 (Jeju Port International Cruise Terminal)

- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/a1c77272-b662-4b14-87b1-0388b31160f3.webp — Main
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/4be7d940-00b4-42e5-a2f8-6fbf3bcc8d74.webp
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/682dacaa-9dfe-403c-a22b-90b9ce42521f.webp
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/1cc0d5cf-68b7-4782-be73-d3a97584338b.webp
- https://api.cdn.visitjeju.net/photomng/imgpath/201804/30/facfb6d9-171f-4bda-bd31-84fe2e9c8068.webp

## 11. 재한유엔기념공원 (UN Memorial Cemetery in Korea, Busan)

- https://upload.wikimedia.org/wikipedia/commons/5/56/UN_Forces_Monument%2C_UN_Memorial_Cemetery%2C_Busan.jpg — UN Forces Monument (5312×2988, 16:9), Bubbahotepblues, CC BY-SA 4.0 (recommended)
- https://upload.wikimedia.org/wikipedia/commons/2/20/Flags_of_representative_UN_Member_nations%2C_UN_Memorial_Cemetery_Busan.jpg — 21 member-nation flagpoles (5312×2988, 16:9), CC BY-SA 4.0
- https://upload.wikimedia.org/wikipedia/commons/3/35/UN_Memorial_Cemetery.JPG — Overview
- https://upload.wikimedia.org/wikipedia/commons/3/3b/2010.6.18_UN_%EC%B0%B8%EC%A0%84%EA%B5%AD%EB%AC%98%EC%97%AD%EC%9D%84_%EC%B0%B8%EB%B0%B0_%287445959642%29.jpg — Memorial ceremony 2010
- https://upload.wikimedia.org/wikipedia/commons/d/d3/Entrance_to_grave_area_at_UN_Memorial_Cemetery.jpg — Grave area entrance
- https://upload.wikimedia.org/wikipedia/commons/0/0c/Back_gate_of_United_Nations_Memorial_Cemetery_in_2018.jpg — Back gate (2018)

---

## Summary

| POI | Direct URLs | Primary source | Status |
|---|---:|---|---|
| 1. Jeonnong-ro Cherry Blossom Street | 6+ (incl. 2026) | VisitJeju CDN | ✅ |
| 2. Noksan-ro Gasi-ri | 7+ | VisitJeju CDN | ✅ |
| 3. Suwon Nammun Market | 5 | Wikimedia | ⚠️ (market interior thin) |
| 4. Gamaksan Suspension Bridge | 5 (8K incl.) | Wikimedia | ✅ |
| 5. Songdo Beach | 7+ | Wikimedia | ✅ |
| 6. Gwangjang Market | 5 (incl. CC0) | Wikimedia | ✅ |
| 7. Bukchon Hanok Village | 6 (Featured Picture) | Wikimedia | ✅ |
| 8. Myeongdong | 5 | Wikimedia | ✅ |
| 9. **Incheon Cruise Terminal** | 2 (indirect) | Wikimedia | ❌ manual capture needed |
| 10. Jeju Cruise Terminal | 11 (Gangjeong + Jeju Port) | VisitJeju CDN | ✅ |
| 11. UN Memorial Cemetery | 6 | Wikimedia | ✅ |

## License notes

- **CC0** (Gwangjang Market entrance by Bernard Gagnon): unrestricted reuse.
- **CC BY-SA 4.0 / 3.0**: most Wikimedia photos require visible attribution
  + the same-license requirement; the existing AtoC photo-credit pattern in
  tour JSONs (`imageCredits[]`) already supports this.
- **VisitJeju CDN webp**: hot-link policy not formally documented; treat as
  reference and re-host through `scripts/import-atoc-modified-photos.mjs`
  rather than direct embed.

## Recommendation for next session

1. Manually click through the KR-구석구석 reference pages for Incheon Cruise
   Terminal and Suwon Nammun Market (gallery sections) — KTO `detailImage1`
   API would also work.
2. Drop downloaded files into `D:\Atoc Photos\modified\<place>\` and run
   `node scripts/import-atoc-modified-photos.mjs` to push them through
   the pipeline (WebP, Storage, JSON wiring).
3. After import, re-run `node scripts/audit-tour-photos.mjs` to verify the
   sparse-POI count dropped.
