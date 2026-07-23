import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { ensureRoom } from '@/lib/tour-room/access';
import { hashToken, signCustomerRoomToken } from '@/lib/tour-room/token';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { verifyRoomClaimToken } from '@/lib/ops/seating/claimToken';
import { maskGuestName, verifyClaimAnswer } from '@/lib/ops/seating/claim';
import { getOpsRoom } from '@/lib/ops/seating/access';

export const dynamic = 'force-dynamic';

/**
 * 조인투어 게스트 claim — AtoC 통합 플랜 §5.2 (C-1~C-5).
 *
 * GET  /api/ops/rooms/[roomId]/claim?ct={roomClaimToken}
 *   마스킹 명단 (C-1 PII 최소화: "Massimo C." + 인원 + claimed 여부만).
 *
 * POST /api/ops/rooms/[roomId]/claim
 *   { claimToken, bookingId, deviceKey, answer: { emailTail? | partySize? },
 *     displayName?, locale? }
 *   이름 선택 + 확인 질문(C-2) → 미claim이면 participant INSERT(is_lead) +
 *   booking-scope 개인 토큰 mint + tour_room_invites 원장 (C-3).
 *   이미 claim된 예약 → 409 + 'reclaim_requested' 이벤트 + ops 푸시 (C-5 —
 *   운영자 승인 큐; 기존 디바이스 토큰 폐기는 승인 시 ops가 수행).
 *
 * 클라이언트 계약 (C-4): 응답 token을 localStorage `ops_personal_tokens`
 * (JSON 배열, 최신 우선)에 저장 — /tour-mode/checkin/[token] 랜딩(§5.4c)이
 * 이 키에서 자동 인식한다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

type DbClient = ReturnType<typeof createServerClient>;

async function verifyClaimContext(
  supabase: DbClient,
  roomId: string,
  claimToken: string | null,
): Promise<
  | { ok: true; room: { id: string; tour_id: string; tour_date: string; booking_id: string; status: string } }
  | { ok: false; status: number; error: string }
> {
  const payload = verifyRoomClaimToken(claimToken);
  if (!payload || payload.roomId !== roomId) {
    return { ok: false, status: 403, error: 'invalid_claim_token' };
  }
  // 폐기 원장 (role='room_claim' 행의 revoked_at).
  const { data: ledger } = await supabase
    .from('tour_room_invites')
    .select('id, revoked_at')
    .eq('token_hash', hashToken(claimToken as string))
    .maybeSingle();
  if ((ledger as { revoked_at?: string | null } | null)?.revoked_at) {
    return { ok: false, status: 403, error: 'claim_token_revoked' };
  }
  const room = await getOpsRoom(supabase, roomId);
  if (!room) return { ok: false, status: 404, error: 'room_not_found' };
  if (
    !room.tour_id ||
    !room.tour_date ||
    room.tour_id !== payload.tourId ||
    room.tour_date !== payload.tourDate
  ) {
    return { ok: false, status: 403, error: 'claim_scope_mismatch' };
  }
  return {
    ok: true,
    room: room as { id: string; tour_id: string; tour_date: string; booking_id: string; status: string },
  };
}

interface RosterBooking {
  id: string;
  tour_id: string | null;
  tour_date: string | null;
  status: string | null;
  contact_name: string | null;
  contact_email: string | null;
  number_of_guests: number | null;
}

async function loadRoster(
  supabase: DbClient,
  tourId: string,
  tourDate: string,
): Promise<RosterBooking[]> {
  const { data } = await supabase
    .from('bookings')
    .select('id, tour_id, tour_date, status, contact_name, contact_email, number_of_guests')
    .eq('tour_id', tourId)
    .eq('tour_date', tourDate)
    .neq('status', 'cancelled');
  return Array.isArray(data) ? (data as RosterBooking[]) : [];
}

async function claimedBookingIds(supabase: DbClient, bookingIds: string[]): Promise<Set<string>> {
  if (bookingIds.length === 0) return new Set();
  const { data } = await supabase
    .from('tour_room_participants')
    .select('booking_id')
    .in('booking_id', bookingIds)
    .eq('role', 'customer');
  const set = new Set<string>();
  for (const row of (data as Array<{ booking_id: string }> | null) ?? []) set.add(row.booking_id);
  return set;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomId: string }> },
) {
  try {
    const { roomId } = await params;
    const supabase = createServerClient();

    const gate = await requestGate({
      namespace: 'ops_room_claim_roster',
      key: clientIpKey(req.headers),
      perMinute: 30,
      perHour: 200,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const claimToken = req.nextUrl.searchParams.get('ct');
    const ctx = await verifyClaimContext(supabase, roomId, claimToken);
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const roster = await loadRoster(supabase, ctx.room.tour_id, ctx.room.tour_date);
    const claimed = await claimedBookingIds(supabase, roster.map((b) => b.id));

    return NextResponse.json({
      roomId,
      tourDate: ctx.room.tour_date,
      bookings: roster.map((b) => ({
        bookingId: b.id,
        // C-1 — 이름 마스킹 + 인원만. 연락처는 절대 미노출.
        name: maskGuestName(b.contact_name),
        partySize: Math.max(1, b.number_of_guests ?? 1),
        claimed: claimed.has(b.id),
      })),
    });
  } catch (error) {
    console.error('GET /api/ops/rooms/[roomId]/claim error:', error);
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

    const gate = await requestGate({
      namespace: 'ops_room_claim',
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

    const claimToken = typeof body.claimToken === 'string' ? body.claimToken : null;
    const ctx = await verifyClaimContext(supabase, roomId, claimToken);
    if (!ctx.ok) return NextResponse.json({ error: ctx.error }, { status: ctx.status });

    const bookingId = String(body.bookingId || '');
    const deviceKey = String(body.deviceKey || '');
    if (!bookingId || !UUID_RE.test(deviceKey)) {
      return NextResponse.json({ error: 'bookingId and deviceKey (uuid) are required' }, { status: 400 });
    }

    const roster = await loadRoster(supabase, ctx.room.tour_id, ctx.room.tour_date);
    const booking = roster.find((b) => b.id === bookingId);
    if (!booking) return NextResponse.json({ error: 'booking_not_in_room' }, { status: 404 });

    // C-2 — 확인 질문 (이메일 뒷자리 or 인원수). 오답은 무조건 403 —
    // 명단의 다른 정보가 새지 않도록 실패 사유를 세분하지 않는다.
    const answer = (body.answer ?? {}) as { emailTail?: string; partySize?: number };
    if (!verifyClaimAnswer(booking, answer)) {
      return NextResponse.json({ error: 'verification_failed' }, { status: 403 });
    }

    // C-5 — 이미 claim된 예약: 409 + 운영자 승인 큐 (이벤트 + ops 푸시).
    const claimed = await claimedBookingIds(supabase, [booking.id]);
    if (claimed.has(booking.id)) {
      const bookingRoom = await ensureRoom(supabase, booking);
      const reclaim = await recordRoomEvent(supabase, {
        roomId: bookingRoom.id,
        bookingId: booking.id,
        type: 'reclaim_requested',
        actorRole: 'system',
        subjectKey: `reclaim:${booking.id}:${deviceKey}`,
        payload: { device_key: deviceKey },
      }).catch(() => ({ inserted: false, event: null }));
      if (reclaim.inserted) {
        void sendOpsPush({
          title: '재등록 요청 (claim 충돌)',
          body: `${maskGuestName(booking.contact_name)} — 이미 등록된 예약에 다른 디바이스가 재등록을 요청했습니다. 승인 시 기존 토큰을 폐기하세요.`,
          tag: `reclaim-${booking.id}`,
        }).catch(() => undefined);
      }
      return NextResponse.json(
        { error: 'already_claimed', reviewQueued: true },
        { status: 409 },
      );
    }

    // C-3 — participant INSERT (is_lead=true) + 개인 토큰 mint + 원장 기록.
    const bookingRoom = await ensureRoom(supabase, booking);
    const displayName =
      String(body.displayName || '').trim().slice(0, 80) || maskGuestName(booking.contact_name);
    const locale = typeof body.locale === 'string' && body.locale ? String(body.locale).slice(0, 8) : 'en';

    const { data: participant, error: participantError } = await supabase
      .from('tour_room_participants')
      .upsert(
        {
          room_id: bookingRoom.id,
          booking_id: booking.id,
          role: 'customer',
          user_id: null,
          display_name: displayName,
          locale,
          device_key: deviceKey,
          is_lead: true,
          last_seen_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'room_id,device_key' },
      )
      .select()
      .single();
    if (participantError) throw participantError;

    const { token, payload } = signCustomerRoomToken({
      bookingId: booking.id,
      displayName,
      tourDate: ctx.room.tour_date,
    });

    // 원장 (기존 tour_room_invites — 폐기는 revoked_at, access.ts가 검사).
    const { error: ledgerError } = await supabase.from('tour_room_invites').insert({
      booking_id: booking.id,
      role: 'customer',
      token_hash: hashToken(token),
      display_name: displayName,
      sent_via: 'ops-link',
      expires_at: new Date(payload.exp * 1000).toISOString(),
    });
    if (ledgerError) throw ledgerError;

    await recordRoomEvent(supabase, {
      roomId: bookingRoom.id,
      bookingId: booking.id,
      type: 'guest_claimed',
      actorRole: 'customer',
      actorParticipantId: (participant as { id?: string }).id ?? null,
      subjectKey: `claim:${booking.id}:${deviceKey}`,
      payload: { device_key: deviceKey },
    }).catch(() => undefined);

    return NextResponse.json(
      {
        token,
        expiresAt: payload.exp,
        bookingId: booking.id,
        roomId: bookingRoom.id,
        participantId: (participant as { id?: string }).id ?? null,
        displayName,
        partySize: Math.max(1, booking.number_of_guests ?? 1),
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/ops/rooms/[roomId]/claim error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
