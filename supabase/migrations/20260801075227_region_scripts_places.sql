-- 지역 해설에 붙는 추천 장소(식당·체험농장·카페).
--
-- 이 마이그레이션은 라이브에 먼저 적용됐고(2026-08-01 07:52 UTC) 레포에는 파일이
-- 없었다. 그래서 레포만으로 스키마를 다시 세우면 `places` 없는 region_scripts가
-- 만들어지고, 서빙 라우트의 `select … places`가 500으로 죽는다. 그 구멍을 메운다.
--
-- 왜 본문이 아니라 컬럼인가: 상호는 고유명사라 번역 대상이 아닌데 본문에 박아
-- 두면 식당 한 곳이 바뀔 때 10개 언어 본문을 전부 고쳐야 한다. 메타로 빼면 한
-- 행만 고치면 되고, UI는 분류 태그(`black_pork`·`cafe` …)의 라벨만 번역한다.
--
-- 형태: [{ tag, ko, en, addr?, phone?, lat?, lng?, verify? }]
--   lat/lng — 카카오 로컬에서 확보한 실좌표. 오늘 경로에서 몇 km인지 **참고로만**
--             보여주는 데 쓴다. 갈 수 있는지는 차량·교통을 아는 기사가 정한다.
--   verify  — 동일 상호의 지점이 여럿이라 사람이 골라야 하는 항목.

alter table region_scripts
  add column if not exists places jsonb not null default '[]'::jsonb;

comment on column region_scripts.places is
  '추천 장소·식당. 고유명사라 로케일 무관 — 본문에 넣으면 한 곳이 바뀔 때 10개 언어를 다 고쳐야 하므로 메타로 뺐다. [{tag, ko, en, addr?, phone?, lat?, lng?, verify?}] 형태이고 UI가 태그 라벨만 번역한다.';
