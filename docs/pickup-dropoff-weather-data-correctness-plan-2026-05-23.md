# Pickup / Drop-off / Weather — 데이터 정합성 트랙 (2026-05-23)

작성일: 2026-05-23
대상: `/tour-product/[slug]` 상세 페이지의 픽업·드롭오프 카드, 지도 핀, "Your Day" 타임라인, 날씨 띠
성격: **데이터 정합성 + i18n 버그 수정** 트랙 (Sprint 1-4 비주얼 시스템과 별개 — 마스터플랜 `tour-product-detail-ui-ux-audit-response-2026-05-17.md` §C에 포인터)
지시: User 2026-05-23 — 픽업/드롭오프 정보가 "중구난방". 6개 로케일(en/ko/ja/zh/zh-TW/es) 전부.

---

## 0. 사용자가 지목한 버그 + 코드 실사 결과

| # | 사용자 보고 | 코드 실사 (사실) |
|---|---|---|
| 1 | 1번 사진: 지도 픽업 핀이 완전 틀린 위치 | 핀 좌표는 `detail_payload.pickup_dropoff.departure[]/return[]` 의 `lat`/`lng` (6개 로케일 행에 동일 복제). 마커는 `TourPickupDropoffSection.tsx:44-80`이 그 값으로 생성. **데이터 좌표가 틀림** (예: Ocean Suites Hotel 실제 탑동≈33.517,126.522 → 저장값 33.4944,126.4808 약 5km 오차; Shilla Duty Free 약 3km 동쪽 오차). |
| 2 | 2번 사진: 픽업 카드의 "Hotel pickup" 라벨 → "N pickup points" | 카드 배지 `PickupDropoffCards.tsx:138` = `sectionUi.pickupCategoryLabel ?? "Hotel pickup"`. 카운트 메타 `:134` = "{count} locations". 대표 섹션 `TourPickupDropoffSection.tsx:178-180` = "{N} locations" 하드코딩. |
| 3 | 3번: 부산 투어도 픽업 카드에 "Hotel pickup" | 동일 컴포넌트(공유). 부산 픽업 3개(서면·부산역·해운대)인데 라벨은 "Hotel pickup". |
| 4 | 4번: 드롭오프가 카드 2개로 중복 → itineraryStop 드롭오프 카드 삭제, 검정 카드만 | `TourTimelineSection.tsx:164-172`는 **맨 앞** 픽업 의사-스톱만 제거. **맨 뒤** 리턴/드롭오프 의사-스톱("Return drive to Busan", "Drop-off (…)" 등)은 제거 안 됨 → 번호 스톱 + 검정 DropoffOnlyCard 동시 노출. ~17개 투어 해당. ⚠ `busan-top-attractions`는 마지막이 실제 명소(Jagalchi Fish Market)라 제거하면 안 됨. |
| 5 | 드롭오프 표준: 제주=신라면세점·롯데시티·제주공항·오션스위츠·동문시장(5), 부산=남포동(자갈치)·서면역·부산역·해운대역(4) | 제주는 이미 5개 일관. 부산은 투어별 1·3·4개로 제각각. |
| 6 | 좌표는 정확히 계산해서 핀 | 동일 — Phase 3에서 정확 지오코딩 후 DB 반영. |
| 7 | 날씨 API를 itinerary stops 대표 명소 좌표 기준으로 | 현재 `lib/weather/tour-weather-anchor.ts`의 정적 slug→좌표 표. **4개 슬러그 누락 → East Jeju로 폴백(부산/속초 투어가 제주 날씨)**. `match_pois`에 명소별 정확 좌표 있음(`lat`/`lng`). |
| 8 | 다른 섹션도 같은 류 버그 점검 | Hero 토스트("Saved"/"Removed"/"Link copied"), Included "Included"/"Not included", 드롭오프 "Approximate" 폴백이 하드코딩 영어 → 비영어 로케일에서 영어 노출. |

## 1. 결정 로그 (User 2026-05-23)

