/**
 * Server-only Kakao Mobility (Navi) driving duration helpers.
 * Do not import from client components.
 */

type LngLat = { lng: number; lat: number };

export type KakaoSingleDriveInput = {
  origin: LngLat;
  destination: LngLat;
};

export type KakaoFutureDriveInput = {
  origin: LngLat;
  destination: LngLat;
  departureAt: string;
};

export type KakaoMultiDestinationInput = {
  origin: LngLat;
  destinations: Array<{
    key: string;
    point: LngLat;
    radius?: number;
  }>;
};

export type KakaoDriveResult = {
  durationMinutes: number;
  distanceMeters: number | null;
  rawSummary?: unknown;
};

function getKakaoApiKey(): string | null {
  return (
    process.env.KAKAO_MOBILITY_REST_API_KEY?.trim() ||
    process.env.KAKAO_REST_API_KEY?.trim() ||
    null
  );
}

function getKakaoBaseUrl(): string {
  return (
    process.env.KAKAO_MOBILITY_BASE_URL?.trim() || 'https://apis-navi.kakaomobility.com'
  );
}

function buildHeaders(key: string): HeadersInit {
  return {
    Authorization: `KakaoAK ${key}`,
    'Content-Type': 'application/json',
  };
}

async function fetchJsonWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = Number(process.env.KAKAO_MOBILITY_TIMEOUT_MS || 5000),
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });

    const text = await res.text();

    if (res.status === 429) {
      console.warn('[kakao-mobility] rate limited (429)', { url: url.split('?')[0] });
    } else if (!res.ok) {
      console.warn('[kakao-mobility] non-2xx response', {
        status: res.status,
        url: url.split('?')[0],
        bodyPreview: text.slice(0, 500),
      });
      throw new Error(`[kakao] ${res.status}`);
    }

    return text ? JSON.parse(text) : null;
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      console.warn('[kakao-mobility] request timeout', {
        url: url.split('?')[0],
        timeoutMs,
      });
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function hasKakaoMobilityKey(): boolean {
  return Boolean(getKakaoApiKey());
}

/** Explicit opt-out for staging / tests. */
export function isKakaoMobilityLiveEnabled(): boolean {
  if (process.env.KAKAO_MOBILITY_DISABLED === '1' || process.env.KAKAO_MOBILITY_DISABLED === 'true') {
    return false;
  }
  return hasKakaoMobilityKey();
}

/** Kakao Navi summary.duration is seconds in typical responses. */
function parseDurationMinutesSeconds(secondsLike: unknown): number {
  if (typeof secondsLike !== 'number' || !Number.isFinite(secondsLike)) {
    throw new Error('Missing or invalid duration field from Kakao response');
  }
  return Math.max(1, Math.round(secondsLike / 60));
}

export async function getKakaoDrivingDuration(input: KakaoSingleDriveInput): Promise<KakaoDriveResult> {
  const key = getKakaoApiKey();
  if (!key) throw new Error('Missing Kakao Mobility API key');

  const url = `${getKakaoBaseUrl()}/v1/directions`;

  const payload = {
    origin: { x: input.origin.lng, y: input.origin.lat },
    destination: { x: input.destination.lng, y: input.destination.lat },
    priority: 'TIME',
  };

  const json = (await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: buildHeaders(key),
    body: JSON.stringify(payload),
  })) as { routes?: Array<{ summary?: { duration?: number; distance?: number } }> };

  const route = json?.routes?.[0];
  const summary = route?.summary;

  return {
    durationMinutes: parseDurationMinutesSeconds(summary?.duration),
    distanceMeters: typeof summary?.distance === 'number' ? summary.distance : null,
    rawSummary: summary ?? null,
  };
}

export async function getKakaoFutureDrivingDuration(
  input: KakaoFutureDriveInput,
): Promise<KakaoDriveResult> {
  const key = getKakaoApiKey();
  if (!key) throw new Error('Missing Kakao Mobility API key');

  const url = `${getKakaoBaseUrl()}/v1/future/directions`;

  const payload = {
    origin: { x: input.origin.lng, y: input.origin.lat },
    destination: { x: input.destination.lng, y: input.destination.lat },
    departure_time: input.departureAt,
    priority: 'TIME',
  };

  const json = (await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: buildHeaders(key),
    body: JSON.stringify(payload),
  })) as { routes?: Array<{ summary?: { duration?: number; distance?: number } }> };

  const route = json?.routes?.[0];
  const summary = route?.summary;

  return {
    durationMinutes: parseDurationMinutesSeconds(summary?.duration),
    distanceMeters: typeof summary?.distance === 'number' ? summary.distance : null,
    rawSummary: summary ?? null,
  };
}

export async function getKakaoMultiDestinationDurations(
  input: KakaoMultiDestinationInput,
): Promise<Record<string, KakaoDriveResult>> {
  const key = getKakaoApiKey();
  if (!key) throw new Error('Missing Kakao Mobility API key');

  const url = `${getKakaoBaseUrl()}/v1/destinations`;

  const payload = {
    origin: { x: input.origin.lng, y: input.origin.lat },
    destinations: input.destinations.map((d) => ({
      key: d.key,
      x: d.point.lng,
      y: d.point.lat,
      radius: d.radius ?? 10000,
    })),
    priority: 'TIME',
  };

  const json = (await fetchJsonWithTimeout(url, {
    method: 'POST',
    headers: buildHeaders(key),
    body: JSON.stringify(payload),
  })) as {
    destinations?: Array<{
      key?: string;
      duration?: number;
      distance?: number;
      summary?: { duration?: number; distance?: number };
    }>;
  };

  const out: Record<string, KakaoDriveResult> = {};

  for (const row of json?.destinations ?? []) {
    const rowKey = String(row?.key ?? '');
    if (!rowKey) continue;

    const durationSeconds =
      row?.duration ?? row?.summary?.duration ?? null;

    try {
      out[rowKey] = {
        durationMinutes: parseDurationMinutesSeconds(durationSeconds),
        distanceMeters:
          typeof row?.distance === 'number'
            ? row.distance
            : typeof row?.summary?.distance === 'number'
              ? row.summary.distance
              : null,
        rawSummary: row?.summary ?? null,
      };
    } catch (e) {
      console.warn('[kakao-mobility] skip malformed multi-destination row', {
        key: rowKey,
        error: e instanceof Error ? e.message : e,
      });
    }
  }

  return out;
}
