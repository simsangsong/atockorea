import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { transcribeAudioFile, translateTextForLocales, type TranslationResult } from '@/lib/openai-server';
import { ensureRoom, resolveRoomActor, type RoomActor, type RoomBooking } from '@/lib/tour-room/access';
import { broadcastToRoom } from '@/lib/tour-room/realtime';
import { ROOM_LOCALES, getRoomTranslationTargets } from '@/lib/tour-room/snapshot';
import { normalizeChatLocale, MAX_TRANSLATION_TARGETS } from '@/lib/tour-room/chatLocale';
import { getQuickReplyPreset } from '@/lib/tour-room/quickReplies';
import { renderSpotEventTranslations } from '@/lib/tour-room/spotContent';
import { pregenerateGuideNoticeTts, type TtsStorageClient } from '@/lib/tour-room/tts-server';
import { sendOpsPush } from '@/lib/tour-ops/push';
import { sendDriverRoomPush } from '@/lib/tour-room/guestPush';
import { requestGate } from '@/lib/durable-rate-limit';
import { classifyAttachment, uploadAttachment, type StorageClientLike } from '@/lib/tour-room/attachments';
import { buildReplySnapshot, type RepliableMessage } from '@/lib/tour-room/reply';

export const dynamic = 'force-dynamic';

// §D A4.1 — 로케일 목록은 ROOM_LOCALES 하나뿐이다. 여기 다시 적으면
// 로케일이 하나 늘어나는 날 이 파일만 조용히 5개로 남는다.
const DEFAULT_TARGET_LOCALES: string[] = [...ROOM_LOCALES];

function parseLocales(value: unknown, fallback = DEFAULT_TARGET_LOCALES): string[] {
  if (Array.isArray(value)) return value.map(String).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return fallback;
}

/**
 * Translation targets when the client didn't pass an explicit list.
 *
 * A GUEST message targets whoever's present (D-8 cost optimization — the
 * operator is always in the room). An OPERATOR message (guide/driver/admin)
 * must always cover the 5 room UI languages, so a guest who JOINS AFTER it was
 * sent still gets a translated bubble instead of the raw Korean — plus any
 * arbitrary chat languages guests have written in (chat_locale).
 */
