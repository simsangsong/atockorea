/**
 * @jest-environment node
 *
 * Plan §G tab ① — the booked tour's itinerary endpoint: resolves the tour slug
 * from the booking, serves the loader's stops, strips pickup/return
 * pseudo-stops, and degrades to empty (→ generic templates) when there's no
 * tour slug / detail page.
 */
import '@/test-utils/restoreWebPrimitives';
import { GET as itineraryGET } from '@/app/api/tour-rooms/[bookingId]/tour-itinerary/route';
import { createServerClient } from '@/lib/supabase';
import { resolveRoomActor } from '@/lib/tour-room/access';
import { loadTourItineraryStopsBySlug } from '@/lib/tour-product/loadTourProductPage';

jest.mock('@/lib/supabase', () => ({ createServerClient: jest.fn() }));
jest.mock('@/lib/tour-room/access', () => ({ resolveRoomActor: jest.fn() }));
jest.mock('@/lib/tour-product/loadTourProductPage', () => ({ loadTourItineraryStopsBySlug: jest.fn() }));

const createServerClientMock = createServerClient as jest.Mock;
const resolveRoomActorMock = resolveRoomActor as jest.Mock;
const loadStopsMock = loadTourItineraryStopsBySlug as jest.Mock;

function fakeDb(tours: unknown) {
  return {
    from() {
      const chain: Record<string, unknown> = {};
      for (const m of ['select', 'eq']) chain[m] = jest.fn(() => chain);
      chain.maybeSingle = jest.fn(async () => ({ data: { tours }, error: null }));
      return chain;
    },
  };
}

function req(locale = 'en') {
  return {
    nextUrl: { searchParams: new URLSearchParams(locale ? `locale=${locale}` : '') },
    headers: { get: () => null },
  } as never;
}
const params = () => ({ params: Promise.resolve({ bookingId: 'booking-1' }) });

beforeEach(() => {
  jest.clearAllMocks();
  resolveRoomActorMock.mockResolvedValue({
    ok: true,
    booking: { id: 'booking-1', preferred_language: 'en' },
    actor: { role: 'customer' },
  });
  createServerClientMock.mockReturnValue(fakeDb({ slug: 'busan-signature', title: 'Busan Signature' }));
  loadStopsMock.mockResolvedValue([]);
});

describe('GET /api/tour-rooms/[bookingId]/tour-itinerary', () => {
  it('403s when the actor cannot be resolved', async () => {
    resolveRoomActorMock.mockResolvedValue({ ok: false, status: 403, error: 'forbidden' });
    const res = await itineraryGET(req(), params());
    expect(res.status).toBe(403);
    expect(loadStopsMock).not.toHaveBeenCalled();
  });

  it('serves the tour stops and strips pickup / drop-off pseudo-stops', async () => {
    loadStopsMock.mockResolvedValue([
      { number: 0, name: 'Hotel pickup', _role: 'pickup' },
      { number: 1, name: 'Gamcheon Culture Village' },
      { number: 2, name: 'Haedong Yonggungsa' },
      { number: 3, name: 'Return', _role: 'dropoff' },
    ]);
    const res = await itineraryGET(req('ko'), params());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.stops.map((s: { name: string }) => s.name)).toEqual([
      'Gamcheon Culture Village',
      'Haedong Yonggungsa',
    ]);
    expect(json.tourTitle).toBe('Busan Signature');
    // locale from the query string reaches the loader.
    expect(loadStopsMock).toHaveBeenCalledWith(expect.anything(), 'busan-signature', 'ko');
  });

  it('returns empty stops (→ templates fallback) when the booking has no tour slug', async () => {
    createServerClientMock.mockReturnValue(fakeDb({ slug: null, title: 'No page tour' }));
    const res = await itineraryGET(req(), params());
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.stops).toEqual([]);
    expect(loadStopsMock).not.toHaveBeenCalled();
  });
});
