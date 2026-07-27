/**
 * T2.3/T2.9 — server TTS helper: cache-first generation and guide-notice
 * pre-generation for tts_capable=false participants (§O-2).
 * V0.3 — streamRoomTts: 생성과 동시에 재생하는 경로.
 *
 * 이 모듈은 순수 서버 코드다. jsdom 에는 ReadableStream 전역이 없어 V0.3
 * 스트리밍 테스트가 돌지 않으므로 node 환경을 명시한다.
 *
 * @jest-environment node
 */
import {
  ensureRoomTts,
  pregenerateGuideNoticeTts,
  speakableText,
  streamRoomTts,
} from '@/lib/tour-room/tts-server';
import { generateSpeechMp3, generateSpeechStream } from '@/lib/openai-server';

jest.mock('@/lib/openai-server', () => ({
  generateSpeechMp3: jest.fn(),
  generateSpeechStream: jest.fn(),
}));
const speechMock = generateSpeechMp3 as jest.Mock;
const streamMock = generateSpeechStream as jest.Mock;

/** 청크가 여러 개인 스트림 — tee 가 조각을 잃지 않는지 보려면 1개로는 부족하다. */
function streamOf(chunks: number[][]): ReadableStream<Uint8Array> {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(Uint8Array.from(chunk));
      controller.close();
    },
  });
}

async function drain(stream: ReadableStream<Uint8Array>): Promise<Buffer> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  return Buffer.concat(chunks);
}

interface FakeConfig {
  cache?: Record<string, string>; // `${messageId}:${locale}` -> storage_path
  participants?: Array<{ locale: string; tts_capable: boolean | null }>;
}

function fakeDb(config: FakeConfig = {}) {
  const upserts: Array<Record<string, unknown>> = [];
  const uploads: string[] = [];
  const uploadBodies: Buffer[] = [];
  const filters: Record<string, unknown> = {};
  const client = {
    upserts,
    uploads,
    uploadBodies,
    storage: {
      from: (bucket: string) => ({
        upload: async (path: string, body: Buffer) => {
          uploads.push(`${bucket}/${path}`);
          uploadBodies.push(body);
          return { error: null };
        },
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
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
        const key = `${filters.message_id}:${filters.locale}`;
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
    uploadBodies: typeof uploadBodies;
  };
}

const MESSAGE = { id: 'm1', source_text: 'Meet at 3pm', translations: { ja: '3時に集合', ko: '3시에 집합' } };

beforeEach(() => {
  jest.clearAllMocks();
  speechMock.mockResolvedValue(new ArrayBuffer(32));
  streamMock.mockImplementation(async () => streamOf([[1, 2, 3], [4, 5], [6]]));
});

describe('streamRoomTts (V0.3)', () => {
  it('본문은 즉시 재생 가능한 바이트이고, 순서가 보존된다', async () => {
    const db = fakeDb();
    const stream = await streamRoomTts(db, 'r1', MESSAGE, 'ja');
    expect(stream).not.toBeNull();
    expect(await drain(stream!.body)).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
  });

  it('persist() 는 손님이 들은 것과 동일한 바이트를 캐시에 적재한다', async () => {
    const db = fakeDb();
    const stream = await streamRoomTts(db, 'r1', MESSAGE, 'ja');
    const heard = await drain(stream!.body);
    await stream!.persist();

    expect(db.uploads).toEqual(['tour-audio/tour-room-tts/r1/m1-ja.mp3']);
    expect(db.uploadBodies[0]).toEqual(heard);
    expect(db.upserts).toEqual([
      { message_id: 'm1', locale: 'ja', storage_path: 'tour-room-tts/r1/m1-ja.mp3' },
    ]);
  });

  it('손님이 본문을 안 읽어도 persist() 는 온전한 오디오를 얻는다 (재생 중단·조기 이탈)', async () => {
    const db = fakeDb();
    const stream = await streamRoomTts(db, 'r1', MESSAGE, 'ja');
    await stream!.persist(); // toClient 는 소비하지 않는다
    expect(db.uploadBodies[0]).toEqual(Buffer.from([1, 2, 3, 4, 5, 6]));
  });

  it('말할 것이 없으면 null — 생성 호출 자체가 없다', async () => {
    const db = fakeDb();
    const empty = await streamRoomTts(db, 'r1', { id: 'x', source_text: '', translations: {} }, 'en');
    expect(empty).toBeNull();
    expect(streamMock).not.toHaveBeenCalled();
  });

  it('업로드가 실패해도 던지지 않는다 — 손님은 이미 들었다', async () => {
    const db = fakeDb();
    (db as unknown as { storage: unknown }).storage = {
      from: () => ({
        upload: async () => ({ error: { message: 'boom' } }),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
      }),
    };
    const stream = await streamRoomTts(db, 'r1', MESSAGE, 'ja');
    await expect(stream!.persist()).resolves.toBeUndefined();
    expect(db.upserts).toEqual([]); // 업로드가 깨졌으면 캐시 행도 만들지 않는다
  });

  it('로케일 번역본을 말한다 (원문이 아니라)', async () => {
    const db = fakeDb();
    await streamRoomTts(db, 'r1', MESSAGE, 'ko');
    expect(streamMock).toHaveBeenCalledWith('3시에 집합', 'ko');
  });
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
    expect(url).toBe('https://cdn.test/tour-room-tts/r1/m1-ja.mp3');
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
