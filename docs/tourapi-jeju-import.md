# 제주 KorService2 전체 POI import (`import:jeju:all:tourapi`)

## 1. areaBasedList2로 제주 전체를 수집하는 이유

- **지역·타입 필터를 한 번에 적용**할 수 있습니다. `lDongRegnCd`(기본 `50`, 제주) 또는 선택적으로 `TOUR_API_USE_AREA_CODE=1` + `TOUR_API_AREA_CODE=39`로 제주만 조회합니다.
- **목록 API가 `totalCount`를 제공**하므로, 고정 개수(예: 200) 없이 전체 페이지를 순회할 수 있습니다.
- 이후 **상세 API**(`detailCommon2`, `detailIntro2`, 선택 `detailInfo2`)로 각 `contentId`별 메타·소개·반복정보를 보강합니다.

## 2. totalCount 기준 전체 페이지 순회

1. `areaBasedList2`를 **1페이지** 호출해 `response.body.totalCount`와 `numOfRows`(요청값과 동일하게 동작)를 확인합니다.
2. `totalPages = ceil(totalCount / numOfRows)` 로 계산합니다.
3. **1…totalPages**까지 순회하며 `item`을 누적합니다.
4. `contentId`+`contentTypeId` 기준으로 **중복 제거**합니다.
5. 목록 순서대로 **listRank**(1부터)를 부여하고, 목록에 있는 **readcount**를 인기도 기초값으로 보관합니다.

## 3. detailCommon2 / detailIntro2 / detailInfo2 역할

| 엔드포인트 | 역할 |
|------------|------|
| **detailCommon2** | 공통 정보: 제목, 주소, 좌표, 대표이미지, 개요, 전화, 홈페이지 등 목록보다 풍부한 공통 필드 병합 |
| **detailIntro2** | 유형별 소개 필드(운영시간·요금·휴무·주차·예약 등) — `contentTypeId`에 따라 필드명이 다름 |
| **detailInfo2** | 반복/부가 정보(구조화된 item 배열) — 호출량이 많으므로 `JEJU_SKIP_DETAIL_INFO2=1`(기본)으로 끌 수 있음 |

## 4. JSON 저장

- 출력: `data/output/jeju-all-places.json`
- **pretty JSON**, `meta`(totalCount, totalPages, syncBatchId, 필터 요약) + `places` 배열
- 체크포인트: `data/output/jeju-import.checkpoint.json` (`completed` 키 목록)

## 5. Supabase upsert

1. 마이그레이션 적용: `supabase/migrations/20250322150000_jeju_kor_tourapi_places.sql`
2. 환경변수: `JEJU_UPSERT_SUPABASE=1`, `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
3. 구현: `scripts/jeju-tourapi/supabase-upsert.ts` — `onConflict: content_id,content_type_id`, 청크 크기 `JEJU_UPSERT_CHUNK_SIZE`(기본 50)
4. **service role**만 쓰기 가능(RLS). anon/authenticated는 **SELECT**만.

## 6. 환경변수

| 변수 | 기본 / 설명 |
|------|-------------|
| `TOUR_API_SERVICE_KEY` | 공공데이터포털 인증키(우선). 없으면 `TOUR_API_KEY` |
| `JEJU_LDONG_REGN_CD` | `50` (제주 법정동 시도코드) |
| `JEJU_CONTENT_TYPE_ID` | `12` (관광지) |
| `JEJU_NUM_OF_ROWS` | 목록 페이지당 행 수(최대 합리적 값, 예: 100) |
| `TOUR_API_ARRANGE` | `B` (조회순 등) |
| `TOUR_API_USE_AREA_CODE` | `0` — `1`이면 `areaCode`+`TOUR_API_AREA_CODE` 사용 |
| `TOUR_API_AREA_CODE` | `39` (제주 지역코드, 레거시 필터용) |
| `JEJU_SKIP_DETAIL_INFO2` | `1`이면 detailInfo2 생략 |
| `JEJU_UPSERT_SUPABASE` | `1`이면 Supabase upsert |
| `JEJU_UPSERT_CHUNK_SIZE` | upsert 청크 크기 |
| `JEJU_DETAIL_CONCURRENCY` | 상세 호출 동시성(기본 3) |
| `JEJU_RESUME_FROM_JSON` | `1`이면 기존 JSON에 있는 항목은 상세 재호출 생략 |
| `TOUR_API_REQUEST_DELAY_MS` | 요청 간 딜레이 |
| `TOUR_API_REQUEST_TIMEOUT_MS` | 타임아웃 |
| `TOUR_API_MAX_RETRIES` | 재시도 횟수 |
| `JEJU_CHECKPOINT_EVERY` | N건 마다 체크포인트 저장 |

## 7. 트래픽·쿼터 고려

- 목록 1회 + 장소당 상세 2~3회 호출이므로 **일일 트래픽 한도**에 유의하세요.
- `JEJU_SKIP_DETAIL_INFO2=1`로 부가 호출을 줄이고, `JEJU_DETAIL_CONCURRENCY`와 `TOUR_API_REQUEST_DELAY_MS`로 **동시성·속도**를 조절하세요.
- 429/타임아웃 시 클라이언트가 **지수 백오프**로 재시도합니다.

## 8. resume 및 재실행

- **체크포인트**: `jeju-import.checkpoint.json`에 완료된 `contentId::contentTypeId` 키가 쌓입니다. 중단 후 재실행 시, **이미 JSON에 저장된 레코드가 있으면** 해당 키는 상세 호출을 건너뜁니다(`placesByKey` + `completedKeys`).
- **`JEJU_RESUME_FROM_JSON=1`**: 기존 `jeju-all-places.json`에 있는 모든 POI를 “완료”로 보고 상세 API를 다시 호출하지 않습니다(전체 재수집이 필요하면 이 값을 끄세요).
- **syncBatchId**: `JEJU_SYNC_BATCH_ID`로 고정하거나, 미설정 시 실행마다 새 ID가 생성됩니다.

## 9. 내부 점수화 (배치)

- 마이그레이션 `20250322170000_jeju_kor_tourapi_places_scoring.sql`로 `jeju_kor_tourapi_places`에 **추천 점수·분류 컬럼**이 추가됩니다.
- 수집과 별도로 **`npm run score:jeju:places`** 를 실행해 `popularity_score`, `data_quality_score`, `base_score`, `region_group` 등을 갱신합니다.
- 상세 규칙·컬럼 설명은 **`docs/jeju-place-scoring.md`** 를 참고하세요.

## 실행 명령

```bash
npm run import:jeju:all:tourapi
```

## 관련 코드

- `scripts/import-jeju-all-places-tourapi.ts` — 배치 진입점
- `scripts/jeju-tourapi/api-client.ts` — KorService2 클라이언트·파라미터 빌더
- `scripts/jeju-tourapi/intro-extractors.ts` — intro 필드 추출
- `scripts/jeju-tourapi/normalizers.ts` — 시간/요금 등 정규화·출처
- `scripts/jeju-tourapi/supabase-upsert.ts` — Supabase upsert
- `scripts/score-jeju-places.ts` — 점수 배치 (선택) · `docs/jeju-place-scoring.md`
