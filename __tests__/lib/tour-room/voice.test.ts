/**
 * Wave T2 client libs — T2.9 TTS ladder (voice detection + fallback order)
 * and T2.6 VAD segmentation / recorder mime negotiation (pure logic).
 */
import {
  hasLocaleVoice,
  loadVoices,
  detectTtsTier,
  speakMessage,
  primeAudio,
  utteranceLang,
  __resetAudioPrimingForTests,
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

  // V0.3 — 서버 tier 는 스트리밍 라우트를 먼저 문다. 성공하면 JSON 왕복이 아예
  // 없다(전체 버퍼 대기 2281ms + 업로드 218ms 를 건너뛴다).
  it('device speech errors → server tier streams, no JSON round trip', async () => {
    const synth = fakeSynth({ voices: [{ lang: 'ko-KR' }], speakOutcome: 'error' });
    const created: Array<{ play: jest.Mock; src?: string }> = [];
    (global as { Audio?: unknown }).Audio = jest.fn(() => {
      const el = { play: jest.fn(async () => undefined), src: undefined as string | undefined };
      created.push(el);
      return el;
    });
    const tier = await speakMessage('안내입니다', target, synth);
    expect(tier).toBe('server');
    expect(created[0].src).toContain('/api/tour-rooms/b1/tts/stream?messageId=m1&locale=ko&rs=rs');
    expect(created[0].play).toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  // 스트리밍 라우트가 없는 배포(롤백 중)나 스트림을 못 무는 엔진에서도 소리는 나야 한다.
  it('streaming route fails → falls back to the JSON url', async () => {
    const synth = fakeSynth({ voices: [] });
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ url: 'https://cdn.test/a.mp3' }),
    });
    const created: Array<{ play: jest.Mock; src?: string }> = [];
    (global as { Audio?: unknown }).Audio = jest.fn(() => {
      const el = {
        // 스트리밍 시도(첫 호출)만 실패시킨다.
        play: jest.fn(async () => {
          if (el.src?.includes('/tts/stream')) throw new Error('cannot play');
        }),
        src: undefined as string | undefined,
      };
      created.push(el);
      return el;
    });
    const tier = await speakMessage('안내입니다', { ...target, locale: 'en' }, { ...synth, addEventListener: undefined } as never);
    expect(tier).toBe('server');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/tour-rooms/b1/tts?messageId=m1&locale=en'),
      expect.objectContaining({ headers: { 'x-tour-room-auth': 'rs' } }),
    );
    expect(created.at(-1)!.src).toBe('https://cdn.test/a.mp3');
  });

  it('every tier fails → none (voice-unavailable badge, §O-2 ③)', async () => {
    const synth = fakeSynth({ voices: [] });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    (global as { Audio?: unknown }).Audio = jest.fn(() => ({
      play: jest.fn(async () => {
        throw new Error('cannot play');
      }),
      src: undefined as string | undefined,
    }));
    const tier = await speakMessage('hello', { ...target, locale: 'en' }, { ...synth, addEventListener: undefined } as never);
    expect(tier).toBe('none');
  });

  // playFromSrc 는 절대 던지면 안 된다 — 던지면 사다리의 다음 단이 통째로 사라진다.
  it('audio 요소가 addEventListener 를 안 가져도 사다리가 살아 있다', async () => {
    const synth = fakeSynth({ voices: [] });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false });
    (global as { Audio?: unknown }).Audio = jest.fn(() => ({ play: jest.fn(async () => undefined) }));
    await expect(
      speakMessage('hello', { ...target, locale: 'en' }, { ...synth, addEventListener: undefined } as never),
    ).resolves.toBe('server');
  });

  // P0-6 — iOS/webview only lets you play an element that already played during
  // a gesture. Creating a fresh Audio AFTER the fetch await is rejected, which
  // is what left the guest speaker permanently muted.
  it('P0-6: server tier reuses the gesture-warmed element instead of a new Audio', async () => {
    __resetAudioPrimingForTests();
    const created: Array<{ play: jest.Mock; src?: string }> = [];
    (global as { Audio?: unknown }).Audio = jest.fn(function FakeAudio(this: unknown, src?: string) {
      const el = { play: jest.fn(async () => undefined), src, preload: '' };
      created.push(el);
      return el;
    });

    primeAudio(); // the user gesture: one element created and played (silence)
    expect(created).toHaveLength(1);

    const synth = fakeSynth({ voices: [] });
    const tier = await speakMessage('안내입니다', target, { ...synth, addEventListener: undefined } as never);

    expect(tier).toBe('server');
    // No SECOND element was constructed — the warmed one had its src swapped.
    expect(created).toHaveLength(1);
    // V0.3 — 이제 그 src 는 스트리밍 라우트다.
    expect(created[0].src).toContain('/tts/stream?messageId=m1&locale=ko&rs=rs');
    expect(created[0].play).toHaveBeenCalledTimes(2); // silence, then the mp3
  });
});

describe('P0-6 utteranceLang — languages outside the room locales', () => {
  it('maps room locales, and passes through a chat-bridge language instead of throwing', () => {
    expect(utteranceLang('ko')).toBe('ko-KR');
    // fr graduated into ROOM_LOCALES (2026-07-27) — it now maps properly.
    expect(utteranceLang('fr')).toBe('fr-FR');
    // A Thai-speaking guest (chat_locale) used to crash TTS_LANG[locale].split.
    expect(() => utteranceLang('th')).not.toThrow();
    expect(utteranceLang('th')).toBe('th');
    expect(hasLocaleVoice([{ lang: 'th-TH' }], 'th' as never)).toBe(true);
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
