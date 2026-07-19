/**
 * @jest-environment node
 *
 * Server-only arrival facility-pins fetch — verification gate (§H, F-D).
 * Only human-verified, active pins reach a guest's scoped map card.
 * Plan: docs/tour-room-facility-pins-master-plan-2026-07-19.md
 */
import { fetchArrivalFacilityPins } from '@/lib/tour-room/facilityPins.server';

type EqCall = [string, unknown];

function fakeClient(rows: unknown[], opts: { rejects?: boolean } = {}) {
  const eqCalls: EqCall[] = [];
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return chain;
    },
    order: () => chain,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      (opts.rejects
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ data: rows, error: null })
      ).then(res, rej),
  };
  return { eqCalls, from: () => chain };
}

describe('fetchArrivalFacilityPins — verification gate', () => {
  it('returns [] for a missing poi_key without querying', async () => {
    const client = fakeClient([]);
    expect(await fetchArrivalFacilityPins(client, null)).toEqual([]);
    expect(await fetchArrivalFacilityPins(client, '')).toEqual([]);
    expect(client.eqCalls).toHaveLength(0);
  });

  it('filters to is_active=true AND is_verified=true (never serves unreviewed pins)', async () => {
    const client = fakeClient([]);
    await fetchArrivalFacilityPins(client, 'gyeongbokgung');
    expect(client.eqCalls).toEqual(
      expect.arrayContaining([
        ['poi_key', 'gyeongbokgung'],
        ['is_active', true],
        ['is_verified', true],
      ]),
    );
  });

  it('maps DB rows to FacilityPin shape', async () => {
    const client = fakeClient([
      { kind: 'restaurant', lat: 37.1, lng: 127.2, name: 'A', rating: 4.5, review_count: 200, distance_m: 80 },
      { kind: 'restroom', lat: 37.2, lng: 127.3, name: '공중화장실', distance_m: 40 },
    ]);
    const pins = await fetchArrivalFacilityPins(client, 'somewhere');
    expect(pins).toHaveLength(2);
    expect(pins[0]).toMatchObject({ kind: 'restaurant', name: 'A', rating: 4.5, reviewCount: 200 });
    expect(pins[1]).toMatchObject({ kind: 'restroom', name: '공중화장실' });
  });

  it('never throws — returns [] when the query fails', async () => {
    const client = fakeClient([], { rejects: true });
    await expect(fetchArrivalFacilityPins(client, 'x')).resolves.toEqual([]);
  });
});
