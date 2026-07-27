/**
 * T2.3/T2.9 — server-side TTS generation into the M-5 room-shared cache.
 *
 * One generation per (message, locale): the cache row + the public
 * tour-audio object are shared by every listener in the room. Used by the
 * GET /tts route (on-demand) and by the guide-notice pre-generation hook
 * (§O-2: when participants reported tts_capable=false, their locales are
 * generated at send time so playback has zero first-listener latency).
 */

import { generateSpeechMp3 } from '@/lib/openai-server';
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

/**
 * A2 — which spoken track a request wants.
 *
 *   'body'      the message text (what the ladder has always spoken);
 *   'narration' the spot briefing behind an arrival card — the part a live
 *               guide would actually say out loud, which used to be readable
 *               only, and only after tapping "More details".
 */
export type TtsPart = 'body' | 'narration';

/** The text a locale actually hears: its translation, else the original. */
export function speakableText(message: RoomTtsMessage, locale: string): string {
  const translations = message.translations ?? {};
  return (translations[locale] || message.source_text || '').trim().slice(0, MAX_TTS_TEXT_CHARS);
}

/**
 * Ensure a cached mp3 exists for (message, locale, part); returns its public
 * URL or null when there is nothing speakable. Safe under races: concurrent
 * generators upload identical content to the same path and upsert the same
 * UNIQUE cache row.
 *
 * `options.text` overrides the message body — narration is composed from the
 * card metadata, not stored as message text. `locale` must be the language the
 * text is genuinely written in, so eight room locales that all fall back to
 * English share one mp3 instead of paying for eight identical generations.
 */
export async function ensureRoomTts(
  supabase: TtsStorageClient,
  roomId: string,
  message: RoomTtsMessage,
  locale: string,
  options: { part?: TtsPart; text?: string } = {},
): Promise<string | null> {
  const part: TtsPart = options.part ?? 'body';
  const { data: cached } = await supabase
    .from('tour_room_tts_cache')
    .select('storage_path')
    .eq('message_id', message.id)
    .eq('locale', locale)
    .eq('part', part)
    .maybeSingle();
  if (cached?.storage_path) {
    return supabase.storage.from(TTS_BUCKET).getPublicUrl(cached.storage_path).data.publicUrl;
  }

  const text = (options.text ?? speakableText(message, locale)).trim().slice(0, MAX_TTS_TEXT_CHARS);
  if (!text) return null;

  const audio = await generateSpeechMp3(text, locale);
  const suffix = part === 'body' ? '' : `-${part}`;
  const storagePath = `tour-room-tts/${roomId}/${message.id}-${locale}${suffix}.mp3`;
  const { error: uploadError } = await supabase.storage
    .from(TTS_BUCKET)
    .upload(storagePath, Buffer.from(audio), { contentType: 'audio/mpeg', upsert: true });
  if (uploadError) throw uploadError;

  await supabase
    .from('tour_room_tts_cache')
    .upsert(
      { message_id: message.id, locale, part, storage_path: storagePath },
      { onConflict: 'message_id,locale,part' },
    );

  return supabase.storage.from(TTS_BUCKET).getPublicUrl(storagePath).data.publicUrl;
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
