'use client';

/**
 * T2.9 — TTS capability ladder (§O-2).
 *
 *   1. device speechSynthesis — only after verifying a voice for the target
 *      locale actually exists (getVoices() races async voice loading, so we
 *      wait for `voiceschanged`; API presence ≠ voice presence: Android
 *      without the language pack and in-app webviews report empty voices);
 *   2. server TTS — GET /api/tour-rooms/[bookingId]/tts (M-5 cache, one
 *      generation per message+locale shared by the whole room), played
 *      through an HTML5 Audio element (media channel — audible even with the
 *      iOS silent switch on);
 *   3. nothing — captions/text are always the primary channel; callers show
 *      a "voice unavailable" badge and lose no functionality.
 *
 * Everything DOM-dependent takes an injectable handle so the ladder logic is
 * unit-testable without a browser.
 */

import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** BCP-47 utterance languages per room locale. */
export const TTS_LANG: Record<RoomLocale, string> = {
  en: 'en-US',
  ko: 'ko-KR',
  ja: 'ja-JP',
  es: 'es-ES',
  zh: 'zh-CN',
};

export interface VoiceLike {
  lang: string;
  name?: string;
}

export interface SynthLike {
  getVoices(): VoiceLike[];
  speak(utterance: SpeechSynthesisUtterance): void;
  cancel(): void;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
}

/** Does any installed voice cover the locale? (language-prefix match) */
export function hasLocaleVoice(voices: VoiceLike[], locale: RoomLocale): boolean {
  const prefix = TTS_LANG[locale].split('-')[0].toLowerCase();
  return voices.some((voice) => (voice.lang || '').toLowerCase().replace('_', '-').startsWith(prefix));
}

/**
 * Voices load asynchronously on most engines: an empty getVoices() result is
 * ambiguous until `voiceschanged` fires (or a short timeout says it never
 * will — the in-app-webview signature).
 */
export function loadVoices(synth: SynthLike, timeoutMs = 1500): Promise<VoiceLike[]> {
  const immediate = synth.getVoices();
  if (immediate.length > 0) return Promise.resolve(immediate);
  if (!synth.addEventListener) return Promise.resolve([]);

  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      synth.removeEventListener?.('voiceschanged', finish);
      resolve(synth.getVoices());
    };
    synth.addEventListener?.('voiceschanged', finish);
    setTimeout(finish, timeoutMs);
  });
}

export type TtsTier = 'device' | 'server' | 'none';

/** Which ladder tier this device can serve for `locale`. */
export async function detectTtsTier(
  locale: RoomLocale,
  synth: SynthLike | null = typeof window !== 'undefined' ? (window.speechSynthesis as unknown as SynthLike) : null,
): Promise<TtsTier> {
  if (!synth || typeof synth.getVoices !== 'function') return 'server';
  const voices = await loadVoices(synth);
  return hasLocaleVoice(voices, locale) ? 'device' : 'server';
}

/** Tier 1 — resolves true when speech completed, false on error/unavailable. */
export function speakWithDevice(
  text: string,
  locale: RoomLocale,
  synth: SynthLike | null = typeof window !== 'undefined' ? (window.speechSynthesis as unknown as SynthLike) : null,
): Promise<boolean> {
  if (!synth || typeof SpeechSynthesisUtterance === 'undefined') return Promise.resolve(false);
  return new Promise((resolve) => {
    try {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = TTS_LANG[locale];
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      synth.speak(utterance);
    } catch {
      resolve(false);
    }
  });
}

export interface ServerTtsTarget {
  bookingId: string;
  messageId: string;
  locale: RoomLocale;
  roomSession: string;
}

/** Tier 2 — fetch the cached/generated mp3 URL, play via HTML5 Audio. */
export async function playServerTts(target: ServerTtsTarget): Promise<boolean> {
  try {
    const res = await fetch(
      `/api/tour-rooms/${encodeURIComponent(target.bookingId)}/tts?messageId=${encodeURIComponent(
        target.messageId,
      )}&locale=${target.locale}`,
      { headers: { 'x-tour-room-auth': target.roomSession } },
    );
    if (!res.ok) return false;
    const { url } = (await res.json()) as { url?: string };
    if (!url) return false;
    const audio = new Audio(url);
    await audio.play();
    return true;
  } catch {
    return false;
  }
}

/**
 * The full ladder for one message. Returns the tier that actually produced
 * sound ('none' = show the voice-unavailable badge, §O-2 ③).
 */
export async function speakMessage(
  text: string,
  target: ServerTtsTarget,
  synth?: SynthLike | null,
): Promise<TtsTier> {
  const tier = await detectTtsTier(target.locale, synth);
  if (tier === 'device' && (await speakWithDevice(text, target.locale, synth))) return 'device';
  if (await playServerTts(target)) return 'server';
  return 'none';
}

// ---------------------------------------------------------------------------
// Audio priming (T2.4): mobile browsers block programmatic playback until a
// user gesture "unlocks" audio. Call once from any tap/click handler.
// ---------------------------------------------------------------------------

let primed = false;

/** True once a user gesture has unlocked audio playback this session. */
export function isAudioPrimed(): boolean {
  return primed;
}

export function primeAudio(): void {
  if (primed || typeof window === 'undefined') return;
  primed = true;
  try {
    // A zero-length silent buffer satisfies the autoplay gesture requirement
    // for both WebAudio and (on most engines) HTMLAudio started later.
    type AudioContextCtor = new () => AudioContext;
    const Ctx =
      (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    void ctx.resume?.();
  } catch {
    /* priming is best-effort; play() failures surface a toast instead */
  }
}

/** Test hook. */
export function __resetAudioPrimingForTests(): void {
  primed = false;
}
