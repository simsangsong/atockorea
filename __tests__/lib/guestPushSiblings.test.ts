/**
 * @jest-environment node
 *
 * 조인 투어 — the staff device holds ONE push row (endpoint is unique),
 * subscribed under whichever booking's cockpit it opened. Every party rides
 * the same van, so a signal fired in any SIBLING booking of the same tour day
 * must still find that device. Guests stay booking-scoped.
 */
import { sendDriverRoomPush } from '@/lib/tour-room/guestPush';
import webpush from 'web-push';

jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn(async () => ({ statusCode: 201 })),
}));

const OLD_ENV = process.env;
beforeEach(() => {
  jest.clearAllMocks();
  process.env = {
    ...OLD_ENV,
    NEXT_PUBLIC_WEB_PUSH_VAPID_PUBLIC_KEY: 'pub',
    WEB_PUSH_VAPID_PRIVATE_KEY: 'priv',
  };
});
afterAll(() => {
  process.env = OLD_ENV;
});

/** bookings: b-1..b-3 share tour t-1 on 2099-01-01; the driver device is
 *  subscribed under b-1 only. */
function fakeDb() {
  const filters: Record<string, unknown>[] = [];
  const client = {
    from: (table: string) => {
      const state: Record<string, unknown> = { table };
      const chain = {
        select: () => chain,
        eq: (col: string, val: unknown) => {
          state[col] = val;
          return chain;
        },
        in: (col: string, vals: unknown) => {
          state[col] = vals;
          filters.push(state);
          if (table === 'push_subscriptions') {
            const ids = vals as string[];
            const rows = ids.includes('b-1')
              ? [{ id: 's1', endpoint: 'https://fcm.googleapis.com/x', p256dh: 'k', auth: 'a' }]
              : [];
            // Only the driver role row exists; guide lookups return empty.
            return Promise.resolve({ data: state.role === 'driver' ? rows : [] });
          }
          return Promise.resolve({ data: [] });
        },
        maybeSingle: () =>
          Promise.resolve({
            data: table === 'bookings' ? { tour_id: 't-1', tour_date: '2099-01-01' } : null,
          }),
        then: (resolve: (v: unknown) => unknown) => {
          // Awaiting the sibling list: .select('id').eq().eq()
          filters.push(state);
          return Promise.resolve({ data: [{ id: 'b-1' }, { id: 'b-2' }, { id: 'b-3' }] }).then(resolve);
        },
      };
      return chain;
    },
  };
  return { client, filters };
}

describe('sendDriverRoomPush widens to the tour day (join tours)', () => {
  it('a signal in sibling booking b-3 still reaches the device subscribed under b-1', async () => {
    const { client, filters } = fakeDb();
    const result = await sendDriverRoomPush(client as never, 'b-3', { body: '길을 잃었어요' });
    expect(result.sent).toBe(1);
    expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    // The subscription lookup ran with the whole sibling set, not just b-3.
    const subLookup = filters.find((f) => f.table === 'push_subscriptions' && f.role === 'driver');
    expect(subLookup?.booking_id).toEqual(expect.arrayContaining(['b-1', 'b-2', 'b-3']));
  });
});
