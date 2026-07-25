import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { kstToday } from '@/lib/tour-room/time';
import { buildXlsx, xlsxDownloadHeaders } from '@/lib/ops/export/xlsx';
import { aoaToCsv, UTF8_BOM } from '@/lib/ops/tax/forms';
import {
  buildRoomMonth,
  roomMonthToAoa,
  MONTHLY_ROOM_SCAN_LIMIT,
  ROOM_HEALTH_LABEL,
  type RoomMonthInputs,
} from '@/lib/ops/rooms/monthly';

export const dynamic = 'force-dynamic';

/**
 * 투어룸 생성 내역 내보내기 (관제 W3 + W6).
 *
 * GET /api/admin/tour-ops/rooms/monthly/export?period=YYYY-MM&format=xlsx|csv
 *
 * xlsx는 두 장이다 — [요약]과 [상세]. 요약만 보고 판단하는 사람과 근거를
 * 확인하는 사람이 다르고, 두 파일로 나누면 둘이 어긋난다.
 */

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const period = req.nextUrl.searchParams.get('period') || kstToday().slice(0, 7);
    const format = req.nextUrl.searchParams.get('format') === 'csv' ? 'csv' : 'xlsx';
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
      console.error('[GET rooms/monthly/export]', error);
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

    const detail = roomMonthToAoa(result);

    if (format === 'csv') {
      const body = UTF8_BOM + aoaToCsv([[`투어룸 생성 내역 ${period}`], [], ...detail]);
      return new NextResponse(body, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="atockorea-rooms-${period}.csv"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    const summary: Array<Array<string | number>> = [
      ['항목', '값'],
      ['대상 기간', period],
      ['생성된 방', result.summary.roomCount],
      ['예약 인원 합계', result.summary.guestTotal],
      [`${ROOM_HEALTH_LABEL.active} 방`, result.summary.activeCount],
      [`${ROOM_HEALTH_LABEL.quiet} 방`, result.summary.quietCount],
      [`${ROOM_HEALTH_LABEL.dead} 방`, result.summary.deadCount],
      [`${ROOM_HEALTH_LABEL.closed} 방`, result.summary.closedCount],
      ['메시지 합계', result.summary.messageTotal],
    ];
    if (result.truncated) {
      // 잘렸다는 사실을 파일 안에 남긴다 — 화면에서만 경고하면 파일을 받아
      // 다른 사람에게 넘긴 순간 그 경고가 사라진다.
      summary.push([], ['⚠ 주의', '하위 데이터가 조회 상한에 닿아 메시지·참가자 수는 최소값입니다.']);
    }

    const file = buildXlsx([
      { name: '요약', rows: summary, headerRowIndex: 0 },
      { name: '상세', rows: detail, headerRowIndex: 0 },
    ]);

    return new NextResponse(new Uint8Array(file), {
      headers: xlsxDownloadHeaders(`atockorea-rooms-${period}.xlsx`),
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET rooms/monthly/export]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
