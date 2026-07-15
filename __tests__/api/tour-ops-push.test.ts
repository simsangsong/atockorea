/**
 * @jest-environment node
 *
 * W6 — push subscription registry (admin-only) + sendOpsPush delivery/pruning.
 */
import '@/test-utils/restoreWebPrimitives';
import { POST as subscribePOST, DELETE as subscribeDELETE } from '@/app/api/admin/tour-ops/push-subscriptions/route';
import { sendOpsPush, isGonePushStatus } from '@/lib/tour-ops/push';
import { requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import webpush from 'web-push';

jest.mock('@/lib/auth', () => ({ requireAdmin: jest.fn() }));
jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(),
}));

const requireAdminMock = requireAdmin as jest.Mock;
const createServerClientMock = createServerClient as jest.Mock;
const sendNotificationMock = webpush.sendNotification as jest.Mock;

function fakeReq(input?: { json?: unknown; headers?: Record<string, string> }) {
  const headers = new Map(Object.entries(input?.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
  return {
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
    json: async () => input?.json ?? {},
  } as never;
}

interface DbCalls {
  upserts: Array<Record<string, unknown>>;
  deletes: Array<{ column: string; value: unknown }>;
}

function fakeDb(rows: Array<Record<string, unknown>> = []): { client: unknown; calls: DbCalls } {
  const calls: DbCalls = { upserts: [], deletes: [] };
  const client = {
    from: () => ({
      upsert: (values: Record<string, unknown>) => {
        calls.upserts.push(values);
        return Promise.resolve({ error: null });
      },
      select: () => ({
        eq: () => Promise.resolve({ data: rows, error: null }),
      }),
      delete: () => ({
        eq: (column: string, value: unknown) => {
          calls.deletes.push({ column, value });
          return Promise.resolve({ error: null });
        },
        in: (column: string, value: unknown) => {
          calls.deletes.push({ column, value });
          return Promise.resolve({ error: null });
        },
      }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  };
  return { client, calls };
}

const SUBSCRIPTION = {
  subscription: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'k1', auth: 'a1' } },
};

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
});

describe('push-subscriptions API (W6.1)', () => {
  it('403s non-admins on both methods', async () => {
    requireAdminMock.mockRejectedValue(new Error('Unauthorized'));
    expect((await subscribePOST(fakeReq({ json: SUBSCRIPTION }))).status).toBe(403);
    expect((await subscribeDELETE(fakeReq({ json: { endpoint: 'x' } }))).status).toBe(403);
  });

  it('400s a malformed subscription', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    createServerClientMock.mockReturnValue(fakeDb().client);
    const res = await subscribePOST(fakeReq({ json: { subscription: { endpoint: 'x' } } }));
    expect(res.status).toBe(400);
  });

  it('400s an endpoint outside the push-service allow-list (stored-SSRF guard)', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    createServerClientMock.mockReturnValue(fakeDb().client);
    for (const endpoint of ['http://169.254.169.254/latest', 'https://evil.example/x', 'http://fcm.googleapis.com/x']) {
      const res = await subscribePOST(
        fakeReq({ json: { subscription: { endpoint, keys: { p256dh: 'k', auth: 'a' } } } }),
      );
      expect(res.status).toBe(400);
    }
  });

  it('upserts by endpoint with the admin identity', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    const { client, calls } = fakeDb();
    createServerClientMock.mockReturnValue(client);
    const res = await subscribePOST(fakeReq({ json: SUBSCRIPTION, headers: { 'user-agent': 'test-ua' } }));
    expect(res.status).toBe(201);
    expect(calls.upserts[0]).toMatchObject({
      user_id: 'admin-1',
      role: 'admin',
      endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
      p256dh: 'k1',
      auth: 'a1',
      user_agent: 'test-ua',
    });
  });

  it('deletes by endpoint', async () => {
    requireAdminMock.mockResolvedValue({ id: 'admin-1' });
    const { client, calls } = fakeDb();
    createServerClientMock.mockReturnValue(client);
    const res = await subscribeDELETE(fakeReq({ json: { endpoint: 'https://fcm.googleapis.com/fcm/send/abc' } }));
    expect(res.status).toBe(200);
    expect(calls.deletes[0]).toEqual({ column: 'endpoint', value: 'https://fcm.googleapis.com/fcm/send/abc' });
  });
});

describe('sendOpsPush (W6.2)', () => {
  const ROWS = [
    { id: 's1', endpoint: 'https://fcm.googleapis.com/fcm/send/1', p256dh: 'k', auth: 'a' },
    { id: 's2', endpoint: 'https://fcm.googleapis.com/fcm/send/2', p256dh: 'k', auth: 'a' },
  ];

  it('no-ops silently when VAPID env is missing', async () => {
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const result = await sendOpsPush({ title: 't', body: 'b' });
    expect(result).toEqual({ sent: 0, pruned: 0 });
    expect(sendNotificationMock).not.toHaveBeenCalled();
  });

  it('sends the JSON payload to every admin subscription', async () => {
    const { client } = fakeDb(ROWS);
    createServerClientMock.mockReturnValue(client);
    sendNotificationMock.mockResolvedValue({ statusCode: 201 });
    const result = await sendOpsPush({ title: '🆘 SOS', body: 'note', tag: 'sos-room-1' });
    expect(result.sent).toBe(2);
    const [, payload] = sendNotificationMock.mock.calls[0];
    expect(JSON.parse(payload as string)).toMatchObject({ title: '🆘 SOS', body: 'note', tag: 'sos-room-1', url: '/admin/tour-ops' });
  });

  it('prunes 404/410 subscriptions and keeps sending to the rest', async () => {
    const { client, calls } = fakeDb(ROWS);
    createServerClientMock.mockReturnValue(client);
    sendNotificationMock
      .mockRejectedValueOnce({ statusCode: 410 })
      .mockResolvedValueOnce({ statusCode: 201 });
    const result = await sendOpsPush({ title: 't', body: 'b' });
    expect(result).toEqual({ sent: 1, pruned: 1 });
    expect(calls.deletes[0]).toEqual({ column: 'id', value: ['s1'] });
  });

  it('isGonePushStatus covers exactly the dead statuses', () => {
    expect(isGonePushStatus(404)).toBe(true);
    expect(isGonePushStatus(410)).toBe(true);
    expect(isGonePushStatus(500)).toBe(false);
    expect(isGonePushStatus(undefined)).toBe(false);
  });
});
