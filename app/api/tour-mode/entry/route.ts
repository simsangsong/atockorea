import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { ensureRoom, type RoomDbClient } from '@/lib/tour-room/access';
import {
  hashToken,
  signCustomerRoomToken,
  signDriverRoomToken,
  signGuideRoomToken,
} from '@/lib/tour-room/token';
import { resolveEntryCode } from '@/lib/tour-room/entryCode';
import { maskGuestName } from '@/lib/ops/seating/claim';

export const dynamic = 'force-dynamic';

/**
 * 입장 코드 문(門) — 코드 하나로 방 열쇠(토큰)를 그 자리에서 발급한다
 * (docs/smart-guide-entry-code-master-plan-2026-08-08 §C-2).
 *
 * POST { code, to?: 'plan' }
 *   → 200 { kind, url, tourTitle, tourDate, guestName }
 *   → 404 not_found | 410 expired | 410 revoked | 429 rate_limited
 *
 * 받는 코드(한 입력창): A2C-XXXXXXXX 상설 예약 코드 · 발송 별칭(짧은 링크의 꼬리) ·
 * OTA 예약번호(Klook/GYG/Viator/KKday…). 판정은 lib/tour-room/entryCode.ts.
 *
 * POST 전용 — /r/{code} 는 이 라우트를 부르지 않고 /tour-mode?code= 로 순수
 * 리다이렉트만 한다. 메일 스캐너·미리보기 봇의 GET 이 토큰을 찍으면 안 된다
 * (§O-1 ⑦과 같은 이유). 사람 브라우저의 JS 만 여기 도달한다.
 *
 * 성공마다 tour_room_invites 에 sent_via='entry-code' 원장 1행 — reinvite 의
 * 'onsite-qr' 과 같은 계약(감사 가능·revoke 가능). 토큰 수명은 기존 규칙 그대로
 * (투어일 KST 종료 + 24h — token.ts 가 결정).
 */

export async function POST(req: NextRequest) {
  try {
    const gate = await requestGate({
      namespace: 'tour_room_entry_code',
      key: clientIpKey(req.headers),
      perMinute: 12,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs || 60000) / 1000)) } },
      );
    }

    const body = (await req.json().catch(() => ({}))) as { code?: unknown; to?: unknown };
    const to = body.to === 'plan' ? 'plan' : undefined;
    const supabase = createServerClient();

    const resolution = await resolveEntryCode(supabase as unknown as RoomDbClient, body.code);
    if (resolution.kind === 'error') {
      const status = resolution.code === 'not_found' ? 404 : 410;
      return NextResponse.json({ error: resolution.code }, { status });
    }

    // URL 은 상대 경로로 준다 — NEXT_PUBLIC_APP_URL 기반 절대 URL 을 주면
    // dev(3160)에서 코드를 입력한 브라우저가 프로덕션 도메인으로 튄다.

    // 가이드·기사 별칭 — tour-date 스코프 토큰을 재발급해 각자의 콘솔로 보낸다.
    // 기사 PIN 게이트(P-D3)는 join 이 그대로 요구한다.
    if (resolution.kind === 'staff') {
      const minted =
        resolution.role === 'driver'
          ? signDriverRoomToken({
              tourId: resolution.tourId,
              tourDate: resolution.tourDate,
              displayName: resolution.displayName ?? '기사님',
            })
          : signGuideRoomToken({
              tourId: resolution.tourId,
              tourDate: resolution.tourDate,
              displayName: resolution.displayName ?? 'Guide',
            });
      const { error } = await supabase.from('tour_room_invites').insert({
        tour_id: resolution.tourId,
        tour_date: resolution.tourDate,
        role: resolution.role,
        display_name: resolution.displayName ?? (resolution.role === 'driver' ? '기사님' : 'Guide'),
        token_hash: hashToken(minted.token),
        sent_via: 'entry-code',
        expires_at: new Date(minted.payload.exp * 1000).toISOString(),
      });
      if (error) throw error;
      const path = resolution.role === 'driver' ? '/tour-mode/driver' : '/tour-mode/guide';
      return NextResponse.json({
        kind: resolution.role,
        url: `${path}?rt=${encodeURIComponent(minted.token)}`,
        tourTitle: null,
        tourDate: resolution.tourDate,
        guestName: null,
      });
    }

    const booking = resolution.booking;
    await ensureRoom(supabase as unknown as RoomDbClient, {
      id: booking.id,
      tour_id: booking.tour_id,
      tour_date: booking.tour_date,
    });

    const minted = signCustomerRoomToken({
      bookingId: booking.id,
      displayName: booking.contact_name || 'Guest',
      tourDate: booking.tour_date as string,
    });
    const { error } = await supabase.from('tour_room_invites').insert({
      booking_id: booking.id,
      tour_id: booking.tour_id,
      tour_date: booking.tour_date,
      role: 'customer',
      display_name: booking.contact_name || 'Guest',
      token_hash: hashToken(minted.token),
      sent_via: 'entry-code',
      expires_at: new Date(minted.payload.exp * 1000).toISOString(),
    });
    if (error) throw error;

    // 확인 카드용 투어 제목 — 실패해도 입장은 막지 않는다.
    let tourTitle: string | null = null;
    if (booking.tour_id) {
      try {
        const { data: tour } = await supabase
          .from('tours')
          .select('title')
          .eq('id', booking.tour_id)
          .maybeSingle();
        tourTitle = (tour as { title?: string | null } | null)?.title ?? null;
      } catch {
        tourTitle = null;
      }
    }

    const rt = encodeURIComponent(minted.token);
    const url =
      to === 'plan'
        ? `/tour-mode/plan/${booking.id}?rt=${rt}`
        : `/tour-mode/room/${booking.id}?rt=${rt}`;

    return NextResponse.json({
      kind: 'customer',
      url,
      tourTitle,
      tourDate: booking.tour_date,
      guestName: maskGuestName(booking.contact_name),
    });
  } catch (error) {
    console.error('POST /api/tour-mode/entry error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
