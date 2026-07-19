/**
 * Phase 2 (unified cockpit) — sendDriverRoomPush now rings the DRIVING
 * operator, who is a pure driver OR a guide driving today. Both roles'
 * subscriptions are notified, each landing on its own console.
 */

jest.mock('web-push', () => ({
  __esModule: true,
  default: { setVapidDetails: jest.fn(), sendNotification: jest.fn(async () => ({})) },
}));

import webpush from 'web-push';
import { sendDriverRoomPush } from '@/lib/tour-room/guestPush';
import type { RoomDbClient } from '@/lib/tour-room/access';

const sendMock = (webpush as unknown as { sendNotification: jest.Mock }).sendNotification;

/** Fake supabase: push_subscriptions filtered by (role, booking_id). */
function fakeDb(byRole: Record<string, Array<{ id: string; endpoint: string; p256dh: string; auth: string }>>): RoomDbClient {
  return {
    from() {
      let role: string | null = null;
      const builder: Record<string, unknown> = {
        select: () => builder,
        delete: () => builder,
        in: () => Promise.resolve({ data: null, error: null }),
        eq: (col: string, value: unknown) => {
          if (col === 'role') role = String(value);
          return builder;
        },
        then: (resolve: (v: unknown) => unknown) => resolve({ data: role ? byRole[role] ?? [] : [] }),
      };
      return builder;
    },
  } as unknown as RoomDbClient;
}

const sub = (id: string) => ({ id, endpoint: `https://push.test/${id}`, p256dh: 'p', auth: 'a' });

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY = 'pub';
  process.env.WEB_PUSH_VAPID_PRIVATE_KEY = 'priv';
});

describe('sendDriverRoomPush (unified cockpit targeting)', () => {
  it('rings a pure driver subscription with the driver console url', async () => {
    const db = fakeDb({ driver: [sub('d1')] });
    const result = await sendDriverRoomPush(db, 'booking-1', { body: 'msg', tag: 't' });
    expect(result.sent).toBe(1);
    expect(sendMock).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(sendMock.mock.calls[0][1]);
    expect(payload.url).toBe('/tour-mode/driver');
  });

  it('rings a guide (driving today) subscription with the guide console url', async () => {
    const db = fakeDb({ guide: [sub('g1')] });
    const result = await sendDriverRoomPush(db, 'booking-1', { body: 'msg' });
    expect(result.sent).toBe(1);
    const payload = JSON.parse(sendMock.mock.calls[0][1]);
    expect(payload.url).toBe('/tour-mode/guide');
  });

  it('notifies both roles when both are subscribed (each its own url)', async () => {
    const db = fakeDb({ driver: [sub('d1')], guide: [sub('g1')] });
    const result = await sendDriverRoomPush(db, 'booking-1', { body: 'msg' });
    expect(result.sent).toBe(2);
    const urls = sendMock.mock.calls.map((c) => JSON.parse(c[1]).url).sort();
    expect(urls).toEqual(['/tour-mode/driver', '/tour-mode/guide']);
  });

  it('is a silent no-op when VAPID is not configured', async () => {
    delete process.env.WEB_PUSH_VAPID_PRIVATE_KEY;
    const db = fakeDb({ driver: [sub('d1')] });
    const result = await sendDriverRoomPush(db, 'booking-1', { body: 'msg' });
    expect(result.sent).toBe(0);
    expect(sendMock).not.toHaveBeenCalled();
  });
});
