/**
 * @jest-environment node
 *
 * Wave T2 server routes — T2.2 stt (transcribe-only, confirm-before-send),
 * T2.3 tts (M-5 cache, generate once per message+locale), T2.7 captions
 * (Tier A text / Tier B audio, multimodal-first with stt fallback).
 */
// Must be first: restores real web primitives before next/server is evaluated.
import '@/test-utils/restoreWebPrimitives';
import { POST as sttPOST } from '@/app/api/tour-rooms/[bookingId]/stt/route';
import { GET as ttsGET } from '@/app/api/tour-rooms/[bookingId]/tts/route';
import { POST as captionsPOST } from '@/app/api/tour-rooms/[bookingId]/captions/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { transcribeAudioFile, generateSpeechMp3 } from '@/lib/openai-server';
import { chatCompletion, translateTextViaRouter } from '@/lib/ai/router';
import { signCustomerRoomToken, signGuideRoomToken } from '@/lib/tour-room/token';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/openai-server', () => ({
  transcribeAudioFile: jest.fn(),
  generateSpeechMp3: jest.fn(),
  translateTextForLocales: jest.fn(),
}));
jest.mock('@/lib/ai/router', () => {
  const actual = jest.requireActual('@/lib/ai/router');
  return {
    ...actual,
    chatCompletion: jest.fn(),
    translateTextViaRouter: jest.fn(),
  };
});
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const transcribeMock = transcribeAudioFile as jest.Mock;
const speechMock = generateSpeechMp3 as jest.Mock;
const chatCompletionMock = chatCompletion as jest.Mock;
const translateViaRouterMock = translateTextViaRouter as jest.Mock;
const broadcastToRoomMock = jest.requireMock('@/lib/tour-room/realtime').broadcastToRoom as jest.Mock;

const BOOKING = {
  id: 'booking-1',
  user_id: 'user-owner',
  tour_id: 'tour-1',
  merchant_id: 'merchant-1',
  tour_date: '2026-07-15',
  contact_name: 'Alex Kim',
  contact_email: 'alex@example.com',
  contact_phone: null,
  preferred_language: 'ja',
};
const ROOM = { id: 'room-1', booking_id: 'booking-1', tour_id: 'tour-1', tour_date: '2026-07-15', status: 'active' };

interface DbConfig {
  booking?: typeof BOOKING | null;
  participants?: Array<Record<string, unknown>>;
  ttsCache?: { storage_path: string; duration_ms: number | null } | null;
  message?: Record<string, unknown> | null;
}

function fakeDb(config: DbConfig = {}) {
  const inserted: Record<string, Array<Record<string, unknown>>> = {};
  const upserted: Record<string, Array<Record<string, unknown>>> = {};
  const uploads: Array<{ bucket: string; path: string }> = [];
  const client = {
    inserted,
    upserted,
    uploads,
    storage: {
      from(bucket: string) {
        return {
          upload: jest.fn(async (path: string) => {
            uploads.push({ bucket, path });
            return { error: null };
          }),
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
        };
      },
    },
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') {
          const b = config.booking === undefined ? BOOKING : config.booking;
          return b ? { data: b, error: null } : { data: null, error: { message: 'not found' } };
        }
        if (table === 'tour_room_invites') return { data: null, error: null };
        if (table === 'tour_room_participants') return { data: config.participants ?? [], error: null };
        if (table === 'tour_room_tts_cache') return { data: config.ttsCache ?? null, error: null };
        if (table === 'tour_room_messages') {
          return { data: config.message === undefined ? null : config.message, error: null };
        }
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'in', 'gt', 'gte', 'order', 'limit']) {
        chain[method] = jest.fn(() => chain);
      }
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
        resolveSelect().then(resolve, reject);
      chain.upsert = jest.fn((values: Record<string, unknown>) => {
        (upserted[table] ??= []).push(values);
        if (table === 'tour_rooms') {
          return { select: () => ({ single: async () => ({ data: ROOM, error: null }) }) };
        }
        return { then: (r: (v: unknown) => unknown) => r({ data: null, error: null }) };
      });
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserted[table] ??= []).push(values);
        return {
          select: () => ({
            single: async () => ({ data: { id: `${table}-row-1`, ...values }, error: null }),
          }),
        };
      });
      return chain;
    },
  };
  return client;
}

function audioForm(extra?: Record<string, string>): FormData {
  const form = new FormData();
  form.append('audio', new File([new Uint8Array(2048)], 'clip.webm', { type: 'audio/webm' }));
  for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v);
  return form;
}

