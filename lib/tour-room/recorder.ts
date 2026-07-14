'use client';

/**
 * T2.1 — push-to-talk recording helper.
 *
 * MediaRecorder with codec negotiation (webm/opus everywhere modern; iOS
 * Safari records mp4/aac — §F T2.1), a hard 60s ceiling, and a lightweight
 * level meter (WebAudio AnalyserNode → 0..1 callback) that drives the
 * Composer's recording animation.
 *
 * O-9: devices without MediaRecorder simply never show the mic button —
 * `isVoiceRecordingSupported()` is the gate, no error dialogs.
 */

export const MAX_RECORDING_MS = 60_000;

const MIME_CANDIDATES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4', // iOS Safari
  'audio/aac',
];

/** First recorder mime the engine supports; null when recording can't work. */
export function pickRecorderMimeType(
  isTypeSupported: (type: string) => boolean = (type) =>
    typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type),
): string | null {
  for (const candidate of MIME_CANDIDATES) {
    try {
      if (isTypeSupported(candidate)) return candidate;
    } catch {
      /* engines may throw on unknown types */
    }
  }
  return null;
}

export function isVoiceRecordingSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof MediaRecorder !== 'undefined' &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    pickRecorderMimeType() !== null
  );
}

/** File extension matching the negotiated container (for the upload name). */
export function extensionForMime(mimeType: string): string {
  if (mimeType.includes('mp4')) return 'm4a';
  if (mimeType.includes('aac')) return 'aac';
  return 'webm';
}

export interface ActiveRecording {
  /** Stop and resolve the recorded clip (also called by the 60s ceiling). */
  stop(): void;
  /** Abort and discard — onFinish is never called. */
  cancel(): void;
}

export interface StartRecordingOptions {
  /** 0..1 RMS level, ~30fps — drives the recording animation. */
  onLevel?: (level: number) => void;
  onElapsed?: (elapsedMs: number) => void;
  /** The finished clip; `null` when recording produced no data. */
  onFinish: (clip: { blob: Blob; mimeType: string; durationMs: number } | null) => void;
  onError?: (error: unknown) => void;
  maxMs?: number;
}

/**
 * Request the mic and start recording. Resolves with control handles, or
 * throws when permission is denied / no recorder is available (callers show
 * the settings-guidance copy, never a dead error dialog).
 */
export async function startVoiceRecording(options: StartRecordingOptions): Promise<ActiveRecording> {
  const mimeType = pickRecorderMimeType();
  if (!mimeType) throw new Error('recording_unsupported');

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const recorder = new MediaRecorder(stream, { mimeType });
  const chunks: BlobPart[] = [];
  const startedAt = Date.now();
  const maxMs = options.maxMs ?? MAX_RECORDING_MS;

  let cancelled = false;
  let meterRaf = 0;
  let audioCtx: AudioContext | null = null;

  // Level meter — best-effort; recording works without WebAudio.
  try {
    type AudioContextCtor = new () => AudioContext;
    const Ctx =
      (window as unknown as { AudioContext?: AudioContextCtor; webkitAudioContext?: AudioContextCtor }).AudioContext ??
      (window as unknown as { webkitAudioContext?: AudioContextCtor }).webkitAudioContext;
    if (Ctx && options.onLevel) {
      audioCtx = new Ctx();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i += 1) {
          const centered = (data[i] - 128) / 128;
          sum += centered * centered;
        }
        options.onLevel?.(Math.min(1, Math.sqrt(sum / data.length) * 3));
        options.onElapsed?.(Date.now() - startedAt);
        meterRaf = requestAnimationFrame(tick);
      };
      meterRaf = requestAnimationFrame(tick);
    }
  } catch {
    /* meter unavailable — keep recording */
  }

  const cleanup = () => {
    cancelAnimationFrame(meterRaf);
    stream.getTracks().forEach((track) => track.stop());
    void audioCtx?.close().catch(() => undefined);
  };

  recorder.addEventListener('dataavailable', (event) => {
    if (event.data && event.data.size > 0) chunks.push(event.data);
  });
  recorder.addEventListener('stop', () => {
    cleanup();
    if (cancelled) return;
    const durationMs = Date.now() - startedAt;
    if (chunks.length === 0) {
      options.onFinish(null);
      return;
    }
    options.onFinish({ blob: new Blob(chunks, { type: mimeType }), mimeType, durationMs });
  });
  recorder.addEventListener('error', (event) => {
    cleanup();
    options.onError?.(event);
  });

  recorder.start();
  const ceiling = setTimeout(() => {
    if (recorder.state === 'recording') recorder.stop();
  }, maxMs);

  return {
    stop() {
      clearTimeout(ceiling);
      if (recorder.state === 'recording') recorder.stop();
    },
    cancel() {
      cancelled = true;
      clearTimeout(ceiling);
      if (recorder.state === 'recording') recorder.stop();
      else cleanup();
    },
  };
}
