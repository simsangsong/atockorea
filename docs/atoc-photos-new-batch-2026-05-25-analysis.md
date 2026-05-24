# `D:\Atoc Photos\NEw oen` 65장 분석 + POI 매칭 플랜

작성일: 2026-05-25
상태: **분석 완료 / 사용자 검토 대기 / 변환·DB 동기화 미실행**

---

## 0. 결론

65장 = 7장 ChatGPT AI 이미지 + 58장 카카오톡 캡처. 전체를 시각 분석해서 다음 카테고리로 정리:

| 카테고리 | 장수 | 처리 |
|---|---|---|
| 이미 hero 슬라이드 5장으로 사용중(원본) | 5 | 추가 POI 갤러리 wire 옵션 |
| 명확히 매칭 가능 | 39 | spec 확정 → 사용자 검토 → wire |
| 픽업/웰컴 사진 — 사용자 EXCLUDE 룰 | 7 | 별도 썸네일 트랙(완료/대기) |
| 확신 70~90% (검증 필요) | 9 | 사용자 확인 후 결정 |
| 모호 (정보 부족) | 5 | 사용자 식별 또는 폐기 |

**사용자가 명시한 매핑 힌트 검증 결과:**
- ✅ "음식 콜라주 = BIFF" → 004512770_07 (떡볶이/호떡 4분할) 정확히 일치
- ✅ "누르끼리 해산물 바구니 = 자갈치" → 004512770_05 (KTO 한국관광공사 워터마크 있음) 정확히 일치
- ✅ "차창밖 경복궁 = 서울 프라이빗" → 004529045_00 (검정 세단 뒷좌석 → 광화문 일몰) 정확히 일치

---

## 1. 카테고리 A — 이미 hero에 사용중인 5장 (KakaoTalk_20260524_223217065 시리즈)

| 파일 | 시각 분석 | 현재 사용처 | 추가 wire 제안 |
|---|---|---|---|
| _00.png (해운대 블루라인 트램) | 트램 + 벚꽃 + 바다 | hero 슬라이드 #2 | `cheongsapo_blue_line` POI 갤러리 |
| _01.png (벚꽃·유채길) | 벚꽃 양옆 + 노란 유채 + 도로 | hero 슬라이드 #3 | `noksan_ro` POI 갤러리 |
| _02.png (섭지코지 + 말) | 말 + 바다 + 일출봉 | hero 슬라이드 #5 | `seopjikoji` POI 갤러리 |
| _03.png (해동용궁사 일출) | 해변 절 + 일출 | hero 슬라이드 #4 | `haedong_yonggungsa` POI 갤러리 |
| _04.png (광화문 일몰 라이트트레일) | 광화문 + 라이트트레일 + 일몰 | hero 슬라이드 #1 | `gyeongbokgung_palace` POI 갤러리 |

**옵션:** 갤러리 wire 여부는 사용자 결정 (이미 hero에 사용중인 사진은 보통 갤러리에 중복으로 안 넣음 — 단 hero 사진을 갤러리에서도 보고 싶다면 wire 가능).

---

## 2. 카테고리 B — 명확히 매칭 가능 (39장)

### B.1 BIFF 광장 / 광복동 (5장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `ChatGPT…01_24_31 AM.png` | BIFF 아치 + 별모양 (인파, AI) | `biff_square` |
| `KakaoTalk…004512770_00.png` | 광복로 야경 + 빨간 우산 + 노점 | `biff_square` (또는 `gwangbok_road`) |
| `KakaoTalk…004512770_07.png` | 길거리 음식 4분할 콜라주 (떡볶이/호떡/꼬치/튀김) ✓ 사용자힌트 | `biff_square` |
| `KakaoTalk…004512770_08.png` | "BIFF" 바닥 사인 + 별 아치 (낮) | `biff_square` |

### B.2 자갈치 시장 (5장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `ChatGPT…12_59_54 AM.png` | 해산물 4분할 (조개/회/생선구이/사시미, AI 콜라주) | `jagalchi_market` |
| `KakaoTalk…004512770_05.png` | 누르끼리 해산물 바구니 + 양념 (KTO 워터마크) ✓ 사용자힌트 | `jagalchi_market` |
| `KakaoTalk…004512770_06.png` | "부산의 명소 자갈치 시장" 아치 야경 | `jagalchi_market` |
| `KakaoTalk…004512770_17.png` | I LOVE JAGALCHI 사인 + 부산항 + 어선 | `jagalchi_market` |
| `KakaoTalk…004512770_18.png` | 자갈치 시장 내부 (관광객 + 해산물 박스) | `jagalchi_market` |
| `KakaoTalk…004512770_19.png` | 자갈치 시장 건물 야경 | `jagalchi_market` |

