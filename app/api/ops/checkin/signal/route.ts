import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { kstToday } from '@/lib/tour-room/time';
import { recordRoomEvent } from '@/lib/tour-room/events';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { verifyRoomCheckinToken } from '@/lib/ops/seating/checkinToken';
import { getOpsRoom } from '@/lib/ops/seating/access';

export const dynamic = 'force-dynamic';

/**
 * 미등록 스캔 시그널 — AtoC 통합 플랜 §5.4c Q-4 ("명단에 없음" 분기).
 *
 * POST { checkinToken, deviceKey? }
 *
 * QR을 스캔했지만 어느 예약에도 매칭되지 않는 게스트 — 가이드/ops가 현장에서
 * 바로 인지해야 하는 상황이라 이벤트 기록 + ops 푸시로 알린다.
 * subject_key로 디바이스×일 단위 디듀프 (스팸 스캔 방지 이중장치: rate gate).
 */

export async function POST(req: NextRequest) {
  try {
    const supabase = createServerClient();
    const body = await req.json().catch(() => ({}));

    const gate = await requestGate({
      namespace: 'ops_checkin_signal',
      key: clientIpKey(req.headers),
      perMinute: 5,
      perHour: 20,
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

    const deviceKey = typeof body.deviceKey === 'string' ? body.deviceKey.slice(0, 64) : 'anon';
    const result = await recordRoomEvent(supabase, {
      roomId: room.id,
      type: 'unregistered_scan',
      actorRole: 'system',
      subjectKey: `unregistered:${deviceKey}:${kstToday()}`,
      payload: { device_key: deviceKey, tour_date: room.tour_date },
    }).catch(() => ({ inserted: false, event: null }));

    if (result.inserted) {
      void sendOpsPush({
        title: '미등록 게스트 QR 스캔',
        body: `체크인 QR을 스캔했지만 명단에 없는 게스트가 있습니다 (투어일 ${room.tour_date ?? '-'}). 현장 확인이 필요합니다.`,
        tag: `unregistered-scan-${room.id}`,
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true, notified: result.inserted });
  } catch (error) {
    console.error('POST /api/ops/checkin/signal error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
