import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { recordRoomEvent, listRoomEvents } from '@/lib/tour-room/events';
import { resolveOpsRoomActor, isStaffActor } from '@/lib/ops/seating/access';
import { loadRoomVehicles, loadAssignments, broadcastSeatUpdate } from '@/lib/ops/seating/service';
import { allSeatsResolved, seatCounts } from '@/lib/ops/seating/logic';
import { fireTourStartBriefing } from '@/lib/ops/seating/startBriefing';

export const dynamic = 'force-dynamic';

/**
 * 시작 게이트 — AtoC 통합 플랜 §5.4 C-15/C-16.
 *
 * GET  게이트 상태: seatCounts + allSeatsResolved + 차량별 집계 + started.
 * POST [투어 시작] (staff 전용):
 *   - allSeatsResolved 검증 (전 좌석 {checked_in | absent}) → 아니면 400
 *   - 전 좌석 locked=true (C-16 좌석 잠금)
 *   - tour_room_events 'tour_start' (subject_key='tour_start' — 기존 partial
 *     unique index로 idempotent; 재탭/동시탭은 inserted=false)
 *   - 최초 1회만: seat_update 브로드캐스트 + 시작 브리핑 팬아웃
 *     (lib/ops/seating/startBriefing.ts — C-16 ① 연결 지점)
 */

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { room } = resolved;

    const vehicles = await loadRoomVehicles(supabase, roomId);
    const assignments = await loadAssignments(supabase, vehicles.map((v) => v.id));

    const startEvents = await listRoomEvents(supabase, room.id, { types: ['tour_start'], limit: 1 });

    return NextResponse.json({
      counts: seatCounts(assignments),
      resolved: allSeatsResolved(assignments),
      started: startEvents.length > 0,
      startedAt: startEvents[0]?.created_at ?? null,
      vehicles: vehicles.map((v) => {
        const rows = assignments.filter((a) => a.room_vehicle_id === v.id);
        return { roomVehicleId: v.id, model: v.model, counts: seatCounts(rows) };
      }),
    });
  } catch (error) {
    console.error('GET /api/ops/rooms/[roomId]/gate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { room, actor } = resolved;
    if (!isStaffActor(actor)) {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }

    const vehicles = await loadRoomVehicles(supabase, roomId);
    const vehicleIds = vehicles.map((v) => v.id);
    const assignments = await loadAssignments(supabase, vehicleIds);

    // C-15 — 전 좌석 {그린 | absent}. 0건도 false (빈 룸 게이트 방지).
    if (!allSeatsResolved(assignments)) {
      return NextResponse.json(
        { error: 'gate_not_ready', counts: seatCounts(assignments) },
        { status: 400 },
      );
    }

    // C-16 — 좌석 잠금.
    const { error: lockError } = await supabase
      .from('ops_seat_assignments')
      .update({ locked: true })
      .in('room_vehicle_id', vehicleIds);
    if (lockError) throw lockError;

    // 단일 트리거 (idempotent — 기존 tour_room_events subject_key 패턴).
    const start = await recordRoomEvent(supabase, {
      roomId: room.id,
      type: 'tour_start',
      actorRole: actor.role === 'admin' ? 'admin' : actor.role,
      subjectKey: 'tour_start',
      payload: { counts: seatCounts(assignments) },
    });

    if (start.inserted) {
      await broadcastSeatUpdate(supabase, room, { kind: 'locked', roomId: room.id });
      // C-16 ① — 시작 브리핑 팬아웃 (룸당 멱등, startBriefing.ts).
      if (room.tour_id && room.tour_date) {
        await fireTourStartBriefing(supabase, {
          tourId: room.tour_id,
          tourDate: room.tour_date,
        }).catch((e) => {
          console.warn('[ops-seating] tour-start briefing failed:', e);
          return { delivered: 0, skipped: 0 };
        });
      }
    }

    return NextResponse.json({
      started: true,
      alreadyStarted: !start.inserted,
      counts: seatCounts(assignments),
    });
  } catch (error) {
    console.error('POST /api/ops/rooms/[roomId]/gate error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
