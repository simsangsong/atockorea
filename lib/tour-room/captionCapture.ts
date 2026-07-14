'use client';

/**
 * T2.6 — guide-side caption capture.
 *
 * Tier A (free STT): Web Speech API when the guide device supports it —
 * final sentences post as text, no audio ever uploads (§N-1).
 *
 * Tier B (universal): WebAudio energy VAD (no library) segments speech into
 * 3–8s chunks; each chunk is a self-contained MediaRecorder capture posted
 * as multipart audio. Silence never uploads (AC: 무음 구간 업로드 0).
 *
 * The segmentation decision logic is a pure state machine
 * (createVadSegmenter) so the chunk-boundary rules are unit-testable.
 */

import { pickRecorderMimeType } from '@/lib/tour-room/recorder';

// ---------------------------------------------------------------------------
// Pure VAD segmenter (§N-3: 400ms silence = sentence boundary, 3–8s chunks).
// ---------------------------------------------------------------------------

export interface VadOptions {
  /** RMS level at/above which a frame counts as speech. */
  threshold: number;
  /** Silence run that closes an utterance. */
  silenceMs: number;
  /** Chunks shorter than this are noise — discard, don't upload. */
  minSpeechMs: number;
  /** Hard chunk ceiling — split long monologues (upload cadence). */
  maxChunkMs: number;
}

export const DEFAULT_VAD: VadOptions = {
  threshold: 0.06,
  silenceMs: 400,
  minSpeechMs: 700,
  maxChunkMs: 8_000,
};

export type VadDecision = 'start' | 'stop' | 'discard' | null;

/**
 * Feed (level, nowMs) frames; get chunk-boundary decisions:
 *   'start'   — speech began, start capturing;
 *   'stop'    — utterance ended (silence) or ceiling hit, ship the chunk;
 *   'discard' — the "speech" was a sub-minSpeechMs blip, drop the capture.
 */
export function createVadSegmenter(options: VadOptions = DEFAULT_VAD): {
  push(level: number, nowMs: number): VadDecision;
  reset(): void;
} {
  let speaking = false;
  let speechStartMs = 0;
  let lastVoiceMs = 0;

  return {
    push(level: number, nowMs: number): VadDecision {
      const voiced = level >= options.threshold;
      if (!speaking) {
        if (!voiced) return null;
        speaking = true;
        speechStartMs = nowMs;
        lastVoiceMs = nowMs;
        return 'start';
      }
      if (voiced) lastVoiceMs = nowMs;
      if (nowMs - speechStartMs >= options.maxChunkMs) {
        speaking = false;
        return 'stop';
      }
      if (nowMs - lastVoiceMs >= options.silenceMs) {
        speaking = false;
        const voicedMs = lastVoiceMs - speechStartMs;
        return voicedMs >= options.minSpeechMs ? 'stop' : 'discard';
      }
      return null;
    },
    reset() {
      speaking = false;
    },
  };
}

// ---------------------------------------------------------------------------
// Tier detection + capture orchestration.
// ---------------------------------------------------------------------------

type SpeechRecognitionCtor = new () => {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: { resultIndex: number; results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }> }) => void) | null;
  onerror: ((event: unknown) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
};

function speechRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type CaptionTier = 'web-speech' | 'chunked-audio' | 'unsupported';

export function detectCaptionTier(): CaptionTier {
  if (speechRecognitionCtor()) return 'web-speech';
  if (
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    pickRecorderMimeType() !== null
  ) {
    return 'chunked-audio';
  }
  return 'unsupported';
}

export interface CaptionCaptureHandlers {
  /** Tier A: a final recognized sentence. */
  onText?: (text: string) => void;
  /** Tier B: a finished speech chunk. */
  onChunk?: (blob: Blob, mimeType: string) => void;
  onLevel?: (level: number) => void;
  onError?: (error: unknown) => void;
}

export interface CaptionCapture {
  tier: CaptionTier;
  stop(): void;
}

/**
 * Start capturing the guide's speech; runs until stop(). Tier A restarts the
 * recognizer on its periodic self-termination; Tier B recycles a MediaRecorder
 * per VAD utterance so every uploaded blob is a valid standalone container.
 */
export async function startCaptionCapture(
  handlers: CaptionCaptureHandlers,
  lang = 'ko-KR',
  vadOptions: VadOptions = DEFAULT_VAD,
): Promise<CaptionCapture> {
  const tier = detectCaptionTier();
  if (tier === 'unsupported') throw new Error('caption_capture_unsupported');

  if (tier === 'web-speech') {
    const Ctor = speechRecognitionCtor()!;
    const recognizer = new Ctor();
    recognizer.lang = lang;
    recognizer.continuous = true;
    recognizer.interimResults = false;
    let stopped = false;
    recognizer.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) handlers.onText?.(text);
        }
      }
    };
    recognizer.onerror = (error) => handlers.onError?.(error);
    // Engines self-terminate recognition periodically — keep it alive.
    recognizer.onend = () => {
      if (!stopped) {
        try {
          recognizer.start();
        } catch {
          /* already restarting */
        }
      }
    };
    recognizer.start();
    return {
      tier,
      stop() {
        stopped = true;
        recognizer.stop();
      },
    };
  }

  // Tier B — VAD-segmented MediaRecorder chunks.
  const mimeType = pickRecorderMimeType()!;
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  type AudioContextCtor = new () => AudioContext;
  const Ctx =
    (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ??
    (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
  if (!Ctx) {
    stream.getTracks().forEach((t) => t.stop());
    throw new Error('caption_capture_unsupported');
  }
  const audioCtx = new Ctx();
  const source = audioCtx.createMediaStreamSource(stream);
  const analyser = audioCtx.createAnalyser();
  analyser.fftSize = 256;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);
  const segmenter = createVadSegmenter(vadOptions);

  let recorder: MediaRecorder | null = null;
  let chunks: BlobPart[] = [];
  let discardCurrent = false;
  let raf = 0;
  let stopped = false;

  const beginUtterance = () => {
    chunks = [];
    discardCurrent = false;
    recorder = new MediaRecorder(stream, { mimeType });
    recorder.addEventListener('dataavailable', (event) => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    });
    recorder.addEventListener('stop', () => {
      if (!discardCurrent && chunks.length > 0 && !stopped) {
        handlers.onChunk?.(new Blob(chunks, { type: mimeType }), mimeType);
      }
      chunks = [];
    });
    recorder.start();
  };
  const endUtterance = (discard: boolean) => {
    if (!recorder) return;
    discardCurrent = discard;
    if (recorder.state === 'recording') recorder.stop();
    recorder = null;
  };

  const tick = () => {
    if (stopped) return;
    analyser.getByteTimeDomainData(data);
    let sum = 0;
    for (let i = 0; i < data.length; i += 1) {
      const centered = (data[i] - 128) / 128;
      sum += centered * centered;
    }
    const level = Math.min(1, Math.sqrt(sum / data.length) * 3);
    handlers.onLevel?.(level);
    const decision = segmenter.push(level, Date.now());
    if (decision === 'start') beginUtterance();
    else if (decision === 'stop') endUtterance(false);
    else if (decision === 'discard') endUtterance(true);
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    tier,
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
      endUtterance(true);
      stream.getTracks().forEach((track) => track.stop());
      void audioCtx.close().catch(() => undefined);
    },
  };
}
