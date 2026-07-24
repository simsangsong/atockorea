/**
 * Regression — `latestArrivalContext` must recognise EVERY arrival path.
 *
 * It originally matched `metadata.kind === 'spot_arrival'` only. The A0 one-tap
 * bundle then became the arrival path on every operator-driven tour, so those
 * rooms handed the concierge a null spot: restroom / photo / food asks all fell
 * back to "ask your guide" while the answer sat two messages up the feed.
 */
import { latestArrivalContext } from '@/lib/tour-room/concierge';

const PIN = { kind: 'restroom' as const, lat: 33.51, lng: 126.53, name: '화장실', isVerified: true };

describe('latestArrivalContext — arrival kinds', () => {
  it('recognises an arrival_bundle as a full arrival', () => {
    const result = latestArrivalContext([
      {
        metadata: {
          kind: 'arrival_bundle',
          spot_title: 'Dongmun Market',
          poi_key: 'dongmun_market',
          content: { name: 'Dongmun Market', description: 'A night market.' },
          facility_pins: [PIN],
        },
      },
    ]);
    expect(result.spotTitle).toBe('Dongmun Market');
    expect(result.poiKey).toBe('dongmun_market');
    expect(result.content?.description).toBe('A night market.');
    expect(result.facilityPins).toHaveLength(1);
  });

  it('still recognises a spot_arrival (unchanged)', () => {
    const result = latestArrivalContext([
      { metadata: { kind: 'spot_arrival', spot_title: 'Seongsan', poi_key: 'seongsan', content: { name: 'S' } } },
    ]);
    expect(result.spotTitle).toBe('Seongsan');
    expect(result.poiKey).toBe('seongsan');
  });

  it('takes the NEWEST arrival regardless of which path produced it', () => {
    const result = latestArrivalContext([
      { metadata: { kind: 'spot_arrival', spot_title: 'First', poi_key: 'first' } },
      { metadata: { kind: 'chat' } },
      { metadata: { kind: 'arrival_bundle', spot_title: 'Second', poi_key: 'second' } },
    ]);
    expect(result.spotTitle).toBe('Second');
  });

  it('an approach_card is only a WEAK fallback — a real arrival always wins', () => {
    const withArrival = latestArrivalContext([
      { metadata: { kind: 'arrival_bundle', spot_title: 'Arrived', poi_key: 'arrived' } },
      { metadata: { kind: 'approach_card', spot_title: 'Coming up', poi_key: 'next' } },
    ]);
    expect(withArrival.spotTitle).toBe('Arrived');

    const previewOnly = latestArrivalContext([
      { metadata: { kind: 'approach_card', spot_title: 'Coming up', poi_key: 'next' } },
    ]);
    expect(previewOnly.spotTitle).toBe('Coming up');
    expect(previewOnly.poiKey).toBe('next');
  });

  it('an empty content object still reads as no content', () => {
    const result = latestArrivalContext([{ metadata: { kind: 'arrival_bundle', spot_title: 'Spot', content: {} } }]);
    expect(result.content).toBeNull();
  });

  it('a feed with no arrival at all yields the empty context', () => {
    const result = latestArrivalContext([{ metadata: { kind: 'extra_ledger' } }, { metadata: null }, {}]);
    expect(result).toEqual({ spotTitle: null, content: null, poiKey: null, facilityPins: [] });
  });
});
