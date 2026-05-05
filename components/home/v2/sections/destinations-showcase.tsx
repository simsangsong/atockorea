"use client";

import { useEffect, useRef } from "react";
import { DestinationCard } from "@/components/home/v2/ui/destination-card";
import { useTranslations } from "@/lib/i18n";

type DestinationDef = {
  id: "Seoul" | "Busan" | "Jeju";
  imageSrc: string;
  nameKey: string;
  altKey: string;
  taglineKey: string;
};

const DESTINATIONS: ReadonlyArray<DestinationDef> = [
  {
    id: "Seoul",
    imageSrc: "/images/destinations/seoul-card.jpg",
    nameKey: "premium.v2.destinations.seoul.name",
    altKey: "premium.v2.destinations.seoul.alt",
    taglineKey: "premium.v2.destinations.seoul.tagline",
  },
  {
    id: "Busan",
    imageSrc: "/images/destinations/busan-card.jpg",
    nameKey: "premium.v2.destinations.busan.name",
    altKey: "premium.v2.destinations.busan.alt",
    taglineKey: "premium.v2.destinations.busan.tagline",
  },
  {
    id: "Jeju",
    imageSrc: "/images/destinations/jeju-card.jpg",
    nameKey: "premium.v2.destinations.jeju.name",
    altKey: "premium.v2.destinations.jeju.alt",
    taglineKey: "premium.v2.destinations.jeju.tagline",
  },
];

/**
 * 3-up portrait destination cards (Seoul / Busan / Jeju) with regional
 * character badges. Mobile = horizontal snap rail; desktop = grid.
 */
export function DestinationsShowcase() {
  const t = useTranslations("home");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add("visible");
    }
  }, []);

  return (
    <section className="relative overflow-hidden px-4 py-12 md:px-6 md:py-16">
      {/* Soft premium wash — matches home warm neutrals */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_75%_55%_at_50%_-8%,rgba(245,158,11,0.09),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-slate-300/40 to-transparent"
        aria-hidden
      />
      <div ref={containerRef} className="relative mx-auto max-w-6xl scroll-animate">
        <div className="mb-8 text-center md:mb-11">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-stone-200/90 bg-gradient-to-b from-white to-stone-50/85 px-4 py-1.5 shadow-[0_1px_0_rgba(255,255,255,0.95)_inset,0_14px_42px_-26px_rgba(15,23,42,0.18)] backdrop-blur-sm">
            <span className="h-1 w-1 rounded-full bg-amber-500/90 shadow-[0_0_0_3px_rgba(245,158,11,0.2)]" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
              {t("premium.v2.destinations.eyebrow")}
            </span>
          </div>
          <h2 className="mx-auto mb-3 max-w-2xl text-balance text-[1.35rem] font-semibold leading-snug tracking-[-0.02em] text-slate-900 md:mb-4 md:text-[1.85rem] md:leading-[1.2] lg:text-[2.15rem]">
            {t("premium.v2.destinations.title")}{" "}
            <span className="bg-gradient-to-r from-amber-800 via-amber-700 to-orange-900/90 bg-clip-text font-semibold text-transparent">
              {t("premium.v2.destinations.titleAccent")}
            </span>
          </h2>
          <p className="mx-auto max-w-md text-[14px] leading-relaxed text-slate-500 md:max-w-lg md:text-[15px] md:leading-[1.65]">
            {t("premium.v2.destinations.subtitle")}
          </p>
        </div>

        <div className="-mx-4 flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-3 scrollbar-hide md:mx-auto md:grid md:max-w-4xl md:auto-rows-fr md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
          {DESTINATIONS.map((dest) => (
            <div
              key={dest.id}
              className="w-[39vw] flex-shrink-0 snap-start md:w-auto"
            >
              <DestinationCard
                name={t(dest.nameKey)}
                imageSrc={dest.imageSrc}
                imageAlt={t(dest.altKey)}
                badge={t(dest.taglineKey)}
                href={`/tours/list?destination=${encodeURIComponent(dest.id)}`}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
