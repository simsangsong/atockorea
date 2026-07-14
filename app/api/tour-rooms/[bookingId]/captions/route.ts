import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { chatCompletion, translateTextViaRouter, AiRouterError } from '@/lib/ai/router';
import { transcribeAudioFile } from '@/lib/openai-server';
import { ensureRoom, resolveRoomActor } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { getParticipantLocales } from '@/lib/tour-room/snapshot';

export const dynamic = 'force-dynamic';

/**
 * T2.7 — live interpretation captions (§N-1 path 2).
 *
 * The guide speaks; every traveller sees a caption in their own locale within
 * ~2s. Two tiers, both landing here:
 *
 *   Tier A (free STT): the guide device ran Web Speech API and posts JSON
 *   { text, seq } — one translation call, no audio ever leaves the phone.
 *
 *   Tier B (universal): the guide device posts a 3–8s VAD speech chunk as
 *   multipart audio — one Gemini Flash-Lite multimodal call transcribes AND
 *   translates in the same request (§N-1); when that fails the ladder falls
 *   back to the legacy stt-router + translate pipeline (T2.7 AC).
 *
 * Captions are ephemeral by default (Broadcast only, no DB row — token and
 * storage cost zero); `record: true` additionally persists the utterance as a
 * normal room message (metadata.kind='caption').
 *
 * Guide/admin only — customers have the messages route.
 */

const MAX_CHUNK_BYTES = 4 * 1024 * 1024; // 8s opus is ~100KB; hard ceiling anyway
const MAX_CAPTION_CHARS = 500;

interface CaptionResult {
  sourceText: string;
  sourceLocale: string;
  translations: Record<string, string>;
  pipeline: 'tier-a' | 'multimodal' | 'stt-fallback';
}

function audioFormatOf(file: File): string {
  const type = (file.type || '').toLowerCase();
  if (type.includes('wav')) return 'wav';
  if (type.includes('mp3') || type.includes('mpeg')) return 'mp3';
  if (type.includes('mp4') || type.includes('aac')) return 'mp4';
  return 'webm';
}

/** Tier B primary: one multimodal call = transcription + N translations. */
async function transcribeAndTranslate(
  audio: File,
  targetLocales: string[],
): Promise<CaptionResult> {
  const base64 = Buffer.from(await audio.arrayBuffer()).toString('base64');
  const completion = await chatCompletion(
    'caption',
    [
      {
        role: 'system',
        content:
          'You transcribe a short tour-guide speech clip and translate it. Preserve names, times, pickup points, prices. Respond with only JSON: {"source_locale": string, "source_text": string, "translations": {locale: string}}. Locales requested: ' +
          targetLocales.join(', '),
      },
      {
        role: 'user',
        content: [
          { type: 'input_audio', input_audio: { data: base64, format: audioFormatOf(audio) } },
        ],
      },
    ],
    { jsonResponse: true, maxOutputTokens: 1000, temperature: 0.2 },
  );
  const parsed = JSON.parse(completion.content) as {
    source_locale?: string;
    source_text?: string;
    translations?: Record<string, string>;
  };
  const sourceText = (parsed.source_text ?? '').trim();
  if (!sourceText) throw new AiRouterError('Multimodal caption returned no transcript', []);
  return {
    sourceText,
    sourceLocale: parsed.source_locale || 'und',
    translations: parsed.translations ?? {},
    pipeline: 'multimodal',
  };
}

/** Tier B fallback: legacy stt-router, then the translation ladder. */
async function transcribeThenTranslate(
  audio: File,
  targetLocales: string[],
): Promise<CaptionResult> {
  const transcribed = await transcribeAudioFile(audio, {});
  const sourceText = transcribed.text.trim();
  if (!sourceText) throw new Error('empty_transcript');
  let translations: Record<string, string> = {};
  let sourceLocale = transcribed.source_locale || 'und';
  try {
    const translated = await translateTextViaRouter(sourceText, targetLocales);
    translations = translated.translations;
    if (translated.source_locale !== 'und') sourceLocale = translated.source_locale;
  } catch {
    // O-14: never lose the utterance — captions degrade to the original text.
  }
  return { sourceText, sourceLocale, translations, pipeline: 'stt-fallback' };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  const startedAt = Date.now();
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    let text = '';
    let seq = 0;
    let record = false;
    let audio: File | null = null;

    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('audio');
      if (!(file instanceof File) || file.size === 0 || file.size > MAX_CHUNK_BYTES) {
        return NextResponse.json({ error: 'audio chunk is required (≤4MB)' }, { status: 400 });
      }
      audio = file;
      seq = Number(form.get('seq') || 0);
      record = String(form.get('record') || '') === 'true';
    } else {
      const body = await req.json().catch(() => ({}));
      text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_CAPTION_CHARS) : '';
      seq = Number(body.seq || 0);
      record = body.record === true;
      if (!text) {
        return NextResponse.json({ error: 'text (Tier A) or audio (Tier B) is required' }, { status: 400 });
      }
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    if (actor.role !== 'guide' && actor.role !== 'admin') {
      return NextResponse.json({ error: 'Only the guide can broadcast captions' }, { status: 403 });
    }

    const room = await ensureRoom(supabase, booking);

    const gate = await requestGate({
      namespace: 'tour_room_captions',
      key: `room:${room.id}`,
      perMinute: 30, // 3–8s chunks ≈ 8–20/min; headroom for overlap resends
      perHour: 900,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const participantLocales = await getParticipantLocales(supabase, room.id);
    const targetLocales = participantLocales.length > 0 ? participantLocales : ['en'];

    let result: CaptionResult;
    if (audio) {
      try {
        result = await transcribeAndTranslate(audio, targetLocales);
      } catch (error) {
        console.warn('[captions] multimodal path failed, falling back to stt-router:', error);
        result = await transcribeThenTranslate(audio, targetLocales);
      }
    } else {
      // Tier A — the transcript is already text; one translation call.
      let translations: Record<string, string> = {};
      let sourceLocale = 'und';
      try {
        const translated = await translateTextViaRouter(text, targetLocales);
        translations = translated.translations;
        sourceLocale = translated.source_locale;
      } catch {
        // O-14: broadcast the original rather than dropping the sentence.
      }
      result = { sourceText: text, sourceLocale, translations, pipeline: 'tier-a' };
    }

    const caption = {
      id: randomUUID(),
      seq,
      sender_role: actor.role,
      source_text: result.sourceText.slice(0, MAX_CAPTION_CHARS),
      source_locale: result.sourceLocale,
      translations: result.translations,
      created_at: new Date().toISOString(),
    };

    await broadcastToRoom(room, 'caption', { caption });

    let message: Record<string, unknown> | null = null;
    if (record) {
      const { data } = await supabase
        .from('tour_room_messages')
        .insert({
          room_id: room.id,
          booking_id: booking.id,
          sender_user_id: authUserId,
          sender_role: actor.role,
          input_kind: 'audio',
          source_text: caption.source_text,
          source_locale: caption.source_locale,
          translations: caption.translations,
          target_locales: targetLocales,
          metadata: { kind: 'caption', seq },
        })
        .select()
        .single();
      if (data) {
        message = data;
        await broadcastToRoom(room, 'message', { message: data });
      }
    }

    // §N-3 latency instrumentation: chunk-received → caption-broadcast.
    console.log(
      `[captions] room=${room.id} seq=${seq} pipeline=${result.pipeline} targets=${targetLocales.length} ms=${Date.now() - startedAt}`,
    );

    return NextResponse.json({ caption, message, pipeline: result.pipeline }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/captions error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
