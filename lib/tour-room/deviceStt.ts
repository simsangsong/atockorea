'use client';

/**
 * Device-native speech-to-text (Web Speech API) for push-to-talk voice input.
 *
 * When the browser can transcribe on its own, we skip the server Whisper round
 * trip entirely: the recognized text goes straight through the normal text
 * path (translate → fan-out). Free, fast, no audio upload. Server STT stays the
 * fallback for everyone else (isDeviceSttSupported() === false).
 *
 * Coverage is deliberately conservative — the constructor merely EXISTING isn't
 * enough. Samsung Internet exposes `webkitSpeechRecognition` but it's
 * unreliable/non-functional; in-app webviews can't run it at all. Those UAs are
 * excluded so they fall cleanly to the server path instead of dead-ending on a
 * broken recognizer.
 */

type RecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type RecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: { results: ArrayLike<RecognitionResultLike> }) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => RecognitionInstance;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/** UAs that expose SpeechRecognition but can't be trusted to run it. */
const BLOCKED_STT_UA =
  /(SamsungBrowser|KAKAOTALK|Instagram|FBAN|FBAV|FB_IAB|Line\/|NAVER\(inapp|DaumApps|; wv\))/i;

/** Pure UA/ctor gate (exported for tests). */
export function deviceSttUsable(ctorPresent: boolean, userAgent: string): boolean {
  if (!ctorPresent) return false;
  return !BLOCKED_STT_UA.test(userAgent);
}

export function isDeviceSttSupported(): boolean {
  return deviceSttUsable(Boolean(recognitionCtor()), typeof navigator !== 'undefined' ? navigator.userAgent || '' : '');
}

export interface DeviceSttHandle {
  /** Finalize — resolves onFinal with whatever was recognized so far. */
  stop(): void;
  /** Abort and discard — onFinal never fires. */
  cancel(): void;
}

/**
 * One-shot recognition: start on mic-down, stop() on mic-up. `onFinal` fires
 * exactly once with the (trimmed) transcript — '' when nothing was recognized,
 * so callers can fall back to the server path. `onPartial` streams the interim
 * transcript for a live "words appearing" affordance.
 */
export function startDeviceStt(opts: {
  lang: string;
  onFinal: (text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (error: string) => void;
}): DeviceSttHandle {
  const Ctor = recognitionCtor();
  if (!Ctor) {
    opts.onError?.('unsupported');
    opts.onFinal('');
    return { stop() {}, cancel() {} };
  }

  const recognizer = new Ctor();
  recognizer.lang = opts.lang;
  recognizer.continuous = false;
  recognizer.interimResults = Boolean(opts.onPartial);
  recognizer.maxAlternatives = 1;

  let finalText = '';
  let settled = false;
  const settle = () => {
    if (settled) return;
    settled = true;
    opts.onFinal(finalText.trim());
  };

  recognizer.onresult = (event) => {
    let interim = '';
    const results = event.results;
    for (let i = 0; i < results.length; i += 1) {
      const result = results[i];
      const transcript = result[0]?.transcript ?? '';
      if (result.isFinal) finalText += transcript;
      else interim += transcript;
    }
    if (interim && opts.onPartial) opts.onPartial(interim);
  };
  recognizer.onerror = (event) => {
    opts.onError?.(event?.error ?? 'error');
    settle();
  };
  recognizer.onend = () => settle();

  try {
    recognizer.start();
  } catch {
    opts.onError?.('start_failed');
    settle();
  }

  return {
    stop() {
      try {
        recognizer.stop();
      } catch {
        settle();
      }
    },
    cancel() {
      settled = true; // suppress onFinal
      try {
        recognizer.abort();
      } catch {
        /* already stopped */
      }
    },
  };
}
