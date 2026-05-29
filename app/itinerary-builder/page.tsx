import { permanentRedirect } from "next/navigation";

/**
 * Phase 11 D27 — `/itinerary-builder` is collapsed into `/?…` (the
 * planner now lives on the home page directly, matcher-pattern style).
 * 308 permanent redirect preserves SEO + every existing query param.
 *
 * The booking surfaces stay where they were:
 *   - `/itinerary-builder/checkout?bookingId=…`
 *   - `/itinerary-builder/confirmation/[id]`
 */
export default async function LegacyBuilderPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const qs = new URLSearchParams();
  qs.set("builder", "open");
  for (const [k, v] of Object.entries(sp ?? {})) {
    if (k === "builder") continue;
    if (Array.isArray(v)) {
      for (const item of v) if (item) qs.append(k, item);
    } else if (v) {
      qs.set(k, v);
    }
  }
  permanentRedirect(`/?${qs.toString()}`);
}
