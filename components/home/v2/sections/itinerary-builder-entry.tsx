"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
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

        {/* Mobile snap rail + desktop 2-up grid */}
        <div
          className="-mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 md:mx-0 md:grid md:grid-cols-2 md:gap-6 md:overflow-visible md:px-0 md:pb-0"
          aria-label="Itinerary builder regions"
        >
          {CARDS.map((card) => {
            const name = t(card.nameKey);
            return (
              <Link
                key={card.slug}
                href={`/itinerary-builder/${card.slug}`}
                className="group relative w-[88%] flex-shrink-0 snap-center overflow-hidden rounded-2xl bg-white shadow-md ring-1 ring-slate-200 transition-all duration-200 hover:-translate-y-1 hover:shadow-xl md:w-auto md:flex-shrink"
              >
                <div className="relative aspect-[16/10] overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={card.imageSrc}
                    alt={name}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-slate-900/10 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-5">
                    <div className="mb-1 inline-flex items-center gap-1 rounded-full bg-amber-400/95 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-slate-900">
                      <MapPin className="h-3 w-3" aria-hidden />
                      {t(card.stopsKey)}
                    </div>
                    <h3 className="text-2xl font-bold leading-tight text-white drop-shadow-md md:text-3xl">
                      {name}
                    </h3>
                    <p className="mt-1 text-sm text-white/90 drop-shadow">{t(card.taglineKey)}</p>
                  </div>
                </div>
                <div className="flex items-center justify-between p-5">
                  <span className="text-sm font-semibold text-slate-700">{t("browseTheMap")}</span>
                  <span className="inline-flex items-center gap-1.5 text-sm font-bold text-amber-700 transition-all group-hover:gap-2.5 group-hover:text-amber-800">
                    {t("open")}
                    <ArrowRight className="h-4 w-4" aria-hidden />
                  </span>
                </div>
              </Link>
            );
          })}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500 md:mt-8">{t("comingSoonNote")}</p>
      </div>
    </section>
  );
}