function fakeReq(input?: {
  query?: Record<string, string>;
  headers?: Record<string, string>;
  json?: unknown;
  form?: FormData;
}) {
  const params = new URLSearchParams(input?.query ?? {});
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (input?.form && !headers.has('content-type')) headers.set('content-type', 'multipart/form-data');
  return {
    nextUrl: { searchParams: params },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
    formData: async () => input?.form ?? new FormData(),
    signal: { aborted: true },
  } as never;
}

const routeParams = (bookingId = 'booking-1') => ({ params: Promise.resolve({ bookingId }) });

const GOOD_STT = {
  text: 'We meet at the east gate.',
  source_locale: 'en',
  provider: 'openai',
  model: 'whisper-1',
  fallback_used: false,
  fallback_reason_codes: [],
  quality: { avg_logprob: -0.2, compression_ratio: 1.1, no_speech_prob: 0.05, duration: 4, reason_codes: [] },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  transcribeMock.mockResolvedValue(GOOD_STT);
  speechMock.mockResolvedValue(new ArrayBuffer(64));
  translateViaRouterMock.mockResolvedValue({ source_locale: 'ko', translations: { en: 'hello', ja: 'こんにちは' } });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('POST /api/tour-rooms/[bookingId]/stt (T2.2)', () => {
  it('400s without multipart audio', async () => {
    const res = await sttPOST(fakeReq({ json: {} }), routeParams());
    expect(res.status).toBe(400);
  });

  it('403s anonymous callers before any transcription runs', async () => {
    const res = await sttPOST(fakeReq({ form: audioForm() }), routeParams());
    expect(res.status).toBe(403);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('transcribes for the booking owner and reports no confirmation needed on clean audio', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const res = await sttPOST(fakeReq({ form: audioForm() }), routeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.text).toBe(GOOD_STT.text);
    expect(json.needsConfirmation).toBe(false);
    expect(json.quality.reason_codes).toEqual([]);
  });

  it('forces confirmation when STT quality is flagged', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    transcribeMock.mockResolvedValue({
      ...GOOD_STT,
      quality: { ...GOOD_STT.quality, reason_codes: ['low_avg_logprob'] },
    });
    const res = await sttPOST(fakeReq({ form: audioForm() }), routeParams());
    const json = await res.json();
    expect(json.needsConfirmation).toBe(true);
  });

  it('429s when the gate denies, before transcription', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 30_000 });
    const res = await sttPOST(fakeReq({ form: audioForm() }), routeParams());
    expect(res.status).toBe(429);
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('accepts a valid customer invite token (no login)', async () => {
    const { token } = signCustomerRoomToken({
      bookingId: 'booking-1',
      displayName: 'Alex',
      tourDate: '2026-07-15',
    });
    const res = await sttPOST(fakeReq({ query: { rt: token }, form: audioForm() }), routeParams());
    expect(res.status).toBe(200);
  });
});

