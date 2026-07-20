import { NextRequest, NextResponse } from 'next/server';
import { placesSearchRateLimit } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/**
 * GET /api/places/search?q=<text>&region=<busan|jeju|seoul>
 *
 * Server-side Google Places (New) Text Search for the D-1 planner's "can't find
 * it? search Google Maps" fallback. Runs with the server key (IP-restricted) so
 * the browser's HTTP-referrer restrictions on the public JS key never block it —
 * same rationale as /api/maps/static — and it uses the CURRENT Places API (the
 * legacy client-side `Autocomplete` widget the picker used before is deprecated).
 * Region-biased, KR-scoped, rate-limited (spends our billable key, public route).
 *
 * ⚠ Requires "Places API (New)" enabled on the server key in Google Cloud.
 */

/** Region cluster bounding boxes (mirror REGION_BOUNDS in the planner). */
const REGION_RECT: Record<
  string,
  { low: { latitude: number; longitude: number }; high: { latitude: number; longitude: number } }
> = {
  jeju: { low: { latitude: 33.1, longitude: 126.1 }, high: { latitude: 33.65, longitude: 126.99 } },
  busan: { low: { latitude: 34.95, longitude: 128.5 }, high: { latitude: 35.95, longitude: 129.6 } },
  seoul: { low: { latitude: 36.9, longitude: 126.3 }, high: { latitude: 38.4, longitude: 128.75 } },
};

interface PlacesTextResult {
  place_id: string | null;
  name: string;
  address: string;
  lat: number | null;
  lng: number | null;
}

export async function GET(req: NextRequest) {
  const limited = placesSearchRateLimit(req);
  if (limited) return limited;

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim().slice(0, 120);
  const region = req.nextUrl.searchParams.get('region') ?? '';
  if (q.length < 2) return NextResponse.json({ results: [] });

  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    console.error('places/search: no server Maps key configured (GOOGLE_MAPS_SERVER_API_KEY / GOOGLE_MAPS_API_KEY)');
    return NextResponse.json({ error: 'maps_key_missing', results: [] }, { status: 500 });
  }

  const rect = REGION_RECT[region];
  const body = {
    textQuery: q,
    regionCode: 'KR',
    languageCode: 'en',
    maxResultCount: 8,
    ...(rect ? { locationBias: { rectangle: rect } } : {}),
  };

  try {
    const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location',
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      console.error('places/search upstream', res.status, detail.slice(0, 300));
      return NextResponse.json({ error: 'places_upstream', results: [] }, { status: 502 });
    }
    const json = (await res.json().catch(() => null)) as { places?: unknown[] } | null;
    const raw = Array.isArray(json?.places) ? json!.places : [];
    const results: PlacesTextResult[] = raw
      .map((entry) => {
        const p = entry as {
          id?: string;
          displayName?: { text?: string };
          formattedAddress?: string;
          location?: { latitude?: number; longitude?: number };
        };
        return {
          place_id: typeof p.id === 'string' ? p.id : null,
          name: p.displayName?.text ?? '',
          address: p.formattedAddress ?? '',
          lat: typeof p.location?.latitude === 'number' ? p.location.latitude : null,
          lng: typeof p.location?.longitude === 'number' ? p.location.longitude : null,
        };
      })
      .filter((r) => r.place_id && r.lat !== null && r.lng !== null);
    return NextResponse.json({ results });
  } catch (err) {
    console.error('places/search error', err);
    return NextResponse.json({ error: 'places_error', results: [] }, { status: 500 });
  }
}
