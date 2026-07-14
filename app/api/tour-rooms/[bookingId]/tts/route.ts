import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { generateSpeechMp3 } from '@/lib/openai-server';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { normalizeRoomLocale } from '@/lib/tour-room/snapshot';

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

const TTS_BUCKET = process.env.SUPABASE_TOUR_AUDIO_BUCKET || 'tour-audio';
const MAX_TTS_TEXT_CHARS = 1200;

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

    // Cache hit — zero paid calls, no rate limit.
    const { data: cached } = await supabase
      .from('tour_room_tts_cache')
      .select('storage_path, duration_ms')
      .eq('message_id', messageId)
      .eq('locale', locale)
      .maybeSingle();
    if (cached?.storage_path) {
      const { data: pub } = supabase.storage.from(TTS_BUCKET).getPublicUrl(cached.storage_path);
      return NextResponse.json({ url: pub.publicUrl, cached: true, durationMs: cached.duration_ms ?? null });
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

    const translations = (message.translations ?? {}) as Record<string, string>;
    const text = (translations[locale] || message.source_text || '').trim().slice(0, MAX_TTS_TEXT_CHARS);
    if (!text) {
      return NextResponse.json({ error: 'Message has no speakable text' }, { status: 422 });
    }

    const audio = await generateSpeechMp3(text, locale);
    const storagePath = `tour-room-tts/${room.id}/${messageId}-${locale}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from(TTS_BUCKET)
      .upload(storagePath, Buffer.from(audio), { contentType: 'audio/mpeg', upsert: true });
    if (uploadError) throw uploadError;

    // Upsert — a concurrent request may have raced us; (message_id, locale)
    // is UNIQUE and both writers uploaded identical content to the same path.
    await supabase
      .from('tour_room_tts_cache')
      .upsert(
        { message_id: messageId, locale, storage_path: storagePath },
        { onConflict: 'message_id,locale' },
      );

    const { data: pub } = supabase.storage.from(TTS_BUCKET).getPublicUrl(storagePath);
    return NextResponse.json({ url: pub.publicUrl, cached: false, durationMs: null });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/tts error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
