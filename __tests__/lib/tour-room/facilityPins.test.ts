/**
 * Facility pins — per-attraction restroom / photo-spot pin selection + the
 * multi-marker Static Maps path for the scoped inline map card.
 * (Track: docs/tour-room-facility-pins-master-plan-2026-07-19.md, W0.2)
 */
import {
  selectFacilityPins,
  facilityStaticMapPath,
  pinLabel,
  guestPinLabel,
  pinDirectionsUrl,
  FACILITY_PIN_CAP,
  type FacilityPin,
} from '@/lib/tour-room/facilityPins';

function pin(overrides: Partial<FacilityPin>): FacilityPin {
  return { kind: 'restroom', lat: 33.5, lng: 126.5, name: null, ...overrides };
}

describe('selectFacilityPins', () => {
  it('filters to the requested kind', () => {
    const pins = [
      pin({ kind: 'restroom', name: 'R1' }),
      pin({ kind: 'photo', name: 'P1' }),
      pin({ kind: 'restroom', name: 'R2' }),
    ];
    expect(selectFacilityPins(pins, 'restroom').map((p) => p.name)).toEqual(['R1', 'R2']);
    expect(selectFacilityPins(pins, 'photo').map((p) => p.name)).toEqual(['P1']);
  });

  it('sorts nearest-first, undefined distance last (stable)', () => {
    const pins = [
      pin({ name: 'far', distanceM: 300 }),
      pin({ name: 'no-dist-a' }),
      pin({ name: 'near', distanceM: 50 }),
      pin({ name: 'no-dist-b' }),
      pin({ name: 'mid', distanceM: 150 }),
    ];
    expect(selectFacilityPins(pins, 'restroom', 10).map((p) => p.name)).toEqual([
      'near',
      'mid',
      'far',
      'no-dist-a',
      'no-dist-b',
    ]);
  });

  it('caps at FACILITY_PIN_CAP by default', () => {
    const pins = Array.from({ length: 6 }, (_, i) => pin({ name: `R${i}`, distanceM: i }));
    expect(selectFacilityPins(pins, 'restroom')).toHaveLength(FACILITY_PIN_CAP);
  });

  it('drops invalid coordinates', () => {
    const pins = [
      pin({ name: 'ok' }),
      pin({ name: 'nan', lat: Number.NaN }),
      pin({ name: 'oob', lat: 200 }),
    ];
    expect(selectFacilityPins(pins, 'restroom').map((p) => p.name)).toEqual(['ok']);
  });
});

describe('facilityStaticMapPath', () => {
  it('emits one numbered marker per pin, no center/zoom (auto-fit)', () => {
    const path = facilityStaticMapPath([
      pin({ kind: 'restroom', lat: 33.5, lng: 126.5 }),
      pin({ kind: 'restroom', lat: 33.51, lng: 126.51 }),
    ]);
    const params = new URLSearchParams(path);
    const markers = params.getAll('markers');
    expect(markers).toHaveLength(2);
    expect(markers[0]).toContain('label:1');
    expect(markers[1]).toContain('label:2');
    expect(markers[0]).toContain('color:0x2563eb'); // restroom = blue
    // Auto-fit relies on omitting center/zoom.
    expect(params.get('center')).toBeNull();
    expect(params.get('zoom')).toBeNull();
    expect(params.get('size')).toBe('320x160');
  });

  it('uses the photo colour for photo pins', () => {
    const path = facilityStaticMapPath([pin({ kind: 'photo' })]);
    expect(new URLSearchParams(path).getAll('markers')[0]).toContain('color:0xdb2777');
  });

  it('returns empty string with no valid pins (text fallback)', () => {
    expect(facilityStaticMapPath([])).toBe('');
    expect(facilityStaticMapPath([pin({ lat: Number.NaN })])).toBe('');
  });

  it('produces a path the /api/maps/static proxy accepts (whitelisted params only)', () => {
    // Guards against drift with lib/maps-proxy ALLOWED_STATIC_MAP_PARAMS.
    const allowed = new Set(['center', 'zoom', 'size', 'scale', 'markers', 'path', 'visible', 'style', 'maptype', 'format', 'language', 'region', 'map_id']);
    const path = facilityStaticMapPath([pin({}), pin({ lat: 33.52 })]);
    for (const key of new URLSearchParams(path).keys()) {
      expect(allowed.has(key)).toBe(true);
    }
  });
});

describe('pinLabel', () => {
  it('prefers locale name, then neutral name, then kind default', () => {
    expect(pinLabel(pin({ name: 'Main gate WC', nameI18n: { ko: '정문 화장실' } }), 'ko')).toBe('정문 화장실');
    expect(pinLabel(pin({ name: 'Main gate WC', nameI18n: { ko: '정문 화장실' } }), 'en')).toBe('Main gate WC');
    expect(pinLabel(pin({ kind: 'restroom', name: null }), 'ja')).toBe('トイレ');
    expect(pinLabel(pin({ kind: 'photo', name: null }), 'en')).toBe('Photo spot');
  });
});

describe('guestPinLabel (A안 — foreign-guest display)', () => {
  it('shows a localized generic label for a Korean-named restroom', () => {
    const pin = pin_({ kind: 'restroom', name: '천지연폭포 공중화장실' });
    expect(guestPinLabel(pin, 'en')).toBe('Restroom');
    expect(guestPinLabel(pin, 'ja')).toBe('トイレ');
    expect(guestPinLabel(pin, 'zh')).toBe('洗手间');
  });

  it('honors a curated per-locale name when present', () => {
    const pin = pin_({ kind: 'restroom', name: '천지연폭포 공중화장실', nameI18n: { en: 'Falls Restroom' } });
    expect(guestPinLabel(pin, 'en')).toBe('Falls Restroom');
    expect(guestPinLabel(pin, 'ja')).toBe('トイレ'); // no ja override → generic
  });

  it('keeps the given name for photo spots', () => {
    expect(guestPinLabel(pin_({ kind: 'photo', name: 'Crater rim view' }), 'en')).toBe('Crater rim view');
  });
});

function pin_(overrides: Partial<FacilityPin>): FacilityPin {
  return { kind: 'restroom', lat: 33.5, lng: 126.5, name: null, ...overrides };
}

describe('pinDirectionsUrl', () => {
  it('builds a native directions link to the pin', () => {
    expect(pinDirectionsUrl(pin({ lat: 33.45, lng: 126.56 }))).toBe(
      'https://www.google.com/maps/dir/?api=1&destination=33.450000,126.560000',
    );
  });
});
