import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { transcribeAudioFile } from '@/lib/openai-server';
import { resolveRoomActor } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

/**
 * T2.2 — speech-to-text ONLY, no message is created (user decision
 * 2026-07-14: voice sends confirm the recognized text before sending).
 *
 * The client records, posts the clip here, receives the transcript, fills the
 * Composer with it for review/edit, and then sends through the ordinary text
 * path. `needsConfirmation` is server-authoritative: when the STT quality
 * heuristics flag the clip (low logprob, high no-speech probability, …) the
 * client must show the confirm step even if the user disabled it in settings.
 *
 * Authorization mirrors the messages route (any resolved room actor), and the
 * gate runs BEFORE the paid STT call — an unauthorized or rate-limited caller
 * never burns a transcription (same principle as T0.8).
 */

const MAX_AUDIO_BYTES = 15 * 1024 * 1024; // ~60s of opus with generous headroom

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const contentType = req.headers.get('content-type') ?? '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ error: 'multipart/form-data with an audio file is required' }, { status: 400 });
    }
    const form = await req.formData();
    const audio = form.get('audio');
    if (!(audio instanceof File)) {
      return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
    }
    if (audio.size === 0 || audio.size > MAX_AUDIO_BYTES) {
      return NextResponse.json({ error: 'audio file size out of range' }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
      guestEmail: String(form.get('contactEmail') || ''),
      guestName: String(form.get('contactName') || ''),
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const gate = await requestGate({
      namespace: 'tour_room_stt',
      key: clientIpKey(req.headers),
      perMinute: 10,
      perHour: 120,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const transcribed = await transcribeAudioFile(audio, {
      prompt: String(form.get('sttPrompt') || ''),
    });

    const reasonCodes = transcribed.quality?.reason_codes ?? [];
    const text = transcribed.text?.trim() ?? '';

    return NextResponse.json({
      text,
      sourceLocale: transcribed.source_locale ?? null,
      provider: transcribed.provider,
      model: transcribed.model,
      fallbackUsed: transcribed.fallback_used,
      quality: transcribed.quality,
      // Force the confirm step when the transcript is empty or flagged.
      needsConfirmation: text.length === 0 || reasonCodes.length > 0,
    });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/stt error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
