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
  'zh-TW': 'zh-TW',
  fr: 'fr-FR',
  de: 'de-DE',
  ru: 'ru-RU',
  it: 'it-IT',
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

/**
 * BCP-47 tag for a locale, tolerating languages outside the 5 room locales.
 * The chat bridge lets a guest read in any language (chat_locale), and
 * `TTS_LANG[locale]` was undefined for those — `.split()` then threw and left
 * the speaker button spinning forever instead of degrading (P0-6).
 */
export function utteranceLang(locale: string): string {
  return TTS_LANG[locale as RoomLocale] ?? locale ?? 'en-US';
}

/** Does any installed voice cover the locale? (language-prefix match) */
export function hasLocaleVoice(voices: VoiceLike[], locale: RoomLocale): boolean {
  const prefix = utteranceLang(locale).split('-')[0].toLowerCase();
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
      utterance.lang = utteranceLang(locale);
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
    // P0-6 — reuse the gesture-warmed element (see primeAudio). A fresh
    // `new Audio(url)` created after the await has no user activation left and
    // iOS Safari / in-app webviews reject its play(), which is what left the
    // speaker stuck on the muted glyph.
    const audio = warmAudio ?? new Audio();
    audio.src = url;
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

/**
 * P0-6 — the single HTMLMediaElement every server-tier playback reuses.
 *
 * On iOS Safari and in-app webviews only an element that was played during a
 * user gesture may be played programmatically afterwards; a fresh
 * `new Audio(url)` per message stays blocked forever. The driver cockpit
 * already solved this (Cockpit.tsx, T0-5) — the guest path never got the fix,
 * so every guest tap fell through to 'none' and the button showed 🔇.
 */
const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAiBUAABArAAACABAAZGF0YQAAAAA=';

let warmAudio: HTMLAudioElement | null = null;

/** True once a user gesture has unlocked audio playback this session. */
export function isAudioPrimed(): boolean {
  return primed;
}

export function primeAudio(): void {
  if (primed || typeof window === 'undefined') return;
  primed = true;
  try {
    // Unlock the MEDIA channel by playing silence on the element we will keep
    // reusing. This must happen inside the gesture, before any await.
    if (typeof Audio !== 'undefined' && !warmAudio) {
      const element = new Audio(SILENT_WAV);
      element.preload = 'auto';
      void element.play().catch(() => {
        /* still worth reusing: some engines unlock on the attempt alone */
      });
      warmAudio = element;
    }
  } catch {
    /* fall through to the WebAudio prime below */
  }
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
  warmAudio = null;
}
