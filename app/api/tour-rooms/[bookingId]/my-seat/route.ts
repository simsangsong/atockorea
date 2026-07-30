/**
 * P4 / P-D22 — "내 좌석".
 *
 * 리포트(2026-07-27): "전날 좌석 지정하려니까 좌석 지정 버튼도 기능도 없네."
 * 관찰은 정확했다 — 좌석은 `GuideSeatDashboard`(가이드 전용)뿐이고 손님 표면엔
 * 아무것도 없었다.
 *
 * 다만 플랜 재리뷰에서 **자율 선택은 지금 만들 기능이 아니라고** 결론냈다:
 *   · `ops_seat_assignments` 라이브 0행 — 운영이 좌석을 배정한 적이 없다.
 *   · 좌석은 `room_vehicle_id`에 매달려 있다 = **배차(스태프 행위)가 선행**한다.
 *   · 리포트의 예약은 프라이빗 카 charter(차 1대·2인)라 좌석 개념이 없다.
 * 상류가 미사용인 채로 선택 UI를 만들면 빈 화면을 출시하게 된다.
 *
 * 그래서 이 라우트는 **읽기 전용**이고, 정직한 세 상태만 답한다:
 *   assigned  좌석이 배정됐다 → 번호를 준다
 *   pending   차량은 붙었는데 내 좌석은 아직 → "가이드가 당일 배정"
 *   none      이 투어엔 좌석 배치가 없다 → 찾지 않게 말해 준다
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

export type MySeatState = 'assigned' | 'pending' | 'none';

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

    // 이 방에 배차된 차량이 있는가? 없으면 좌석이라는 개념 자체가 없다.
    const { data: vehicleRaw } = await supabase
      .from('ops_room_vehicles')
      .select('id, plate_number, layout_id')
      .eq('room_id', room.id)
      .maybeSingle();
    const vehicle = vehicleRaw as { id: string; plate_number: string | null; layout_id: string | null } | null;

    if (!vehicle?.id || !vehicle.layout_id) {
      return NextResponse.json({ state: 'none' satisfies MySeatState, seat_number: null });
    }

    const participantId = actor.kind === 'session' ? actor.sessionPayload.participantId : null;
    let seat: { seat_number: string | null } | null = null;

    if (participantId) {
      const { data } = await supabase
        .from('ops_seat_assignments')
        .select('seat_number')
        .eq('room_vehicle_id', vehicle.id)
        .eq('participant_id', participantId)
        .maybeSingle();
      seat = data as { seat_number: string | null } | null;
    }
    // 개인 참가자 행이 없으면 예약 단위 배정으로 떨어진다(동행자 미등록 케이스).
    if (!seat?.seat_number) {
      const { data } = await supabase
        .from('ops_seat_assignments')
        .select('seat_number')
        .eq('room_vehicle_id', vehicle.id)
        .eq('booking_id', booking.id)
        .limit(1)
        .maybeSingle();
      seat = data as { seat_number: string | null } | null;
    }

    return NextResponse.json({
      state: (seat?.seat_number ? 'assigned' : 'pending') satisfies MySeatState,
      seat_number: seat?.seat_number ?? null,
      // 번호판은 손님이 차를 알아보는 데 쓰인다. 없으면 굳이 지어내지 않는다.
      plate_number: vehicle.plate_number ?? null,
    });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/my-seat error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