describe('GET /api/tour-rooms/[bookingId]/tts (T2.3)', () => {
  const asOwner = () => getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });

  it('400s without messageId', async () => {
    asOwner();
    const res = await ttsGET(fakeReq(), routeParams());
    expect(res.status).toBe(400);
  });

  it('403s anonymous callers', async () => {
    const res = await ttsGET(fakeReq({ query: { messageId: 'm1', locale: 'ja' } }), routeParams());
    expect(res.status).toBe(403);
  });

  it('serves a cache hit with zero generation and zero rate-limit spend', async () => {
    asOwner();
    createServerClientMock.mockReturnValue(
      fakeDb({ ttsCache: { storage_path: 'tour-room-tts/room-1/m1-ja.mp3', duration_ms: 1200 } }),
    );
    const res = await ttsGET(fakeReq({ query: { messageId: 'm1', locale: 'ja' } }), routeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(json.url).toContain('tour-room-tts/room-1/m1-ja.mp3');
    expect(speechMock).not.toHaveBeenCalled();
    expect(requestGateMock).not.toHaveBeenCalled();
  });

  it('generates once on a miss: TTS call + storage upload + cache upsert', async () => {
    asOwner();
    const db = fakeDb({
      ttsCache: null,
      message: { id: 'm1', room_id: 'room-1', source_text: 'Meet at 3pm', translations: { ja: '3時に集合' } },
    });
    createServerClientMock.mockReturnValue(db);
    const res = await ttsGET(fakeReq({ query: { messageId: 'm1', locale: 'ja' } }), routeParams());
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.cached).toBe(false);
    expect(speechMock).toHaveBeenCalledWith('3時に集合', 'ja');
    expect(db.uploads[0].path).toBe('tour-room-tts/room-1/m1-ja.mp3');
    expect(db.upserted.tour_room_tts_cache[0]).toMatchObject({ message_id: 'm1', locale: 'ja' });
  });

  it("404s a message that belongs to another room", async () => {
    asOwner();
    createServerClientMock.mockReturnValue(
      fakeDb({ ttsCache: null, message: { id: 'm1', room_id: 'other-room', source_text: 'x', translations: {} } }),
    );
    const res = await ttsGET(fakeReq({ query: { messageId: 'm1', locale: 'ja' } }), routeParams());
    expect(res.status).toBe(404);
  });

  it('429s generation when the room gate denies', async () => {
    asOwner();
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 10_000 });
    createServerClientMock.mockReturnValue(fakeDb({ ttsCache: null }));
    const res = await ttsGET(fakeReq({ query: { messageId: 'm1', locale: 'ja' } }), routeParams());
    expect(res.status).toBe(429);
    expect(speechMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/tour-rooms/[bookingId]/captions (T2.7)', () => {
  const guideToken = () =>
    signGuideRoomToken({ tourId: 'tour-1', tourDate: '2026-07-15', displayName: 'Guide Kim' }).token;

  it('403s a customer (owner) — captions are guide/admin only', async () => {
    getAuthUserMock.mockResolvedValue({ id: 'user-owner', role: 'customer' });
    const res = await captionsPOST(fakeReq({ json: { text: 'hello', seq: 1 } }), routeParams());
    expect(res.status).toBe(403);
  });

  it('Tier A: guide text → one translation call → caption broadcast, no DB row', async () => {
    const db = fakeDb({ participants: [{ locale: 'ja' }, { locale: 'es' }] });
    createServerClientMock.mockReturnValue(db);
    const res = await captionsPOST(
      fakeReq({ query: { rt: guideToken() }, json: { text: '3시에 동문에서 모입니다', seq: 7 } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.pipeline).toBe('tier-a');
    expect(json.caption.seq).toBe(7);
    expect(translateViaRouterMock).toHaveBeenCalledWith('3시에 동문에서 모입니다', ['ja', 'es']);
    expect(broadcastToRoomMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'room-1' }),
      'caption',
      expect.objectContaining({ caption: expect.objectContaining({ seq: 7 }) }),
    );
    expect(db.inserted.tour_room_messages).toBeUndefined();
  });

  it('Tier A with record:true persists the caption as a message and broadcasts it', async () => {
    const db = fakeDb({ participants: [{ locale: 'en' }] });
    createServerClientMock.mockReturnValue(db);
    const res = await captionsPOST(
      fakeReq({ query: { rt: guideToken() }, json: { text: 'important notice', seq: 1, record: true } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    expect(db.inserted.tour_room_messages[0]).toMatchObject({
      sender_role: 'guide',
      metadata: { kind: 'caption', seq: 1 },
    });
    const events = broadcastToRoomMock.mock.calls.map((c) => c[1]);
    expect(events).toEqual(expect.arrayContaining(['caption', 'message']));
  });

  it('Tier A translation failure still broadcasts the original (O-14)', async () => {
    translateViaRouterMock.mockRejectedValue(new Error('all providers down'));
    const res = await captionsPOST(
      fakeReq({ query: { rt: guideToken() }, json: { text: 'hello group', seq: 2 } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.caption.source_text).toBe('hello group');
    expect(json.caption.translations).toEqual({});
  });

  it('Tier B: multimodal one-call transcribes and translates', async () => {
    chatCompletionMock.mockResolvedValue({
      content: JSON.stringify({
        source_locale: 'ko',
        source_text: '여기는 해동용궁사입니다',
        translations: { en: 'This is Haedong Yonggungsa' },
      }),
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
    });
    const res = await captionsPOST(
      fakeReq({ query: { rt: guideToken() }, form: audioForm({ seq: '3' }) }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.pipeline).toBe('multimodal');
    expect(json.caption.translations.en).toContain('Yonggungsa');
    expect(transcribeMock).not.toHaveBeenCalled();
  });

  it('Tier B falls back to stt-router + translate when multimodal fails', async () => {
    chatCompletionMock.mockRejectedValue(new Error('gemini down'));
    transcribeMock.mockResolvedValue({ ...GOOD_STT, text: 'fallback transcript' });
    const res = await captionsPOST(
      fakeReq({ query: { rt: guideToken() }, form: audioForm({ seq: '4' }) }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.pipeline).toBe('stt-fallback');
    expect(json.caption.source_text).toBe('fallback transcript');
    expect(transcribeMock).toHaveBeenCalled();
  });

  it('429s when the caption gate denies', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 5000 });
    const res = await captionsPOST(
      fakeReq({ query: { rt: guideToken() }, json: { text: 'hi', seq: 5 } }),
      routeParams(),
    );
    expect(res.status).toBe(429);
  });
});
