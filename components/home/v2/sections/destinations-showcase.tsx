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
  const scrollRef = useRef<HTMLDivElement>(null);
  const reveal = useRevealContainerProps();

  return (
    <section className="relative overflow-hidden px-4 md:px-6 section-py-md bg-white">
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

        {/* Mobile snap-scroll wrapped in `relative` so the right-edge fade can
            absolutely position. The fade signals "more content →" since the
            scrollbar is hidden. Hidden on md+ where the grid layout shows
            everything at once. */}
        <div className="relative -mx-4 md:mx-auto md:max-w-4xl">
          <div ref={scrollRef} className="flex snap-x snap-mandatory gap-3.5 overflow-x-auto px-4 pb-3 scrollbar-hide md:grid md:auto-rows-fr md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
            {DESTINATIONS.map((dest) => (
              <motion.div
                key={dest.id}
                variants={REVEAL_ITEM_VARIANTS}
                className="w-[60vw] flex-shrink-0 snap-start md:w-auto"
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
            className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-white via-white/90 to-transparent md:hidden"
          />
        </div>
        <SnapScrollDots containerRef={scrollRef} count={DESTINATIONS.length} />
      </motion.div>
    </section>
  );
}
