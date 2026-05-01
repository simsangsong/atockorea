"use client";

import { useEffect, useRef, useState } from "react";
import { DestinationCard } from "@/components/home/v2/ui/destination-card";
import { useTranslations } from "@/lib/i18n";

type DestinationDef = {
  id: "Seoul" | "Busan" | "Jeju";
  imageSrc: string;
  nameKey: string;
  altKey: string;
};

const DESTINATIONS: ReadonlyArray<DestinationDef> = [
  {
    id: "Seoul",
    imageSrc: "/images/destinations/seoul-card.jpg",
    nameKey: "premium.v2.destinations.seoul.name",
    altKey: "premium.v2.destinations.seoul.alt",
  },
  {
    id: "Busan",
    imageSrc: "/images/destinations/busan-card.jpg",
    nameKey: "premium.v2.destinations.busan.name",
    altKey: "premium.v2.destinations.busan.alt",
  },
  {
    id: "Jeju",
    imageSrc: "/images/destinations/jeju-card.jpg",
    nameKey: "premium.v2.destinations.jeju.name",
    altKey: "premium.v2.destinations.jeju.alt",
  },
];

type DestinationsApiResponse = {
  destinations: Array<{ city: string; count: number }>;
  total: number;
};

/**
 * 3-up portrait destination cards (Seoul / Busan / Jeju). Static curated copy
 * + live counts from `/api/tours/destinations`. Fails silently to no-count
 * mode when the fetch errors. Mobile = horizontal snap rail; desktop = grid.
 */
export function DestinationsShowcase() {
  const t = useTranslations("home");
  const containerRef = useRef<HTMLDivElement>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.classList.add("visible");
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/tours/destinations", { signal: controller.signal })
      .then((r) => (r.ok ? (r.json() as Promise<DestinationsApiResponse>) : null))
      .then((data) => {
        if (!data?.destinations) return;
        const map: Record<string, number> = {};
        for (const { city, count } of data.destinations) {
          map[city] = count;
        }
        setCounts(map);
      })
      .catch(() => {});
    return () => controller.abort();
  }, []);

  return (
    <section className="px-4 py-10 md:px-6 md:py-14">
      <div ref={containerRef} className="mx-auto max-w-5xl scroll-animate">
        <div className="mb-7 text-center md:mb-9">
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/95 px-3 py-1.5 shadow-home-neutral-card backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
            <span className="text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-600">
              {t("premium.v2.destinations.eyebrow")}
            </span>
          </div>
          <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900 md:text-2xl lg:text-3xl">
            {t("premium.v2.destinations.title")}{" "}
            <span className="font-extrabold text-amber-700">
              {t("premium.v2.destinations.titleAccent")}
            </span>
          </h2>
          <p className="mx-auto max-w-lg text-[13px] font-medium leading-relaxed text-slate-600 md:text-[14px]">
            {t("premium.v2.destinations.subtitle")}
          </p>
        </div>

        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 md:mx-auto md:max-w-lg md:grid md:grid-cols-3 md:gap-3 md:overflow-visible md:px-0 md:pb-0">
          {DESTINATIONS.map((dest) => {
            const count = counts[dest.id] ?? null;
            return (
              <div
                key={dest.id}
                className="w-[39vw] flex-shrink-0 snap-start md:w-auto"
              >
                <DestinationCard
                  name={t(dest.nameKey)}
                  imageSrc={dest.imageSrc}
                  imageAlt={t(dest.altKey)}
                  count={count}
                  countLabel={
                    count != null
                      ? t("premium.v2.destinations.countLabelParam", { count })
                      : undefined
                  }
                  href={`/tours/list?destination=${encodeURIComponent(dest.id)}`}
                />
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