function fallbackTargetLocales(senderRole: string, participantLocales: string[]): string[] {
  if (senderRole === 'customer') {
    return participantLocales.length > 0 ? participantLocales : DEFAULT_TARGET_LOCALES;
  }
  return [...new Set([...DEFAULT_TARGET_LOCALES, ...participantLocales])].slice(0, MAX_TRANSLATION_TARGETS);
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
    let inputKind: 'text' | 'audio' | 'image' | 'file' = 'text';
    let guestEmail = '';
    let guestName = '';
    let targetLocalesRaw: unknown = null;
    let audioFile: File | null = null;
    let attachmentFile: File | null = null;
    let sttPrompt = '';
    let presetKey: string | null = null;
    let ackKind: string | null = null;
    let replyToId: string | null = null;
    let messageMetadata: Record<string, unknown> = {};
    // The sender's EXPLICIT chat-language override (client rides it along on
    // plain text sends). When present it pins the participant's chat_locale
    // instead of write-detection clobbering the explicit choice.
    let chatLocalePref: string | null = null;

    const contentType = req.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const audio = form.get('audio');
      const attachment = form.get('attachment');
      if (attachment instanceof File) {
        // Kakao-grade photo/file attachment — an optional caption rides along
        // and is translated like any text.
        attachmentFile = attachment;
        text = String(form.get('caption') || '').trim();
      } else if (audio instanceof File) {
        audioFile = audio;
        sttPrompt = String(form.get('sttPrompt') || '');
        inputKind = 'audio';
      } else {
        return NextResponse.json({ error: 'audio or attachment file is required' }, { status: 400 });
      }
      replyToId = typeof form.get('replyToId') === 'string' ? String(form.get('replyToId')) : null;
      targetLocalesRaw = form.get('targetLocales');
      guestEmail = String(form.get('contactEmail') || '');
      guestName = String(form.get('contactName') || '');
    } else {
      const body = await req.json().catch(() => ({}));
      text = typeof body.text === 'string' ? body.text.trim() : '';
      presetKey = typeof body.presetKey === 'string' ? body.presetKey : null;
      ackKind = typeof body.ackKind === 'string' ? body.ackKind : null;
      replyToId = typeof body.replyToId === 'string' ? body.replyToId : null;
      targetLocalesRaw = body.targetLocales;
      guestEmail = String(body.contactEmail || '');
      guestName = String(body.contactName || '');
      chatLocalePref = typeof body.chatLocale === 'string' ? body.chatLocale : null;
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

    // D-8 (T1.3) + language-agnostic bridge (2026-07-18): default translation
    // targets are the room's folded locales PLUS every raw chat language a
    // guest has written in — a driver's Korean reply comes back as a bubble
    // in whatever language the guest actually typed. Explicit client
    // targetLocales and the legacy defaults remain the fallback.
    const participantLocales = await getRoomTranslationTargets(supabase, room.id);
    const targetLocales = parseLocales(targetLocalesRaw, fallbackTargetLocales(senderRole, participantLocales));

    // Kakao-grade attachment: validate → rate-gate → upload → carry the
    // attachment metadata. The optional caption stays in `text` (translated below).
    if (attachmentFile) {
      const classified = classifyAttachment({
        type: attachmentFile.type,
        size: attachmentFile.size,
        name: attachmentFile.name,
      });
      if ('error' in classified) {
        return NextResponse.json({ error: classified.error }, { status: 400 });
      }
      const attachGate = await requestGate({
        namespace: 'tour_room_attachment',
        key: actor.kind === 'session' ? `participant:${actor.sessionPayload.participantId}` : `booking:${booking.id}`,
        perMinute: 6,
        perHour: 60,
      });
      if (!attachGate.allowed) {
        return NextResponse.json(
          { error: 'rate_limited' },
          { status: 429, headers: { 'Retry-After': String(Math.ceil((attachGate.retryAfterMs ?? 0) / 1000)) } },
        );
      }
      try {
        const bytes = Buffer.from(await attachmentFile.arrayBuffer());
        const attachmentMeta = await uploadAttachment(
          supabase as unknown as StorageClientLike,
          room.id,
          { bytes, type: attachmentFile.type, name: attachmentFile.name, size: attachmentFile.size },
          classified.ext,
        );
        inputKind = classified.kind;
        messageMetadata = { ...messageMetadata, kind: `attachment_${classified.kind}`, attachment: attachmentMeta };
      } catch (uploadError) {
        console.error('tour-room attachment upload failed:', uploadError);
        return NextResponse.json({ error: 'attachment upload failed' }, { status: 502 });
      }
    }

    // Reply/quote: build the snapshot from the REAL original row (anti-forgery),
    // scoped to this room. Missing/foreign originals are silently ignored.
    let replyToMessageId: string | null = null;
    if (replyToId) {
      const { data: original } = await supabase
        .from('tour_room_messages')
        .select('id, room_id, sender_role, input_kind, source_text, metadata')
        .eq('id', replyToId)
        .eq('room_id', room.id)
        .maybeSingle();
      if (original) {
        replyToMessageId = (original as { id: string }).id;
        messageMetadata = { ...messageMetadata, reply_to: buildReplySnapshot(original as RepliableMessage) };
      }
    }

    if (audioFile) {
      const transcribed = await transcribeAudioFile(audioFile, { prompt: sttPrompt });
      text = transcribed.text;
      messageMetadata = {
        ...messageMetadata,
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

    if (!text && !attachmentFile) {
      return NextResponse.json({ error: 'text, audio, or attachment is required' }, { status: 400 });
    }

    // R-6 (T1.3): a translation failure must never block the message — post
    // the original immediately and mark it pending for async repair.
    let translation: TranslationResult;
    if (preset) {
      translation = { source_locale: 'en', translations: { ...preset.text } };
    } else if (pretranslated) {
      translation = pretranslated;
    } else if (!text) {
      // A caption-less attachment has nothing to translate.
      translation = { source_locale: 'und', translations: {} };
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
        reply_to_message_id: replyToMessageId,
        metadata: messageMetadata,
      })
      .select()
      .single();

    if (error) throw error;

    // D-1/§O-7: push the committed row to the room channel; best-effort by
    // design — clients recover any gap via the after-cursor resync.
    await broadcastToRoom(room, 'message', { message });

    // Language-agnostic bridge: remember what language this guest actually
    // writes in (detected by the translation router), so the NEXT fan-out —
    // e.g. the driver's Korean voice reply — targets it too. Plain chat only:
    // presets/acks carry fixed-locale text and say nothing about the guest.
    if (senderRole === 'customer' && actor.kind === 'session' && !preset && !ackKind) {
      // An explicit chat-language override is authoritative — pin it and never
      // let write-detection overwrite it (a guest who chose Italian but types
      // in Spanish must keep receiving operator bubbles in Italian). Auto mode
      // (no override) falls through to the detected write language.
      const next = normalizeChatLocale(chatLocalePref) ?? normalizeChatLocale(translation.source_locale);
      if (next) {
        void supabase
          .from('tour_room_participants')
          .update({ chat_locale: next, updated_at: new Date().toISOString() })
          .eq('id', actor.sessionPayload.participantId)
          .then(() => undefined, () => undefined);
      }
    }

    // Driver background alert (P-D7): a guest message rings the driver's device
    // when they're out in a nav app. Generic body (no message content on the
    // lock screen); tapping opens the console where the Korean TTS plays. Acks
    // (headcount confirmations) don't warrant a ping.
    if (senderRole === 'customer' && !ackKind) {
      const driverGate = await requestGate({
        namespace: 'tour_room_driver_msg_push',
        key: `room:${room.id}`,
        perMinute: 6,
        perHour: 60,
      });
      if (driverGate.allowed) {
        void sendDriverRoomPush(supabase, booking.id, {
          body: '손님이 메시지를 보냈어요. 탭하여 확인하세요.',
          tag: `guest-msg-${room.id}`,
        }).catch(() => undefined);
      }
    }

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
