/**
 * P-D19 — "이 기기에서 편집하기".
 *
 * P-D13은 초안 편집자를 한 명으로 유지하려고 lead 게스트만 편집하게 한다. 그
 * 취지는 옳지만, 리포트(2026-07-27)의 상황에서는 **혼자 여행하는 사람이 자기
 * 예약에서 잠긴다**: 브라우저에서 초대를 열어 참가(→lead)한 뒤 PWA로 다시 열면
 * 스토리지가 달라 새 참가자 행이 생기고, 그 기기는 영영 비-lead다. 저장은 전부
 * 403이고 화면은 읽기전용이 된다 — 혼란스러운 실패가 확실한 잠금이 될 뿐이다.
 *
 * 그래서 인계를 허용하되, **동행자는 제외**한다. 동행자는 개인 초대로 들어오며
 * `invite_id`가 남는다(join 라우트). 그들이 편집자가 되면 안 된다는 것이
 * P-D13의 실제 목적이고, 이 게이트는 그 목적을 그대로 지킨다.
 *
 * 같은 예약의 손님들은 모두 같은 결제 주체이므로 인계는 보안 경계가 아니라
 * **편집권 이동**이다. 되돌리기도 같은 버튼으로 된다.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest, ctx: { params: Promise<{ bookingId: string }> }) {
  const { bookingId } = await ctx.params;
  try {
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if ('error' in resolved) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor } = resolved;

    // 세션으로 들어온 손님만 — 토큰·스태프는 대상이 아니다.
    if (actor.kind !== 'session' || actor.role !== 'customer') {
      return NextResponse.json({ error: 'customers_only' }, { status: 403 });
    }

    const gate = await requestGate({
      namespace: 'tour_room_plan_claim',
      key: `booking:${booking.id}`,
      perMinute: 4,
      perHour: 20,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_ms: gate.retryAfterMs ?? 0 },
        { status: 429 },
      );
    }

    const participantId = actor.sessionPayload.participantId;
    const { data: me } = await supabase
      .from('tour_room_participants')
      .select('id, booking_id, invite_id, is_lead, display_name')
      .eq('id', participantId)
      .maybeSingle();
    const row = me as
      | { id: string; booking_id: string; invite_id: string | null; is_lead: boolean; display_name: string | null }
      | null;

    if (!row || row.booking_id !== booking.id) {
      return NextResponse.json({ error: 'participant_not_found' }, { status: 404 });
    }
    // 🔴 동행자는 인계 대상이 아니다 — 개인 초대로 들어온 기기는 계속 읽기전용.
    if (row.invite_id) {
      return NextResponse.json({ error: 'companion_cannot_lead' }, { status: 403 });
    }
    if (row.is_lead) {
      return NextResponse.json({ ok: true, already_lead: true });
    }

    // 한 번에 한 명 불변식: 이 예약의 다른 손님에게서 내리고 나에게 올린다.
    const { error: clearError } = await supabase
      .from('tour_room_participants')
      .update({ is_lead: false })
      .eq('booking_id', booking.id)
      .eq('role', 'customer')
      .neq('id', row.id);
    if (clearError) throw clearError;

    const { error: setError } = await supabase
      .from('tour_room_participants')
      .update({ is_lead: true })
      .eq('id', row.id);
    if (setError) throw setError;

    return NextResponse.json({ ok: true, already_lead: false });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/plan/claim-lead error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
