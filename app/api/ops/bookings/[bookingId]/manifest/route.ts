import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { resolveOpsRoomActor, isStaffActor } from '@/lib/ops/seating/access';
import { loadTourManifest } from '@/lib/ops/seating/manifest';

export const dynamic = 'force-dynamic';

/**
 * 가이드 명단·좌석 통합 조회 (staff 전용) — AtoC 통합 플랜 §5.4b / §11.B B1.
 *
 * GET /api/ops/bookings/[bookingId]/manifest
 *   가이드 명단·체크인 대시보드(§5.4b)와 채팅 좌석 스트립(B1)의 단일 소스.
 *   bookingId로 키잉 — 대시보드는 overview.rooms[].booking_id, 스트립은
 *   자기가 연 booking을 그대로 넘긴다. 내부에서 booking→룸→(tour_id,
 *   tour_date) 스코프로 전 명단+좌석+차량을 tour 단위로 로드한다.
 *
 *   인가: booking의 룸에 resolveOpsRoomActor → **staff(가이드/기사/admin)만**.
 *   PII(연락처·특이사항) 노출이라 게스트 토큰은 거부(isStaffActor 게이트).
 *   변경(체크인/노쇼/게이트/좌석)은 응답 anchorRoomId로 기존
 *   /api/ops/rooms/[roomId]/* 엔드포인트를 호출한다.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    // booking → 자기 룸 (tour_rooms.booking_id UNIQUE) → 그 룸으로 인가.
    const { data: roomRow } = await supabase
      .from('tour_rooms')
      .select('id, tour_id, tour_date')
      .eq('booking_id', bookingId)
      .maybeSingle();
    const room = roomRow as { id: string; tour_id: string | null; tour_date: string | null } | null;
    if (!room) return NextResponse.json({ error: 'room_not_found' }, { status: 404 });

    const resolved = await resolveOpsRoomActor(req, supabase, room.id);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    if (!isStaffActor(resolved.actor)) {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }
    if (!room.tour_id || !room.tour_date) {
      return NextResponse.json({ error: 'room_has_no_tour_scope' }, { status: 400 });
    }

    const manifest = await loadTourManifest(supabase, { tourId: room.tour_id, tourDate: room.tour_date });

    return NextResponse.json({
      tour: manifest.tour,
      tourDate: manifest.tourDate,
      anchorRoomId: manifest.anchorRoomId,
      channelTopic: manifest.channelTopic,
      started: manifest.started,
      bookings: manifest.bookings,
      vehicles: manifest.vehicles.map((v) => ({
        roomVehicleId: v.id,
        model: v.model,
        plateNumber: v.plate_number,
        totalSeats: v.total_seats,
        layout: v.layout,
      })),
      assignments: manifest.assignments.map((a) => ({
        seatNumber: a.seat_number,
        roomVehicleId: a.room_vehicle_id,
        bookingId: a.booking_id,
        guestLabel: a.guest_label,
        checkedInAt: a.checked_in_at ?? null,
        absentAt: a.absent_at ?? null,
        locked: Boolean(a.locked),
      })),
    });
  } catch (error) {
    console.error('GET /api/ops/bookings/[bookingId]/manifest error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