### B.3 부산타워 / 용두산공원 (3장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004512770_03.png` | 부산타워 + 용두산 정자 (낮) | `yongdusan_park` (시너지 `busan_tower`) |
| `KakaoTalk…004512770_04.png` | BUSAN TOWER 하트 사인 + 4인 가족 | `busan_tower` |
| `KakaoTalk…004529045_20.png` | 부산타워 + 용두산 정자 야경 | `yongdusan_park` |

### B.4 송도 (2장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004512770_02.png` | 송도 스카이워크 V자 다리 | `songdo_skywalk` (있다면) / 또는 `songdo_beach` |
| `KakaoTalk…004512770_13.png` | SONGDO 사인 + 케이블카 + 커플 | `songdo_beach` |

### B.5 감천문화마을 (2장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004529045_18.png` | 어린왕자 동상 야경 (집들 야경) | `gamcheon_culture_village` |
| `KakaoTalk…004529045_19.png` | 어린왕자 동상 "Le Petit Prince" 표지 (낮) | `gamcheon_culture_village` |

### B.6 해운대 블루라인 (1장 — hero 외 추가)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004524… 이미 hero` — 추가 없음 | | |

### B.7 경복궁 / 광화문 (4장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004529045_00.png` | ★차창밖 경복궁 (검정 세단 뒷좌석) ✓ 사용자힌트 | **`incheon-seoul-private-car-shore-excursion-cruise` 갤러리 (slug-level)** — POI 매핑 아닌 tour-slug-level wire |
| `KakaoTalk…004529045_04.png` | 광화문 정면 (낮, 청명) | `gyeongbokgung_palace` |
| `KakaoTalk…004529045_05.png` | 흥례문 내부 view | `gyeongbokgung_palace` |
| `KakaoTalk…004529045_10.png` | 흥례문 + 한복 여인 2명 (낮) | `gyeongbokgung_palace` |
| `KakaoTalk…004512770_11.png` | 경복궁 마당 + 한복 여인 회전 | `gyeongbokgung_palace` |

### B.8 북촌 한옥마을 (2장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004512770_10.png` | 한복 여인 골목 뒷모습 | `bukchon_hanok_village` |
| `KakaoTalk…004529045_09.png` | 한복 여인 2명 골목 뒷모습 (파스텔 파랑+분홍) | `bukchon_hanok_village` |

### B.9 N서울타워 (1장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004512770_09.png` | 벚꽃 + 한강 야경 + N서울타워 (석촌호수 view) | `n_seoul_tower` (또는 `seokchon_lake`) |

### B.10 불국사 (2장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004512770_01.png` | 다보탑·석가탑 마당 + 관광객 | `bulguksa_temple` |
| `KakaoTalk…004529045_15.png` | 청운교/백운교 (불국사 입구 계단) | `bulguksa_temple` |

### B.11 경주 (대릉원·교촌·월정교 — 4장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004529045_12.png` | 월정교 + 벚꽃 + 강 | `woljeonggyo` (월정교) |
| `KakaoTalk…004529045_13.png` | "경주교촌마을" 표지석 + 한옥 | `gyochon_hanok_village` |
| `KakaoTalk…004529045_14.png` | 대릉원 천마총 내부 박물관 | `daereungwon` |
| `KakaoTalk…004512770_15.png` | 보문호수 + 리조트 항공 view | `bomun_lake` |

### B.12 진해 (1장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004512770_14.png` | 여좌천 벚꽃 강변 | `jinhae_yeojwacheon` |

### B.13 쁘디프랑스 (2장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `ChatGPT…01_01_52 AM.png` | 파스텔 마을 + 광대 동상 (AI) | `petite_france` |
| `KakaoTalk…004529045_08.png` | 컬러풀 마을 + 커플 (실사) | `petite_france` |

### B.14 아홉산 대숲 (1장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004529045_17.png` | "아홉산숲" 표지석 + 입구 계단 | `ahopsan_bamboo` |

### B.15 제주 자연 (외돌개·새연교·해변 — 3장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004512770_12.png` | 외돌개 + 형제섬 view | `oedolgae` |
| `KakaoTalk…004529045_22.png` | 새연교 (제주 빨간 다리) | `saeyeon_bridge` (있다면) |
| `KakaoTalk…004529045_23.png` | 해변 + 사람들 + 등대 | `iho_teu` 또는 `hyeopjae_beach` (등대 색 확인 필요) |

### B.16 제주 — 산방산/초가집 + 한라산 view (2장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `ChatGPT…12_59_14 AM.png` | 초가집 + 산방산 (AI) | `sanbangsan` (또는 `jeju_folk_village`) |
| `KakaoTalk…004512770_20.png` | 수국 액자 + 한라산 view | `hueree` 또는 `hallasan` view spot |

