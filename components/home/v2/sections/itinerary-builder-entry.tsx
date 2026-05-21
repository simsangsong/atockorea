"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, MapPin } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

/**
 * Home v2 entry into the custom itinerary builder.
 *
 * Per D7 (planner 2026-05-17): this is the canonical home-page entry point
 * for the map-based custom-itinerary feature. The two region cards mirror
 * the cards on `/itinerary-builder` so the visual handoff is consistent.
 *
 * Per memory feedback_home_visual_energy.md: amber eyebrow default, premium
 * feel (not muted). Mobile: horizontal snap rail. Desktop: 2-up grid.
 *
 * i18n: strings live under `itineraryBuilder.home.*` in messages/<locale>.json
 * (authored EN-first via D6 pipeline, auto-translated to ko/ja/zh/zh-TW/es
 * by `scripts/translate-itinerary-builder-messages.mjs`).
 */

const CARDS = [
  {
    slug: "busan" as const,
    nameKey: "busanName",
    taglineKey: "busanTagline",
    stopsKey: "busanStops",
    imageSrc: "/images/destinations/busan-card.jpg",
  },
  {
    slug: "jeju" as const,
    nameKey: "jejuName",
    taglineKey: "jejuTagline",
    stopsKey: "jejuStops",
    imageSrc: "/images/destinations/jeju-card.jpg",
  },
  {
    slug: "seoul" as const,
    nameKey: "seoulName",
    taglineKey: "seoulTagline",
    stopsKey: "seoulStops",
    imageSrc: "/images/destinations/seoul-card.jpg",
  },
];

export function ItineraryBuilderEntry() {
  const t = useTranslations("itineraryBuilder.home");
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blockRef.current) {
      blockRef.current.classList.add("visible");
    }
  }, []);

  return (
    <section className="section-py-md relative overflow-hidden bg-slate-50 px-4 md:px-6">
      <div ref={blockRef} className="relative mx-auto max-w-6xl scroll-animate">
        <header className="mb-8 text-center md:mb-11">
          <p className="mb-3 text-eyebrow text-amber-700 md:mb-4">{t("eyebrow")}</p>
          <h2 className="mb-3 text-balance text-display text-slate-900">{t("title")}</h2>
          <p className="mx-auto max-w-2xl text-h3 font-medium text-slate-600">{t("subtitle")}</p>
        </header>

        {/* Mobile snap rail + desktop 3-up grid */}
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
          aria-label="Itinerary builder regions"
        >
          {CARDS.map((card) => {
            const name = t(card.nameKey);
            return (
              <Link
                key={card.slug}
                href={`/itinerary-builder?region=${card.slug}`}
                className="group relative w-[68vw] flex-shrink-0 snap-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl md:w-auto md:flex-shrink"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                  <Image
                    src={card.imageSrc}
                    alt={name}
                    fill
                    sizes="(max-width: 768px) 68vw, 380px"
                    className="object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="px-5 pt-4 pb-5">
                  <div className="mb-2 inline-flex items-center gap-1 text-eyebrow text-amber-700">
                    <MapPin className="h-3 w-3" aria-hidden />
                    {t(card.stopsKey)}
                  </div>
                  <h3 className="text-xl font-bold leading-tight text-slate-900 md:text-2xl">
                    {name}
                  </h3>
                  <p className="mt-1.5 text-sm text-slate-600">{t(card.taglineKey)}</p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
                    <span className="text-sm font-medium text-slate-500">{t("browseTheMap")}</span>
                    <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 transition-all group-hover:gap-2.5 group-hover:text-amber-800">
                      {t("open")}
                      <ArrowRight className="h-4 w-4" aria-hidden />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>

      </div>
    </section>
  );
}
