/**
 * P4 / P-D22 — "내 좌석".
 *
 * 리포트(2026-07-27): "전날 좌석 지정하려니까 좌석 지정 버튼도 기능도 없네."
 * 관찰은 정확했다 — 좌석은 `GuideSeatDashboard`(가이드 전용)뿐이고 손님 표면엔
 * 아무것도 없었다.
 *
 * 🔴 2026-07-30 개정 — 두 가지가 바뀌었다.
 *
 * ① **그룹을 못 보고 있었다.** 예전 구현은 `ops_room_vehicles`를 손님 자기
 *    룸 하나로만(`.eq('room_id', room.id).maybeSingle()`) 찾았다. 그런데
 *    조인투어는 예약 하나당 룸 하나라 한 투어가 룸 N개이고, 차량은 그중
 *    **임의의 한 룸(앵커)** 에만 매달린다. 그래서 앵커가 아닌 손님 — 즉
 *    대부분 — 은 좌석이 배정돼 있어도 `none`("이 투어엔 좌석이 없어요")을
 *    받았다. 게다가 룸에 차량이 둘이면 `.maybeSingle()`이 에러를 내고 그
 *    에러가 버려져 역시 `none`이 됐다. 이제 `loadRoomVehicles`를 쓴다 —
 *    좌석판·명단·체크인·게이트가 이미 쓰는 그 함수이고, 그룹 확장이 그
 *    안에 있다. 네 화면이 같은 답을 본다.
 *
 * ② **읽기 전용이 아니다.** 예전 주석은 "자율 선택은 지금 만들 기능이
 *    아니다 — 상류(배차)가 미사용이라 빈 화면을 출시하게 된다"고 했다. 그
 *    판단의 근거는 유효하지만 결론이 과했다: 문을 아예 안 만들 게 아니라
 *    **상류가 준비됐을 때만 열리는 문**을 만들면 된다. 그래서 이 라우트가
 *    그 판정까지 답한다(`can_pick`). 배차 전이면 문이 없는 게 아니라
 *    닫혀 있는 것이고, 손님은 "아직"이라는 정직한 답을 본다.
 *
 * 상태는 그대로 셋이다:
 *   assigned  좌석이 배정됐다 → 번호를 준다
 *   pending   차량은 붙었는데 내 좌석은 아직
 *   none      이 투어엔 좌석 배치가 없다 → 찾지 않게 말해 준다
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { loadAssignments, loadRoomVehicles } from '@/lib/ops/seating/service';
import { kstToday } from '@/lib/tour-room/time';

export const dynamic = 'force-dynamic';

export type MySeatState = 'assigned' | 'pending' | 'none';

export interface MySeatResponse {
  state: MySeatState;
  seat_number: number | null;
  plate_number: string | null;
  /**
   * May this guest still choose? Everything the picker needs, decided once on
   * the server so the client never has to re-derive the rules:
   *   · a vehicle with a layout exists for this tour group, AND
   *   · it is still before the tour day (C-11 — the seats route refuses guest
   *     writes from 00:00 KST on the day, so offering the picker then would be
   *     offering a button that 400s), AND
   *   · the start gate has not locked the board, AND
   *   · the caller is a guest (staff have their own board).
   */
  can_pick: boolean;
  /** The ops room to address; the seats API expands to its tour-date siblings. */
  room_id: string | null;
  /** Party size — the picker caps the selection at this. */
  party_size: number;
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  try {
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    // FA-022 — the other 48 callers test `!resolved.ok`, which is the union's
    // actual discriminant. `'error' in resolved` happens to agree today only
    // because the success shape carries no `error` key; add an optional one and
    // this single caller silently inverts. Same check as everywhere else.
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;
    const room = await ensureRoom(supabase, booking);

    const empty = (): MySeatResponse => ({
      state: 'none',
      seat_number: null,
      plate_number: null,
      can_pick: false,
      room_id: room.id,
      party_size: 1,
    });

    // 그룹의 차량 전부. 배치도 없는 차는 좌석이라는 개념이 성립하지 않는다.
    const vehicles = (await loadRoomVehicles(supabase, room.id)).filter((v) => v.layout);
    if (vehicles.length === 0) return NextResponse.json(empty());

    const assignments = await loadAssignments(
      supabase,
      vehicles.map((v) => v.id),
    );
    const participantId = actor.kind === 'session' ? actor.sessionPayload.participantId : null;
    const mine =
      (participantId ? assignments.find((a) => a.participant_id === participantId) : null) ??
      assignments.find((a) => a.booking_id === booking.id) ??
      null;

    const vehicle = vehicles.find((v) => v.id === mine?.room_vehicle_id) ?? vehicles[0];
    const boardLocked = assignments.some((a) => a.locked);
    // C-11 — guest writes close at 00:00 KST on the tour day.
    const beforeTourDay = Boolean(booking.tour_date) && kstToday() < (booking.tour_date as string);
    const isGuest = actor.role === 'customer';

    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('number_of_guests')
      .eq('id', booking.id)
      .maybeSingle();
    const partySize = Math.max(
      1,
      Number((bookingRow as { number_of_guests?: number | null } | null)?.number_of_guests ?? 1) || 1,
    );

    const body: MySeatResponse = {
      state: mine?.seat_number != null ? 'assigned' : 'pending',
      seat_number: mine?.seat_number ?? null,
      // 번호판은 손님이 차를 알아보는 데 쓰인다. 없으면 굳이 지어내지 않는다.
      plate_number: vehicle?.plate_number ?? null,
      can_pick: isGuest && beforeTourDay && !boardLocked,
      room_id: room.id,
      party_size: partySize,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/my-seat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