### B.17 제주 해녀 (3장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `ChatGPT…12_17_07 AM.png` | 일출 + 해녀 다이빙 (성산일출봉 배경, AI) | `jeju_haenyeo_museum` 또는 `seongsan_ilchulbong` |
| `ChatGPT…12_25_03 AM.png` | 해녀 시연 + 관객 + 성산일출봉 (AI) | `seongsan_ilchulbong` (Haenyeo show — 14:00 일 1회 ground truth 적용) |
| `ChatGPT…12_29_21 AM.png` | 해녀 일행 silhouette 일몰 (AI) | `jeju_haenyeo_museum` |

### B.18 남이섬 (1장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004529045_11.png` | 호수 + 메타세콰이아 + 일몰 | `nami_island` |

### B.19 아침고요수목원 (1장)

| 파일 | 시각 | poi_key |
|---|---|---|
| `KakaoTalk…004529045_07.png` | 한국 정원 + 정자 + 꽃 만개 | `garden_of_morning_calm` |

---

## 3. 카테고리 C — 픽업/웰컴 사진 EXCLUDE (사용자 명시 룰, 7장)

**사용자 룰:** "항구나 이런데서 손님 맞이하는 사진들은 일단 예외를 두고 나머지들 먼저 리뷰"

| 파일 | 시각 | 상태 |
|---|---|---|
| `KakaoTalk…004512770_22.png` | Incheon Port + Costa Serena + 흰색 카니발 | ✅ 이미 incheon-cruise thumbnail 사용중 (PR #74) |
| `KakaoTalk…004512770_23.png` | 검정 EV9 + 4인 + 한라산 (제주 사이드) | 픽업 — 사용자 룰 EXCLUDE |
| `KakaoTalk…004512770_24.png` | Incheon Port 변형 (큰 크루즈 + 흰색 카니발) | 픽업 — 사용자 룰 EXCLUDE |
| `KakaoTalk…004512770_29.png` | 강정터미널 + 검정 카니발 + 4인 | ✅ 이미 jeju-cruise thumbnail 사용중 (PR #74) |
| `KakaoTalk…004529045_01.png` | 제주국제크루즈터미널 + 흰색 카니발 + 4인 | 픽업 — 사용자 룰 EXCLUDE |
| `KakaoTalk…004529045_02.png` | 부산크루즈터미널 + 흰색 카니발 + 3인 (small group) | 픽업 — 사용자 룰 EXCLUDE |
| `KakaoTalk…004529045_03.png` | 부산크루즈터미널 + AtoC Korea 버스 + 4인 | ✅ 이미 busan-cruise-bus thumbnail 사용중 (PR #75) |

**참고:** 픽업 사진들은 별도 트랙(이미 4장 썸네일로 사용중, 3장은 별도 결정 대기).

---

## 4. 카테고리 D — 확신 70~90% (사용자 확인 필요, 9장)

### D.1 차량 사진 — 갤러리 적용 대상?

| 파일 | 시각 | 후보 wire | 확인 필요 |
|---|---|---|---|
| `KakaoTalk…004512770_21.png` | Kia EV9/Carnival 후면 + N서울타워 야경 | `incheon-seoul-private-car-shore-excursion-cruise` 갤러리 (차+서울 야경 = private 차량 promotion) | 사용자 결정: seoul-private 갤러리에 넣을지? |

### D.2 산 / 케이블카 — 어느 산?

| 파일 | 시각 | 후보 | 확인 필요 |
|---|---|---|---|
| `KakaoTalk…004512770_25.png` | 푸른 산 + 큰 바위봉 + 작은 절 | `seoraksan` (설악산 권금성·신흥사) 또는 `hallasan` | 사용자 확인 |
| `KakaoTalk…004512770_26.png` | 케이블카 + 푸른 산 | `seoraksan_cable_car` 또는 다른 케이블카 | 사용자 확인 |
| `KakaoTalk…004512770_27.png` | 케이블카 변형 각도 (같은 위치) | (위와 동일) | 사용자 확인 |

### D.3 사찰 — 어디?

| 파일 | 시각 | 후보 | 확인 필요 |
|---|---|---|---|
| `KakaoTalk…004512770_28.png` | 한국 사찰 정면 (한옥 마당, 산 배경) | `bulguksa_temple` 또는 `tongdosa` | 사용자 확인 |
| `KakaoTalk…004529045_16.png` | 다른 한국 사찰 (정면, 큰 처마, 한자 현판 "佛靈靈住"?) | `bulguksa_temple` 또는 다른 사찰 | 사용자 확인 |

### D.4 해변 파빌리언

| 파일 | 시각 | 후보 | 확인 필요 |
|---|---|---|---|
| `KakaoTalk…004529045_21.png` | 화이트 커튼 카바나 + 의자 + 해변·작은섬 | 제주 리조트(베니키아·롯데 등)? 또는 송도? | 사용자 확인 |

---

## 5. 카테고리 E — 모호 / 식별 어려움 (5장)

| 파일 | 시각 | 메모 |
|---|---|---|
| `KakaoTalk…004512770_16.jpg` | 놀이공원 (롤러코스터 + 벚꽃 + 다리) | `gyeongju_world` or `eworld`(대구)? 명확하지 않음 |

(나머지 4장은 모두 카테고리 B/C/D에 흡수됨 — 실제 모호 카운트 = 1장만)

---

## 6. POI 매칭 통계

| 관광지 | 신규 사진 수 | 현재 갤러리 사진 수 (Supabase) | 노트 |
|---|---|---|---|
| 자갈치 시장 | 6 | (확인 필요) | 가장 많은 신규 사진 |
| 경복궁 | 4 | (확인 필요) | + 차창밖 1장은 tour-slug-level |
| BIFF 광장 | 4 | (확인 필요) | |
| 해녀 (성산/박물관) | 3 | (확인 필요) | 14:00 1회 ground truth |
| 부산타워/용두산 | 3 | (확인 필요) | |
| 경주 (대릉원/교촌/월정교) | 3 | (확인 필요) | |
| 불국사 | 2 | (확인 필요) | |
| 송도 | 2 | (확인 필요) | |
| 감천문화마을 | 2 | (확인 필요) | |
| 북촌한옥마을 | 2 | (확인 필요) | |
| 쁘디프랑스 | 2 | (확인 필요) | AI 1장 + 실사 1장 |
| 그 외 1장씩 | 각 1 | | 진해여좌천·N서울타워·아홉산숲·외돌개·새연교·해변·산방산·휴애리·남이섬·아침고요·보문호수 |

---

## 7. 실행 플랜 (사용자 검토 후만)

### Phase 1 — 사용자 검토 (지금)
- 본 분석 보고 검토
- 카테고리 D 9장 확인 (어느 산/사찰/해변)
- 카테고리 E 1장 식별
- 픽업 EXCLUDE 3장(004512770_23, 004529045_01·_02) 처리 방향 결정
- hero에 사용중인 5장 추가 wire 여부 결정

### Phase 2 — 변환 + 배치
- `scripts/convert-new-batch-photos.mjs` 신규 — sharp 1600w q90 WebP
- 각 사진을 `public/images/tours/<poi-folder>/` 에 배치
- 신규 폴더 필요: `biff-square`, `jagalchi-market`, `gamcheon-culture-village`, `yongdusan-park`, `seoul-private-car-interior` 등

### Phase 3 — 매칭 spec JSON 작성
- 형식: `{ file, poi_key | tour_slug, gallery_position?, alt_ko/en/ja/zh/zh-TW/es }`
- 매칭이 POI-level이면 → `match_pois.default_image_url` + tour itineraryStops
- 매칭이 tour-slug-level이면 → `tour_product_pages.detail_payload.galleryItems[]` push

### Phase 4 — DB 동기화
- `match_pois.default_image_url` UPDATE (POI-level)
- `tour_product_pages.detail_payload.galleryItems` JSON 조작 (Supabase jsonb 함수)
- 6 로케일 모두 sync

### Phase 5 — JSON `components/product-tour-static/<slug>/*.{locale}.json` 동기화
- detail_payload와 정합 보장

### Phase 6 — 시각 검증 + 빌드 + ship
- `/tour-product/<slug>` 각 페이지 갤러리 확인
- `npm run build` 통과
- commit + PR + 머지 + 푸시

---

## 8. 결정 요청 사항 (사용자)

1. **카테고리 D 식별** — 9장 확인 (산/케이블카/사찰/해변 파빌리언) 사용자가 알려주거나 추측대로 진행해도 되는지
2. **카테고리 E 1장** — 놀이공원 사진 어디인지
3. **픽업 EXCLUDE 3장** — 갤러리는 wire 안 하지만 다른 용도(투어 상품 페이지 "신뢰" 섹션 등)에 쓸지
4. **Hero 사용중 5장** — 갤러리에 추가로도 wire할지 (중복 노출 OK?)
5. **차창밖 경복궁 1장** — `incheon-seoul-private-car-shore-excursion-cruise` 갤러리 맞는지 (`busan-private-car-charter-cruise-shore`에도 넣을지?)
6. **신규 폴더 명명** — `public/images/tours/biff-square/`, `jagalchi-market/`, `gamcheon-culture-village/` 등 만드는 방향 OK?

---

## 9. 자료 보존

- 추출된 65장 메타 데이터 + 시각 분석은 본 문서에 모두 기록됨
- 원본은 `D:\Atoc Photos\NEw oen\` 위치 유지
- 변환 후 사용된 파일은 추후 `D:\Atoc Photos\modified\<주제별 폴더>\` 로 이동 권장
