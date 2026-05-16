import Link from "next/link";
import type { Metadata } from "next";
import { SitePageShell } from "@/src/components/layout/SitePageShell";
import { REGION_SLUGS } from "@/lib/itinerary-builder/regions";

export const metadata: Metadata = {
  title: "Build Your Custom Korea Itinerary | AtoC Korea",
  description:
    "Pick a region, browse curated points of interest, and design your own day in Korea. Map-driven private-tour builder for Busan and Jeju.",
};

// Static region copy. Will be moved to messages/en.json + auto-translated
// in Phase 3 step 3.6 (i18n pipeline).
const REGION_COPY: Record<(typeof REGION_SLUGS)[number], {
  title: string;
  subtitle: string;
  bullets: string[];
  imageSrc: string;
}> = {
  busan: {
    title: "Busan",
    subtitle: "Korea's port city — UNESCO temples, coastal views, fresh markets",
    bullets: [
      "20 curated stops across Busan + Yangsan + Gyeongju",
      "Sea temples, ancient capitals, color-block villages",
      "Day-trippable from one base",
    ],
    imageSrc: "/images/destinations/busan-card.jpg",
  },
  jeju: {
    title: "Jeju Island",
    subtitle: "Volcanic UNESCO island — sunrise peaks, hidden caves, tangerine groves",
    bullets: [
      "25 curated stops across the whole island",
      "UNESCO Triple Crown (Biosphere + Heritage + Geopark)",
      "Coastal drives, lava caves, hydrangea coasts",
    ],
    imageSrc: "/images/destinations/jeju-card.jpg",
  },
};

export default function ItineraryBuilderLanding() {
  return (
    <SitePageShell>
      <main className="min-h-screen bg-slate-50">
        <section className="px-4 pb-16 pt-12 md:px-6 md:pb-24 md:pt-16">
          <div className="mx-auto max-w-5xl">
            <header className="mb-10 text-center md:mb-14">
              <p className="mb-3 text-xs font-bold uppercase tracking-[0.15em] text-amber-700">
                Custom itinerary builder
              </p>
              <h1 className="mb-4 text-3xl font-bold tracking-tight text-slate-900 md:text-5xl">
                Build Your Own Korea Day
              </h1>
              <p className="mx-auto max-w-2xl text-base text-slate-600 md:text-lg">
                Pick a region, browse curated points of interest on the map, then sequence your own
                itinerary. We'll quote it for you.
              </p>
            </header>

            <div className="grid gap-6 md:grid-cols-2">
              {REGION_SLUGS.map((slug) => {
                const copy = REGION_COPY[slug];
                return (
                  <Link
                    key={slug}
                    href={`/itinerary-builder/${slug}`}
                    className="group relative overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
                  >
                    <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={copy.imageSrc}
                        alt={copy.title}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent" />
                      <div className="absolute bottom-0 left-0 right-0 p-5">
                        <h2 className="text-2xl font-bold text-white drop-shadow-md md:text-3xl">
                          {copy.title}
                        </h2>
                        <p className="mt-1 text-sm text-white/90 drop-shadow">{copy.subtitle}</p>
                      </div>
                    </div>
                    <div className="p-5">
                      <ul className="space-y-2">
                        {copy.bullets.map((b) => (
                          <li key={b} className="flex items-start gap-2 text-sm text-slate-700">
                            <span aria-hidden className="mt-1 text-amber-600">
                              •
                            </span>
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                      <div className="mt-5 flex items-center justify-between text-sm font-semibold text-slate-900 group-hover:text-amber-700">
                        <span>Open the map →</span>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            <p className="mt-10 text-center text-xs text-slate-500">
              Seoul and DMZ rollout planned after MVP launch.
            </p>
          </div>
        </section>
      </main>
    </SitePageShell>
  );
}
