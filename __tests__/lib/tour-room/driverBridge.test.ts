/**
 * W3 (P-D15) — driver voice-bridge primitives:
 * driver tokens, PIN gate, one-tap signal bundles, nav deep links.
 */
import { signDriverRoomToken, signGuideRoomToken, verifyRoomToken } from '@/lib/tour-room/token';
import { checkDriverPin, pinFromBusPayload, pinFromVehicleValue } from '@/lib/tour-room/driver';
import { DRIVER_DELAY_MINUTES, googleMapsPinUrl, renderDriverSignal } from '@/lib/tour-room/driverSignals';
import {
  googleDirectionsUrl,
  kakaoNaviUrl,
  kakaoWebRouteUrl,
  naverWalkUrl,
  tmapUrl,
} from '@/lib/tour-room/nav-links';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';
import type { RoomDbClient } from '@/lib/tour-room/access';

const FUTURE_DATE = (() => {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
})();

describe('driver room tokens', () => {
  it('signs and verifies a driver tour-date token', () => {
    const { token } = signDriverRoomToken({ tourId: 'tour-1', tourDate: FUTURE_DATE, displayName: '김기사' });
    const payload = verifyRoomToken(token);
    expect(payload).toMatchObject({ scope: 'tour-date', role: 'driver', tourId: 'tour-1', tourDate: FUTURE_DATE });
  });

  it('defaults the display name', () => {
    const { payload } = signDriverRoomToken({ tourId: 'tour-1', tourDate: FUTURE_DATE });
    expect(payload.displayName).toBe('Driver');
  });

  it('driver and guide tokens stay distinct roles', () => {
    const guide = verifyRoomToken(signGuideRoomToken({ tourId: 't', tourDate: FUTURE_DATE, displayName: 'G' }).token);
    const driver = verifyRoomToken(signDriverRoomToken({ tourId: 't', tourDate: FUTURE_DATE }).token);
    expect(guide?.role).toBe('guide');
    expect(driver?.role).toBe('driver');
  });
});

describe('vehicle PIN gate (P-D3)', () => {
  it('extracts the last 4 digits from Korean plates', () => {
    expect(pinFromVehicleValue('제주 79바 1234')).toBe('1234');
    expect(pinFromVehicleValue('12가3456')).toBe('3456');
    expect(pinFromVehicleValue('no digits')).toBeNull();
    expect(pinFromVehicleValue(null)).toBeNull();
  });

  it('scans the historical payload field names', () => {
    expect(pinFromBusPayload({ vehicle_number: '경기 12아 7788' })).toBe('7788');
    expect(pinFromBusPayload({ busNumber: '서울70사1004' })).toBe('1004');
    expect(pinFromBusPayload({ note: 'nothing here' })).toBeNull();
  });

  function dbWithPayload(payload: unknown): RoomDbClient {
    return {
      from: () => ({
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: { payload }, error: null }) }),
          }),
        }),
      }),
    } as unknown as RoomDbClient;
  }

  it('requires and matches the PIN when a vehicle is on file', async () => {
    const db = dbWithPayload({ vehicle_number: '제주 79바 1234' });
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '1234')).resolves.toEqual({ required: true, ok: true });
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '9999')).resolves.toEqual({ required: true, ok: false });
  });

  it('fails open when no vehicle is on file (token stays the primary secret)', async () => {
    const db = dbWithPayload({});
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '')).resolves.toEqual({ required: false, ok: true });
  });

  /**
   * The plate moved to the dispatch panel and the gate did not follow it, so
   * in production `expected` was null for almost every tour and any forwarded
   * driver link opened the room. These pin the new first source.
   */
  function dbWithDispatch(
    dispatches: Array<{ plate_number?: string | null; vehicle?: { plate_number?: string | null } | null }>,
    busPayload: unknown = {},
  ): RoomDbClient {
    return {
      from: (table: string) => {
        if (table === 'tour_rooms') {
          const chain: Record<string, unknown> = {};
          chain.select = () => chain;
          chain.eq = () => chain;
          chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: [{ id: 'room-1' }], error: null }).then(res);
          return chain;
        }
        if (table === 'ops_room_vehicles') {
          const chain: Record<string, unknown> = {};
          chain.select = () => chain;
          chain.in = () => chain;
          chain.then = (res: (v: unknown) => unknown) => Promise.resolve({ data: dispatches, error: null }).then(res);
          return chain;
        }
        return {
          select: () => ({
            eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { payload: busPayload }, error: null }) }) }),
          }),
        };
      },
    } as unknown as RoomDbClient;
  }

  it('takes the PIN from the dispatched plate', async () => {
    const db = dbWithDispatch([{ plate_number: '서울 12가 3456' }]);
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '3456')).resolves.toEqual({ required: true, ok: true });
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '1111')).resolves.toEqual({ required: true, ok: false });
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '')).resolves.toEqual({ required: true, ok: false });
  });

  it('accepts the registered vehicle plate when the dispatch has none of its own', async () => {
    const db = dbWithDispatch([{ plate_number: null, vehicle: { plate_number: '제주 79바 4321' } }]);
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '4321')).resolves.toEqual({ required: true, ok: true });
  });

  it('accepts any plate running that day — a second bus must not lock out the first', async () => {
    const db = dbWithDispatch([{ plate_number: '서울12가3456' }, { plate_number: '서울34나7788' }]);
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '3456')).resolves.toEqual({ required: true, ok: true });
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '7788')).resolves.toEqual({ required: true, ok: true });
    await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '0000')).resolves.toEqual({ required: true, ok: false });
  });

  it('still falls back to the legacy sheet, and stays open with a plateless dispatch', async () => {
    const legacy = dbWithDispatch([{ plate_number: null, vehicle: null }], { vehicle_number: '경기 12아 7788' });
    await expect(checkDriverPin(legacy, 'tour-1', FUTURE_DATE, '7788')).resolves.toEqual({ required: true, ok: true });

    // Rental model: the type is dispatched days ahead, the plate arrives on the
    // day. Until it does there is nothing to check and entry must not break.
    const typeOnly = dbWithDispatch([{ plate_number: null, vehicle: null }], {});
    await expect(checkDriverPin(typeOnly, 'tour-1', FUTURE_DATE, '')).resolves.toEqual({ required: false, ok: true });
  });

  /**
   * 🔴 FA-018 — "no plate on file" and "the lookup broke" used to be the same
   * empty set, and the empty set opened the gate. A dispatch table hiccup
   * therefore deleted the PIN check instead of enforcing it. These three pin
   * the distinction at each of the three places a lookup can fail.
   */
  function dbFailingAt(failing: 'rooms' | 'dispatch' | 'legacy'): RoomDbClient {
    const err = { message: 'connection reset' };
    return {
      from: (table: string) => {
        if (table === 'tour_rooms') {
          const chain: Record<string, unknown> = {};
          chain.select = () => chain;
          chain.eq = () => chain;
          chain.then = (res: (v: unknown) => unknown) =>
            Promise.resolve(
              failing === 'rooms' ? { data: null, error: err } : { data: [{ id: 'room-1' }], error: null },
            ).then(res);
          return chain;
        }
        if (table === 'ops_room_vehicles') {
          const chain: Record<string, unknown> = {};
          chain.select = () => chain;
          chain.in = () => chain;
          chain.then = (res: (v: unknown) => unknown) =>
            Promise.resolve(failing === 'dispatch' ? { data: null, error: err } : { data: [], error: null }).then(res);
          return chain;
        }
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({
                maybeSingle: async () =>
                  failing === 'legacy' ? { data: null, error: err } : { data: { payload: {} }, error: null },
              }),
            }),
          }),
        };
      },
    } as unknown as RoomDbClient;
  }

  it.each(['rooms', 'dispatch', 'legacy'] as const)(
    '🔴 a failed plate lookup (%s) closes the gate instead of removing it',
    async (where) => {
      const db = dbFailingAt(where);
      await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '1234')).resolves.toEqual({
        required: true,
        ok: false,
        lookupFailed: true,
      });
      // Not even an empty PIN gets through — the point is that we could not check.
      await expect(checkDriverPin(db, 'tour-1', FUTURE_DATE, '')).resolves.toMatchObject({ ok: false });
    },
  );

  it('a thrown query (not just an error field) also closes the gate', async () => {
    const throwing = {
      from: () => {
        throw new Error('client exploded');
      },
    } as unknown as RoomDbClient;
    await expect(checkDriverPin(throwing, 'tour-1', FUTURE_DATE, '1234')).resolves.toEqual({
      required: true,
      ok: false,
      lookupFailed: true,
    });
  });
});

