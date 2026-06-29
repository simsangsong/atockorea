import { permanentRedirect } from "next/navigation";
import { ITINERARY_BUILDER_ENABLED } from "@/lib/itinerary-builder/builder-visibility";

/**
 * Phase 13 D36 — `/itinerary-builder/[region]` collapses into
 * `/itinerary-builder?region=…` (the canonical single planner route
 * restored). 308 permanent redirect preserves SEO + every query param.
 */
export default async function LegacyRegionPage({
  params,
  searchParams,
}: {
  params: Promise<{ region: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  // Klook prep 2026-06-29: builder hidden → legacy region URLs go to the catalog.
  if (!ITINERARY_BUILDER_ENABLED) permanentRedirect("/tours/list");
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
