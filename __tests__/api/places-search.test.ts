/**
 * @jest-environment node
 *
 * /api/places/search — server-side Google Places (New) Text Search proxy for
 * the planner's "can't find it?" fallback. Verifies the short-query guard, the
 * result mapping + coord filter, region bias, and upstream-failure handling.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET } from '@/app/api/places/search/route';

/** Plain fetch-Response stub (avoids keeping undici's global agent alive, which
 *  would stop Jest from exiting). */
function fetchStub(status: number, json: unknown, text = '') {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => json,
    text: async () => text,
  };
}

const realFetch = global.fetch;
const OLD_ENV = process.env;

beforeEach(() => {
  process.env = { ...OLD_ENV, GOOGLE_MAPS_SERVER_API_KEY: 'test-key' };
});
afterEach(() => {
  global.fetch = realFetch;
  process.env = OLD_ENV;
  jest.clearAllMocks();
});

function req(qs: string, ip = '1.2.3.4') {
  return {
    nextUrl: { searchParams: new URLSearchParams(qs) },
    headers: { get: (h: string) => (h === 'x-forwarded-for' ? ip : null) },
  } as never;
}

describe('GET /api/places/search', () => {
  it('returns [] for short queries without calling Google', async () => {
    global.fetch = jest.fn();
    const res = await GET(req('q=a', '10.0.0.1'));
    expect((await res.json()).results).toEqual([]);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('maps Places (New) results and drops entries without coordinates', async () => {
    global.fetch = jest.fn(async () =>
      fetchStub(200, {
        places: [
          {
            id: 'p1',
            displayName: { text: 'Gamcheon Culture Village' },
            formattedAddress: 'Busan',
            location: { latitude: 35.09, longitude: 129.01 },
          },
          { id: 'p2', displayName: { text: 'No Coords' } },
        ],
      }),
    ) as unknown as typeof fetch;
    const res = await GET(req('q=gamcheon&region=busan', '10.0.0.2'));
    const json = await res.json();
    expect(json.results).toEqual([
      { place_id: 'p1', name: 'Gamcheon Culture Village', address: 'Busan', lat: 35.09, lng: 129.01 },
    ]);
    const call = (global.fetch as jest.Mock).mock.calls[0];
    expect(call[0]).toContain('places:searchText');
    const body = JSON.parse(call[1].body);
    expect(body.textQuery).toBe('gamcheon');
    expect(body.regionCode).toBe('KR');
    expect(body.locationBias.rectangle).toBeDefined();
    expect(call[1].headers['X-Goog-Api-Key']).toBe('test-key');
  });

  it('502s (empty results) when the Google upstream fails', async () => {
    global.fetch = jest.fn(async () => fetchStub(403, {}, 'denied')) as unknown as typeof fetch;
    const res = await GET(req('q=busan tower', '10.0.0.3'));
    expect(res.status).toBe(502);
    expect((await res.json()).results).toEqual([]);
  });

  it('500s when no server Maps key is configured', async () => {
    process.env = { ...OLD_ENV };
    delete process.env.GOOGLE_MAPS_SERVER_API_KEY;
    delete process.env.GOOGLE_MAPS_API_KEY;
    global.fetch = jest.fn();
    const res = await GET(req('q=haeundae', '10.0.0.4'));
    expect(res.status).toBe(500);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