describe('driver signal bundles (5-locale, zero LLM)', () => {
  it('covers every room locale for every signal type', () => {
    for (const type of ['delay', 'parking_pin', 'vehicle_arrived', 'vehicle_issue'] as const) {
      const bundle = renderDriverSignal(type, { minutes: 10 });
      for (const locale of ROOM_LOCALES) {
        expect(bundle.translations[locale]).toBeTruthy();
        expect(bundle.translations[locale]).not.toContain('{');
      }
    }
  });

  it('interpolates minutes and appends the shared maps link', () => {
    const bundle = renderDriverSignal('parking_pin', { mapsUrl: googleMapsPinUrl(33.5, 126.5) });
    expect(bundle.translations.ko).toContain('https://maps.google.com/?q=33.500000,126.500000');
    const delay = renderDriverSignal('delay', { minutes: 20 });
    expect(delay.translations.ko).toContain('20분');
    expect(delay.translations.en).toContain('20 minutes');
  });

  it('delay minute options stay a fixed whitelist', () => {
    expect(DRIVER_DELAY_MINUTES).toEqual([5, 10, 15, 20, 30]);
  });
});

describe('nav deep links (W3.2)', () => {
  const dest = { lat: 33.458, lng: 126.942, name: '성산일출봉' };

  it('builds the driver links (kakao app + web fallback + tmap)', () => {
    expect(kakaoNaviUrl(dest)).toBe('kakaomap://route?ep=33.458,126.942&by=CAR');
    expect(kakaoWebRouteUrl(dest)).toContain('map.kakao.com/link/to/');
    expect(kakaoWebRouteUrl(dest)).toContain(',33.458,126.942');
    expect(tmapUrl(dest)).toContain('goalx=126.942');
    expect(tmapUrl(dest)).toContain('goaly=33.458');
  });

  it('builds the guest links (naver walk + google)', () => {
    expect(naverWalkUrl(dest)).toContain('nmap://route/walk?dlat=33.458&dlng=126.942');
    expect(googleDirectionsUrl(dest)).toContain('destination=33.458,126.942');
    expect(googleDirectionsUrl(dest, 'driving')).toContain('travelmode=driving');
  });

  it('URL-encodes destination names', () => {
    expect(naverWalkUrl(dest)).toContain(encodeURIComponent('성산일출봉'));
    expect(tmapUrl({ lat: 1, lng: 2 })).toContain(encodeURIComponent('목적지'));
  });
});
