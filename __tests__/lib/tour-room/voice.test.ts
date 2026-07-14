/**
 * Wave T2 client libs — T2.9 TTS ladder (voice detection + fallback order)
 * and T2.6 VAD segmentation / recorder mime negotiation (pure logic).
 */
import {
  hasLocaleVoice,
  loadVoices,
  detectTtsTier,
  speakMessage,
  TTS_LANG,
  type SynthLike,
  type VoiceLike,
} from '@/lib/tour-room/tts';
import { createVadSegmenter, DEFAULT_VAD } from '@/lib/tour-room/captionCapture';
import { pickRecorderMimeType, extensionForMime } from '@/lib/tour-room/recorder';

describe('TTS_LANG', () => {
  it('maps every room locale to a BCP-47 tag', () => {
    for (const lang of Object.values(TTS_LANG)) expect(lang).toMatch(/^[a-z]{2}-[A-Z]{2}$/);
  });
});

describe('hasLocaleVoice', () => {
  const voices: VoiceLike[] = [{ lang: 'en-US' }, { lang: 'zh_CN' }, { lang: 'ja-JP' }];
  it('matches by language prefix, tolerant of underscore tags', () => {
    expect(hasLocaleVoice(voices, 'en')).toBe(true);
    expect(hasLocaleVoice(voices, 'zh')).toBe(true);
    expect(hasLocaleVoice(voices, 'ja')).toBe(true);
    expect(hasLocaleVoice(voices, 'ko')).toBe(false);
    expect(hasLocaleVoice([], 'en')).toBe(false);
  });
});

function fakeSynth(input: {
  voices?: VoiceLike[];
  voicesAfterEvent?: VoiceLike[];
  speakOutcome?: 'end' | 'error' | 'silent';
}): SynthLike & { spoken: string[] } {
  let currentVoices = input.voices ?? [];
  const listeners = new Set<() => void>();
  const synth = {
    spoken: [] as string[],
    getVoices: () => currentVoices,
    speak(utterance: SpeechSynthesisUtterance) {
      synth.spoken.push(utterance.text);
      if (input.speakOutcome === 'end') utterance.onend?.(new Event('end') as never);
      else if (input.speakOutcome === 'error') utterance.onerror?.(new Event('error') as never);
      // 'silent' — never resolves; callers should not depend on it here
    },
    cancel() {},
    addEventListener(_type: string, listener: () => void) {
      listeners.add(listener);
      if (input.voicesAfterEvent) {
        currentVoices = input.voicesAfterEvent;
        queueMicrotask(() => listeners.forEach((l) => l()));
      }
    },
    removeEventListener(_type: string, listener: () => void) {
      listeners.delete(listener);
    },
  };
  return synth;
}

describe('loadVoices / detectTtsTier (§O-2 ①)', () => {
  it('returns immediately-available voices', async () => {
    const synth = fakeSynth({ voices: [{ lang: 'ko-KR' }] });
    expect(await loadVoices(synth)).toHaveLength(1);
    expect(await detectTtsTier('ko', synth)).toBe('device');
  });

  it('waits for voiceschanged when the initial list is empty', async () => {
    const synth = fakeSynth({ voices: [], voicesAfterEvent: [{ lang: 'es-ES' }] });
    expect(await detectTtsTier('es', synth)).toBe('device');
  });

  it('falls to server tier when voices stay empty (in-app webview signature)', async () => {
    const synth = fakeSynth({ voices: [] });
    expect(await detectTtsTier('en', { ...synth, addEventListener: undefined } as never)).toBe('server');
  });

  it('API presence ≠ voice presence: wrong-locale voices → server tier', async () => {
    const synth = fakeSynth({ voices: [{ lang: 'en-US' }] });
    expect(await detectTtsTier('ko', synth)).toBe('server');
  });

  it('no speechSynthesis at all → server tier', async () => {
    expect(await detectTtsTier('en', null)).toBe('server');
  });
});

