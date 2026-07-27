import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requestGate, clientIpKey } from '@/lib/durable-rate-limit';
import { resolveRoomActor, type RoomBooking } from '@/lib/tour-room/access';
import { transcribeAudioFile, translateTextForLocales } from '@/lib/openai-server';
import { roomSttPrompt } from '@/lib/tour-room/sttPrompt.server';
import {
  MAX_INTERPRET_CHARS,
  droppedNumbers,
  interpretDirection,
  isNoopDirection,
  normalizeInterpretSide,
} from '@/lib/tour-room/interpret';

export const dynamic = 'force-dynamic';

/**
 * V1 — 대면 통역 한 턴.
 *
 * POST /api/tour-rooms/[bookingId]/interpret
 *   multipart: audio(File) · side('guest'|'local') · guestLocale · [localLocale]
 *   json:      { text, side, guestLocale, localLocale? }
 *   → { sourceText, translatedText, from, to, droppedNumbers[] }
 *
 * 🔴 **채팅에 쓰지 않는다.** 식당에서 5분 대화하면 투어 채팅이 통째로 묻힌다.
 * 이 엔드포인트는 순수 변환기다 — 기록이 필요하면 손님이 따로 채팅에 남긴다.
 *
 * 🔴 TTS 는 **기기 음성**(`speakWithDevice`)이 맡는다. 서버 TTS 캐시는
 * `message_id` 로 키가 잡혀 있어 메시지 없는 턴을 담을 자리가 없고, 대면에서는
 * 어차피 상대가 화면을 보고 있으므로 큰 글씨 자막이 1차 채널이다. 한국어 음성이
 * 없는 기기면 상대는 읽는다 — 그것도 통한다.
 *
 * 인증·레이트게이트가 **유료 호출보다 먼저** 돈다(T0.8 원칙). 한도는 실제 대화
 * 길이에 맞췄다 — 식당에서 한 번 주고받으면 20턴은 우습게 넘어간다.
 */

const MAX_AUDIO_BYTES = 15 * 1024 * 1024;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ bookingId: string }> },
) {
  try {
    const { bookingId } = await params;
    const supabase = createServerClient();

    const contentType = req.headers.get('content-type') ?? '';
    const isMultipart = contentType.includes('multipart/form-data');

    let audio: File | null = null;
    let text = '';
    let sideRaw: unknown = null;
    let guestLocale = '';
    let localLocale = '';
    let guestEmail = '';
    let guestName = '';

    if (isMultipart) {
      const form = await req.formData();
      const file = form.get('audio');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'audio file is required' }, { status: 400 });
      }
      if (file.size === 0 || file.size > MAX_AUDIO_BYTES) {
        return NextResponse.json({ error: 'audio file size out of range' }, { status: 400 });
      }
      audio = file;
      sideRaw = form.get('side');
      guestLocale = String(form.get('guestLocale') || '');
      localLocale = String(form.get('localLocale') || '');
      guestEmail = String(form.get('contactEmail') || '');
      guestName = String(form.get('contactName') || '');
    } else {
      const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
      text = typeof body.text === 'string' ? body.text.trim().slice(0, MAX_INTERPRET_CHARS) : '';
      sideRaw = body.side;
      guestLocale = typeof body.guestLocale === 'string' ? body.guestLocale : '';
      localLocale = typeof body.localLocale === 'string' ? body.localLocale : '';
      if (!text) {
        return NextResponse.json({ error: 'text or audio is required' }, { status: 400 });
      }
    }

    const side = normalizeInterpretSide(sideRaw);
    if (!side) {
      return NextResponse.json({ error: "side must be 'guest' or 'local'" }, { status: 400 });
    }

    const resolved = await resolveRoomActor(req, bookingId, { supabase, guestEmail, guestName });
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const gate = await requestGate({
      namespace: 'tour_room_interpret',
      key: clientIpKey(req.headers),
      perMinute: 20,
      perHour: 200,
    });
    if (!gate.allowed) {
      return NextResponse.json(
        { error: 'rate_limited' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((gate.retryAfterMs ?? 0) / 1000)) } },
      );
    }

    const booking = resolved.booking as RoomBooking;
    const direction = interpretDirection(side, guestLocale, localLocale || undefined);

    if (audio) {
      // V0.1 과 같은 용어 바이어싱 — 오늘 가는 곳 이름이 대면 대화에도 그대로 나온다
      // ("성산일출봉 가려면?"). 룸별 캐시라 첫 턴에서만 DB 를 친다.
      const sttPrompt = await roomSttPrompt(supabase, {
        bookingId: booking.id,
        tourDate: booking.tour_date,
        tourId: booking.tour_id,
      });
      const transcribed = await transcribeAudioFile(audio, sttPrompt ? { prompt: sttPrompt } : {});
      text = (transcribed.text ?? '').trim().slice(0, MAX_INTERPRET_CHARS);
    }

    if (!text) {
      // 무음·잡음만 잡힌 턴. 빈 말풍선을 띄우느니 아무것도 안 한다.
      return NextResponse.json({ sourceText: '', translatedText: '', ...direction, droppedNumbers: [] });
    }

    // 같은 언어끼리면 옮길 게 없다 — 유료 호출을 아낀다.
    if (isNoopDirection(direction)) {
      return NextResponse.json({ sourceText: text, translatedText: text, ...direction, droppedNumbers: [] });
    }

    let translatedText = '';
    try {
      const translated = await translateTextForLocales(text, [direction.to]);
      translatedText = translated.translations[direction.to] ?? '';
    } catch (translationError) {
      // 원문은 살린다 — 상대가 번역기에 직접 넣을 수라도 있어야 한다.
      console.warn('[interpret] translation failed, returning source only:', translationError);
    }

    // 시간·금액·인원이 번역에서 증발했는지. 조용히 틀린 시각을 말하는 것보다
    // 화면에 원문 숫자를 같이 띄우는 편이 낫다.
    const dropped = translatedText ? droppedNumbers(text, translatedText) : [];

    return NextResponse.json({
      sourceText: text,
      translatedText,
      ...direction,
      droppedNumbers: dropped,
    });
  } catch (error) {
    console.error('POST /api/tour-rooms/[bookingId]/interpret error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
