"use client";

import { useRef } from "react";
import { motion } from "framer-motion";
import { DestinationCard } from "@/components/home/v2/ui/destination-card";
import { SnapScrollDots } from "@/components/home/v2/ui/SnapScrollDots";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";

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
    imageSrc: "/images/destinations/seoul-card.webp",
    nameKey: "premium.v2.destinations.seoul.name",
    altKey: "premium.v2.destinations.seoul.alt",
    taglineKey: "premium.v2.destinations.seoul.tagline",
  },
  {
    id: "Busan",
    imageSrc: "/images/destinations/busan-card.webp",
    nameKey: "premium.v2.destinations.busan.name",
    altKey: "premium.v2.destinations.busan.alt",
    taglineKey: "premium.v2.destinations.busan.tagline",
  },
  {
    id: "Jeju",
    imageSrc: "/images/destinations/jeju-card.webp",
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
  const scrollRef = useRef<HTMLDivElement>(null);
  const reveal = useRevealContainerProps();

  return (
    // 2026-07-14 owner: compact pass — section-py-md → sm pairs with the
    // smaller 4:3 destination cards.
    <section className="relative overflow-hidden px-4 md:px-6 section-py-sm bg-white">
      <motion.div {...reveal} className="relative mx-auto max-w-6xl">
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="mb-8 text-center md:mb-11">
          <p className="mb-3 text-eyebrow md:mb-4">
            {t("premium.v2.destinations.eyebrow")}
          </p>
          <h2 className="mx-auto mb-3 max-w-2xl text-balance text-h2 text-slate-900 md:mb-4">
            {t("premium.v2.destinations.title")}{" "}
            <span className="font-extrabold text-amber-700">
              {t("premium.v2.destinations.titleAccent")}
            </span>
          </h2>
          <p className="mx-auto max-w-md text-body text-slate-600 md:max-w-lg">
            {t("premium.v2.destinations.subtitle")}
          </p>
        </motion.div>

        {/* Mobile keeps the snap rail inset so cards feel intentional, not cut off. */}
        <div className="relative -mx-4 overflow-hidden md:mx-auto md:max-w-4xl md:overflow-visible">
          <div ref={scrollRef} className="flex snap-x snap-mandatory scroll-px-6 gap-4 overflow-x-auto pb-3 pl-6 pr-10 scrollbar-hide md:grid md:auto-rows-fr md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
            {DESTINATIONS.map((dest) => (
              <motion.div
                key={dest.id}
                variants={REVEAL_ITEM_VARIANTS}
                className="w-[46vw] flex-shrink-0 snap-start md:w-auto"
              >
                <DestinationCard
                  name={t(dest.nameKey)}
                  imageSrc={dest.imageSrc}
                  imageAlt={t(dest.altKey)}
                  badge={t(dest.taglineKey)}
                  href={`/tours/list?destination=${encodeURIComponent(dest.id)}`}
                  onClick={() => analytics.homeDestinationCardClick({ destination: dest.id })}
                />
              </motion.div>
            ))}
          </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-white/95 via-white/55 to-transparent md:hidden"
          />
        </div>
        <SnapScrollDots containerRef={scrollRef} count={DESTINATIONS.length} />
      </motion.div>
    </section>
  );
}
