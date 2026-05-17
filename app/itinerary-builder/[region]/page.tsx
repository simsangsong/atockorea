import { notFound } from "next/navigation";
import type { Metadata } from "next";
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
import BuilderShell from "@/components/itinerary-builder/BuilderShell";

// Force runtime fetch — match_pois is small and refreshed rarely; serve from
// CDN-edge with 5-minute ISR for performance.
export const revalidate = 300;

const REGION_HEADLINES: Record<RegionSlug, { eyebrow: string; title: string; subtitle: string }> = {
  busan: {
    eyebrow: "Busan + day-trip cluster",
    title: "Busan Map",
    subtitle: "20 curated stops across Busan, Yangsan, Gyeongju, Ulsan, and Miryang.",
  },
  jeju: {
    eyebrow: "Jeju Island",
    title: "Jeju Map",
    subtitle: "25 curated stops across the whole UNESCO Triple Crown island.",
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
      "poi_key, name_en, name_ko, names_other_locales, region, category, default_image_url, default_stay_minutes, lat, lng, poi_meta, description, highlights, images, why_on_route, smart_notes, visit_basics, convenience"
    )
    .in("region", cluster as unknown as string[])
    .not("name_en", "is", null)
    .not("lat", "is", null);

  if (error) {
    throw new Error(`Failed to load POIs for ${region}: ${error.message}`);
  }
  const pois = (data ?? []) as MatchPoiRow[];

  return (
    <SitePageShell>
      <main className="min-h-screen bg-slate-50">
        <header className="px-4 pt-8 pb-4 md:px-6 md:pt-12">
          <div className="mx-auto max-w-7xl">
            <p className="mb-1 text-eyebrow">{headline.eyebrow}</p>
            <h1 className="text-display text-slate-900">{headline.title}</h1>
            <p className="mt-2 max-w-2xl text-body text-slate-600">{headline.subtitle}</p>
          </div>
        </header>

        <section className="px-0 pb-12 md:px-6">
          <div className="mx-auto max-w-7xl overflow-hidden border-y border-slate-200 bg-white md:rounded-2xl md:border md:shadow-md md:ring-1 md:ring-slate-200">
            <BuilderShell
              region={region}
              pois={pois}
              center={center}
              mapId={process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || ""}
              apiKey={process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || ""}
            />
          </div>
          <p className="mt-3 px-4 text-center text-micro text-slate-500 md:px-0">
            {pois.length} curated points of interest in this region.
          </p>
        </section>
      </main>
    </SitePageShell>
  );
}
