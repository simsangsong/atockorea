import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { kstToday } from '@/lib/tour-room/time';
import { buildRoomMonth, MONTHLY_ROOM_SCAN_LIMIT, type RoomMonthInputs } from '@/lib/ops/rooms/monthly';

export const dynamic = 'force-dynamic';

/**
 * 투어룸 생성 내역 — 월 범위 (관제 W3).
 *
 * GET /api/admin/tour-ops/rooms/monthly?period=YYYY-MM
 *
 * 기존 `/rooms?date=`는 하루치 운영 화면용이라 메시지 원문까지 끌어온다. 이쪽은
 * "이번 달에 몇 개 방이 열렸고, 몇 개가 아무도 안 들어온 채 죽어 있나"를 보는
 * 원장이므로 **집계만** 한다 — 메시지 본문은 조회하지 않는다(월 단위로 본문을
 * 끌면 응답이 수 MB가 되고, 화면은 그것을 하나도 쓰지 않는다).
 *
 * 스캔 상한에 닿으면 `truncated: true`를 함께 돌려준다. 조용히 잘라낸 집계는
 * "이번 달 메시지 5000건"처럼 그럴듯하게 틀린 숫자가 되고, 그 숫자를 보고
 * 판단이 내려진다.
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const period = req.nextUrl.searchParams.get('period') || kstToday().slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json({ error: 'period=YYYY-MM 가 필요합니다' }, { status: 400 });
    }

    const [year, month] = period.split('-').map(Number);
    const lastDay = new Date(Date.UTC(month === 12 ? year + 1 : year, month === 12 ? 0 : month, 0)).getUTCDate();
    const first = `${period}-01`;
    const last = `${period}-${String(lastDay).padStart(2, '0')}`;

    const { data: rooms, error } = await supabase
      .from('tour_rooms')
      .select('id, booking_id, tour_id, tour_date, status, created_at, updated_at')
      .gte('tour_date', first)
      .lte('tour_date', last)
      .order('tour_date', { ascending: true })
      .limit(2000);
    if (error) {
      console.error('[GET /api/admin/tour-ops/rooms/monthly]', error);
      return NextResponse.json({ error: '투어룸을 불러오지 못했습니다', details: error.message }, { status: 500 });
    }

    const roomRows = (rooms ?? []) as RoomMonthInputs['rooms'];
    const roomIds = roomRows.map((r) => r.id);
    const bookingIds = [...new Set(roomRows.map((r) => r.booking_id).filter(Boolean))] as string[];
    const tourIds = [...new Set(roomRows.map((r) => r.tour_id).filter(Boolean))] as string[];

    const empty = { data: [] as never[] };
    const [bookingsRes, toursRes, participantsRes, messagesRes, invitesRes] = await Promise.all([
      bookingIds.length
        ? supabase
            .from('bookings')
            .select('id, contact_name, number_of_guests, preferred_language, status, booking_reference, source')
            .in('id', bookingIds)
        : Promise.resolve(empty),
      tourIds.length ? supabase.from('tours').select('id, title, city').in('id', tourIds) : Promise.resolve(empty),
      roomIds.length
        ? supabase
            .from('tour_room_participants')
            .select('room_id, role, last_seen_at')
            .in('room_id', roomIds)
            .limit(MONTHLY_ROOM_SCAN_LIMIT)
        : Promise.resolve(empty),
      roomIds.length
        ? supabase
            .from('tour_room_messages')
            .select('room_id, sender_role, created_at')
            .in('room_id', roomIds)
            .order('created_at', { ascending: false })
            .limit(MONTHLY_ROOM_SCAN_LIMIT)
        : Promise.resolve(empty),
      // 초대는 room_id가 아니라 booking_id로 걸린다(실스키마 확인).
      bookingIds.length
        ? supabase
            .from('tour_room_invites')
            .select('booking_id, revoked_at, expires_at')
            .in('booking_id', bookingIds)
            .limit(MONTHLY_ROOM_SCAN_LIMIT)
        : Promise.resolve(empty),
    ]);

    const result = buildRoomMonth({
      period,
      rooms: roomRows,
      bookings: (bookingsRes.data ?? []) as RoomMonthInputs['bookings'],
      tours: (toursRes.data ?? []) as RoomMonthInputs['tours'],
      participants: (participantsRes.data ?? []) as RoomMonthInputs['participants'],
      messages: (messagesRes.data ?? []) as RoomMonthInputs['messages'],
      invites: (invitesRes.data ?? []) as RoomMonthInputs['invites'],
    });

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/tour-ops/rooms/monthly]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
