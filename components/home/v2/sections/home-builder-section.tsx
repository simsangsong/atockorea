"use client";

import { useEffect, useMemo, useState } from "react";
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
  /** Server-resolved Google Maps env (server components can't touch process.env in client comp). */
  mapId: string;
  apiKey: string;
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
 * region changes back via `router.replace('/')`, and this section's
 * `useEffect` re-fetches POIs when the URL region changes. POIs SSR-prefetch
 * only when an inbound link carried `?region=`; cold visits lazy-fetch.
 *
 * URL contract on `/`:
 *   - `?region=busan|jeju|seoul` — active region
 *   - `?builder=open` — auto-expand + auto-scroll into view (set by the
 *     `/itinerary-builder` redirect so inbound bookmarks land smoothly)
 *   - all other planner params (date, party, lang, duration, hours, ship,
 *     port, pickup, intent) are owned by PlannerTopRail / AIRecommendPanel.
 */
export function HomeBuilderSection({
  initialRegion,
  initialPois,
  mapId,
  apiKey,
}: Props) {
  const t = useTranslations("itineraryBuilder.home");
  const sp = useSearchParams();
  const urlRegion = sp?.get("region") ?? null;
  const region: RegionSlug =
    initialRegion && isRegionSlug(initialRegion) ? initialRegion
      : isRegionSlug(urlRegion ?? "") ? (urlRegion as RegionSlug)
      : DEFAULT_REGION;
  const center = REGION_CENTER[region];

  const [pois, setPois] = useState<MatchPoiRow[] | null>(
    initialPois && initialRegion === region ? initialPois : null,
  );
  const [loading, setLoading] = useState<boolean>(!pois);
  const [error, setError] = useState<string | null>(null);

  // Refetch when the URL region changes (PlannerTopRail.patch routes here
  // with router.replace, so the searchParams change but the page does NOT
  // remount). The SSR-prefetched payload is reused only for the initial
  // region; every subsequent change goes through the API.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/itinerary-builder/pois?region=${region}`)
      .then(async (r) => {
        const json = (await r.json()) as
          | { ok: true; pois: MatchPoiRow[] }
          | { ok: false; error: string };
        if (cancelled) return;
        if (!r.ok || !json.ok) {
          setError(!json.ok ? json.error : `HTTP ${r.status}`);
          setLoading(false);
          return;
        }
        setPois(json.pois);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "fetch_failed");
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [region]);

  // Auto-scroll into view when the inbound link asks for it (e.g. the
  // `/itinerary-builder` permanent redirect sets `?builder=open`).
  const sectionId = "home-builder";
  const wantsAutoScroll = sp?.get("builder") === "open";
  useEffect(() => {
    if (!wantsAutoScroll) return;
    const el = document.getElementById(sectionId);
    if (!el) return;
    // Wait one frame so layout has settled with whatever was prefetched.
    requestAnimationFrame(() => {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, [wantsAutoScroll]);

  // Reuse the same initialPois only for the first region; once the user
  // changes region the SSR set is stale.
  const ready = useMemo(() => !loading && Array.isArray(pois), [loading, pois]);

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
            mapId={mapId}
            apiKey={apiKey}
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
    <div className="flex h-[320px] items-center justify-center rounded-card bg-emerald-50/30 shadow-[0_2px_8px_rgba(15,23,42,0.04),0_22px_50px_-20px_rgba(15,23,42,0.20)] ring-1 ring-emerald-100/40">
      <span className="inline-flex items-center gap-2 text-caption font-semibold text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin text-emerald-600" aria-hidden />
        {label}
      </span>
    </div>
  );
}
