import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ChevronLeft } from "lucide-react";
import { createServerClient } from "@/lib/supabase";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import {
  REGION_CLUSTER,
  REGION_CENTER,
  REGION_SLUGS,
  isRegionSlug,
  type RegionSlug,
} from "@/lib/itinerary-builder/regions";
import type { MatchPoiRow } from "@/lib/itinerary-builder/types";
import { isBuilderAttraction } from "@/lib/itinerary-match-engine/poi-taxonomy";
import BuilderShell from "@/components/itinerary-builder/BuilderShell";

// Force runtime fetch — match_pois is small and refreshed rarely; serve from
// CDN-edge with 5-minute ISR for performance.
export const revalidate = 300;

const REGION_HEADLINES: Record<RegionSlug, { eyebrow: string; title: string; subtitle: string }> = {
  busan: {
    eyebrow: "Busan + day-trip cluster",
    title: "Busan Map",
    subtitle: "Curated stops across Busan, Yangsan, Gyeongju, Ulsan, and Miryang.",
  },
  jeju: {
    eyebrow: "Jeju Island",
    title: "Jeju Map",
    subtitle: "Curated stops across the whole UNESCO Triple Crown island.",
  },
  seoul: {
    eyebrow: "Seoul + Gyeonggi day-trips",
    title: "Seoul Map",
    subtitle: "Curated stops across central Seoul, Gyeonggi palaces, and day-trip corridors.",
  },
};

export async function generateStaticParams() {
  return REGION_SLUGS.map((region) => ({ region }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ region: string }>;
}): Promise<Metadata> {
  const { region } = await params;
  if (!isRegionSlug(region)) return {};
  const h = REGION_HEADLINES[region];
  return {
    title: `${h.title} — Build Your Itinerary | AtoC Korea`,
    description: h.subtitle,
  };
}

export default async function ItineraryBuilderRegionPage({
  params,
}: {
  params: Promise<{ region: string }>;
}) {
  const { region } = await params;
  if (!isRegionSlug(region)) notFound();

  const cluster = REGION_CLUSTER[region];
  const center = REGION_CENTER[region];
  const headline = REGION_HEADLINES[region];

  const supabase = createServerClient();
  const { data, error } = await supabase
    .from("match_pois")
    .select(
      "poi_key, name_en, name_ko, names_other_locales, region, category, default_image_url, default_stay_minutes, lat, lng, stop_role, is_attraction, is_operational, builder_profile_source, builder_profile_version, poi_meta, description, highlights, images, why_on_route, smart_notes, visit_basics, convenience"
    )
    .in("region", cluster as unknown as string[])
    .not("name_en", "is", null)
    .not("lat", "is", null);

  if (error) {
    throw new Error(`Failed to load POIs for ${region}: ${error.message}`);
  }
  const pois = ((data ?? []) as MatchPoiRow[]).filter((p) =>
    p.is_attraction === true || (p.is_attraction == null && isBuilderAttraction(p.poi_key))
  );

  return (
    <SitePageShell>
      <main className="min-h-screen bg-white/55">
        {/* V2 Phase 1 — thin breadcrumb bar replaces the old hero header
            (display title + subtitle). The user already navigated here
            from the intake form; a hero re-greeting is friction. The map
            below and the AI panel speak for the region's character. */}
        <nav
          aria-label="Itinerary builder navigation"
          className="border-b border-slate-200/70 bg-white/70 backdrop-blur-md"
        >
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 md:px-6 lg:px-8">
            <Link
              href="/itinerary-builder"
              className="inline-flex items-center gap-1 text-micro font-semibold text-slate-500 transition-colors hover:text-slate-900"
            >
              <ChevronLeft className="h-3.5 w-3.5" aria-hidden />
              Plan a different region
            </Link>
            <div className="min-w-0 flex-shrink text-right">
              <h1 className="truncate text-h3 leading-none text-slate-900">{headline.title}</h1>
              <p className="mt-0.5 truncate text-micro text-slate-500">
                {pois.length} stops · {headline.eyebrow}
              </p>
            </div>
          </div>
        </nav>

        <BuilderShell
          region={region}
          pois={pois}
          center={center}
          mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || ""}
          apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
        />
      </main>
    </SitePageShell>
  );
}
