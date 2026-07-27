/**
 * T2.3/T2.9 — server-side TTS generation into the M-5 room-shared cache.
 *
 * One generation per (message, locale): the cache row + the public
 * tour-audio object are shared by every listener in the room. Used by the
 * GET /tts route (on-demand) and by the guide-notice pre-generation hook
 * (§O-2: when participants reported tts_capable=false, their locales are
 * generated at send time so playback has zero first-listener latency).
 */

import { generateSpeechMp3, generateSpeechStream } from '@/lib/openai-server';
import type { RoomDbClient } from '@/lib/tour-room/access';

export const TTS_BUCKET = process.env.SUPABASE_TOUR_AUDIO_BUCKET || 'tour-audio';
export const MAX_TTS_TEXT_CHARS = 1200;

export interface TtsStorageClient extends RoomDbClient {
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        body: Buffer,
        options: { contentType: string; upsert: boolean },
      ): Promise<{ error: unknown }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
}

export interface RoomTtsMessage {
  id: string;
  source_text?: string | null;
  translations?: Record<string, string> | null;
}

/** The text a locale actually hears: its translation, else the original. */
export function speakableText(message: RoomTtsMessage, locale: string): string {
  const translations = message.translations ?? {};
  return (translations[locale] || message.source_text || '').trim().slice(0, MAX_TTS_TEXT_CHARS);
}

/**
 * Ensure a cached mp3 exists for (message, locale); returns its public URL or
 * null when the message has nothing speakable. Safe under races: concurrent
 * generators upload identical content to the same path and upsert the same
 * UNIQUE cache row.
 */
export async function ensureRoomTts(
  supabase: TtsStorageClient,
  roomId: string,
  message: RoomTtsMessage,
  locale: string,
): Promise<string | null> {
  const { data: cached } = await supabase
    .from('tour_room_tts_cache')
    .select('storage_path')
    .eq('message_id', message.id)
    .eq('locale', locale)
    .maybeSingle();
  if (cached?.storage_path) {
    return supabase.storage.from(TTS_BUCKET).getPublicUrl(cached.storage_path).data.publicUrl;
  }

  const text = speakableText(message, locale);
  if (!text) return null;

  const audio = await generateSpeechMp3(text, locale);
  const storagePath = `tour-room-tts/${roomId}/${message.id}-${locale}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(TTS_BUCKET)
    .upload(storagePath, Buffer.from(audio), { contentType: 'audio/mpeg', upsert: true });
  if (uploadError) throw uploadError;

  await supabase
    .from('tour_room_tts_cache')
    .upsert({ message_id: message.id, locale, storage_path: storagePath }, { onConflict: 'message_id,locale' });

  return supabase.storage.from(TTS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
}

export interface RoomTtsStream {
  /** 클라이언트로 그대로 흘려보낼 mp3 본문. */
  body: ReadableStream<Uint8Array>;
  /**
   * 스트림이 끝난 뒤 캐시에 적재한다. 라우트는 이걸 **반드시** 스케줄해야 한다
   * (`after()`): 호출하지 않으면 tee 의 두 번째 분기가 소비되지 않아 메모리에
   * 쌓인다. 실패는 조용히 삼킨다 — 손님은 이미 음성을 들었고, 캐시가 비면
   * 다음 청취자가 한 번 더 생성할 뿐이다.
   */
  persist(): Promise<void>;
}

/**
 * V0.3 — 생성과 동시에 재생. `ensureRoomTts` 는 전체 버퍼(2281ms) → 스토리지
 * 업로드(218ms) → public URL 을 거친 뒤에야 클라이언트가 **그 URL 을 다시
 * 받으러 가는** 구조라, 캐시 미스 첫 청취자는 3초 가까이 기다린다.
 *
 * 여기서는 OpenAI 응답 본문을 그대로 손님에게 흘리면서 같은 바이트를 tee 로
 * 받아 두었다가 응답 후 업로드한다. 첫 바이트 1292ms 에 재생이 시작되고,
 * 캐시는 그대로 채워져 두 번째 청취자부터는 기존 CDN 경로로 0ms 다.
 *
 * 🔴 캐시 자체는 유지한다 — 스토리지 왕복은 218ms 로 범인이 아니었고(실측),
 * 두 번째 청취자부터의 이득이 훨씬 크다.
 */
export async function streamRoomTts(
  supabase: TtsStorageClient,
  roomId: string,
  message: RoomTtsMessage,
  locale: string,
): Promise<RoomTtsStream | null> {
  const text = speakableText(message, locale);
  if (!text) return null;

  const upstream = await generateSpeechStream(text, locale);
  const [toClient, toCache] = upstream.tee();

  const persist = async (): Promise<void> => {
    try {
      const reader = toCache.getReader();
      const chunks: Uint8Array[] = [];
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      const audio = Buffer.concat(chunks);
      if (audio.length === 0) return;

      const storagePath = `tour-room-tts/${roomId}/${message.id}-${locale}.mp3`;
      const { error } = await supabase.storage
        .from(TTS_BUCKET)
        .upload(storagePath, audio, { contentType: 'audio/mpeg', upsert: true });
      if (error) return;

      // 동시에 JSON 경로가 같은 걸 만들었어도 onConflict 가 흡수한다.
      await supabase
        .from('tour_room_tts_cache')
        .upsert({ message_id: message.id, locale, storage_path: storagePath }, { onConflict: 'message_id,locale' });
    } catch {
      /* 캐시 적재 실패가 이미 전달된 음성을 되돌리지는 않는다 */
    }
  };

  return { body: toClient, persist };
}

/**
 * §O-2 pre-generation: after a guide message commits, generate TTS for the
 * locales of participants whose devices reported tts_capable=false. Explicit
 * false only — null means "unknown", and unknown devices probe on demand.
 * Best-effort by contract: any failure leaves on-demand generation intact.
 */
export async function pregenerateGuideNoticeTts(
  supabase: TtsStorageClient,
  roomId: string,
  message: RoomTtsMessage,
): Promise<void> {
  try {
    const { data } = await supabase
      .from('tour_room_participants')
      .select('locale, tts_capable')
      .eq('room_id', roomId)
      .eq('tts_capable', false);
    const locales = [...new Set(((data as Array<{ locale?: string }>) ?? []).map((p) => p.locale).filter(Boolean))] as string[];
    for (const locale of locales) {
      await ensureRoomTts(supabase, roomId, message, locale).catch(() => undefined);
    }
  } catch {
    /* best-effort — on-demand /tts still covers every listener */
  }
}
