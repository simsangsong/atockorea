import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { isStaffActor, resolveOpsRoomActor } from '@/lib/ops/seating/access';
import type { RoomDbClient } from '@/lib/tour-room/access';
import { noteRoleFor, normalizeNote, type GuestNote } from '@/lib/ops/seating/guestNotes';

export const dynamic = 'force-dynamic';

/**
 * §K B4 — 명단 메모 (운영자 노트).
 *
 *   GET  /api/ops/rooms/[roomId]/notes            → 이 그룹의 메모 전부
 *   PUT  /api/ops/rooms/[roomId]/notes            { bookingId, note }
 *
 * 🔴 **손님은 읽지도 쓰지도 못한다.** 메모는 운영자가 손님에 대해 쓴 것이고
 * ("무릎이 안 좋으심"), 손님 화면에 새면 그 자체로 사고다. `isStaffActor`가
 * 유일한 게이트다 — 개인 토큰으로는 이 라우트에 들어올 수 없다.
 *
 * 🔴 B4-D1 — `needs`를 건드리지 않는다. 손님이 선언한 것과 운영자가 쓴 것이
 * 한 필드로 합쳐지면 알레르기 표시를 누가 말했는지 알 수 없어진다.
 *
 * 조회 범위가 룸 하나가 아니라 **그룹 전체**인 이유: 명단은 그룹 단위 화면이고,
 * 행마다 따로 부르면 12번 왕복한다.
 */

interface NoteRow {
  booking_id: string;
  note: string;
  updated_by_role: string;
  updated_by_name: string | null;
  updated_at: string;
}

function toGuestNote(row: NoteRow): GuestNote {
  return {
    bookingId: row.booking_id,
    note: row.note,
    updatedByRole: (row.updated_by_role as GuestNote['updatedByRole']) ?? 'admin',
    updatedByName: row.updated_by_name,
    updatedAt: row.updated_at,
  };
}

/** 이 룸이 속한 그룹의 예약 id 전부. 메모 조회·쓰기 권한의 경계다. */
async function groupBookingIds(
  supabase: RoomDbClient,
  room: { booking_id: string; tour_id: string | null; tour_date: string | null },
): Promise<string[]> {
  if (!room.tour_id || !room.tour_date) return [room.booking_id];
  const { data } = await supabase
    .from('bookings')
    .select('id')
    .eq('tour_id', room.tour_id)
    .eq('tour_date', room.tour_date);
  const ids = Array.isArray(data) ? (data as Array<{ id: string }>).map((b) => b.id) : [];
  return ids.length > 0 ? ids : [room.booking_id];
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient() as unknown as RoomDbClient;
    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    if (!isStaffActor(resolved.actor)) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    }

    const bookingIds = await groupBookingIds(supabase, resolved.room);
    const { data, error } = await supabase
      .from('ops_guest_notes')
      .select('booking_id, note, updated_by_role, updated_by_name, updated_at')
      .in('booking_id', bookingIds);
    // 테이블 미적용 환경에서는 메모 없이 명단이 그대로 뜬다 — 메모 하나 때문에
    // 명단 화면이 죽으면 안 된다(다른 ops_* 라우트와 같은 graceful degrade).
    if (error) return NextResponse.json({ notes: [] }, { status: 200 });

    return NextResponse.json({ notes: ((data ?? []) as NoteRow[]).map(toGuestNote) }, { status: 200 });
  } catch (error) {
    console.error('GET /api/ops/rooms/[roomId]/notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ roomId: string }> }) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient() as unknown as RoomDbClient;
    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    if (!isStaffActor(resolved.actor)) {
      return NextResponse.json({ error: 'Staff access required' }, { status: 403 });
    }
    const role = noteRoleFor(resolved.actor.role);
    if (!role) return NextResponse.json({ error: 'Staff access required' }, { status: 403 });

    const body = (await req.json().catch(() => ({}))) as { bookingId?: string; note?: string };
    const bookingId = typeof body.bookingId === 'string' ? body.bookingId : '';
    if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 });

    // 🔴 그룹 밖 예약에 메모를 달 수 없다. 가이드 토큰은 그날 그 투어 스코프이고,
    // 다른 날 손님에게 메모를 남기는 경로가 되면 안 된다.
    const bookingIds = await groupBookingIds(supabase, resolved.room);
    if (!bookingIds.includes(bookingId)) {
      return NextResponse.json({ error: 'Booking is not on this tour day' }, { status: 404 });
    }

    const note = normalizeNote(body.note);
    const displayName =
      'displayName' in resolved.actor && typeof resolved.actor.displayName === 'string'
        ? resolved.actor.displayName
        : null;

    // 빈 메모 = 삭제 의도(normalizeNote 계약). 지우기 버튼을 따로 만들지 않는다 —
    // 운전 중·승차 중에 되는 동작이어야 한다.
    if (note === null) {
      const { error } = await supabase.from('ops_guest_notes').delete().eq('booking_id', bookingId);
      if (error) throw error;
      return NextResponse.json({ note: null }, { status: 200 });
    }

    const row = {
      booking_id: bookingId,
      note,
      updated_by_role: role,
      updated_by_name: displayName,
      updated_at: new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from('ops_guest_notes')
      .upsert(row, { onConflict: 'booking_id' })
      .select('booking_id, note, updated_by_role, updated_by_name, updated_at')
      .single();
    if (error) throw error;

    return NextResponse.json({ note: toGuestNote(data as NoteRow) }, { status: 200 });
  } catch (error) {
    console.error('PUT /api/ops/rooms/[roomId]/notes error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
