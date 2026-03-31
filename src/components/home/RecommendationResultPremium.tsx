"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";
import {
  DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES,
  type HomepageProductCardImages,
} from "@/lib/homepage-product-card-images.shared";
import { CardFilmGrain } from "@/src/components/home/product-card-glass";

const CUSTOM_JOIN_HREF = "/custom-join-tour";
const ALT_HREF = "/tours/list";

const FIT_CHIP_KEYS = ["fitChip1", "fitChip2", "fitChip3", "fitChip4", "fitChip5"] as const;

function isResolvedJoinImage(data: unknown): data is Pick<HomepageProductCardImages, "join"> {
  if (data == null || typeof data !== "object") return false;
  const j = (data as { join?: unknown }).join;
  return typeof j === "string" && j.length > 0;
}

function isResolvedImages(v: unknown): v is HomepageProductCardImages {
  if (v == null || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return typeof o.join === "string" && typeof o.private === "string" && typeof o.bus === "string";
}

/**
 * Single homepage route recommendation: one best match + one subtle text alternative (no lists or carousels).
 */
export default function RecommendationResultPremium() {
  const t = useTranslations("home");
  const [bgSrc, setBgSrc] = useState<string>(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/homepage-product-card-images")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        if (isResolvedImages(data)) {
          setBgSrc(data.join);
          return;
        }
        if (isResolvedJoinImage(data)) {
          setBgSrc(data.join);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="relative w-full px-3 py-9 sm:px-4 sm:py-11 md:py-[4.25rem]"
      aria-labelledby="recommendation-result-heading"
    >
      <div className="mx-auto max-w-4xl">
        <p className="home-type-eyebrow text-center">{t("premium.recommendation.eyebrow")}</p>
        <h2 id="recommendation-result-heading" className="sr-only">
          {t("premium.recommendation.sectionTitle")}
        </h2>

        <article
          className="group relative isolate mt-6 flex min-h-[24rem] flex-col overflow-hidden rounded-[1.75rem] border border-white/35 bg-white/5 shadow-[0_26px_60px_-16px_rgba(15,23,42,0.38),0_12px_34px_-12px_rgba(59,130,246,0.14),inset_0_1px_0_0_rgba(255,255,255,0.24)] ring-1 ring-sky-400/35 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-1 hover:border-white/45 hover:shadow-[0_34px_76px_-14px_rgba(15,23,42,0.42),0_18px_46px_-12px_rgba(59,130,246,0.18),inset_0_1px_0_0_rgba(255,255,255,0.3)] sm:mt-7 sm:min-h-[26rem] md:min-h-[28rem]"
          aria-label={t("premium.recommendation.cardAria")}
        >
          <Image
            src={bgSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 896px"
            className="z-0 object-cover object-center transition duration-500 ease-out group-hover:scale-[1.02]"
            priority={false}
          />
          <div
            className="pointer-events-none absolute inset-0 z-[2] rounded-[1.75rem] bg-gradient-to-b from-slate-900/35 via-slate-900/20 to-slate-950/88 backdrop-blur-[16px] backdrop-saturate-150"
            aria-hidden
          />
          <CardFilmGrain id="recommendation-result-grain" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-px rounded-t-[1.75rem] bg-gradient-to-r from-transparent via-white/45 to-transparent opacity-90"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-px rounded-b-[1.75rem] bg-gradient-to-r from-transparent via-white/18 to-transparent opacity-70"
            aria-hidden
          />

          <div className="relative z-10 flex h-full min-h-[24rem] flex-1 flex-col justify-end p-5 text-white sm:min-h-[26rem] sm:p-6 md:min-h-[28rem] md:p-7">
            <span className="home-pill-badge-on-image home-pill-badge-on-image--cool">
              {t("premium.recommendation.bestMatchLabel")}
            </span>

            <h3 className="mt-3 text-[1.75rem] font-black leading-[1.05] tracking-tight text-white sm:text-[2rem] md:text-[2.1rem]">
              {t("premium.recommendation.routeName")}
            </h3>

            <p className="mt-2 max-w-[26rem] text-[13px] font-semibold leading-snug text-slate-100 sm:text-sm">
              {t("premium.recommendation.routeReason")}
            </p>

            <ul
              className="mt-4 flex flex-wrap gap-2 sm:mt-5 sm:gap-2.5"
              aria-label={t("premium.recommendation.fitChipsAria")}
            >
              {FIT_CHIP_KEYS.map((key) => (
                <li
                  key={key}
                  className="rounded-full border border-emerald-200/40 bg-emerald-950/30 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-50/95 shadow-[0_1px_0_rgba(255,255,255,0.06)_inset] backdrop-blur-sm sm:text-[10px] sm:tracking-[0.14em]"
                >
                  {t(`premium.recommendation.${key}`)}
                </li>
              ))}
            </ul>

            <p className="mt-5 text-xl font-black tabular-nums tracking-tight text-white drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)] sm:mt-6 sm:text-2xl">
              {t("premium.recommendation.price")}
            </p>

            <Link
              href={CUSTOM_JOIN_HREF}
              className="mt-5 inline-flex w-full min-h-[50px] items-center justify-center rounded-full border border-white/50 bg-white px-4 py-3.5 text-[13px] font-bold text-slate-900 shadow-[0_10px_32px_-8px_rgba(0,0,0,0.3)] ring-1 ring-black/[0.05] backdrop-blur-sm transition group-hover:bg-white group-hover:shadow-[0_14px_40px_-6px_rgba(0,0,0,0.34)] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/95 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-400/80 sm:min-h-[52px] sm:text-sm"
              onClick={() => analytics.heroFormStart("recommendation_best_match")}
            >
              {t("premium.recommendation.cta")}
            </Link>
          </div>
        </article>

        <div className="mx-auto mt-8 max-w-xl border-t border-slate-200/65 pt-6 text-center sm:mt-9 sm:pt-7">
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">{t("premium.recommendation.alsoConsiderLabel")}</p>
          <Link
            href={ALT_HREF}
            className="mt-2 inline-flex min-h-[44px] items-center justify-center text-[13px] font-semibold text-slate-700 underline-offset-4 transition hover:text-slate-900 hover:underline sm:text-sm"
          >
            {t("premium.recommendation.altLine")}
          </Link>
        </div>
      </div>
    </section>
  );
}
