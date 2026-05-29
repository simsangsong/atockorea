"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import {
  REGION_CENTER,
  isRegionSlug,
  type RegionSlug,
} from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import { useTranslations } from "@/lib/i18n";
import BuilderShell from "@/components/itinerary-builder/BuilderShell";

interface Props {
  /**
   * Phase 11 D30 — when the home page receives `?region=` SSR can pre-fetch
   * the POIs and pass them in for an instant first paint. Optional: cold
   * landing-page visits skip the prefetch (TTFB) and we lazy-fetch via
   * `GET /api/itinerary-builder/pois?region=…` on mount.
   */
  initialRegion?: RegionSlug | null;
  initialPois?: MatchPoiRow[] | null;
  /**
   * Google Maps env. Optional: when omitted (e.g. on `/[locale]/page.tsx`,
   * which is a client component and doesn't pass these props), we fall back
   * to `process.env.NEXT_PUBLIC_GOOGLE_MAPS_*` directly. Next.js inlines
   * `NEXT_PUBLIC_*` at build time, so client components can read them.
   */
  mapId?: string;
  apiKey?: string;
}

const DEFAULT_REGION: RegionSlug = "busan";

/**
 * Phase 11 — HomeBuilderSection.
 *
 * Mounts the unified planner (BuilderShell) directly inside HomeV2Page so
 * inputs + result + map + price all render on `/`. Replaces the old
 * `ItineraryBuilderEntry` (3 region cards linking out to `/itinerary-builder`).
 *
 * Region selection lives in the URL (`?region=`) — PlannerTopRail writes
 * region changes back via `router.replace(pathname?…)`, and this section's
 * `useEffect` re-fetches POIs when the URL region changes. POIs SSR-prefetch
 * only when an inbound link carried `?region=`; cold visits lazy-fetch.
 */
export function HomeBuilderSection({
  initialRegion,
  initialPois,
  mapId,
  apiKey,
}: Props) {
  const t = useTranslations("itineraryBuilder.home");
  const sp = useSearchParams();

  // Phase 11 audit fix #1 — the URL is the SoT for region. `initialRegion`
  // only seeds the FIRST resolution; once mounted, PlannerTopRail's
  // router.replace updates `?region=`, and the URL drives every subsequent
  // re-fetch. Previously the ternary preferred `initialRegion` forever,
  // pinning region to the SSR value and silently no-op'ing the chips.
  const urlRegion = sp?.get("region") ?? null;
  const region: RegionSlug = isRegionSlug(urlRegion ?? "")
    ? (urlRegion as RegionSlug)
    : initialRegion && isRegionSlug(initialRegion)
      ? initialRegion
      : DEFAULT_REGION;
  const center = REGION_CENTER[region];

  // Phase 11 audit fix #3 — only the FIRST region (which SSR prefetched)
  // gets to skip the loading flash. Once the user changes region the
  // SSR set is stale, so we lazy-fetch and show the spinner. Tracking
  // the prefetched-region in a ref lets us recognize the warm case
  // across re-renders without re-doing the comparison on every render.
  const prefetchedRegionRef = useRef<RegionSlug | null>(
    initialRegion && initialPois ? initialRegion : null,
  );
  const [pois, setPois] = useState<MatchPoiRow[] | null>(
    prefetchedRegionRef.current === region ? (initialPois ?? null) : null,
  );
  const [loading, setLoading] = useState<boolean>(
    !(prefetchedRegionRef.current === region && initialPois),
  );
  const [error, setError] = useState<string | null>(null);

  // Refetch when the URL region changes. The first effect run on a warm
  // (SSR-prefetched) load early-returns so we don't unmount BuilderShell
  // and lose Google Maps / AI panel / quote-modal state during a redundant
  // network round-trip.
  useEffect(() => {
    if (prefetchedRegionRef.current === region) {
      // Consume the prefetch token — subsequent region changes always fetch.
      prefetchedRegionRef.current = null;
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    fetch(`/api/itinerary-builder/pois?region=${region}`, {
      signal: controller.signal,
    })
      .then(async (r) => {
        const json = (await r.json()) as
          | { ok: true; pois: MatchPoiRow[] }
          | { ok: false; error: string };
        if (controller.signal.aborted) return;
        if (!r.ok || !json.ok) {
          setError(!json.ok ? json.error : `HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        setPois(json.pois);
        setLoading(false);
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        setError(e instanceof Error ? e.message : "fetch_failed");
        setLoading(false);
      });
    return () => controller.abort();
  }, [region]);

  // Auto-scroll into view when the inbound link asks for it (e.g. the
  // `/itinerary-builder` permanent redirect sets `?builder=open`). Phase 11
  // audit fix #6 — gate on `ready` so we don't scroll users to a loading
  // spinner, then re-fire when content actually arrives.
  const sectionId = "home-builder";
  const wantsAutoScroll = sp?.get("builder") === "open";
  const ready = useMemo(() => !loading && Array.isArray(pois), [loading, pois]);
  const didAutoScrollRef = useRef(false);
  useEffect(() => {
    if (!wantsAutoScroll || !ready || didAutoScrollRef.current) return;
    const el = document.getElementById(sectionId);
    if (!el) return;
    didAutoScrollRef.current = true;
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [wantsAutoScroll, ready]);

  return (
    <section
      id={sectionId}
      className="section-py-md relative scroll-mt-24 bg-stone-50 px-4 md:px-6 lg:px-8"
      aria-label={t("title")}
    >
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 text-center md:mb-8">
          <p className="mb-3 inline-flex items-center gap-1.5 text-eyebrow text-slate-500">
            <Sparkles className="h-3 w-3 text-emerald-600" aria-hidden />
            {t("eyebrow")}
          </p>
          <h2 className="mb-3 text-balance text-display text-slate-900">
            {t("title")}
          </h2>
          <p className="mx-auto max-w-2xl text-h3 font-medium text-slate-600">
            {t("subtitle")}
          </p>
        </header>

        {ready && pois ? (
          <BuilderShell
            region={region}
            pois={pois}
            center={center}
            mapId={mapId || process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || ""}
            apiKey={apiKey || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
            placement="home"
          />
        ) : (
          <LoadingState
            label={loading ? t("loading") : error ? t("error") : t("loading")}
          />
        )}
      </div>
    </section>
  );
}

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex h-[320px] items-center justify-center rounded-card bg-emerald-50/30 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_22px_50px_-20px_rgba(15,23,42,0.20),inset_0_1px_0_rgba(255,255,255,0.9)] ring-1 ring-emerald-100/40">
      <span className="inline-flex items-center gap-2 text-caption font-semibold text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden />
        {label}
      </span>
    </div>
  );
}
