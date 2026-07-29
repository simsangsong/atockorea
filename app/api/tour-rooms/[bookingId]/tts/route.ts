import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { ensureRoomTts, TTS_BUCKET, type TtsPart, type TtsStorageClient } from '@/lib/tour-room/tts-server';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';
import { composeSpotNarration, pickSpotContent } from '@/lib/tour-room/spotContent';
import { signRoomMedia, type RoomMediaStorageClient } from '@/lib/tour-room/roomMedia';

export const dynamic = 'force-dynamic';

/**
 * T2.3 — server TTS, cache-only by design (§B D-6, §O-2 ladder step 2).
 *
 * GET /api/tour-rooms/[bookingId]/tts?messageId=…&locale=…[&rs=…]
 *
 * One generation per (message, locale), shared by the whole room via
 * tour_room_tts_cache + the public tour-audio bucket; every later listener —
 * including other participants — replays the cached mp3 with zero LLM/TTS
 * calls. Responds with JSON { url, cached } (the AudioButton fetches the URL
 * and feeds an HTML5 Audio element, which plays on the media channel even
 * with the iOS silent switch on).
 *
 * Auth accepts the `rs` room-session query param (resolveRoomActor) so
 * header-less consumers work too. The generation path (cache miss) is
 * rate-limited; cache hits are not.
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
    const requestedLocale = normalizeRoomLocale(req.nextUrl.searchParams.get('locale'));
    const part: TtsPart = req.nextUrl.searchParams.get('part') === 'narration' ? 'narration' : 'body';

    const room = await ensureRoom(supabase, booking);

    // A2 — the narration track speaks the arrival card's briefing, which may be
    // written in a different language than the viewer's locale (curated content
    // covers 6 locales, poi_kb is English-only). Cache and voice both follow the
    // language the PROSE is in, never the requester's locale.
    let locale = requestedLocale;
    let narrationText: string | null = null;
    if (part === 'narration') {
      const { data: card } = await supabase
        .from('tour_room_messages')
        .select('id, room_id, metadata')
        .eq('id', messageId)
        .maybeSingle();
      if (!card || (card as { room_id?: string }).room_id !== room.id) {
        return NextResponse.json({ error: 'Message not found in this room' }, { status: 404 });
      }
      const picked = pickSpotContent(
        (card as { metadata?: Record<string, unknown> }).metadata,
        requestedLocale,
      );
      narrationText = composeSpotNarration(picked?.content);
      if (!narrationText) {
        return NextResponse.json({ error: 'Message has no speakable text' }, { status: 422 });
      }
      locale = picked?.lang ?? requestedLocale;
    }

    // Cache hit — zero paid calls, no rate limit.
    const { data: cached } = await supabase
      .from('tour_room_tts_cache')
      .select('storage_path, duration_ms')
      .eq('message_id', messageId)
      .eq('locale', locale)
      .eq('part', part)
      .maybeSingle();
    if (cached?.storage_path) {
      // Private bucket — the cache hit still costs zero paid calls, it just
      // hands back a URL that expires instead of one that never does.
      const url = await signRoomMedia(
        supabase as unknown as RoomMediaStorageClient,
        TTS_BUCKET,
        cached.storage_path,
      );
      if (!url) {
        return NextResponse.json({ error: 'audio_unavailable' }, { status: 502 });
      }
      return NextResponse.json({ url, cached: true, durationMs: cached.duration_ms ?? null });
    }

    // Generation path — budget-guarded (§O-2 ②).
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

    const url = await ensureRoomTts(supabase as unknown as TtsStorageClient, room.id, message, locale, {
      part,
      ...(narrationText ? { text: narrationText } : {}),
    });
    if (!url) {
      return NextResponse.json({ error: 'Message has no speakable text' }, { status: 422 });
    }
    return NextResponse.json({ url, cached: false, durationMs: null, lang: locale });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/tts error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
