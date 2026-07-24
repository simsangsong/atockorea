import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { kstToday } from '@/lib/tour-room/time';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { resolveOpsRoomActor, isStaffActor } from '@/lib/ops/seating/access';
import { loadRoomVehicles, loadAssignments, broadcastSeatUpdate } from '@/lib/ops/seating/service';
import { mintCheckinNonce, verifyCheckinNonce } from '@/lib/ops/seating/qrNonce';
import { signRoomCheckinToken, verifyRoomCheckinToken, buildCheckinUrls } from '@/lib/ops/seating/checkinToken';

export const dynamic = 'force-dynamic';

/**
 * 체크인 — AtoC 통합 플랜 §5.4 (C-12~C-14) + §5.4c QR 원탭 (D16).
 *
 * GET  (staff 전용) 룸 체크인 QR 발급:
 *      콘솔용 = roomCheckinToken + 5분 로테이션 nonce / 인쇄용 = 정적(nonce
 *      없음 — 개인 토큰만으로 보안, 플랜 Q-1 문서화된 트레이드오프).
 *
 * POST 3경로 공통 수렴 (C-13):
 *   { method: 'guest_app' }                                  — 개인 토큰 + 당일(KST)
 *   { method: 'guest_qr', checkinToken, nonce? }             — 개인 토큰 + QR 검증
 *       nonce 제공 시 반드시 유효해야 함(5분 로테이션 만료 → 403 nonce_expired);
 *       미제공 = 인쇄 정적 QR 경로 (checkinToken 필수).
 *   { method: 'guest_qr_auto', checkinToken, nonce }         — §K B5 자동 체크인
 *       🔴 nonce **필수**. 정적 QR로는 자동이 성립하지 않는다(B5-D1): 차량 외부
 *       인쇄 QR은 인도에서도 스캔되므로 자동이면 타지 않은 사람이 탑승으로
 *       기록되고, 시작 게이트가 빈자리를 안은 채 열린다.
 *       actor를 따로 기록해(B5-D5) "자동이 오작동했나"를 데이터로 판정한다.
 *   { method: 'guest_qr_auto', action: 'undo' }              — B5-D2 즉시 되돌리기
 *       자기 예약의 좌석 중 **자동으로 체크인된 것만** 되돌린다.
 *   { method: 'guide_manual', roomVehicleId, seatNumber, action?: 'checkin'|'undo' }
 *       — 가이드/기사/admin 토큰. 스마트폰 없는 게스트 (C-13③), actor 감사 기록.
 *   guest 경로 공통: seatNumbers?: number[] — party 일부만 체크인(§5.4c 3).
 *       생략 시 본인 booking의 미해결 좌석 전부 (lead 일괄 — C-6).
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
    const { room, actor } = resolved;
    if (!isStaffActor(actor)) {
      return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
    }
    if (!room.tour_date) {
      return NextResponse.json({ error: 'room_has_no_tour_date' }, { status: 400 });
    }

    const { token } = signRoomCheckinToken({
      roomId: room.id,
      tourId: room.tour_id,
      tourDate: room.tour_date,
    });
    const { nonce, rotatesInSec } = mintCheckinNonce(room.id);
    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    const urls = buildCheckinUrls(origin, token, nonce);

    return NextResponse.json({
      checkinToken: token,
      nonce,
      rotatesInSec,
      consoleUrl: urls.consoleUrl, // QR로 렌더 — rotatesInSec마다 재호출
      staticUrl: urls.staticUrl, // 인쇄용 — nonce 없음 (Q-1)
    });
  } catch (error) {
    console.error('GET /api/ops/rooms/[roomId]/checkin error:', error);
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
    const body = await req.json().catch(() => ({}));

    const resolved = await resolveOpsRoomActor(req, supabase, roomId);
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { room, actor } = resolved;

    const method = String(body.method || '');
    const vehicles = await loadRoomVehicles(supabase, roomId);
    const vehicleIds = vehicles.map((v) => v.id);

    // ── guide_manual — staff가 좌석판에서 특정 좌석 탭 (C-13③) ──────────
    if (method === 'guide_manual') {
      if (!isStaffActor(actor)) {
        return NextResponse.json({ error: 'Guide, driver, or admin only' }, { status: 403 });
      }
      const roomVehicleId = String(body.roomVehicleId || '');
      const seatNumber = Number(body.seatNumber);
      const action = body.action === 'undo' ? 'undo' : 'checkin';
      if (!vehicleIds.includes(roomVehicleId) || !Number.isInteger(seatNumber)) {
        return NextResponse.json({ error: 'roomVehicleId and seatNumber are required' }, { status: 400 });
      }

      const rows = await loadAssignments(supabase, [roomVehicleId]);
      const target = rows.find((a) => a.seat_number === seatNumber);
      if (!target) return NextResponse.json({ error: 'seat_not_assigned' }, { status: 404 });
      if (target.absent_at && action === 'checkin') {
        return NextResponse.json({ error: 'seat_marked_absent' }, { status: 400 });
      }

      const patch =
        action === 'checkin'
          ? { checked_in_at: new Date().toISOString(), checkin_actor: 'guide_manual' }
          : { checked_in_at: null, checkin_actor: null };
      const { error: updateError } = await supabase
        .from('ops_seat_assignments')
        .update(patch)
        .eq('id', target.id);
      if (updateError) throw updateError;

      await recordRoomEvent(supabase, {
        roomId: room.id,
        bookingId: target.booking_id,
        type: action === 'checkin' ? 'seat_checkin' : 'seat_checkin_undo',
        actorRole: actor.role === 'admin' ? 'admin' : actor.role,
        payload: { room_vehicle_id: roomVehicleId, seat_numbers: [seatNumber], method: 'guide_manual' },
      }).catch(() => undefined);
      await broadcastSeatUpdate(supabase, room, {
        roomVehicleId,
        bookingId: target.booking_id,
        seatNumbers: [seatNumber],
        kind: action === 'checkin' ? 'checked_in' : 'checkin_undone',
      });

      return NextResponse.json({ ok: true, seatNumbers: [seatNumber], action });
    }

    // ── guest_app / guest_qr / guest_qr_auto — 게스트 셀프 체크인 ────────
    if (method !== 'guest_app' && method !== 'guest_qr' && method !== 'guest_qr_auto') {
      return NextResponse.json({ error: 'unknown_method' }, { status: 400 });
    }
    if (actor.role !== 'customer') {
      return NextResponse.json({ error: 'personal_token_required' }, { status: 403 });
    }

    // C-12 — 체크인 오픈: tour_date 당일 00:00 KST부터.
    if (!room.tour_date || kstToday() !== room.tour_date) {
      return NextResponse.json({ error: 'checkin_not_open', tourDate: room.tour_date }, { status: 403 });
    }

    const guestUndo = method === 'guest_qr_auto' && body.action === 'undo';

    if (method === 'guest_qr' || (method === 'guest_qr_auto' && !guestUndo)) {
      // QR 소지 증명: checkinToken 필수 + (있다면) nonce는 유효해야 한다.
      const qrPayload = verifyRoomCheckinToken(body.checkinToken);
      if (!qrPayload || qrPayload.roomId !== room.id) {
        return NextResponse.json({ error: 'invalid_checkin_token' }, { status: 403 });
      }
      const hasNonce = body.nonce !== undefined && body.nonce !== null && body.nonce !== '';
      // 🔴 B5-D1 — 자동 경로는 nonce가 **없으면 거부**한다. guest_qr의 "미제공 =
      // 정적 QR 허용" 완화가 여기까지 오면 자동 체크인의 전제가 무너진다.
      if (method === 'guest_qr_auto' && !hasNonce) {
        return NextResponse.json({ error: 'nonce_required_for_auto' }, { status: 403 });
      }
      if (hasNonce && !verifyCheckinNonce(room.id, body.nonce)) {
        return NextResponse.json({ error: 'nonce_expired' }, { status: 403 });
      }
      // nonce 부재 = 인쇄 정적 QR 경로 (Q-1 — 개인 토큰이 신원을 보증).
    }

    const bookingId = actor.bookingId;
    const mine = (await loadAssignments(supabase, vehicleIds)).filter((a) => a.booking_id === bookingId);
    if (mine.length === 0) return NextResponse.json({ error: 'no_seats' }, { status: 400 });

    // ── B5-D2 즉시 되돌리기 ──────────────────────────────────────────────
    // 🔴 손님이 되돌릴 수 있는 것은 **자동으로 체크인된 좌석뿐**이다.
    // 규칙이 좁아야 하는 이유: 손님이 자기 의사로 누른 체크인(guest_qr/guest_app)이나
    // 가이드가 대신 해준 체크인(guide_manual)까지 손님이 지울 수 있으면,
    // 시작 게이트가 근거로 삼는 탑승 기록이 손님 쪽에서 흔들린다.
    // 자동은 시스템이 대신 단언한 것이므로 정정 권한이 손님에게 있다.
    if (guestUndo) {
      const undoable = mine.filter((a) => a.checked_in_at && a.checkin_actor === 'guest_qr_auto');
      const requestedUndo = Array.isArray(body.seatNumbers)
        ? new Set(body.seatNumbers.map(Number).filter((n: number) => Number.isInteger(n)))
        : null;
      const targets = requestedUndo ? undoable.filter((a) => requestedUndo.has(a.seat_number)) : undoable;
      if (targets.length === 0) {
        return NextResponse.json({ error: 'nothing_to_undo' }, { status: 400 });
      }
      const { error: undoError } = await supabase
        .from('ops_seat_assignments')
        .update({ checked_in_at: null, checkin_actor: null })
        .in(
          'id',
          targets.map((a) => a.id),
        );
      if (undoError) throw undoError;

      const undoneSeats = targets.map((a) => a.seat_number);
      await recordRoomEvent(supabase, {
        roomId: room.id,
        bookingId,
        type: 'seat_checkin',
        actorRole: 'customer',
        payload: { seat_numbers: undoneSeats, method: 'guest_qr_auto', action: 'undo' },
      }).catch(() => undefined);
      // 되돌린 좌석이 즉시 가이드 좌석판에 반영되어야 한다(B5.2 판정).
      await broadcastSeatUpdate(supabase, room, {
        bookingId,
        seatNumbers: undoneSeats,
        kind: 'checkin_undone',
      });
      return NextResponse.json({ ok: true, undone: true, seatNumbers: undoneSeats });
    }

    const requested = Array.isArray(body.seatNumbers)
      ? new Set(body.seatNumbers.map(Number).filter((n: number) => Number.isInteger(n)))
      : null;
    const pending = mine.filter(
      (a) => !a.checked_in_at && !a.absent_at && (!requested || requested.has(a.seat_number)),
    );

    if (pending.length === 0) {
      const already = mine.filter((a) => a.checked_in_at).map((a) => a.seat_number);
      // 멱등 재스캔 (§5.4c Q-4 — "이미 체크인 ✓") — 에러가 아니다.
      return NextResponse.json({ ok: true, alreadyCheckedIn: true, seatNumbers: already });
    }

    const now = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('ops_seat_assignments')
      .update({ checked_in_at: now, checkin_actor: method })
      .in(
        'id',
        pending.map((a) => a.id),
      );
    if (updateError) throw updateError;

    const seatNumbers = pending.map((a) => a.seat_number);
    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId,
      type: 'seat_checkin',
      actorRole: 'customer',
      payload: { seat_numbers: seatNumbers, method },
    }).catch(() => undefined);
    await broadcastSeatUpdate(supabase, room, {
      bookingId,
      seatNumbers,
      kind: 'checked_in',
    });

    return NextResponse.json({ ok: true, seatNumbers, checkedInAt: now });
  } catch (error) {
    console.error('POST /api/ops/rooms/[roomId]/checkin error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
