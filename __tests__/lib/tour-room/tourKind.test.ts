/**
 * §11.D D1 — canonical join-vs-private helper. Exercises every branch,
 * including the null/unknown price_type ⇒ join fallback and the
 * price_type-wins-over-otaTourKind precedence.
 */
import {
  tourKindFromPriceType,
  isPrivateTour,
  resolveTourKind,
  type TourKind,
} from '@/lib/tour-room/tourKind';

describe('tourKindFromPriceType', () => {
  it("maps 'vehicle' to private", () => {
    expect(tourKindFromPriceType('vehicle')).toBe<TourKind>('private');
  });

  it.each(['person', 'group', 'coach', 'unknown', ''])(
    "maps non-vehicle value %p to join",
    (value) => {
      expect(tourKindFromPriceType(value)).toBe<TourKind>('join');
    },
  );

  it('maps null/undefined to join (safe fallback)', () => {
    expect(tourKindFromPriceType(null)).toBe('join');
    expect(tourKindFromPriceType(undefined)).toBe('join');
  });
});

describe('isPrivateTour', () => {
  it("is true only for 'vehicle'", () => {
    expect(isPrivateTour('vehicle')).toBe(true);
    expect(isPrivateTour('person')).toBe(false);
    expect(isPrivateTour('group')).toBe(false);
    expect(isPrivateTour('anything')).toBe(false);
    expect(isPrivateTour(null)).toBe(false);
    expect(isPrivateTour(undefined)).toBe(false);
  });
});

describe('resolveTourKind', () => {
  it('uses price_type when present, ignoring otaTourKind', () => {
    expect(resolveTourKind({ priceType: 'vehicle', otaTourKind: 'join' })).toBe('private');
    expect(resolveTourKind({ priceType: 'person', otaTourKind: 'private' })).toBe('join');
    expect(resolveTourKind({ priceType: 'group' })).toBe('join');
  });

  it('falls back to otaTourKind only when price_type is null/undefined', () => {
    expect(resolveTourKind({ priceType: null, otaTourKind: 'private' })).toBe('private');
    expect(resolveTourKind({ priceType: undefined, otaTourKind: 'private' })).toBe('private');
    expect(resolveTourKind({ priceType: null, otaTourKind: 'join' })).toBe('join');
    expect(resolveTourKind({ priceType: null, otaTourKind: 'anything' })).toBe('join');
    expect(resolveTourKind({ priceType: null, otaTourKind: null })).toBe('join');
    expect(resolveTourKind({})).toBe('join');
  });
});
