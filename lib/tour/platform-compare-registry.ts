/**
 * Static lookup for the per-tour PlatformCompareBlock.
 *
 * The v2 trust strategy ("same operator, listed on Klook · GetYourGuide · Viator,
 * compare anytime") needs a per-tour list of external OTA URLs. This file is the
 * initial home of that data so the UI can ship without waiting on a Supabase
 * `tour_platform_links` table; once a table exists the loader can be swapped in
 * behind the same API surface and this registry retired.
 *
 * Editorial workflow: add an entry keyed by the static tour slug. Tours absent
 * from the registry render nothing — never invent a link.
 */
export type TourComparePlatform = "klook" | "getyourguide" | "viator";

export type TourComparePlatformLink = {
  platform: TourComparePlatform;
  url: string;
  /** Lowest "from" price observed on the platform, USD. Optional. */
  priceUsd?: number;
  /** ISO-8601 date the link/price was last verified by the ops team. */
  lastCheckedAt?: string;
};

export type TourCompareEntry = {
  links: ReadonlyArray<TourComparePlatformLink>;
};

const PLATFORM_LABEL: Record<TourComparePlatform, string> = {
  klook: "Klook",
  getyourguide: "GetYourGuide",
  viator: "Viator",
};

export function getPlatformLabel(p: TourComparePlatform): string {
  return PLATFORM_LABEL[p];
}

/**
 * Append UTM params so OTA-side analytics attributes the click to AtoC.
 * Preserves any existing query string on the OTA URL.
 */
export function appendCompareUtm(url: string, slug: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("utm_source", "atockorea");
    u.searchParams.set("utm_medium", "compare");
    u.searchParams.set("utm_campaign", "tour_platform_compare");
    u.searchParams.set("utm_content", slug);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Slug → external OTA links.
 *
 * Initially empty. As the ops team confirms each tour's listings across
 * Klook / GetYourGuide / Viator, add an entry below. Tours without an entry
 * render no PlatformCompareBlock (the v2 doctrine: never fake the proof).
 */
const TOUR_PLATFORM_COMPARE_REGISTRY: Record<string, TourCompareEntry> = {
  // Example shape — uncomment and fill once the ops team verifies the URLs.
  // "east-signature-nature-core": {
  //   links: [
  //     {
  //       platform: "klook",
  //       url: "https://www.klook.com/activity/<id>/",
  //       priceUsd: 89,
  //       lastCheckedAt: "2026-05-11",
  //     },
  //   ],
  // },
};

export function getTourCompareLinks(slug: string): TourCompareEntry | null {
  const entry = TOUR_PLATFORM_COMPARE_REGISTRY[slug];
  if (!entry || entry.links.length === 0) return null;
  return entry;
}

export function tourCompareLastCheckedAt(entry: TourCompareEntry): string | null {
  let latest: string | null = null;
  for (const link of entry.links) {
    if (!link.lastCheckedAt) continue;
    if (latest === null || link.lastCheckedAt > latest) {
      latest = link.lastCheckedAt;
    }
  }
  return latest;
}
