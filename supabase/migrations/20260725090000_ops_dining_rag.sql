-- AtoC 통합 플랜 §5.7 (D13) — Kakao 식당 추천 RAG (task#7 slice A)
--
-- 빌드 사양: docs/dining-rag-task7-build-spec-2026-07-25.md
--
-- 배경 (이 마이그레이션이 존재하는 이유):
--   식사 스톱에서 "이 근처 뭐 먹지?"에 답하려면 매 요청마다 Kakao Local을 때리는
--   수밖에 없었다. 그건 쿼터를 태우고, 느리고, 오프라인에서 죽는다. 이 3테이블은
--   그 호출을 **셀(geohash7) 단위로 1회만** 하고 이후 영구히 캐시에서 서빙하기 위한
--   원장이다.
--
-- 설계 결정 (사양 §0 — 플랜 대비 확정 개정, 근거 포함):
--   K1. Kakao Local은 평점·리뷰수를 주지 않는다(repo가 이미 기록:
--       scripts/collect-facility-pins.mjs "Kakao Local has no rating"). 그래서
--       수집은 Kakao(발견·한국어명·카카오맵 딥링크·카테고리) × Google Places(New)
--       (평점·리뷰수·가격대·영업시간·아동친화·채식) **하이브리드 1회**이고,
--       머지된 행 하나가 ops_kakao_place_cache 1행이다. rating/review_count가
--       NULL인 행은 "구글에서 못 찾은 집"이지 "나쁜 집"이 아니다.
--   K4. **ops_kakao_cell_index가 HIT 판정의 단일 진실이다.** "캐시에 10곳 이상
--       있으면 HIT" 같은 개수 규칙을 쓰면 식당이 원래 3곳뿐인 시골 셀이 영원히
--       MISS가 되어 매 요청마다 외부 호출이 나간다(제로콜 계약 파괴). 그래서
--       HIT = "이 셀을 이미 수집했고 TTL이 살아 있다" 뿐이고, 개수는 수집 시
--       반경 확대(800→1500m)의 트리거로만 쓴다.
--   K6. **전수 사람 검수 게이트 없음**(poi_facility_pins와 다르다). 화장실·포토핀은
--       추론이라 검수가 필요했지만 식당은 사업자 원천 데이터다. 대신 ①정량 품질
--       필터 ②TTL 90일 ③게스트 "정보가 틀려요" 3회 누적 시 자동 숨김
--       (reported_wrong_count >= 3) ④어드민 수동 차단(is_blocked)으로 막는다.
--   K7. ⚠ Kakao ToS — Kakao POI를 비카카오 지도 위에 표시하면 약관 위반 소지가
--       있다. 그래서 이 데이터로는 **지도 타일을 그리지 않는다**(카드는 리스트 +
--       항목별 카카오맵 딥링크뿐). place_url이 NOT NULL인 이유이기도 하다 —
--       딥링크가 없는 장소는 애초에 렌더할 수 없으므로 캐시에 들어오지 못한다.
--   D10. 비가역 대외 액션 없음. 외부 API는 읽기 전용 검색뿐이다.
--
-- 컨벤션은 기존 ops_* 슬라이스와 동일:
--   ops_ prefix(additive만) / RLS enabled + 정책 0개 + anon·authenticated 권한
--   회수(service-role 전용). 게스트는 라우트를 통해서만 이 데이터를 본다.
--
-- 멱등: create table / create index 전부 if not exists. 재적용해도 안전하다.
--
-- ⚠ 적용 금지 상태로 파일만 커밋. 적용은 코디네이터가 한다.
--
-- ---------------------------------------------------------------------------
-- 적용 전 점검 (기대값을 각 줄에 적어둔다)
-- ---------------------------------------------------------------------------
--
--   -- (a) 같은 이름의 테이블이 이미 있는가? → 3개 전부 NULL이어야 신규 생성.
--   select to_regclass('public.ops_kakao_cell_index')          as t_cells,
--          to_regclass('public.ops_kakao_place_cache')         as t_places,
--          to_regclass('public.ops_restaurant_recommendations') as t_recs;
--
--   -- (b) FK 대상이 존재하는가? → 2개 전부 non-NULL이어야 함.
--   select to_regclass('public.bookings')                as t_bookings,
--          to_regclass('public.tour_room_participants')  as t_participants;
--
--   -- (c) 이 마이그레이션은 기존 행을 하나도 읽거나 수정하지 않는다
--   --     (UPDATE/DELETE/INSERT 없음 — 순수 DDL).
--
--   -- (d) 적용 후 검증: 정책 0개 + RLS on 이어야 함.
--   select relname, relrowsecurity,
--          (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--     from pg_class c
--    where relname in ('ops_kakao_cell_index','ops_kakao_place_cache','ops_restaurant_recommendations');

-- ============================================================================
-- 1. ops_kakao_cell_index — 셀 수집 원장 (HIT 판정의 단일 진실, K4)
-- ============================================================================
create table if not exists ops_kakao_cell_index (
  id uuid primary key default gen_random_uuid(),

  -- 검색 CENTER의 geohash7 (~153m × 153m). 장소 자신의 셀이 아니라 "무엇을
  -- 중심으로 수집했는가"다 — 이 구분이 HIT 판정의 핵심이다.
  cell text not null unique,

  center_lat numeric not null,
  center_lng numeric not null,

  -- 실제로 수집에 성공한 반경(800 또는 확대된 1500). 다음 요청이 더 넓은 반경을
  -- 요구하면 이 값을 보고 재수집할지 판단할 수 있다.
  radius_m integer not null,

  place_count integer not null default 0,
  kakao_calls integer not null default 0,
  google_calls integer not null default 0,
  source text not null default 'kakao+google',

  fetched_at timestamptz not null default now(),
  -- TTL 90일 (R-7). 만료된 셀은 다음 요청 때 자동 재수집된다.
  expires_at timestamptz not null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 만료 스윕(주간 플라이휠 퍼지) + HIT 판정의 `expires_at > now()` 조건.
create index if not exists ops_kakao_cell_index_expires_idx
  on ops_kakao_cell_index (expires_at);

comment on table ops_kakao_cell_index is
  '셀(geohash7) 수집 원장 — 다이닝 캐시 HIT 판정의 단일 진실(사양 K4). HIT = "이 셀을 수집했고 TTL 유효"이며 장소 개수는 판정에 쓰지 않는다(식당이 3곳뿐인 시골 셀이 영원히 MISS가 되는 것을 막기 위함).';
comment on column ops_kakao_cell_index.cell is
  '검색 CENTER의 geohash7. 장소 자신의 셀(ops_kakao_place_cache.cell)과 다른 개념이다.';
comment on column ops_kakao_cell_index.radius_m is
  '실제 수집 반경. 기본 800m, 유효 후보 < 10이면 1500m로 1회 확대(사양 K5 — 성산일출봉 r=500 실호출 0건이 근거).';

-- ============================================================================
-- 2. ops_kakao_place_cache — 정규화된 장소 캐시 (Kakao × Google 머지 결과)
-- ============================================================================
create table if not exists ops_kakao_place_cache (
  id uuid primary key default gen_random_uuid(),

  -- 'kakao:21499361'. 머지에서 **Kakao id가 정본**이다 — 카카오맵 딥링크를
  -- 만들 수 있는 쪽이 카카오뿐이라, 매칭되지 않은 구글 장소는 버린다(K7).
  place_key text not null unique,

  -- 장소 자신의 geohash7.
  cell text not null,
  -- 이 장소를 발견한 검색 셀들(여러 셀의 반경이 겹칠 수 있다). 반경 조회는
  -- cell 기반이지만, 어떤 수집에서 왔는지 추적하려면 이 배열이 필요하다.
  search_cells text[] not null default '{}',

  -- 카카오 원어명(한국어). 게스트 카드에는 이 원어명을 항상 병기한다 —
  -- 택시 기사/식당 직원에게 보여줄 수 있어야 하기 때문.
  name text not null,
  -- 10 site locale. 1회 번역 후 영구(batch 래더, 사양 K2). 실패 시 NULL이고
  -- 카드는 원어명으로 폴백한다 — 치명적이지 않다.
  name_i18n jsonb,

  category_group text not null,            -- 'FD6'(음식점) | 'CE7'(카페)
  category_name text,                      -- '음식점 > 한식 > 해물,생선'
  cuisine text,                            -- 잎 노드 정규화 ('해물,생선')

  road_address text,
  address text,
  phone text,

  -- 카카오맵 딥링크. NOT NULL — 딥링크 없이는 카드를 렌더할 수 없다(K7).
  place_url text not null,

  lat numeric not null,
  lng numeric not null,

  -- Google 머지분. NULL = "구글에서 못 찾음"이지 "나쁜 집"이 아니다(K1).
  rating numeric,
  review_count integer,
  price_band smallint check (price_band is null or price_band between 1 and 4),

  -- 🔴 검증된 **양성** 신호만 넣는다. 추론 금지 — 특히 halal은 상호/카테고리에
  -- 명시되지 않으면 절대 붙이지 않는다(사양 §1.2 / R-4 "배제 우선 semantics").
  -- 어휘: vegetarian_friendly · vegan · halal · kids_ok · takeout · dine_in ·
  --       cafe · parking · reservable
  tags text[] not null default '{}',

  -- Google 리뷰 본문에 **문자 그대로 등장한** 요리명만(critic 패스가 검증).
  -- 근거가 없으면 빈 배열이며, 창작하지 않는다(사양 K3).
  signature_menus jsonb,
  menus_i18n jsonb,                        -- 예약(향후)

  -- Google regularOpeningHours 원문(periods 그대로). 해석은 애플리케이션이 한다.
  open_hours jsonb,
  google_place_id text,

  -- rating × log10(reviews+1) + 피드백 가중. 랭킹의 기본항.
  quality_score numeric not null default 0,

  is_blocked boolean not null default false,          -- 어드민 블랙리스트
  is_closed boolean not null default false,           -- 폐업 감지
  reported_wrong_count integer not null default 0,    -- 3회 → 자동 숨김(K6)

  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 반경 조회의 주 인덱스: cell in (...) → 정확 haversine 필터는 앱이 한다.
create index if not exists ops_kakao_place_cache_cell_idx
  on ops_kakao_place_cache (cell);
create index if not exists ops_kakao_place_cache_expires_idx
  on ops_kakao_place_cache (expires_at);
-- dietary 칩 필터(tags @> '{vegan}')와 검색셀 역추적.
create index if not exists ops_kakao_place_cache_tags_gin
  on ops_kakao_place_cache using gin (tags);
create index if not exists ops_kakao_place_cache_search_cells_gin
  on ops_kakao_place_cache using gin (search_cells);
-- 어드민 신고 큐(reported_wrong_count > 0 우선).
create index if not exists ops_kakao_place_cache_reported_idx
  on ops_kakao_place_cache (reported_wrong_count desc)
  where reported_wrong_count > 0;

comment on table ops_kakao_place_cache is
  'Kakao Local × Google Places(New) 머지 결과의 정규화 캐시(§5.7 R-3). Kakao id가 정본이고, 매칭되지 않은 구글 장소는 카카오맵 딥링크를 만들 수 없어 버려진다(사양 K7 — Kakao ToS).';
comment on column ops_kakao_place_cache.tags is
  '검증된 양성 신호만. halal/vegan은 상호·카테고리에 명시된 경우에만 붙인다 — 추론 금지. 양성 검증이 불가능한 제약은 "맞다"고 주장하지 않고 명백히 상충하는 곳을 빼기만 한다(R-4).';
comment on column ops_kakao_place_cache.signature_menus is
  'Google 리뷰 본문에 문자 그대로 등장한 요리명만(critic 패스 검증). 근거 없으면 빈 배열 — 창작 금지(사양 K3).';
comment on column ops_kakao_place_cache.reported_wrong_count is
  '게스트 "정보가 틀려요" 누적. 3 이상이면 서빙에서 자동 제외되고 어드민 신고 큐로 올라간다(사양 K6 — 전수 사람 검수를 대체하는 장치).';
comment on column ops_kakao_place_cache.rating is
  'Google 머지분. NULL은 "구글에서 못 찾음"이지 "나쁜 집"이 아니다 — 셀 전체가 무평점이면 거리순 폴백 + unrated 뱃지로 서빙한다(K1).';

-- ============================================================================
-- 3. ops_restaurant_recommendations — 노출·탭·방문 원장 (R-6)
--
--    랭킹 피드백 루프의 소스이자, "무엇을 보여줬는가"의 감사 추적이다.
-- ============================================================================
create table if not exists ops_restaurant_recommendations (
  id uuid primary key default gen_random_uuid(),

  booking_id uuid not null references bookings(id) on delete cascade,
  room_id uuid,
  participant_id uuid references tour_room_participants(id) on delete set null,

  poi_key text,
  cell text not null,
  place_key text not null,
  rank smallint not null,

  -- 노출 당시 적용된 dietary 필터. 나중에 "왜 이 집이 나왔나"를 재구성하려면
  -- 필터를 함께 기록해야 한다(needs는 그 사이 바뀔 수 있다).
  dietary_tags text[] not null default '{}',

  shown_at timestamptz not null default now(),
  tapped_at timestamptz,
  visited_at timestamptz,

  -- null | 'good' | 'wrong' | 'closed'
  feedback text check (feedback is null or feedback in ('good', 'wrong', 'closed')),

  created_at timestamptz not null default now(),

  -- 같은 룸·같은 셀에서 같은 집을 다시 노출하면 행이 늘지 않고 갱신된다.
  constraint ops_restaurant_recommendations_uniq unique (booking_id, place_key, cell)
);

create index if not exists ops_restaurant_recommendations_booking_idx
  on ops_restaurant_recommendations (booking_id);
-- 랭킹 피드백 집계의 주 조회: 이 장소가 전역에서 몇 번 방문/신고됐는가.
create index if not exists ops_restaurant_recommendations_place_idx
  on ops_restaurant_recommendations (place_key);
create index if not exists ops_restaurant_recommendations_cell_idx
  on ops_restaurant_recommendations (cell);

comment on table ops_restaurant_recommendations is
  '다이닝 카드 노출·탭·방문 원장(§5.7 R-6). 랭킹 피드백(visited +0.3 / tapped +0.1 / wrong −1.0)의 소스이자 "무엇을 보여줬는가"의 감사 추적. UNIQUE(booking_id, place_key, cell)로 재노출은 갱신이지 증행이 아니다.';
comment on column ops_restaurant_recommendations.dietary_tags is
  '노출 당시 적용된 필터 스냅샷. needs는 이후 바뀔 수 있으므로 재구성을 위해 함께 기록한다.';

-- ============================================================================
-- 4. RLS — service-role 전용. RLS enabled + 정책 0개 + 클라이언트 role 권한 회수.
--    캐시는 외부 API 파생 데이터(쿼터가 걸린 자산)이고, 추천 원장은 게스트별
--    행동 기록이다. anon/authenticated에게 직접 노출할 이유가 없다 — 게스트는
--    룸 세션을 검증하는 라우트를 통해서만 본다.
-- ============================================================================
alter table ops_kakao_cell_index enable row level security;
alter table ops_kakao_place_cache enable row level security;
alter table ops_restaurant_recommendations enable row level security;

revoke all on ops_kakao_cell_index from anon, authenticated;
revoke all on ops_kakao_place_cache from anon, authenticated;
revoke all on ops_restaurant_recommendations from anon, authenticated;

-- ============================================================================
-- End. Verify after apply:
--   1. 3개 테이블 존재, RLS enabled, policies = 0 (위 점검 쿼리 (d))
--   2. anon/authenticated 로는 select 불가
--   3. GIN 인덱스 2종 존재:
--        select indexname from pg_indexes
--         where tablename = 'ops_kakao_place_cache' and indexdef ilike '%gin%';
--        → ops_kakao_place_cache_tags_gin, ops_kakao_place_cache_search_cells_gin
--   4. 멱등 스모크: 이 파일을 한 번 더 적용해도 에러 없이 통과해야 한다.
-- ============================================================================
