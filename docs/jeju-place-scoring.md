# 제주 KorService2 장소 내부 추천 점수화 (`score:jeju:places`)

Tour API 전체 수집(`import:jeju:all:tourapi`)과 **독립**으로 실행하는 배치입니다. 예약·결제·프론트 코드는 건드리지 않습니다.

## 1. 마이그레이션

점수·분류 컬럼은 다음 파일에서 추가됩니다.

- `supabase/migrations/20250322170000_jeju_kor_tourapi_places_scoring.sql`

Supabase CLI:

```bash
supabase db push
```

또는 대시보드 SQL Editor에 위 마이그레이션 내용을 적용합니다.

## 2. 실행

- 환경 변수: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (서비스 롤, RLS 업데이트용)
- 선택: `JEJU_SCORE_UPDATE_CHUNK` — 한 번에 병렬 업데이트하는 행 수(기본 `25`)
- 점수 마이그레이션 전이면: `JEJU_SCORE_SKIP_SUPABASE=1` 로 **JSON만** 쓰고 DB 업데이트는 생략

```bash
npm run score:jeju:places
```

출력:

- Supabase `jeju_kor_tourapi_places` 행 업데이트 (`scoring_version`, `scored_at` 포함)
- 감사용 JSON: `data/output/jeju-all-places-scored.json`

## 3. 컬럼 요약

| 구분 | 컬럼 | 설명 |
|------|------|------|
| 분류 | `region_group` | 휴리스틱 지역: `east`, `west`, `south`, `city`, `udo`, `etc` |
| 분류 | `is_indoor`, `is_outdoor` | 제목·주소·개요·intro JSON 키워드 기반 (둘 다 true 가능, 불명확 시 null) |
| 분류 | `is_free`, `is_paid` | `fee_text` 기반 (없으면 null) |
| 플래그 | `is_must_visit` | 수동(기본 false) — 배치 v1에서 자동 세팅하지 않음 |
| 플래그 | `manual_hidden` | 수동 숨김(기본 false). true면 `base_score`는 0으로 강제 |
| 자동 | `popularity_score` | 전체 `readcount` min–max 정규화 0–100, 없으면 null |
| 자동 | `data_quality_score` | 필드 완성도 가중치 합 0–100 |
| 자동 | `base_score` | v1 가중합 0–100 (아래 공식) |
| 수동 | `manual_priority` | 가중치용(기본 0). `base_score`에 10% 반영 |
| 수동 | `travel_value_score`, `photo_score` | 운영이 채우면 `base_score`에 각각 20%·10% |
| 수동 | `senior_score`, `family_score`, `couple_score`, `rainy_day_score`, `route_efficiency_score` | 향후 세그먼트·컨텍스트용 (v1 배치는 건드리지 않음) |
| 수동 | `season_*` | 계절 가중 (v1 배치는 건드리지 않음) |
| 메타 | `scoring_version` | 예: `v1` |
| 메타 | `scored_at` | 배치 실행 시각(UTC) |

**자동 vs 수동**

- **자동**: 매 배치에서 `readcount` 분포·필드 유무로 다시 계산되는 점수(`popularity_score`, `data_quality_score`, 휴리스틱 태그).
- **수동**: DB에서 직접 편집해 의도를 반영하는 값(`manual_priority`, `travel_value_score`, `photo_score`, `manual_hidden`, `is_must_visit`, 세그먼트·계절 컬럼). v1 배치는 수동 컬럼을 **덮어쓰지 않고** `base_score` 계산에만 읽습니다.

## 4. `base_score` v1

`manual_hidden === true` 이면 **0** (추천에서 제외하기 쉽게).

그 외:

```text
base_score =
  0.35 × coalesce(popularity_score, 0) +
  0.25 × coalesce(data_quality_score, 0) +
  0.20 × coalesce(travel_value_score, 0) +
  0.10 × coalesce(photo_score, 0) +
  0.10 × coalesce(manual_priority, 0)
```

결과는 **0~100**으로 clamp.

## 5. `region_group` 휴리스틱

주소·제목·개요·intro JSON을 합친 문자열에서 키워드 매칭(우선순위: `udo` → `east` → `west` → `south` → `city` → `etc`). 상세 키워드 목록은 `scripts/jeju-tourapi/recommendation-scoring.ts`의 `inferRegionGroup` 참고.

## 6. `manual_hidden` / `manual_priority`

- **`manual_hidden`**: 내부적으로 노출하지 않을 장소. true면 `base_score`를 0으로 두어 정렬·필터에서 쉽게 제외.
- **`manual_priority`**: 운영 가산점(0 이상). 같은 품질의 POI 중 노출 순을 조정할 때 사용. `base_score`에 10% 반영.

## 7. Import 파이프라인과의 관계

- `import:jeju:all:tourapi` 는 기존 컬럼만 upsert합니다.
- 점수 컬럼은 **별도 배치**로만 갱신합니다. Import 재실행 후에도 `score:jeju:places` 를 다시 돌리면 `popularity_score` 등이 최신 데이터에 맞춰 재계산됩니다.

## 8. 추후: 고객·컨텍스트별 실시간 점수

- **저장된 값**: `base_score` + 세그먼트/계절 컬럼 + `region_group` 태그.
- **런타임**: `context_score = base_score + f(세그먼트, 날씨, 동선, …)` 처럼 **별도 함수**로 계산해 API/Edge에서 붙이면 됩니다. DB에는 “정적인 기본 점수”와 “수동 보정”을 남기고, 세션별 가중은 애플리케이션 레이어에서 합산하는 패턴을 권장합니다.

## 관련 코드

- `scripts/jeju-tourapi/recommendation-scoring.ts` — DB 추천용 휴리스틱·정규화·`base_score`
- `scripts/jeju-tourapi/scoring.ts` — KorService2 **검색/상세 병합**용 (`mergeDetailCommonIntoItem`, `scoreSearchCandidate` 등; import 파이프라인 전용)
- `scripts/score-jeju-places.ts` — 점수 배치 진입점
- `docs/tourapi-jeju-import.md` — Tour API 수집 파이프라인
