import { permanentRedirect } from "next/navigation";

/**
 * Phase 10.3 D21 — `/itinerary-builder/[region]` is collapsed into
 * `/itinerary-builder?region=…`. This route stays only as a 308
 * (permanent) redirect to preserve SEO + inbound bookmarks.
 *
 * Existing query params (track / lang / date / party / duration / hours /
 * ship / intent / pickup / port / locale / origin) are forwarded verbatim.
 */
export default async function LegacyRegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ region }, sp] = await Promise.all([params, searchParams]);
  const qs = new URLSearchParams();
  qs.set("region", region);
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (k === "region") continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item) qs.append(k, item);
    } else if (v) {
      qs.set(k, v);
    }
  }
  permanentRedirect(`/itinerary-builder?${qs.toString()}`);
}
