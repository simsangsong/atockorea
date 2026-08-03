-- 차량이 배정된 예약을 삭제할 수 있게 한다 (PERF-LEDGER-2026-08 P-06).
--
-- 문제:
--   ops_room_vehicles_anchor_present  CHECK (group_id IS NOT NULL OR room_id IS NOT NULL)
--   ops_room_vehicles_room_id_fkey    FK room_id -> tour_rooms(id) ON DELETE SET NULL
--   tour_rooms_booking_id_fkey        FK booking_id -> bookings(id) ON DELETE CASCADE
--
--   bookings 삭제 → CASCADE tour_rooms 삭제 → room_id 가 SET NULL →
--   group_id 도 NULL 인 행(= 룸에만 매인 차량)은 CHECK 위반 → 트랜잭션 전체 롤백.
--   방-앵커 차량은 전세·프라이빗 투어의 정상 형태라 엣지 케이스가 아니다.
--   실제로 2026-08-03 `scripts/sim-tour-day.ts --cleanup` 이 이 제약으로 exit 1 했다.
--
-- 왜 room_id 를 그냥 ON DELETE CASCADE 로 바꾸지 않는가:
--   **이중 앵커 행이 실재한다** — 라이브에 group_id 와 room_id 를 둘 다 가진 행이 있다(실측).
--   그 행은 룸이 사라져도 그룹 앵커로 계속 유효하다. 통짜 CASCADE 는 그것까지 지워버려
--   지금 동작(room_id 만 NULL 로 떨어지고 행은 생존)을 퇴행시킨다.
--   FK 액션으로는 "앵커가 이것 하나뿐일 때만" 을 표현할 수 없으므로 트리거로 쓴다.
--
-- 결과:
--   * 룸이 유일한 앵커인 행  → 룸과 함께 삭제된다 (트리거)
--   * 그룹 앵커도 있는 행    → 기존대로 room_id 만 NULL 이 되고 살아남는다 (FK SET NULL)
--   CHECK 는 그대로 두고 위반 상황 자체를 없앤다.
--
-- 이 패턴(SET NULL FK + 그 컬럼을 요구하는 CHECK)은 public 스키마 전체에서
-- 이 테이블 하나뿐임을 확인했다 [실측, pg_constraint 전수 스캔].

create or replace function public.ops_room_vehicles_drop_sole_anchor()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- 룸이 유일한 앵커인 배정만 정리한다. 그룹 앵커가 있으면 손대지 않는다.
  delete from public.ops_room_vehicles
   where room_id = old.id
     and group_id is null;
  return old;
end;
$$;

comment on function public.ops_room_vehicles_drop_sole_anchor() is
  '룸 삭제 시, 그 룸에만 매인 차량 배정을 함께 지운다. anchor_present CHECK 와 room_id 의 '
  'ON DELETE SET NULL 이 충돌해 예약 삭제가 통째로 실패하던 것을 막는다 (P-06).';

drop trigger if exists tour_rooms_drop_sole_anchored_vehicles on public.tour_rooms;

create trigger tour_rooms_drop_sole_anchored_vehicles
  before delete on public.tour_rooms
  for each row
  execute function public.ops_room_vehicles_drop_sole_anchor();

-- 트리거로만 불려야 한다. security definer 함수를 public 스키마에 두면 PostgREST 로 노출되고
-- 어드바이저가 `anon_security_definer_function_executable` 로 잡는다 (적용 직후 실제로 잡혔다).
-- 트리거 실행은 이 GRANT 와 무관하므로 회수해도 동작에 영향이 없다.
revoke execute on function public.ops_room_vehicles_drop_sole_anchor() from public;
revoke execute on function public.ops_room_vehicles_drop_sole_anchor() from anon;
revoke execute on function public.ops_room_vehicles_drop_sole_anchor() from authenticated;
