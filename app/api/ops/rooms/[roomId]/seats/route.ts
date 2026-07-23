import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { resolveOpsRoomActor, isStaffActor } from '@/lib/ops/seating/access';
import {
  loadRoomVehicles,
  loadAssignments,
  broadcastSeatUpdate,
  type SeatAssignmentRow,
} from '@/lib/ops/seating/service';
import { buildSeatStateMap } from '@/lib/ops/seating/logic';

export const dynamic = 'force-dynamic';

/**
 * 좌석판 조회/선택/해제 — AtoC 통합 플랜 §5.3 (C-7~C-11).
 *
 * GET    좌석판 상태: 차량들(배치도 포함) + buildSeatStateMap (viewer 관점).
 * POST   좌석 선택 (party 전원 일괄, C-9): { roomVehicleId, seats:[{seatNumber,
 *        guestLabel?}], bookingId? (staff 대행 — §5.4b 현장 지정) }.
 *        UNIQUE 위반(동시 선점) → 409 + 최신 좌석판 상태 (C-10).
 *        locked/체크인 이후 변경 → 400 (C-11: 게스트는 당일부터 잠금).
 * DELETE 좌석 해제 (출발 전만): { roomVehicleId, seatNumbers?, bookingId? }.
 */

function seatChangeLockedForCustomer(tourDate: string | null): boolean {
  // C-11/C-12 — 체크인 오픈(tour_date 00:00 KST)부터 게스트 자율 변경 금지.
  return Boolean(tourDate) && kstToday() >= (tourDate as string);
}

