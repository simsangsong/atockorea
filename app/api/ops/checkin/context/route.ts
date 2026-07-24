import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { kstToday } from '@/lib/tour-room/time';
import { verifyRoomToken } from '@/lib/tour-room/token';
import { verifyRoomCheckinToken } from '@/lib/ops/seating/checkinToken';
import { verifyCheckinNonce } from '@/lib/ops/seating/qrNonce';
import { getOpsRoom } from '@/lib/ops/seating/access';
import { loadRoomVehicles, loadAssignments } from '@/lib/ops/seating/service';

export const dynamic = 'force-dynamic';

/**
 * QR 랜딩 컨텍스트 리졸버 — AtoC 통합 플랜 §5.4c (D16 원탭 플로우).
 *
 * POST { checkinToken, nonce?, tokens: string[] }  (부작용 없음 — 판정만)
 *
 * §K B5.1 — 응답의 `autoEligible`이 랜딩의 자동/탭 분기를 정한다. 정적 QR은
 * 기존 동작(탭 유지) 그대로다.
 *
 * 게스트가 룸 QR을 스캔하면 랜딩(/tour-mode/checkin/[token])이 디바이스에
 * 저장된 개인 토큰들(localStorage `ops_personal_tokens`)을 보내 상태를 받는다:
 *
 *   ready        — 인식 성공: 이름·좌석·party → [체크인 확인] 1탭
 *   already      — 전 좌석 체크인 완료 (멱등 ✓)
 *   no_seats     — claim은 됐으나 좌석 미지정 → 가이드 현장 지정 안내 (§5.4b)
 *   not_open     — tour_date 당일(KST) 아님 (C-12)
 *   no_token     — 저장 토큰 없음/전부 무효 → claim 폴백 안내 (Q-4)
 *   wrong_room   — 유효한 개인 토큰이 있으나 다른 투어/날짜 (Q-4)
 *   unregistered — 토큰의 예약이 취소/부재 → 클라이언트가 signal 라우트로
 *                  'unregistered_scan' 발신 (Q-4)
 *
 * matchedTokenIndex = 체크인 POST에 재사용할 tokens[] 인덱스.
 */

const MAX_TOKENS = 10;

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));

    const gate = await requestGate({
      namespace: 'ops_checkin_context',
      key: clientIpKey(req.headers),
      perMinute: 20,
      perHour: 120,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const qr = verifyRoomCheckinToken(body.checkinToken);
    if (!qr) return NextResponse.json({ error: 'invalid_qr' }, { status: 404 });

    const room = await getOpsRoom(supabase, qr.roomId);
    if (!room) return NextResponse.json({ error: 'invalid_qr' }, { status: 404 });

    const nonceProvided = typeof body.nonce === 'string' && body.nonce.length > 0;
    const nonceValid = nonceProvided ? verifyCheckinNonce(room.id, body.nonce) : null;

    const base = {
      roomId: room.id,
      tourDate: room.tour_date,
      nonceValid, // null = 정적 QR (nonce 없음)
      // §K B5-D1 — 🔴 자동 체크인은 **nonce가 유효한 QR에서만** 가능하다.
      //
      // 체크인은 "이 사람이 탑승했다"는 운영상 단언이다. 차량 외부에 붙는
      // 인쇄용 정적 QR은 인도에서도 스캔되므로, 자동이면 **타지 않은 사람이
      // 탑승으로 기록**되고 시작 게이트가 빈자리를 안은 채 열린다 — 노쇼/absent
      // 설계가 막으려던 바로 그 실패다. 가이드 콘솔 QR은 차 안 가이드 화면에만
      // 뜨므로 물리적 현장성이 5분 로테이션 nonce로 담보된다.
      //
      // 클라이언트가 nonceValid로 재유도하게 두지 않고 서버가 단언한다:
      // 판정이 두 곳에 살면 한쪽만 바뀌는 날이 온다.
      autoEligible: nonceValid === true,
    };

    const rawTokens: unknown[] = Array.isArray(body.tokens) ? body.tokens.slice(0, MAX_TOKENS) : [];
    let sawValidCustomerToken = false;
    let sawUnregistered = false;

    for (let i = 0; i < rawTokens.length; i++) {
      const payload = verifyRoomToken(rawTokens[i]);
      if (!payload || payload.scope !== 'booking') continue;
      sawValidCustomerToken = true;

      const { data } = await supabase
        .from('bookings')
        .select('id, tour_id, tour_date, status, number_of_guests')
        .eq('id', payload.bookingId)
        .maybeSingle();
      const booking = data as {
        id: string;
        tour_id: string | null;
        tour_date: string | null;
        status: string | null;
        number_of_guests: number | null;
      } | null;

      if (!booking || booking.status === 'cancelled') {
        sawUnregistered = true; // 명단에 없음 → 클라이언트가 signal 발신 (Q-4)
        continue;
      }

      const inScope =
        booking.id === room.booking_id ||
        (Boolean(room.tour_id) &&
          booking.tour_id === room.tour_id &&
          Boolean(room.tour_date) &&
          booking.tour_date === room.tour_date);
      if (!inScope) continue; // 다른 룸/날짜 후보 — 남은 토큰 계속 시도

      // 매칭 성공 — 좌석 로드.
      const vehicles = await loadRoomVehicles(supabase, room.id);
      const mine = (await loadAssignments(supabase, vehicles.map((v) => v.id))).filter(
        (a) => a.booking_id === booking.id,
      );

      if (!room.tour_date || kstToday() !== room.tour_date) {
        return NextResponse.json({ ...base, state: 'not_open', matchedTokenIndex: i });
      }
      if (mine.length === 0) {
        return NextResponse.json({
          ...base,
          state: 'no_seats',
          matchedTokenIndex: i,
          displayName: payload.displayName,
        });
      }
      const pending = mine.filter((a) => !a.checked_in_at && !a.absent_at);
      const seats = mine.map((a) => ({
        seatNumber: a.seat_number,
        guestLabel: a.guest_label,
        checkedIn: Boolean(a.checked_in_at),
        absent: Boolean(a.absent_at),
      }));
      if (pending.length === 0) {
        return NextResponse.json({
          ...base,
          state: 'already',
          matchedTokenIndex: i,
          displayName: payload.displayName,
          seats,
        });
      }
      return NextResponse.json({
        ...base,
        state: 'ready',
        matchedTokenIndex: i,
        displayName: payload.displayName,
        partySize: Math.max(1, booking.number_of_guests ?? 1),
        seats,
      });
    }

    if (sawUnregistered) return NextResponse.json({ ...base, state: 'unregistered' });
    if (sawValidCustomerToken) return NextResponse.json({ ...base, state: 'wrong_room' });
    return NextResponse.json({ ...base, state: 'no_token' });
  } catch (error) {
    console.error('POST /api/ops/checkin/context error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
