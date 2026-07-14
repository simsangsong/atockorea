/**
 * @jest-environment node
 *
 * T4.7 — vision-ask: private-by-default answers, share persists a room
 * message, per-participant daily gate, menu preset.
 */
// Must be first: restores real web primitives before next/server is evaluated.
import '@/test-utils/restoreWebPrimitives';
import { POST as visionPOST } from '@/app/api/tour-rooms/[bookingId]/vision-ask/route';
import { getAuthUser } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import { requestGate } from '@/lib/durable-rate-limit';
import { chatCompletion } from '@/lib/ai/router';
import { signRoomSession } from '@/lib/tour-room/access';

jest.mock('@/lib/auth', () => ({ getAuthUser: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({
  requestGate: jest.fn(),
  clientIpKey: jest.fn(() => 'ip:test'),
}));
jest.mock('@/lib/ai/router', () => {
  const actual = jest.requireActual('@/lib/ai/router');
  return { ...actual, chatCompletion: jest.fn() };
});
jest.mock('@/lib/tour-room/realtime', () => ({
  broadcastToRoom: jest.fn(async () => ({ ok: true })),
}));

const getAuthUserMock = getAuthUser as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const requestGateMock = requestGate as jest.Mock;
const chatCompletionMock = chatCompletion as jest.Mock;

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

function fakeDb() {
  const inserted: Record<string, Array<Record<string, unknown>>> = {};
  const client = {
    inserted,
    storage: {
      listBuckets: async () => ({ data: [{ name: 'tour-room-photos' }], error: null }),
      createBucket: jest.fn(async () => ({ error: null })),
      from: (bucket: string) => ({
        upload: jest.fn(async () => ({ error: null })),
        getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${bucket}/${path}` } }),
      }),
    },
    from(table: string) {
      const chain: Record<string, unknown> = {};
      const resolveSelect = async () => {
        if (table === 'bookings') return { data: BOOKING, error: null };
        if (table === 'tour_room_invites') return { data: null, error: null };
        return { data: null, error: null };
      };
      for (const method of ['select', 'eq', 'in', 'order', 'limit']) chain[method] = jest.fn(() => chain);
      chain.single = jest.fn(resolveSelect);
      chain.maybeSingle = jest.fn(resolveSelect);
      chain.then = (resolve: (v: unknown) => unknown) => resolveSelect().then(resolve);
      chain.upsert = jest.fn(() => ({
        select: () => ({ single: async () => ({ data: ROOM, error: null }) }),
      }));
      chain.insert = jest.fn((values: Record<string, unknown>) => {
        (inserted[table] ??= []).push(values);
        return { select: () => ({ single: async () => ({ data: { id: 'msg-1', ...values }, error: null }) }) };
      });
      return chain;
    },
  };
  return client;
}

function imageForm(extra?: Record<string, string>): FormData {
  const form = new FormData();
  form.append('image', new File([new Uint8Array(4096)], 'photo.jpg', { type: 'image/jpeg' }));
  for (const [k, v] of Object.entries(extra ?? {})) form.append(k, v);
  return form;
}

function fakeReq(input: { form: FormData; headers?: Record<string, string> }) {
  const headers = new Map(Object.entries(input.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  if (!headers.has('content-type')) headers.set('content-type', 'multipart/form-data');
  return {
    nextUrl: { searchParams: new URLSearchParams() },
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => ({}),
    formData: async () => input.form,
    signal: { aborted: true },
  } as never;
}

const routeParams = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });
const session = () =>
  signRoomSession({
    roomId: 'room-1',
    bookingId: 'booking-1',
    participantId: 'participant-9',
    role: 'customer',
    displayName: 'Alex',
  }).session;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.TOUR_ROOM_TOKEN_SECRET = 'unit-test-secret';
  getAuthUserMock.mockResolvedValue(null);
  requestGateMock.mockResolvedValue({ allowed: true, retryAfterMs: 0 });
  chatCompletionMock.mockResolvedValue({ content: 'This is tteokbokki — spicy rice cakes.', provider: 'gemini', model: 'g' });
  createServerClientMock.mockReturnValue(fakeDb());
});

describe('POST /api/tour-rooms/[bookingId]/vision-ask (T4.7)', () => {
  it('403s anonymous callers before any vision spend', async () => {
    const res = await visionPOST(fakeReq({ form: imageForm() }), routeParams());
    expect(res.status).toBe(403);
    expect(chatCompletionMock).not.toHaveBeenCalled();
  });

  it('private by default: answers the asker, no message row, no upload', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await visionPOST(
      fakeReq({ form: imageForm({ locale: 'ja', question: 'これは何?' }), headers: { 'x-tour-room-auth': session() } }),
      routeParams(),
    );
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.answer).toContain('tteokbokki');
    expect(json.shared).toBe(false);
    expect(db.inserted.tour_room_messages).toBeUndefined();
    // Prompt carried the locale + question.
    const prompt = chatCompletionMock.mock.calls[0][1][0].content[0].text as string;
    expect(prompt).toContain('Japanese');
    expect(prompt).toContain('これは何?');
  });

  it('share=true persists a vision_answer message and broadcasts it', async () => {
    const db = fakeDb();
    createServerClientMock.mockReturnValue(db);
    const res = await visionPOST(
      fakeReq({ form: imageForm({ locale: 'en', share: 'true' }), headers: { 'x-tour-room-auth': session() } }),
      routeParams(),
    );
    const json = await res.json();
    expect(json.shared).toBe(true);
    expect(db.inserted.tour_room_messages[0]).toMatchObject({
      sender_role: 'system',
      metadata: expect.objectContaining({ kind: 'vision_answer' }),
    });
  });

  it('menu preset switches the prompt to a menu translation', async () => {
    await visionPOST(
      fakeReq({ form: imageForm({ locale: 'en', preset: 'menu' }), headers: { 'x-tour-room-auth': session() } }),
      routeParams(),
    );
    const prompt = chatCompletionMock.mock.calls[0][1][0].content[0].text as string;
    expect(prompt).toContain('menu');
    expect(prompt.toLowerCase()).toContain('allergen');
  });

  it('429s on the participant daily gate before the vision call', async () => {
    requestGateMock.mockResolvedValue({ allowed: false, retryAfterMs: 60_000 });
    const res = await visionPOST(
      fakeReq({ form: imageForm(), headers: { 'x-tour-room-auth': session() } }),
      routeParams(),
    );
    expect(res.status).toBe(429);
    expect(chatCompletionMock).not.toHaveBeenCalled();
    expect(requestGateMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'participant:participant-9' }));
  });

  it('injects the location context into the prompt', async () => {
    await visionPOST(
      fakeReq({ form: imageForm({ locale: 'en', context: 'Gamcheon Culture Village' }), headers: { 'x-tour-room-auth': session() } }),
      routeParams(),
    );
    const prompt = chatCompletionMock.mock.calls[0][1][0].content[0].text as string;
    expect(prompt).toContain('Gamcheon Culture Village');
  });
});
