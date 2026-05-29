import { permanentRedirect } from "next/navigation";

/**
 * Phase 11 D27 — `/itinerary-builder/[region]` is collapsed into `/?…`
 * (the planner now lives on the home page). 308 permanent redirect
 * preserves SEO + every existing query param, plus adds `builder=open`
 * so the home page auto-scrolls to the builder section.
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
  qs.set("builder", "open");
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (k === "region" || k === "builder") continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item) qs.append(k, item);
    } else if (v) {
      qs.set(k, v);
    }
  }
  permanentRedirect(`/?${qs.toString()}`);
}
