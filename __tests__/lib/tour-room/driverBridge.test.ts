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
