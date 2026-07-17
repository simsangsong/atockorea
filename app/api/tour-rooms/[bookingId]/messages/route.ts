import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { transcribeAudioFile, translateTextForLocales, type TranslationResult } from '@/lib/openai-server';
import { ensureRoom, resolveRoomActor, type RoomActor, type RoomBooking } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { getParticipantLocales } from '@/lib/tour-room/snapshot';
import { getQuickReplyPreset } from '@/lib/tour-room/quickReplies';
import { renderSpotEventTranslations } from '@/lib/tour-room/spotContent';
import { pregenerateGuideNoticeTts, type TtsStorageClient } from '@/lib/tour-room/tts-server';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { requestGate } from '@/lib/durable-rate-limit';

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
function senderRoleFor(actor: RoomActor): 'customer' | 'guide' | 'admin' | 'driver' {
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
    let presetKey: string | null = null;
    let ackKind: string | null = null;
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
      presetKey = typeof body.presetKey === 'string' ? body.presetKey : null;
      ackKind = typeof body.ackKind === 'string' ? body.ackKind : null;
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
    const room = await ensureRoom(supabase, booking as RoomBooking);

    // D-8 (T1.3): default translation targets are the locales actually present
    // in the room; explicit client targetLocales and the legacy defaults
    // (guide → customer's preferred language, else all 5) remain the fallback.
    const participantLocales = await getParticipantLocales(supabase, room.id);
    const targetLocales = parseLocales(
      targetLocalesRaw,
      participantLocales.length > 0 ? participantLocales : defaultTargetLocalesFor(senderRole, booking),
    );

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

    // T6.4 — onboard headcount ack: zero-LLM template, tallied by the guide
    // console via metadata.kind (schema unchanged, AC).
    let pretranslated: TranslationResult | null = null;
    if (ackKind === 'onboard') {
      const bundle = renderSpotEventTranslations('onboard_ack', {});
      text = bundle.source_text;
      messageMetadata = { ...messageMetadata, kind: 'onboard_ack' };
      pretranslated = { source_locale: bundle.source_locale, translations: bundle.translations };
    }

    // T1.7 (§M-2 ②): quick-reply presets are pre-translated constants — the
    // client sends only the key, the server owns the content, and no LLM call
    // is made. Works even when every AI provider is down.
    let preset = null;
    if (presetKey) {
      preset = getQuickReplyPreset(presetKey);
      if (!preset) {
        return NextResponse.json({ error: 'Unknown quick-reply preset' }, { status: 400 });
      }
      text = preset.text.en;
      messageMetadata = { ...messageMetadata, kind: 'quick_reply', preset_key: preset.key };
    }

    if (!text) {
      return NextResponse.json({ error: 'text or audio transcription is required' }, { status: 400 });
    }

    // R-6 (T1.3): a translation failure must never block the message — post
    // the original immediately and mark it pending for async repair.
    let translation: TranslationResult;
    if (preset) {
      translation = { source_locale: 'en', translations: { ...preset.text } };
    } else if (pretranslated) {
      translation = pretranslated;
    } else {
      try {
        translation = await translateTextForLocales(text, targetLocales);
      } catch (translationError) {
        console.warn('tour-room message translation failed, publishing original first:', translationError);
        translation = { source_locale: 'und', translations: {} };
        messageMetadata = { ...messageMetadata, translation_status: 'pending' };
      }
    }

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

    // D-1/§O-7: push the committed row to the room channel; best-effort by
    // design — clients recover any gap via the after-cursor resync.
    await broadcastToRoom(room, 'message', { message });

    // §O-2 (T2.9): pre-generate TTS for participants whose devices reported
    // tts_capable=false, so their first listen has no generation latency.
    // Fire-and-forget — on-demand /tts remains the safety net.
    if (senderRole === 'guide' || senderRole === 'admin' || senderRole === 'driver') {
      void pregenerateGuideNoticeTts(supabase as unknown as TtsStorageClient, room.id, message).catch(
        () => undefined,
      );
    }

    // W6.2 — a customer's need_help quick reply pings ops subscribers even
    // with the console closed (the attention queue covers the open console).
    // Gated per room so a looped preset can't flood the ops push channel.
    if (senderRole === 'customer' && presetKey === 'need_help') {
      const pushGate = await requestGate({
        namespace: 'tour_ops_need_help_push',
        key: `room:${room.id}`,
        perMinute: 3,
        perHour: 20,
      });
      if (pushGate.allowed) {
        const senderName =
          ('displayName' in actor ? actor.displayName : null) || booking.contact_name || '게스트';
        void sendOpsPush({
          title: `🙋 도움 요청 — ${senderName}`,
          body: text,
          tag: `need-help-${room.id}`,
        }).catch(() => undefined);
      }
    }

    return NextResponse.json({ room, message }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/messages error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
