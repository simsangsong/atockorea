"use client";

// v3 §D #1 — 3-card "비슷한 투어" rail under the matcher winner card.
//
// Quiet by design: no animation, no auto-cycle. Just static recommendations
// to absorb users who like the winner but want options.

import Image from "next/image";
import Link from "next/link";
import {
  hrefStaticTourProductDetail,
  type StaticTourProductRegistration,
} from "@/components/product-tour-static/catalog/staticTourProductRegistry";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";

export function SimilarToursStrip({
  winnerSlug,
  tours,
}: {
  winnerSlug: string;
  tours: readonly StaticTourProductRegistration[];
}) {
  const t = useTranslations("home");
  if (!tours.length) return null;

  return (
    <section
      aria-label={t("premium.v2.similarTours.heading")}
      className="mt-4 md:mt-5"
    >
      <p className="mb-2 text-eyebrow md:mb-3">
        {t("premium.v2.similarTours.heading")}
      </p>
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        {tours.map((tour) => (
          <Link
            key={tour.slug}
            href={hrefStaticTourProductDetail(tour.slug)}
            onClick={() =>
              analytics.homeFeaturedCardClick({
                source: "similar_recommendation",
                slug: tour.slug,
              })
            }
            data-similar-winner={winnerSlug}
            className="focus-ring group block overflow-hidden rounded-card shadow-1 transition-shadow hover:shadow-2"
          >
            <div className="relative aspect-[4/3] w-full overflow-hidden">
              <Image
                src={tour.thumbnail || tour.heroImage}
                alt={tour.title}
                fill
                sizes="(max-width: 768px) 30vw, 14rem"
                loading="lazy"
                className="object-cover transition-transform duration-300 ease-out group-hover:scale-105 motion-reduce:transition-none motion-reduce:group-hover:scale-100"
              />
              <div
                aria-hidden
                className="absolute inset-0 bg-gradient-to-t from-slate-950/75 via-slate-950/15 to-transparent"
              />
              <span className="absolute left-2 top-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-white/85">
                {tour.region}
              </span>
            </div>
            <div className="p-2 md:p-2.5">
              <p className="line-clamp-2 text-[12px] font-medium leading-tight text-slate-800 md:text-[13px]">
                {tour.title}
              </p>
              <p className="mt-1 text-[10.5px] text-slate-500 md:text-[11px]">
                {tour.duration} · {tour.priceLabel}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
