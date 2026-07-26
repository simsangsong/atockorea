-- 배차별 차량 사진 (옵션) — 렌트 운영 대응.
--
-- 배경: 이 운영은 차를 소유하지 않는다. 매번 렌트하고 차량이 매번 바뀌므로
-- 배차 시점에 확정된 것은 타입(배치도)뿐이고, 실제 어떤 차가 왔는지는 당일
-- 사진 한 장이 가장 정확한 기록이다. 번호판 텍스트와 달리 사진은 오타가 없다.
--
-- 설계 결정:
--   1. **옵션이다.** NULL이 정상 상태다 — 사진이 없다고 배차가 불완전한 것이 아니다.
--   2. **URL이 아니라 storage path를 담는다.** 차량 사진에는 기사·손님이 찍힐 수
--      있어서 public 버킷에 두지 않는다(ops_no_show_evidence·실차 사진과 같은 규약).
--      조회는 단기 서명 URL로만 한다.
--   3. **새 버킷을 만들지 않는다.** 기존 private 버킷 `ops-vehicle-refs`를
--      `room-vehicle/<id>/…` 경로로 나눠 쓴다. 버킷이 늘면 보관 정책도 늘어난다.
--
-- 이미 있는 것과 구분: 기사 콕핏의 [차량사진]은 **손님 채팅으로 보내는** 사진이고
-- (Cockpit.tsx B1), 이 컬럼은 **관제가 보관하는** 배차 기록이다. 목적이 다르다.
--
-- 적용 전/후 점검:
--   select count(*) from ops_room_vehicles;                       -- 영향 행 0 (additive)
--   select column_name from information_schema.columns
--     where table_name='ops_room_vehicles' and column_name='photo_path';

alter table ops_room_vehicles
  add column photo_path text;

comment on column ops_room_vehicles.photo_path is
  '배차 차량 사진의 private storage path (버킷 ops-vehicle-refs, 경로 room-vehicle/…). NULL = 사진 없음(정상). URL이 아니라 path다 — 조회는 단기 서명 URL로만.';
