-- 캐시된 식당 행이 번역·메뉴 추출을 거쳤는지 기록한다.
-- 라이브에는 이미 적용됐다(2026-07-26, MCP). 이 파일은 그 상태를 레포에 고정한다.
--
-- 왜 별도 컬럼인가: `name_i18n IS NULL` 은 두 가지를 동시에 뜻한다 —
--   ① 아직 시도하지 않았다
--   ② 시도했는데 모델이 아무것도 못 냈다(예산 소진·파싱 실패·리뷰에 메뉴 없음)
-- 구분하지 못하면 보수 작업이 ②를 매주 영원히 다시 시도한다.
--
-- 배경: 새 셀에서 식당을 처음 물은 손님 한 명이 코퍼스 전체(최대 120곳)의 번역
-- 비용을 냈다. 46초였고 동시성으로 15.8초가 됐지만 여전히 손님이 낸다.
-- 이제 collectCell 이 보여줄 만큼(SYNC_ENRICH_LIMIT)만 즉시 번역하고 나머지는
-- 미번역으로 저장한 뒤, 주간 flywheel 의 enrichPendingPlaces 가 갚는다.
-- 그 "나머지"를 식별하는 것이 이 컬럼이다.

alter table public.ops_kakao_place_cache
  add column if not exists enriched_at timestamptz;

comment on column public.ops_kakao_place_cache.enriched_at is
  '번역·시그니처메뉴 추출을 시도한 시각. NULL = 미시도(= flywheel 보수 대상). 값이 있으면 결과가 비었어도 시도한 것이다 — name_i18n IS NULL 만으로는 이 둘이 구분되지 않는다.';

-- 보수 대상만 훑는 부분 인덱스. 전체가 아니라 "아직 안 한 것"만 본다.
create index if not exists ops_kakao_place_cache_unenriched
  on public.ops_kakao_place_cache (expires_at)
  where enriched_at is null;

-- 기존 행은 전부 번역을 거친 상태다(그때는 전량 동기 번역이었다). 그대로 두면
-- 첫 flywheel 이 캐시 전체를 다시 번역한다.
update public.ops_kakao_place_cache
   set enriched_at = coalesce(updated_at, created_at, now())
 where enriched_at is null;