describe('speakMessage ladder (T2.9)', () => {
  const target = { bookingId: 'b1', messageId: 'm1', locale: 'ko' as const, roomSession: 'rs' };

  beforeAll(() => {
    // jsdom ships no speech synthesis — a minimal utterance stand-in.
    (global as { SpeechSynthesisUtterance?: unknown }).SpeechSynthesisUtterance = class {
      text: string;
      lang = '';
      onend: ((e: unknown) => void) | null = null;
      onerror: ((e: unknown) => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  it('device voice present and speech succeeds → device tier, no server call', async () => {
    const synth = fakeSynth({ voices: [{ lang: 'ko-KR' }], speakOutcome: 'end' });
    const tier = await speakMessage('안내입니다', target, synth);
    expect(tier).toBe('device');
    expect(synth.spoken).toEqual(['안내입니다']);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('device speech errors → server fallback plays the cached mp3', async () => {
    const synth = fakeSynth({ voices: [{ lang: 'ko-KR' }], speakOutcome: 'error' });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn.test/a.mp3' }),
    });
    const play = jest.fn(async () => undefined);
    // jsdom has no Audio playback — stub the constructor.
    (global as { Audio?: unknown }).Audio = jest.fn(() => ({ play }));
    const tier = await speakMessage('안내입니다', target, synth);
    expect(tier).toBe('server');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tour-rooms/b1/tts?messageId=m1&locale=ko'),
      expect.objectContaining({ headers: { 'x-tour-room-auth': 'rs' } }),
    );
    expect(play).toHaveBeenCalled();
  });

  it('every tier fails → none (voice-unavailable badge, §O-2 ③)', async () => {
    const synth = fakeSynth({ voices: [] });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    const tier = await speakMessage('hello', { ...target, locale: 'en' }, { ...synth, addEventListener: undefined } as never);
    expect(tier).toBe('none');
  });
});

describe('createVadSegmenter (T2.6, §N-3)', () => {
  const opts = DEFAULT_VAD; // threshold .06, silence 400, min 700, max 8000

  it('starts on the first voiced frame and stops after the silence run', () => {
    const vad = createVadSegmenter(opts);
    expect(vad.push(0.01, 0)).toBeNull(); // silence — nothing
    expect(vad.push(0.2, 100)).toBe('start');
    expect(vad.push(0.3, 900)).toBeNull(); // still speaking
    expect(vad.push(0.01, 1100)).toBeNull(); // silence begins
    expect(vad.push(0.01, 1301)).toBe('stop'); // 400ms silence, 800ms voiced ≥ min
  });

  it('discards sub-minimum blips instead of uploading them', () => {
    const vad = createVadSegmenter(opts);
    expect(vad.push(0.2, 0)).toBe('start');
    expect(vad.push(0.01, 200)).toBeNull();
    expect(vad.push(0.01, 601)).toBe('discard'); // 200ms of voice < 700ms min
  });

  it('splits monologues at the max chunk ceiling', () => {
    const vad = createVadSegmenter(opts);
    expect(vad.push(0.2, 0)).toBe('start');
    expect(vad.push(0.2, 7999)).toBeNull();
    expect(vad.push(0.2, 8000)).toBe('stop'); // ceiling
    expect(vad.push(0.2, 8100)).toBe('start'); // next chunk begins immediately
  });
});

describe('pickRecorderMimeType (T2.1)', () => {
  it('prefers webm/opus, falls back to mp4 (iOS), null when nothing works', () => {
    expect(pickRecorderMimeType((t) => t.startsWith('audio/webm'))).toBe('audio/webm;codecs=opus');
    expect(pickRecorderMimeType((t) => t === 'audio/mp4')).toBe('audio/mp4');
    expect(pickRecorderMimeType(() => false)).toBeNull();
  });

  it('maps containers to upload extensions', () => {
    expect(extensionForMime('audio/webm;codecs=opus')).toBe('webm');
    expect(extensionForMime('audio/mp4')).toBe('m4a');
    expect(extensionForMime('audio/aac')).toBe('aac');
  });
});
