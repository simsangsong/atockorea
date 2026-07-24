import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { ensureRoom } from '@/lib/tour-room/access';
import { hashToken, signCompanionRoomToken } from '@/lib/tour-room/token';
import { verifyCompanionInviteToken } from '@/lib/tour-room/companionToken';
import { companionFullMessage, companionSlots } from '@/lib/tour-room/companion';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';

export const dynamic = 'force-dynamic';

/**
 * §5.2 C-6 — 동행자 초대 링크 redeem (두 번째 디바이스 등록).
 *
 * POST /api/tour-rooms/[bookingId]/companion-invite/redeem
 *   { inviteToken, deviceKey, displayName?, locale? }
 *   → tour_room_participants 행 1개(is_lead=false) + 그 디바이스 전용
 *     booking-scope 개인 토큰. 이후 동행자는 룸의 온전한 구성원이다
 *     (자기 채팅 신원 · 자기 체크인 · 자기 푸시 구독).
 *
 * 가드레일 (플랜 §5.2 C-6):
 *   · 링크는 예약 1건에만 유효 — payload.bookingId ≠ 경로 [bookingId]면 403.
 *   · 만료 = 투어일 + 1 (룸 claim 링크와 동일, verifyCompanionInviteToken).
 *   · 폐기 = tour_room_invites.revoked_at (claim 라우트와 같은 원장).
 *   · 정원 = bookings.number_of_guests. 초과는 500이 아니라 409 + 사람 문장.
 *   · lead 승격 없음 — 발급 토큰은 companion 표식을 달고, join 라우트가
 *     그 표식을 보고 승격 경로를 건너뛴다.
 *
 * 멱등: 같은 디바이스가 링크를 다시 열면(새로고침·재공유) 기존 participant를
 * 그대로 재사용하고 토큰만 재발급한다 — 자리를 새로 먹지 않는다.
 *
 * 🔴 대외 액션 없음.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface CompanionBookingRow {
  id: string;
  tour_id: string | null;
  tour_date: string | null;
  status: string | null;
  contact_name: string | null;
  preferred_language: string | null;
  number_of_guests: number | null;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));

    const gate = await requestGate({
      namespace: 'tour_room_companion_redeem',
      key: clientIpKey(req.headers),
      perMinute: 10,
      perHour: 40,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const inviteToken = typeof body.inviteToken === 'string' ? body.inviteToken : null;
    const payload = verifyCompanionInviteToken(inviteToken);
    if (!payload || payload.bookingId !== bookingId) {
      // 만료·위조·다른 예약의 링크를 구분해 알리지 않는다 (탐색 방지).
      return NextResponse.json({ error: 'invalid_companion_token' }, { status: 403 });
    }

    const deviceKey = String(body.deviceKey || body.device_key || '');
    if (!UUID_RE.test(deviceKey)) {
      return NextResponse.json({ error: 'deviceKey (uuid) is required' }, { status: 400 });
    }

    // 폐기 원장 (lead가 링크를 무를 수 있는 유일한 경로).
    const { data: ledger } = await supabase
      .from('tour_room_invites')
      .select('id, revoked_at')
      .eq('token_hash', hashToken(inviteToken as string))
      .maybeSingle();
    if ((ledger as { revoked_at?: string | null } | null)?.revoked_at) {
      return NextResponse.json({ error: 'companion_token_revoked' }, { status: 403 });
    }

    const { data: bookingRaw } = await supabase
      .from('bookings')
      .select('id, tour_id, tour_date, status, contact_name, preferred_language, number_of_guests')
      .eq('id', bookingId)
      .maybeSingle();
    const booking = bookingRaw as CompanionBookingRow | null;
    if (!booking) return NextResponse.json({ error: 'booking_not_found' }, { status: 404 });
    if (booking.status === 'cancelled') {
      return NextResponse.json({ error: 'booking_cancelled' }, { status: 409 });
    }
    // 스코프 무결성: 토큰이 각인한 투어일과 예약의 투어일이 어긋나면 거절
    // (예약일이 옮겨졌다면 옛 링크는 옛 만료를 들고 있으므로 재발급이 맞다).
    if (!booking.tour_date || booking.tour_date !== payload.tourDate) {
      return NextResponse.json({ error: 'companion_scope_mismatch' }, { status: 403 });
    }

    const room = await ensureRoom(supabase, booking);
    const locale = normalizeRoomLocale(body.locale, normalizeRoomLocale(booking.preferred_language));

    const { data: existingRows } = await supabase
      .from('tour_room_participants')
      .select('id, device_key, is_lead')
      .eq('room_id', room.id)
      .eq('role', 'customer');
    const existing = (existingRows as Array<{ id: string; device_key: string; is_lead: boolean }> | null) ?? [];
    const mine = existing.find((p) => p.device_key === deviceKey) ?? null;

    // 정원 검사는 "새 자리를 먹는" 경우에만 (재방문은 통과 — 멱등).
    const slots = companionSlots(booking.number_of_guests, existing.length);
    if (!mine && slots.full) {
      return NextResponse.json(
        { error: 'party_full', slots, message: companionFullMessage(locale) },
        { status: 409 },
      );
    }

    const displayName =
      String(body.displayName || '').trim().slice(0, 80) ||
      (booking.contact_name ? `${booking.contact_name} 일행` : 'Guest');

    const { data: participant, error: participantError } = await supabase
      .from('tour_room_participants')
      .upsert(
        {
          room_id: room.id,
          booking_id: booking.id,
          role: 'customer',
          user_id: null,
          display_name: displayName,
          locale,
          device_key: deviceKey,
          // C-6 — 동행자는 절대 lead가 아니다. 재방문 시에도 false로 못박는다.
          is_lead: false,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'room_id,device_key' },
      )
      .select()
      .single();
    if (participantError) throw participantError;

    const { token, payload: tokenPayload } = signCompanionRoomToken({
      bookingId: booking.id,
      displayName,
      tourDate: booking.tour_date,
    });

    // 개인 토큰 원장 — 폐기 경로는 lead/게스트 토큰과 동일 (access.ts가 검사).
    const { error: tokenLedgerError } = await supabase.from('tour_room_invites').insert({
      booking_id: booking.id,
      role: 'customer',
      token_hash: hashToken(token),
      display_name: displayName,
      sent_via: 'manual',
      expires_at: new Date(tokenPayload.exp * 1000).toISOString(),
    });
    if (tokenLedgerError) throw tokenLedgerError;

    await recordRoomEvent(supabase, {
      roomId: room.id,
      bookingId: booking.id,
      type: 'companion_joined',
      actorRole: 'customer',
      actorParticipantId: (participant as { id?: string }).id ?? null,
      subjectKey: `companion:${booking.id}:${deviceKey}`,
      payload: { device_key: deviceKey },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        token,
        expiresAt: tokenPayload.exp,
        bookingId: booking.id,
        roomId: room.id,
        participantId: (participant as { id?: string }).id ?? null,
        displayName,
        isLead: false,
        slots: companionSlots(booking.number_of_guests, mine ? existing.length : existing.length + 1),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/companion-invite/redeem error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