async function stateResponse(
  supabase: ReturnType<typeof createServerClient>,
  roomId: string,
  viewerBookingId: string | null,
  status = 200,
  extra: Record<string, unknown> = {},
) {
  const vehicles = await loadRoomVehicles(supabase, roomId);
  const assignments = await loadAssignments(supabase, vehicles.map((v) => v.id));
  const byVehicle = vehicles.map((v) => {
    const rows = assignments.filter((a) => a.room_vehicle_id === v.id);
    return {
      roomVehicleId: v.id,
      model: v.model,
      plateNumber: v.plate_number,
      totalSeats: v.total_seats,
      layout: v.layout,
      seatStates: v.layout ? buildSeatStateMap(v.layout, rows, viewerBookingId) : {},
      seats: rows.map((a) => ({
        seatNumber: a.seat_number,
        bookingId: a.booking_id,
        guestLabel: a.guest_label,
        checkedInAt: a.checked_in_at ?? null,
        absentAt: a.absent_at ?? null,
        locked: Boolean(a.locked),
      })),
    };
  });
  return NextResponse.json({ vehicles: byVehicle, ...extra }, { status });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const viewerBookingId = resolved.actor.role === 'customer' ? resolved.actor.bookingId : null;
    return await stateResponse(supabase, roomId, viewerBookingId);
  } catch (error) {
    console.error('GET /api/ops/rooms/[roomId]/seats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  if (code === '23505') return true;
  const message = (error as { message?: unknown } | null)?.message;
  return typeof message === 'string' && message.includes('duplicate key');
}

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

    const roomVehicleId = String(body.roomVehicleId || '');
    const rawSeats = Array.isArray(body.seats) ? body.seats : [];
    if (!roomVehicleId || rawSeats.length === 0) {
      return NextResponse.json({ error: 'roomVehicleId and seats are required' }, { status: 400 });
    }

    // 대상 booking: 게스트는 본인, staff는 명시 필수 (§5.4b 현장 지정).
    let targetBookingId: string;
    if (actor.role === 'customer') {
      targetBookingId = actor.bookingId;
      if (seatChangeLockedForCustomer(room.tour_date)) {
        return NextResponse.json({ error: 'seat_change_locked' }, { status: 400 });
      }
    } else {
      targetBookingId = String(body.bookingId || '');
      if (!targetBookingId) {
        return NextResponse.json({ error: 'bookingId is required for staff assignment' }, { status: 400 });
      }
    }

    const vehicles = await loadRoomVehicles(supabase, roomId);
    const vehicle = vehicles.find((v) => v.id === roomVehicleId);
    if (!vehicle) return NextResponse.json({ error: 'vehicle_not_in_room' }, { status: 404 });

    // 좌석번호는 배치도에 실재해야 한다.
    const validNumbers = new Set((vehicle.layout?.seats ?? []).map((s) => s.n));
    const seats: Array<{ seatNumber: number; guestLabel: string | null }> = [];
    for (const raw of rawSeats) {
      const n = Number((raw as { seatNumber?: unknown }).seatNumber);
      if (!Number.isInteger(n) || !validNumbers.has(n)) {
        return NextResponse.json({ error: `invalid_seat_number:${n}` }, { status: 400 });
      }
      const label = (raw as { guestLabel?: unknown }).guestLabel;
      seats.push({ seatNumber: n, guestLabel: typeof label === 'string' ? label.slice(0, 80) : null });
    }
    if (new Set(seats.map((s) => s.seatNumber)).size !== seats.length) {
      return NextResponse.json({ error: 'duplicate_seat_numbers' }, { status: 400 });
    }

    // party 인원 상한 (게스트 자율 선택만 — staff 대행은 운영 판단).
    if (actor.role === 'customer') {
      const { data: bookingRow } = await supabase
        .from('bookings')
        .select('number_of_guests')
        .eq('id', targetBookingId)
        .maybeSingle();
      const cap = Math.max(1, (bookingRow as { number_of_guests?: number | null } | null)?.number_of_guests ?? 1);
      if (seats.length > cap) {
        return NextResponse.json({ error: 'party_size_exceeded', partySize: cap }, { status: 400 });
      }
    }

    // 기존 배정 검사: 체크인/노쇼/잠금 좌석이 있으면 재배치 금지 (C-11).
    const existing = (await loadAssignments(supabase, [roomVehicleId])).filter(
      (a: SeatAssignmentRow) => a.booking_id === targetBookingId,
    );
    if (existing.some((a) => a.checked_in_at || a.absent_at || a.locked)) {
      return NextResponse.json({ error: 'seats_locked_or_resolved' }, { status: 400 });
    }

    // 교체 배정: 기존 행 삭제 → 새 행 삽입. UNIQUE(room_vehicle_id,
    // seat_number)가 레이스의 최종 심판 — 후착은 23505 → 409 (C-10).
    if (existing.length > 0) {
      const { error: deleteError } = await supabase
        .from('ops_seat_assignments')
        .delete()
        .eq('room_vehicle_id', roomVehicleId)
        .eq('booking_id', targetBookingId)
        .is('checked_in_at', null)
        .is('absent_at', null)
        .eq('locked', false);
      if (deleteError) throw deleteError;
    }

    const { error: insertError } = await supabase.from('ops_seat_assignments').insert(
      seats.map((s) => ({
        room_vehicle_id: roomVehicleId,
        booking_id: targetBookingId,
        // participant는 디바이스 단위, 좌석은 booking 단위 원장 (§5.6) —
        // 개별 participant 연결은 동행자 개별 등록(C-6 후속)에서 채운다.
        participant_id: null,
        seat_number: s.seatNumber,
        guest_label: s.guestLabel,
      })),
    );
    if (insertError) {
      if (isUniqueViolation(insertError)) {
        // C-10 — 후착 409 + 최신 상태 반환 → 클라이언트 재선택 유도.
        return await stateResponse(supabase, roomId, targetBookingId, 409, { error: 'seat_taken' });
      }
      throw insertError;
    }

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: targetBookingId,
      type: 'seats_assigned',
      actorRole: actor.role === 'admin' ? 'admin' : actor.role,
      payload: {
        room_vehicle_id: roomVehicleId,
        seat_numbers: seats.map((s) => s.seatNumber),
        by_staff: isStaffActor(actor),
      },
    }).catch(() => undefined);

    await broadcastSeatUpdate(supabase, room, {
      roomVehicleId,
      bookingId: targetBookingId,
      seatNumbers: seats.map((s) => s.seatNumber),
      kind: 'assigned',
    });

    return await stateResponse(supabase, roomId, targetBookingId, 201);
  } catch (error) {
    console.error('POST /api/ops/rooms/[roomId]/seats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
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

    const roomVehicleId = String(body.roomVehicleId || '');
    if (!roomVehicleId) {
      return NextResponse.json({ error: 'roomVehicleId is required' }, { status: 400 });
    }

    let targetBookingId: string;
    if (actor.role === 'customer') {
      targetBookingId = actor.bookingId;
      if (seatChangeLockedForCustomer(room.tour_date)) {
        return NextResponse.json({ error: 'seat_change_locked' }, { status: 400 });
      }
    } else {
      targetBookingId = String(body.bookingId || '');
      if (!targetBookingId) {
        return NextResponse.json({ error: 'bookingId is required for staff release' }, { status: 400 });
      }
    }

    const vehicles = await loadRoomVehicles(supabase, roomId);
    if (!vehicles.some((v) => v.id === roomVehicleId)) {
      return NextResponse.json({ error: 'vehicle_not_in_room' }, { status: 404 });
    }

    const seatNumbers = Array.isArray(body.seatNumbers)
      ? body.seatNumbers.map(Number).filter((n: number) => Number.isInteger(n))
      : null;

    let query = supabase
      .from('ops_seat_assignments')
      .delete()
      .eq('room_vehicle_id', roomVehicleId)
      .eq('booking_id', targetBookingId)
      .is('checked_in_at', null)
      .is('absent_at', null)
      .eq('locked', false);
    if (seatNumbers && seatNumbers.length > 0) query = query.in('seat_number', seatNumbers);
    const { error: deleteError } = await query;
    if (deleteError) throw deleteError;

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: targetBookingId,
      type: 'seats_released',
      actorRole: actor.role === 'admin' ? 'admin' : actor.role,
      payload: { room_vehicle_id: roomVehicleId, seat_numbers: seatNumbers ?? 'all' },
    }).catch(() => undefined);

    await broadcastSeatUpdate(supabase, room, {
      roomVehicleId,
      bookingId: targetBookingId,
      seatNumbers,
      kind: 'released',
    });

    return await stateResponse(supabase, roomId, targetBookingId);
  } catch (error) {
    console.error('DELETE /api/ops/rooms/[roomId]/seats error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
