import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { transcribeAudioFile, translateTextForLocales } from '@/lib/openai-server';
import { ensureRoom, resolveRoomActor, type RoomActor, type RoomBooking } from '@/lib/tour-room/access';

export const dynamic = 'force-dynamic';

const DEFAULT_TARGET_LOCALES = ['en', 'ko', 'zh', 'ja', 'es'];

function parseLocales(value: unknown, fallback = DEFAULT_TARGET_LOCALES): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return fallback;
}

function defaultTargetLocalesFor(
  senderRole: string,
  booking: { preferred_language?: string | null },
): string[] {
  const customerPreferred = booking.preferred_language?.trim();
  if (senderRole === 'guide' && customerPreferred) return [customerPreferred];
  return DEFAULT_TARGET_LOCALES;
}

/** PA-3: sender role is server-authoritative, derived from the resolved actor. */
function senderRoleFor(actor: RoomActor): 'customer' | 'guide' | 'admin' {
  return actor.role;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    // No guest credentials are accepted on GET (pre-refactor behaviour);
    // tokens / room sessions / logged-in roles authorize via resolveRoomActor.
    const resolved = await resolveRoomActor(req, bookingId, { supabase });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking } = resolved;

    const room = await ensureRoom(supabase, booking);
    const { data, error } = await supabase
      .from('tour_room_messages')
      .select('*')
      .eq('room_id', room.id)
      .order('created_at', { ascending: true });
    if (error) throw error;

    return NextResponse.json({ room, messages: data ?? [] });
  } catch (error) {
    console.error('GET /api/tour-rooms/[bookingId]/messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    let text = '';
    let inputKind: 'text' | 'audio' = 'text';
    let guestEmail = '';
    let guestName = '';
    let targetLocalesRaw: unknown = null;
    let audioFile: File | null = null;
    let sttPrompt = '';
    let messageMetadata: Record<string, unknown> = {};

    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const audio = form.get('audio');
      if (!(audio instanceof File)) {
        return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
      }
      audioFile = audio;
      sttPrompt = String(form.get('sttPrompt') || '');
      inputKind = 'audio';
      targetLocalesRaw = form.get('targetLocales');
      guestEmail = String(form.get('contactEmail') || '');
      guestName = String(form.get('contactName') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      text = typeof body.text === 'string' ? body.text.trim() : '';
      targetLocalesRaw = body.targetLocales;
      guestEmail = String(body.contactEmail || '');
      guestName = String(body.contactName || '');
    }

    // Authorize before doing any paid work (STT/translation) — same response
    // contract as before, but an unauthorized caller can no longer burn an
    // STT call ahead of the 403.
    const resolved = await resolveRoomActor(req, bookingId, {
      supabase,
      guestEmail,
      guestName,
    });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }
    const { booking, actor, authUserId } = resolved;
    const senderRole = senderRoleFor(actor);
    const targetLocales = parseLocales(targetLocalesRaw, defaultTargetLocalesFor(senderRole, booking));

    if (audioFile) {
      const transcribed = await transcribeAudioFile(audioFile, { prompt: sttPrompt });
      text = transcribed.text;
      messageMetadata = {
        stt: {
          provider: transcribed.provider,
          model: transcribed.model,
          fallback_used: transcribed.fallback_used,
          fallback_reason_codes: transcribed.fallback_reason_codes,
          quality: transcribed.quality,
        },
      };
    }

    if (!text) {
      return NextResponse.json({ error: 'text or audio transcription is required' }, { status: 400 });
    }

    const room = await ensureRoom(supabase, booking as RoomBooking);
    const translation = await translateTextForLocales(text, targetLocales);
    const { data: message, error } = await supabase
      .from('tour_room_messages')
      .insert({
        room_id: room.id,
        booking_id: booking.id,
        sender_user_id: authUserId,
        sender_role: senderRole,
        input_kind: inputKind,
        source_text: text,
        source_locale: translation.source_locale,
        translations: translation.translations,
        target_locales: targetLocales,
        metadata: messageMetadata,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ room, message }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
