/**
 * T2.3/T2.9 — server TTS helper: cache-first generation and guide-notice
 * pre-generation for tts_capable=false participants (§O-2).
 */
import { ensureRoomTts, pregenerateGuideNoticeTts, speakableText } from '@/lib/tour-room/tts-server';
import { generateSpeechMp3 } from '@/lib/openai-server';

jest.mock('@/lib/openai-server', () => ({ generateSpeechMp3: jest.fn() }));
const speechMock = generateSpeechMp3 as jest.Mock;

interface FakeConfig {
  cache?: Record<string, string>; // `${messageId}:${locale}` -> storage_path
  participants?: Array<{ locale: string; tts_capable: boolean | null }>;
}

function fakeDb(config: FakeConfig = {}) {
  const upserts: Array<Record<string, unknown>> = [];
  const uploads: string[] = [];
  const filters: Record<string, unknown> = {};
  const client = {
    upserts,
    uploads,
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string) => {
          uploads.push(`${bucket}/${path}`);
          return { error: null };
        },
        createSignedUrl: async (path: string) => ({ data: { signedUrl: `https://cdn.test/${path}?token=sig` }, error: null }),
      }),
    },
    from(table: string) {
      const chain: Record<string, unknown> = {};
      for (const method of ['select']) chain[method] = jest.fn(() => chain);
      chain.eq = jest.fn((col: string, value: unknown) => {
        filters[col] = value;
        return chain;
      });
      chain.maybeSingle = jest.fn(async () => {
        // A2 — a message has more than one spoken track, so the cache key
        // carries `part`; a narration lookup must never hit the body's row.
        const part = (filters.part as string | undefined) ?? 'body';
        const key = `${filters.message_id}:${filters.locale}${part === 'body' ? '' : `:${part}`}`;
        const path = config.cache?.[key];
        return { data: path ? { storage_path: path } : null, error: null };
      });
      chain.then = (resolve: (v: unknown) => unknown) => {
        if (table === 'tour_room_participants') {
          return Promise.resolve({
            data: (config.participants ?? []).filter((p) => p.tts_capable === filters.tts_capable),
            error: null,
          }).then(resolve);
        }
        return Promise.resolve({ data: null, error: null }).then(resolve);
      };
      chain.upsert = jest.fn((values: Record<string, unknown>) => {
        upserts.push(values);
        return { then: (r: (v: unknown) => unknown) => r({ data: null, error: null }) };
      });
      return chain;
    },
  };
  return client as never as import('@/lib/tour-room/tts-server').TtsStorageClient & {
    upserts: typeof upserts;
    uploads: typeof uploads;
  };
}

const MESSAGE = { id: 'm1', source_text: 'Meet at 3pm', translations: { ja: '3時に集合', ko: '3시에 집합' } };

beforeEach(() => {
  jest.clearAllMocks();
  speechMock.mockResolvedValue(new ArrayBuffer(32));
});

describe('speakableText', () => {
  it('prefers the locale translation, falls back to the original', () => {
    expect(speakableText(MESSAGE, 'ja')).toBe('3時に集合');
    expect(speakableText(MESSAGE, 'es')).toBe('Meet at 3pm');
    expect(speakableText({ id: 'x', source_text: '', translations: {} }, 'en')).toBe('');
  });
});

describe('ensureRoomTts', () => {
  it('cache hit → public URL with zero generation', async () => {
    const db = fakeDb({ cache: { 'm1:ja': 'tour-room-tts/r1/m1-ja.mp3' } });
    const url = await ensureRoomTts(db, 'r1', MESSAGE, 'ja');
    expect(url).toBe('https://cdn.test/tour-room-tts/r1/m1-ja.mp3?token=sig');
    expect(speechMock).not.toHaveBeenCalled();
  });

  it('cache miss → generate + upload + upsert exactly once', async () => {
    const db = fakeDb();
    const url = await ensureRoomTts(db, 'r1', MESSAGE, 'ja');
    expect(url).toContain('m1-ja.mp3');
    expect(speechMock).toHaveBeenCalledWith('3時に集合', 'ja');
    expect(db.uploads).toEqual(['tour-audio/tour-room-tts/r1/m1-ja.mp3']);
    expect(db.upserts[0]).toMatchObject({ message_id: 'm1', locale: 'ja' });
  });

  it('nothing speakable → null, no generation', async () => {
    const db = fakeDb();
    const url = await ensureRoomTts(db, 'r1', { id: 'm2', source_text: '  ', translations: {} }, 'en');
    expect(url).toBeNull();
    expect(speechMock).not.toHaveBeenCalled();
  });
});

describe('ensureRoomTts — narration track (A2)', () => {
  it('speaks the supplied briefing, not the one-line message body', async () => {
    const db = fakeDb();
    const url = await ensureRoomTts(db, 'r1', MESSAGE, 'en', {
      part: 'narration',
      text: 'Haedong Yonggungsa. A seaside temple.',
    });
    expect(speechMock).toHaveBeenCalledWith('Haedong Yonggungsa. A seaside temple.', 'en');
    expect(url).toContain('m1-en-narration.mp3');
    expect(db.upserts[0]).toMatchObject({ message_id: 'm1', locale: 'en', part: 'narration' });
  });

  it('does not serve the body recording to a narration request', async () => {
    // The whole point of `part`: the body row for this message already exists.
    const db = fakeDb({ cache: { 'm1:en': 'tour-room-tts/r1/m1-en.mp3' } });
    await ensureRoomTts(db, 'r1', MESSAGE, 'en', { part: 'narration', text: 'A seaside temple.' });
    expect(speechMock).toHaveBeenCalledWith('A seaside temple.', 'en');
  });

  it('reuses a cached narration across every locale that shares the language', async () => {
    const db = fakeDb({ cache: { 'm1:en:narration': 'tour-room-tts/r1/m1-en-narration.mp3' } });
    const url = await ensureRoomTts(db, 'r1', MESSAGE, 'en', { part: 'narration', text: 'ignored' });
    expect(url).toBe('https://cdn.test/tour-room-tts/r1/m1-en-narration.mp3?token=sig');
    expect(speechMock).not.toHaveBeenCalled();
  });

  it('keeps the body track on its original path (no cache invalidation)', async () => {
    const db = fakeDb();
    await ensureRoomTts(db, 'r1', MESSAGE, 'ja');
    expect(db.uploads).toEqual(['tour-audio/tour-room-tts/r1/m1-ja.mp3']);
    expect(db.upserts[0]).toMatchObject({ part: 'body' });
  });
});

describe('pregenerateGuideNoticeTts (§O-2)', () => {
  it('generates once per distinct locale of tts_capable=false participants only', async () => {
    const db = fakeDb({
      participants: [
        { locale: 'ja', tts_capable: false },
        { locale: 'ja', tts_capable: false }, // duplicate locale — one generation
        { locale: 'ko', tts_capable: false },
        { locale: 'es', tts_capable: true }, // capable device — skipped
        { locale: 'zh', tts_capable: null }, // unknown — skipped (probe on demand)
      ],
    });
    await pregenerateGuideNoticeTts(db, 'r1', MESSAGE);
    const spokenLocales = speechMock.mock.calls.map((c) => c[1]).sort();
    expect(spokenLocales).toEqual(['ja', 'ko']);
  });

  it('swallows generation failures (on-demand /tts remains the safety net)', async () => {
    speechMock.mockRejectedValue(new Error('tts down'));
    const db = fakeDb({ participants: [{ locale: 'ja', tts_capable: false }] });
    await expect(pregenerateGuideNoticeTts(db, 'r1', MESSAGE)).resolves.toBeUndefined();
  });
});