| 결정 | 내용 |
|---|---|
| D1 | 부산 시티 데이투어 드롭오프 = 4지점 표준화(남포동/자갈치·서면역·부산역·해운대역). **크루즈·전세차(항구 픽업) 투어는 현행 항구 유지.** |
| D2 | "Hotel pickup included" 부제·트러스트 푸터 → 중립 "Pickup included" (6개 로케일). 카드 배지는 "{N} pickup points". |
| D3 (impl) | 드롭오프 중복은 **코드 수정**(타임라인이 맨 뒤 리턴 의사-스톱도 strip) — itineraryStops 데이터는 보존(데이 플로우 등 다른 소비처 영향 최소화). |
| D4 (impl) | 날씨는 정적 앵커표 유지하되 각 항목 좌표를 **대표 명소(match_pois 출처)**로 재산출 + 누락 4슬러그 추가. (런타임 DB 조회 없이 빠른 폴백 유지) |
| D5 (User 2026-05-23) | **Source of truth = 양쪽 모두.** 정적 JSON 번들(`components/product-tour-static/*.json`)과 Supabase가 동일 sync 상태. 모든 데이터 변경(_role/좌표/드롭오프)을 양쪽에 동일 적용. 로컬 `.env.local`은 `TOUR_PRODUCT_USE_SUPABASE=1`. JSON 동기화는 좌표·드롭오프 변경과 함께 **파일당 1회** 패치(Phase 3/4 통합 스크립트)로 처리해 diff 최소화. |
| 사실 추가 | 타임라인 **선두 픽업 strip도 비영어에서 깨져 있었음** (현 regex가 ja「ピックアップ/お迎え/乗車」, es「Recogida/Salida」, zh「出发/出發」 미매치 → 일부 로케일에서 픽업도 중복). `_role` 마커로 양끝 모두 로케일 무관하게 해결. |

## 2. 적용 범위 — 신규 스키마(departure/return, 핀 노출) 투어

**Jeju (10)**: jeju-cherry-blossom-tour-east-route, jeju-cruise-shore-excursion-bus-tour, jeju-cruise-shore-excursion-small-group-tour, jeju-eastern-unesco-spots-day-tour, jeju-grand-highlights-loop, jeju-hydrangea-festival-tour-east-route, jeju-hydrangea-festival-tour-southwest-route, jeju-southern-top-unesco-spots-tour, jeju-west-south-full-day-authentic-tour, jeju-winter-southwest-tangerine-snow-camellia-tour
**Busan (6)**: busan-gyeongju-unesco-legacy-tour-national-museum, busan-plum-cherry-blossom-day-tour-to-yangsan-gyeongju, busan-small-group-sightseeing-tour-cruise-passengers(항구), busan-spring-cherry-blossom-gyeongju-highlights-day-tour, busan-top-attractions-day-tour, from-busan-gyeongju-ancient-capital-day-tour
**Seoul/Incheon (7)**: from-incheon-seoul-day-tour-cruise-guests(항구), incheon-seoul-private-car-shore-excursion-cruise(항구), seoul-seoraksan-national-park-sokcho-beach-day-trip, seoul-suburbs-private-chartered-car-10hr(route variants), seoul-suwon-hwaseong-folk-village-starfield-library, seoul-suwon-hwaseong-gwangmyeong-cave-starfield-library, seoul-suwon-hwaseong-waujeongsa-starfield

**Parked (레거시 meeting_points/dropoff_points 스키마, 핀 미노출 — 별도 트랙)**: busan-cruise-shore-excursion-bus-tour, busan-outskirts-tongdosa-amethyst-yeongnam-day-tour, busan-private-car-charter-cruise-shore, east-signature-nature-core, jeju-island-private-car-charter-tour, pocheon-…, seoul-dmz-…, seoul-private-nami-…, seoul-seoraksan-naksansa-…, seoul-seoraksan-nami-island-…, southwest-hallasan-osulloc-aewol. (날씨 누락 4슬러그는 Phase 5에서 처리)

## 3. 실행 페이즈 (위험 낮은 순 → DB 변경은 검토 후)

- **Phase 0 — 데이터 준비(노출 변화 없음)**: 고유 픽업/드롭오프 지점 정확 지오코딩(Google Geocoding, 도시 바운딩박스 검증) + 대표명소 날씨앵커표(match_pois) 작성. **검토 체크포인트**: DB 쓰기 전 좌표표를 사용자에게 제시.
- **Phase 1 — 타임라인 드롭오프 중복(코드)**: `TourTimelineSection.tsx`에 맨 뒤 리턴/드롭오프 의사-스톱 strip 추가(DROPOFF_RX + return 비어있지 않음 + !routeVariants). Jagalchi 등 실제 명소 보존.
- **Phase 2 — 픽업 라벨/문구(코드+i18n 6로케일)**: `pickupPointsTemplate`("{count} pickup points") 신설; 배지 "Hotel pickup" 제거→카운트; 대표 섹션 "{N} locations"→"{N} pickup points"; 부제·푸터 "Pickup included" 중립화; 투어별 DB sectionUi 오버라이드 점검.
- **Phase 3 — 좌표 정확도(DB, 체크포인트 후)**: `scripts/fix-pickup-dropoff-coords.mjs`로 departure/return의 lat/lng를 position 기준 일괄 보정(6로케일 행 전부). 정적지도 렌더 검증.
- **Phase 4 — 부산 드롭오프 4지점 표준화(DB)**: 부산 시티 데이투어 return[]을 4지점으로(로케일별 현지명). 크루즈/전세차 제외.
- **Phase 5 — 날씨 대표명소 앵커(코드)**: `TOUR_WEATHER_ANCHORS` 좌표를 대표명소(match_pois)로 재산출 + 누락 4슬러그 추가 + areaLabel 정정.
- **Phase 6 — 로케일 정합성 스윕(코드 6로케일)**: Hero 토스트/Included·Not included/Approximate 등 하드코딩 영어 제거. 섹션 컴포넌트 영어 리터럴 grep 정리.
- **Phase 7 — QA + ship**: build green, 타깃 테스트, 로케일 시각 점검, commit→PR→merge(ship workflow).

