import { NextRequest, NextResponse } from 'next/server';
import QRCode from 'qrcode';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { hashToken, signCustomerRoomToken } from '@/lib/tour-room/token';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { maskGuestName } from '@/lib/ops/seating/claim';
import {
  RECLAIM_APPROVED,
  RECLAIM_EVENT_TYPES,
  RECLAIM_REJECTED,
  buildReclaimQueue,
  gateReclaimDecision,
  maskDeviceKey,
  reclaimSubjectKey,
  type ReclaimEventLike,
} from '@/lib/ops/reclaim';

export const dynamic = 'force-dynamic';

/**
 * 재claim 판정 — AtoC 통합 플랜 §5.2 C-5 (승인 큐의 나머지 절반).
 *
 * POST /api/admin/tour-ops/reclaims/decision
 *   { room_id, booking_id, device_key, decision: 'approve'|'reject',
 *     confirm: true, note? }
 *
 * 이 엔드포인트의 전체 목적은 **탈취 방지**다. 그래서 기본값이 안전 쪽이다:
 *   · 자동 승인 경로 없음 — 큐에 실제 `reclaim_requested`가 있어야 하고,
 *   · 이미 판정된 요청은 409 (재승인으로 토큰을 또 찍어낼 수 없다),
 *   · confirm: true가 없으면 400 — UI의 2단계 확인과 짝을 이룬다.
 *
 * 승인이 하는 일 (플랜: "기존 디바이스 토큰은 승인 시 폐기"):
 *   ① 그 예약의 살아있는 customer 초대 토큰을 전부 revoked_at 처리 —
 *      기존 기기의 저장 토큰이 그 즉시 죽는다. 폐기는 새 원장을 만들지 않고
 *      기존 tour_room_invites.revoked_at을 쓴다 (lib/tour-room/access.ts와
 *      lib/ops/seating/access.ts가 이미 이 컬럼을 검사한다 — 병렬 기구 금지).
 *   ② participant 행의 device_key를 요청 디바이스로 이전 (행을 지우지 않는다:
 *      메시지·좌석 배정이 이 participant를 참조한다).
 *   ③ 새 booking-scope 개인 토큰 발급 + 원장 기록 → 운영자가 손님에게 건네는
 *      링크/QR로 반환. 요청 디바이스에 자동 전달하지 않는 것은 의도적이다 —
 *      아직 신원이 확인되지 않은 기기이고, 전달 경로는 사람이 쥔다.
 *
 * 거절은 사실만 남기고(이벤트) ops에 알린다. 어느 쪽이든 tour_room_events에
 * 감사 1행(누가·언제·어느 디바이스가 이겼는지)이 반드시 남는다.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function appUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com').replace(/\/$/, '');
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });

    const roomId = String(body.room_id || '');
    const bookingId = String(body.booking_id || '');
    const deviceKey = String(body.device_key || '');
    const decision = body.decision === 'approve' ? 'approve' : body.decision === 'reject' ? 'reject' : null;
    if (!roomId || !bookingId || !UUID_RE.test(deviceKey) || !decision) {
      return NextResponse.json(
        { error: 'room_id, booking_id, device_key (uuid) and decision are required' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();
    const subjectKey = reclaimSubjectKey(bookingId, deviceKey);

    // 큐 재구성 — "이 요청이 실제로 존재하고 아직 미결인가"를 이벤트 로그에서 확인.
    const { data: eventRows, error: eventError } = await supabase
      .from('tour_room_events')
      .select('id, room_id, booking_id, type, actor_role, subject_key, payload, created_at')
      .eq('room_id', roomId)
      .in('type', [...RECLAIM_EVENT_TYPES])
      .order('created_at', { ascending: false })
      .limit(200);
    if (eventError) throw eventError;

    const gate = gateReclaimDecision(buildReclaimQueue((eventRows ?? []) as ReclaimEventLike[]), {
      bookingId,
      deviceKey,
      confirm: body.confirm,
    });
    if (!gate.ok) {
      return NextResponse.json({ error: gate.error, message: gate.message }, { status: gate.status });
    }

    const { data: bookingRow } = await supabase
      .from('bookings')
      .select('id, contact_name, tour_date')
      .eq('id', bookingId)
      .maybeSingle();
    const booking = bookingRow as { id: string; contact_name: string | null; tour_date: string | null } | null;
    const note = typeof body.note === 'string' ? body.note.trim().slice(0, 300) : null;

    // ── 거절: 사실만 남기고 알린다. 기존 디바이스는 그대로 유효하다.
    if (decision === 'reject') {
      await recordRoomEvent(supabase, {
        roomId,
        bookingId,
        type: RECLAIM_REJECTED,
        actorRole: 'admin',
        subjectKey,
        payload: { device_key: deviceKey, decided_by: admin.id, decided_by_email: admin.email ?? null, note },
      });
      void sendOpsPush({
        title: '재등록 요청 거절됨',
        body: `${maskGuestName(booking?.contact_name ?? null)} — ${maskDeviceKey(deviceKey)} 기기의 재등록을 거절했어요. 기존 기기는 그대로 유효해요.`,
        tag: `reclaim-${bookingId}`,
      }).catch(() => undefined);
      return NextResponse.json({ ok: true, decision: 'reject' });
    }

    // ── 승인.
    const { data: participantRows } = await supabase
      .from('tour_room_participants')
      .select('id, room_id, booking_id, device_key, display_name, locale, is_lead, created_at')
      .eq('room_id', roomId)
      .eq('role', 'customer');
    const participants = ((participantRows ?? []) as Array<{
      id: string;
      room_id: string;
      booking_id: string;
      device_key: string;
      display_name: string;
      locale: string;
      is_lead: boolean;
      created_at: string;
    }>).slice();

    // (room_id, device_key)는 UNIQUE — 요청 키가 이미 다른 예약에 묶여 있으면
    // 그 예약을 조용히 날려버릴 수 없다. 사람이 먼저 정리해야 한다.
    const conflicting = participants.find(
      (participant) => participant.device_key === deviceKey && participant.booking_id !== bookingId,
    );
    if (conflicting) {
      return NextResponse.json(
        {
          error: 'device_bound_to_other_booking',
          message: '이 기기는 같은 룸의 다른 예약에 이미 등록돼 있어요. 그 등록을 먼저 정리해 주세요.',
        },
        { status: 409 },
      );
    }

    const mine = participants
      .filter((participant) => participant.booking_id === bookingId)
      .sort((a, b) => Number(b.is_lead) - Number(a.is_lead) || (a.created_at < b.created_at ? -1 : 1));
    const incumbent = mine[0] ?? null;

    // ① 기존 토큰 폐기 — 기존 기구(tour_room_invites.revoked_at)를 그대로 쓴다.
    const nowIso = new Date().toISOString();
    const { data: revokedRows, error: revokeError } = await supabase
      .from('tour_room_invites')
      .update({ revoked_at: nowIso })
      .eq('booking_id', bookingId)
      .eq('role', 'customer')
      .is('revoked_at', null)
      .select('id');
    if (revokeError) throw revokeError;
    const revokedCount = Array.isArray(revokedRows) ? revokedRows.length : 0;

    // ② participant 이전 — 행은 유지(메시지·좌석 배정이 참조한다), 기기만 바꾼다.
    const displayName = incumbent?.display_name || maskGuestName(booking?.contact_name ?? null);
    if (incumbent && incumbent.device_key !== deviceKey) {
      const { error } = await supabase
        .from('tour_room_participants')
        .update({ device_key: deviceKey, last_seen_at: null, updated_at: nowIso })
        .eq('id', incumbent.id);
      if (error) throw error;
    }

    // ③ 새 개인 토큰 + 원장.
    const tourDate = booking?.tour_date ?? null;
    if (!tourDate) {
      return NextResponse.json(
        { error: 'booking_has_no_tour_date', message: '예약에 투어 날짜가 없어 토큰을 발급할 수 없어요.' },
        { status: 409 },
      );
    }
    const { token, payload } = signCustomerRoomToken({ bookingId, displayName, tourDate });
    const expiresAt = new Date(payload.exp * 1000).toISOString();
    const { error: ledgerError } = await supabase.from('tour_room_invites').insert({
      booking_id: bookingId,
      role: 'customer',
      token_hash: hashToken(token),
      display_name: displayName,
      sent_via: 'ops-link',
      created_by: admin.id,
      expires_at: expiresAt,
    });
    if (ledgerError) throw ledgerError;

    // 감사 1행 — 누가·언제·어느 디바이스가 이겼는지.
    await recordRoomEvent(supabase, {
      roomId,
      bookingId,
      type: RECLAIM_APPROVED,
      actorRole: 'admin',
      subjectKey,
      payload: {
        previous_device_key: incumbent?.device_key ?? null,
        device_key: deviceKey,
        participant_id: incumbent?.id ?? null,
        revoked_token_count: revokedCount,
        decided_by: admin.id,
        decided_by_email: admin.email ?? null,
        note,
      },
    });

    const url = `${appUrl()}/tour-mode/room/${encodeURIComponent(bookingId)}?rt=${encodeURIComponent(token)}`;
    let qrDataUrl: string | null = null;
    try {
      qrDataUrl = await QRCode.toDataURL(url, { width: 360, margin: 1 });
    } catch {
      qrDataUrl = null;
    }

    void sendOpsPush({
      title: '재등록 승인됨',
      body: `${maskGuestName(booking?.contact_name ?? null)} — ${maskDeviceKey(deviceKey)} 기기로 이전했고 기존 토큰 ${revokedCount}건을 폐기했어요.`,
      tag: `reclaim-${bookingId}`,
    }).catch(() => undefined);

    return NextResponse.json({
      ok: true,
      decision: 'approve',
      url,
      expires_at: expiresAt,
      qr_data_url: qrDataUrl,
      revoked_token_count: revokedCount,
      previous_device_masked: maskDeviceKey(incumbent?.device_key ?? null),
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/tour-ops/reclaims/decision]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
