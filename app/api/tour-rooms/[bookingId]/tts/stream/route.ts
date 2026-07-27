import { NextRequest, NextResponse, after } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { streamRoomTts, TTS_BUCKET, type TtsStorageClient } from '@/lib/tour-room/tts-server';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';

export const dynamic = 'force-dynamic';

/**
 * V0.3 — 재생 가능한 오디오를 직접 돌려주는 TTS 경로.
 *
 * GET /api/tour-rooms/[bookingId]/tts/stream?messageId=…&locale=…[&rs=…]
 *   → 200 audio/mpeg (생성과 동시에 스트리밍)
 *   → 302 → 공개 CDN URL (캐시 히트)
 *
 * 형제 라우트 `../tts` 는 JSON `{ url }` 을 돌려주고 클라이언트가 그 URL 을
 * **다시 받으러 간다**. 캐시 히트에는 그게 맞지만(CDN 이 서빙), 캐시 미스
 * 첫 청취자에게는 전체 버퍼 대기(2281ms) + 업로드(218ms) + 두 번째 왕복이
 * 전부 재생 전에 쌓인다. 여기서는 첫 바이트(1292ms)에 재생이 시작된다.
 * 실측: `scripts/qa-voice-latency.mjs` · 근거: docs/voice-translation-call-feasibility-2026-07-27.md §A-1
 *
 * `<audio src="…/tts/stream?…">` 로 그대로 물리면 된다. JSON 라우트는 기존
 * 소비자(AudioButton·§O-2 사전생성)를 위해 그대로 둔다 — 이건 추가지 교체가 아니다.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking } = resolved;

    const messageId = req.nextUrl.searchParams.get('messageId') ?? '';
    if (!messageId) {
      return NextResponse.json({ error: 'messageId is required' }, { status: 400 });
    }
    const locale = normalizeRoomLocale(req.nextUrl.searchParams.get('locale'));

    const room = await ensureRoom(supabase, booking);

    // 캐시 히트 — CDN 이 우리보다 잘 서빙한다. 리다이렉트가 가장 빠르다.
    const { data: cached } = await supabase
      .from('tour_room_tts_cache')
      .select('storage_path')
      .eq('message_id', messageId)
      .eq('locale', locale)
      .maybeSingle();
    if (cached?.storage_path) {
      const { data: pub } = supabase.storage.from(TTS_BUCKET).getPublicUrl(cached.storage_path);
      return NextResponse.redirect(pub.publicUrl, 302);
    }

    // 생성 경로 — JSON 라우트와 같은 예산 게이트(§O-2 ②).
    const gate = await requestGate({
      namespace: 'tour_room_tts',
      key: `room:${room.id}`,
      perMinute: 6,
      perHour: 60,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const { data: message } = await supabase
      .from('tour_room_messages')
      .select('id, room_id, source_text, translations')
      .eq('id', messageId)
      .maybeSingle();
    if (!message || message.room_id !== room.id) {
      return NextResponse.json({ error: 'Message not found in this room' }, { status: 404 });
    }

    const stream = await streamRoomTts(supabase as unknown as TtsStorageClient, room.id, message, locale);
    if (!stream) {
      return NextResponse.json({ error: 'Message has no speakable text' }, { status: 422 });
    }

    // tee 의 두 번째 분기는 반드시 소비돼야 한다 — 응답을 돌려주기 전에 예약한다.
    after(stream.persist);

    return new Response(stream.body, {
      headers: {
        'Content-Type': 'audio/mpeg',
        // 생성 중이라 길이를 모른다. 청크 전송이 되도록 버퍼링을 막는다.
        'Cache-Control': 'no-store',
        'X-Accel-Buffering': 'no',
      },
    });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/tts/stream error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
