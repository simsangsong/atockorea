-- AtoC 통합 플랜 §2 명명 규칙 정합 — 다이닝 RAG 3테이블에 tenant_id 추가
--
-- §2: "포팅·신규 백오피스는 ops_* prefix + tenant_id DEFAULT 'atockorea'
--      (B2B 발라내기 대비)". 20260725090000_ops_dining_rag.sql이 이 컬럼을
--      빠뜨려, 라이브의 ops_* 25개 테이블 중 이 3개만 규칙에서 이탈해 있었다.
--      (감사 2026-07-25: information_schema로 전수 확인)
--
-- 완전 additive. DEFAULT가 있고 기존 행이 0건이라 백필도 필요 없으며,
-- 애플리케이션은 이 컬럼을 명시하지 않고 insert해도 기본값이 채워진다
-- (다른 ops_* 테이블과 동일한 취급 — 코드 변경 불요).
--
-- 적용 전 점검:
--   select count(*) from ops_kakao_cell_index;           -- 기대: 0
--   select count(*) from ops_kakao_place_cache;          -- 기대: 0
--   select count(*) from ops_restaurant_recommendations; -- 기대: 0
-- 적용 후 검증:
--   select table_name from information_schema.columns
--    where table_schema = 'public' and column_name = 'tenant_id'
--      and table_name like 'ops_kakao%' or table_name = 'ops_restaurant_recommendations';
--   → 3행

alter table ops_kakao_cell_index
  add column if not exists tenant_id text not null default 'atockorea';

alter table ops_kakao_place_cache
  add column if not exists tenant_id text not null default 'atockorea';

alter table ops_restaurant_recommendations
  add column if not exists tenant_id text not null default 'atockorea';
