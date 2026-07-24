import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { resolveOpsRoomActor, isStaffActor } from '@/lib/ops/seating/access';
import { loadRoomVehicles, loadAssignments, broadcastSeatUpdate } from '@/lib/ops/seating/service';
import { hasEvidenceFor } from '@/lib/ops/seating/evidence';

export const dynamic = 'force-dynamic';

/**
 * 노쇼(absent) 처리 — AtoC 통합 플랜 §5.4 C-15 ⚠ + §5.4b D12(증거팩).
 *
 * POST { roomVehicleId, seatNumber, action: 'mark' | 'clear', evidenceId?, evidenceUrl? }
 *   가이드/기사/admin 전용. absent_at 마킹/해제 — 노쇼 좌석은 시작 게이트
 *   계산에서 제외된다 (allSeatsResolved).
 *
 * 증거 강제 (D12 — 비대칭 마찰 원칙: 체크인은 무마찰, 노쇼만 증거 요구):
 *   action='mark'는 이 (차량, 좌석)에 대한 ops_no_show_evidence 행이 있어야만
 *   통과한다. 없으면 400 evidence_required. 클라이언트는 먼저
 *   POST /api/ops/rooms/[roomId]/no-show-evidence 로 사진+GPS+타임스탬프를
 *   올리고 받은 evidenceId를 여기에 넘긴다.
 *   action='clear'(노쇼 취소)는 증거 불요 — 되돌리는 방향엔 마찰이 없다.
 *
 *   레거시 evidenceUrl 문자열은 계속 이벤트 payload에 기록만 한다. 그것만으로는
 *   절대 통과시키지 않는다 (문자열은 위조 가능 — 증거력 0).
 */

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));

    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { room, actor } = resolved;
    if (!isStaffActor(actor)) {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const roomVehicleId = String(body.roomVehicleId || '');
    const seatNumber = Number(body.seatNumber);
    const action = body.action === 'clear' ? 'clear' : body.action === 'mark' ? 'mark' : null;
    if (!roomVehicleId || !Number.isInteger(seatNumber) || !action) {
      return NextResponse.json(
        { error: 'roomVehicleId, seatNumber, action(mark|clear) are required' },
        { status: 400 },
      );
    }

    const vehicles = await loadRoomVehicles(supabase, roomId);
    if (!vehicles.some((v) => v.id === roomVehicleId)) {
      return NextResponse.json({ error: 'vehicle_not_in_room' }, { status: 404 });
    }

    const rows = await loadAssignments(supabase, [roomVehicleId]);
    const target = rows.find((a) => a.seat_number === seatNumber);
    if (!target) return NextResponse.json({ error: 'seat_not_assigned' }, { status: 404 });

    const evidenceUrl = typeof body.evidenceUrl === 'string' ? body.evidenceUrl.slice(0, 2048) : null;

    // D12 게이트 — 증거 없는 노쇼는 만들 수 없다. evidenceId가 오면 그 행이
    // 정말 이 좌석의 것인지까지 확인한다(다른 좌석 증거 재사용 차단).
    let evidenceId: string | null = null;
    if (action === 'mark') {
      const lookup = await hasEvidenceFor(supabase, {
        roomVehicleId,
        seatNumber,
        evidenceId: typeof body.evidenceId === 'string' ? body.evidenceId : null,
      });
      if (!lookup.found) {
        return NextResponse.json(
          { error: 'evidence_required', message: '현장 사진·위치 증거를 먼저 남겨야 노쇼 처리할 수 있어요.' },
          { status: 400 },
        );
      }
      evidenceId = lookup.evidenceId;
    }

    const patch =
      action === 'mark'
        ? { absent_at: new Date().toISOString() }
        : { absent_at: null };
    const { error: updateError } = await supabase
      .from('ops_seat_assignments')
      .update(patch)
      .eq('id', target.id);
    if (updateError) throw updateError;

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: target.booking_id,
      type: action === 'mark' ? 'seat_absent' : 'seat_absent_cleared',
      actorRole: actor.role === 'admin' ? 'admin' : actor.role,
      payload: {
        room_vehicle_id: roomVehicleId,
        seat_number: seatNumber,
        // 감사추적 완성: 어떤 증거 행이 이 비가역 액션을 정당화했는가.
        ...(evidenceId ? { evidence_id: evidenceId } : {}),
        ...(evidenceUrl ? { evidence_url: evidenceUrl } : {}),
      },
    }).catch(() => undefined);

    await broadcastSeatUpdate(supabase, room, {
      roomVehicleId,
      bookingId: target.booking_id,
      seatNumbers: [seatNumber],
      kind: action === 'mark' ? 'absent' : 'absent_cleared',
    });

    return NextResponse.json({ ok: true, seatNumber, action, evidenceId });
  } catch (error) {
    console.error('POST /api/ops/rooms/[roomId]/absent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
