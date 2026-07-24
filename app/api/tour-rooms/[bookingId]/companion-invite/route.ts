import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { isLeadGuest } from '@/lib/tour-room/lead';
import { hashToken } from '@/lib/tour-room/token';
import { signCompanionInviteToken } from '@/lib/tour-room/companionToken';
import { companionSlots } from '@/lib/tour-room/companion';

export const dynamic = 'force-dynamic';

/**
 * §5.2 C-6 — 동행자 초대 링크 발급.
 *
 * GET  /api/tour-rooms/[bookingId]/companion-invite
 *   정원 현황만 (lead의 설정 카드가 "N자리 남음"을 그리는 데 씀).
 *
 * POST /api/tour-rooms/[bookingId]/companion-invite
 *   lead 전용. 이 예약 하나만 여는 서명 링크를 발급하고 tour_room_invites에
 *   role='companion' 원장 행을 남긴다(폐기·감사). 만료 = 투어일 + 1.
 *
 * lead 판정은 lib/tour-room/lead.ts 단일 권위 — 동행자(participant.is_lead=
 * false)는 여기서 403이므로 초대 링크를 다시 뿌릴 수 없다(무한 증식 차단).
 *
 * 🔴 대외 액션 없음: 링크를 만들어 돌려줄 뿐 아무것도 발송하지 않는다.
 *    공유는 사람이 자기 메신저로 한다.
 */

interface BookingCapacityRow {
  number_of_guests: number | null;
}

async function loadSlots(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
  roomId: string | null,
) {
  const { data: bookingRow } = await supabase
    .from('bookings')
    .select('number_of_guests')
    .eq('id', bookingId)
    .maybeSingle();

  let used = 0;
  if (roomId) {
    const { data: participants } = await supabase
      .from('tour_room_participants')
      .select('id')
      .eq('room_id', roomId)
      .eq('role', 'customer');
    used = Array.isArray(participants) ? participants.length : 0;
  }
  return companionSlots((bookingRow as BookingCapacityRow | null)?.number_of_guests ?? null, used);
}

async function roomIdFor(
  supabase: ReturnType<typeof createServerClient>,
  bookingId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('tour_rooms')
    .select('id')
    .eq('booking_id', bookingId)
    .maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });

    const lead = resolved.actor.role === 'customer' && (await isLeadGuest(supabase, resolved.actor));
    const slots = await loadSlots(supabase, bookingId, await roomIdFor(supabase, bookingId));
    return NextResponse.json({ is_lead: lead, slots });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/companion-invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    const { booking, actor, authUserId } = resolved;

    // Lead 전용 (P-D13). 동행자·게스트·스태프 전부 여기서 막힌다.
    if (actor.role !== 'customer' || !(await isLeadGuest(supabase, actor))) {
      return NextResponse.json({ error: 'lead_guest_only' }, { status: 403 });
    }
    if (!booking.tour_date) {
      return NextResponse.json({ error: 'Booking has no tour_date' }, { status: 400 });
    }

    // 링크 남발 방지 — 예약 단위 게이트(공유 IP 뒤의 다른 예약을 말려들게 하지 않는다).
    const gate = await requestGate({
      namespace: 'tour_room_companion_invite',
      key: `booking:${booking.id}`,
      perMinute: 3,
      perHour: 12,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited', retry_after_ms: gate.retryAfterMs ?? 0 },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const slots = await loadSlots(supabase, booking.id, await roomIdFor(supabase, booking.id));
    if (slots.full) {
      // 정원이 찼으면 링크 자체를 만들지 않는다 — 못 쓸 링크를 쥐여주지 않는다.
      return NextResponse.json({ error: 'party_full', slots }, { status: 409 });
    }

    const { token, payload } = signCompanionInviteToken({
      bookingId: booking.id,
      tourDate: booking.tour_date,
    });

    const { error: ledgerError } = await supabase.from('tour_room_invites').insert({
      booking_id: booking.id,
      role: 'companion',
      token_hash: hashToken(token),
      display_name: booking.contact_name ?? null,
      sent_via: 'manual',
      expires_at: new Date(payload.exp * 1000).toISOString(),
      created_by: authUserId,
    });
    if (ledgerError) throw ledgerError;

    const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
    return NextResponse.json(
      {
        url: `${origin}/tour-mode/companion/${encodeURIComponent(token)}`,
        expires_at: payload.exp,
        slots,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/companion-invite error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