## 4. 검증 게이트
- 핀: 정적지도 URL 렌더로 제주/부산/서울 표본 핀 위치 확인.
- 중복: ~17개 투어 타임라인 마지막 중복 카드 사라짐 + busan-top-attractions Jagalchi 유지 확인.
- 라벨/문구: 6개 로케일 렌더 확인(영어 누수 0).
- 날씨: `/api/weather/forecast?slug=…` 표본이 대표 지역 반환(부산 투어가 제주 아님).

## 5. 상태 대시보드
| Phase | 상태 | 커밋 |
|---|---|---|
| 0 데이터 준비 + 좌표 검토 | 🔄 지오코딩 스크립트 작성 중 | — |
| 1 타임라인 중복(코드) | ✅ code+DB _role 완료, tsc green / JSON _role은 Phase 3·4 통합 sync에 포함 / 브라우저 QA는 Phase 7 통합 | (uncommitted) TourTimelineSection.tsx + tourProductDetailSectionTypes.ts + DB _role(18 선두/17 후미) |
| 2 픽업 라벨/문구 | ✅ code+i18n 완료, tsc green. "Hotel pickup"→"N pickup points"(pickupPointsTemplate 6로케일), 부제·푸터 "Pickup included" 중립화, 비영어 누락 카드키(pickupCardTitle/dropoffCardTitle/dropoffApproxLabel/dropoffLocationsTemplate/dropoffReturnNote) 보강. busan-small-group-cruise는 정확한 크루즈 카피라 DB 오버라이드 유지. | (uncommitted) tourProductSectionUi.ts + PickupDropoffCards.tsx + TourPickupDropoffSection.tsx |
| 2 픽업 라벨/문구 | ⏳ | — |
| 3 좌표 DB+JSON 반영 | ✅ Google 지오코딩값으로 23투어 좌표 교정 (DB 82행 + JSON 122파일, 6로케일). 큰 오류 4건(오션스위츠·신라·인천크루즈·노포) 포함 전부 교정. `scripts/fix-pickup-dropoff-coords.mjs` | (uncommitted) |
| 4 부산 드롭오프 표준화 | ✅ 부산 시티 데이투어 4종(gyeongju·plum·spring·from-busan)을 4지점(남포/자갈치·부산역·서면·해운대)으로 표준화 + 로케일별 new-schema 정규화. 크루즈/전세차 제외. `scripts/standardize-busan-dropoffs.mjs` | (uncommitted) |
| 4b 레거시 스키마 복구 | ✅ **신규 발견**: 8투어의 비영어 행이 legacy meeting_points 스키마라 비영어 픽업/드롭오프 섹션이 안 보였음. EN new-schema로 정규화(JSON 40 + DB 40). 잔여 legacy 0 확인. `scripts/normalize-legacy-pickup-dropoff.mjs` | (uncommitted) |
| 5 날씨 대표명소 앵커 | ✅ `lib/weather/tour-weather-anchor.ts` 33투어 전부 대표 관광지(match_pois) 좌표로 재작성 + 누락 4슬러그(busan-cruise·busan-outskirts·seoul-seoraksan-naksansa·seoul-seoraksan-nami) 추가 → 제주 폴백 버그 해소. tsc green. | (uncommitted) |
| 6 로케일 정합성 스윕 | ✅ Included/Not included 라벨 + 드롭오프 "Approximate" 폴백을 sectionUi로 6로케일 현지화 (`includedLabel`/`notIncludedLabel`/`pickupApproximateLabel`). 토스트(저장/공유/예약오류)는 §D 보류. tsc green. | (uncommitted) |
| 7 QA + ship | 🔄 브라우저 QA + 커밋/PR/머지 | — |

## 6. Parked / 관찰
- 데이 플로우 레일("How the day flows")은 픽업/리턴 의사-스톱을 노드로 노출(타임라인과 다른 컴포넌트). 사용자 미지적 → 보류, 필요시 별도 정리.
- 레거시 스키마 11개 투어를 핀 노출 신규 스키마로 마이그레이션 — 별도 트랙(사용자 요청 시).
