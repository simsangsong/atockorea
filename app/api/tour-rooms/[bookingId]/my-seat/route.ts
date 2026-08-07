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
 * 🔴 2026-08-07 개정 — **`none`이 두 가지 다른 사실을 뭉개고 있었다.**
 *
 * 배차가 없으면 이 라우트는 `none`을 줬고 카드는 `none`에 아무것도 안 그렸다.
 * 그런데 배차가 없는 이유는 둘이다: ① 아직 차를 안 붙였다(조인 투어 — 곧
 * 좌석이 생긴다) ② 이 상품에는 좌석이라는 개념이 없다(전세 — 차가 통째로
 * 일행 것이다). 둘을 같은 값으로 답하니 손님 화면에서 좌석은 **닫힌 문이
 * 아니라 없는 문**이 됐다 — 카드 헤더 주석이 약속한 "배차되면 열려요"는
 * 한 번도 렌더된 적이 없다. 라이브 배차가 0건이라 사실상 전 손님이 이 경로다.
 *
 * 판별은 `isPrivateTour(tours.price_type)` — 조인/프라이빗의 정본 판정자다
 * (`lib/tour-room/tourKind.ts`). 새로 만들지 않고 그걸 쓴다.
 *
 * 상태는 이제 넷이다:
 *   assigned  좌석이 배정됐다 → 번호를 준다
 *   pending   차량은 붙었는데 내 좌석은 아직
 *   awaiting  좌석 있는 상품인데 배차 전 → "배차되면 고를 수 있어요"
 *   none      이 투어엔 좌석 배치가 없다(전세) → 찾지 않게 아무 말도 안 한다
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { loadAssignments, loadRoomVehicles } from '@/lib/ops/seating/service';
import { isPrivateTour } from '@/lib/tour-room/tourKind';

export const dynamic = 'force-dynamic';

export type MySeatState = 'assigned' | 'pending' | 'awaiting' | 'none';

export interface MySeatResponse {
  state: MySeatState;
  seat_number: number | null;
  plate_number: string | null;
  /**
   * May this guest still choose? Everything the picker needs, decided once on
   * the server so the client never has to re-derive the rules:
   *   · a vehicle with a layout exists for this tour group, AND
   *   · my own seats are not checked in / marked absent / locked yet
   *     (C-11 as revised by the owner 2026-08-07 — see below), AND
   *   · the start gate has not locked the board, AND
   *   · the caller is a guest (staff have their own board).
   *
   * 🔴 The old rule was a blanket date lock: guest writes closed at 00:00 KST
   * on the tour day. That is wider than the thing it protects. What must not
   * move is a seat that already carries check-in or no-show evidence — and the
   * seats route has always enforced exactly that, per assignment. The date
   * lock additionally froze guests who had not checked in and, on a join tour,
   * had not even been given a seat yet — on the one morning they most need to
   * pick one. Owner decision (2026-08-07): allow changes until check-in.
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

    const empty = (state: 'awaiting' | 'none'): MySeatResponse => ({
      state,
      seat_number: null,
      plate_number: null,
      can_pick: false,
      room_id: room.id,
      party_size: 1,
    });

    // 그룹의 차량 전부. 배치도 없는 차는 좌석이라는 개념이 성립하지 않는다.
    const vehicles = (await loadRoomVehicles(supabase, room.id)).filter((v) => v.layout);
    if (vehicles.length === 0) {
      // 배차 전이다. 좌석이 생길 상품인지(조인) 아예 없는 상품인지(전세)를
      // 가른다 — 전세에 "배차되면 좌석을 고를 수 있어요"라고 하면 오지 않을
      // 문을 기다리게 만든다.
      const { data: tourRow } = booking.tour_id
        ? await supabase.from('tours').select('price_type').eq('id', booking.tour_id).maybeSingle()
        : { data: null };
      const priceType = (tourRow as { price_type?: string | null } | null)?.price_type ?? null;
      return NextResponse.json(empty(isPrivateTour(priceType) ? 'none' : 'awaiting'));
    }

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
    // C-11 (2026-08-07 개정) — 내 좌석이 이미 결론난 뒤에만 잠근다. 판정 대상은
    // 날짜가 아니라 **내 배정 행들**이다. 일행 중 한 명이라도 체크인/노쇼로
    // 결론이 났으면 그 원장은 손대지 않는다.
    const myRows = assignments.filter((a) => a.booking_id === booking.id);
    const myRowsResolved = myRows.some((a) => a.checked_in_at || a.absent_at || a.locked);
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
      can_pick: isGuest && !myRowsResolved && !boardLocked,
      room_id: room.id,
      party_size: partySize,
    };
    return NextResponse.json(body);
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/my-seat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
