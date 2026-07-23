import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { resolveOpsRoomActor, isStaffActor } from '@/lib/ops/seating/access';
import { loadRoomVehicles, loadAssignments, broadcastSeatUpdate } from '@/lib/ops/seating/service';

export const dynamic = 'force-dynamic';

/**
 * 노쇼(absent) 처리 — AtoC 통합 플랜 §5.4 C-15 ⚠.
 *
 * POST { roomVehicleId, seatNumber, action: 'mark' | 'clear', evidenceUrl? }
 *   가이드/기사/admin 전용. absent_at 마킹/해제 — 노쇼 좌석은 시작 게이트
 *   계산에서 제외된다 (allSeatsResolved).
 *
 * 증거팩(kursoflow 사진+GPS+워터마크 패턴, ops_no_show_evidence)은 후속
 * 슬라이스 — 이번엔 evidenceUrl 옵션만 받아 tour_room_events payload에
 * 남긴다 (OTA 분쟁 대비 최소 기록; 증거 강제는 UI 슬라이스에서).
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
        ...(evidenceUrl ? { evidence_url: evidenceUrl } : {}),
      },
    }).catch(() => undefined);

    await broadcastSeatUpdate(supabase, room, {
      roomVehicleId,
      bookingId: target.booking_id,
      seatNumbers: [seatNumber],
      kind: action === 'mark' ? 'absent' : 'absent_cleared',
    });

    return NextResponse.json({ ok: true, seatNumber, action });
  } catch (error) {
    console.error('POST /api/ops/rooms/[roomId]/absent error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
