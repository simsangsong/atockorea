"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";
import {
  DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES,
  type HomepageProductCardImages,
} from "@/lib/homepage-product-card-images.shared";
import { CardFilmGrain, ProductCardCheckIcon } from "@/src/components/home/product-card-glass";
import { HOME_STYLE_OPTIONS } from "@/src/components/home/home-style-options";

const CUSTOM_JOIN_HREF = "/custom-join-tour";
/** Live East Jeju small-group product (join tour detail). */
const EAST_JEJU_SMALL_GROUP_TOUR_HREF = "/tour/east-signature-nature-core";

type HeroDestination = "jeju" | "seoul" | "busan";

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
 * Above-the-fold Korea day-tour matching: destination first, Jeju preferences, then best-match preview.
 * Secondary formats stay on the preview card (no duplicate recommendation block below).
 */
export default function HeroPremium() {
  const t = useTranslations("home");
  const [destination, setDestination] = useState<HeroDestination>("jeju");
  const [intent, setIntent] = useState("");
  const [matchBgSrc, setMatchBgSrc] = useState<string>(DEFAULT_HOMEPAGE_PRODUCT_CARD_IMAGES.join);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/homepage-product-card-images")
      .then((r) => (r.ok ? r.json() : null))
      .then((data: unknown) => {
        if (cancelled) return;
        if (isResolvedImages(data)) {
          setMatchBgSrc(data.join);
          return;
        }
        if (isResolvedJoinImage(data)) {
          setMatchBgSrc(data.join);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const appendChip = useCallback((phrase: string) => {
    setIntent((prev) => {
      const p = prev.trim();
      if (!p) return phrase;
      if (p.includes(phrase)) return p;
      return `${p}, ${phrase}`;
    });
  }, []);

  const continueHref = useMemo(() => {
    const params = new URLSearchParams();
    if (destination === "jeju") params.set("destination", "jeju");
    const q = intent.trim();
    if (q) params.set("intent", q);
    const s = params.toString();
    return s ? `${CUSTOM_JOIN_HREF}?${s}` : CUSTOM_JOIN_HREF;
  }, [intent, destination]);

  const bestMatchLines = useMemo(
    () => [t("premium.hero.bestMatchLine1"), t("premium.hero.bestMatchLine2")],
    [t]
  );

  return (
    <section className="home-hero-stack relative w-full bg-transparent" aria-label="Hero">
      <div className="mx-auto max-w-4xl space-y-5 sm:space-y-6">
        <header className="mx-auto flex max-w-2xl flex-col items-center px-1 text-center sm:px-2">
          <p className="home-hero-kicker">{t("premium.hero.glassBrandPill")}</p>
          {t("premium.hero.matchEyebrow").trim() ? (
            <p className="home-hero-match-eyebrow">{t("premium.hero.matchEyebrow")}</p>
          ) : null}
          <h1 className="home-type-display mt-2 text-balance text-[1.7rem] leading-[1.05] sm:text-[1.95rem] md:text-[2.1rem]">
            <span className="block">{t("premium.hero.headlineLine1")}</span>
            {t("premium.hero.headlineLine2").trim() ? (
              <span className="mt-0.5 block">{t("premium.hero.headlineLine2")}</span>
            ) : null}
          </h1>
          <p className="home-type-body mx-auto mt-2.5 max-w-[26rem] whitespace-pre-line text-center leading-snug sm:mt-3 sm:leading-relaxed">
            {t("premium.hero.matchSubtitle")}
          </p>
        </header>

        {/* Intent panel — destination segment + travel-style input (logic unchanged) */}
        <div className="hero-planner-surface p-4 sm:p-5 md:p-6" data-hero-intent-panel>
          <div className="hero-planner-flow-step">
            <p className="hero-planner-section-title hero-planner-section-title--compact">
              {t("premium.hero.destinationSectionTitle")}
            </p>
            <div
              className="hero-destination-segmented mt-2"
              role="group"
              aria-label={t("premium.hero.destinationSectionTitle")}
            >
              <button
                type="button"
                aria-pressed={destination === "jeju"}
                onClick={() => setDestination("jeju")}
                className={
                  destination === "jeju"
                    ? "hero-destination-segment hero-destination-segment--active"
                    : "hero-destination-segment"
                }
              >
                <span className="hero-destination-segment__name">{t("premium.hero.destJeju")}</span>
                <span className="hero-destination-segment__badge hero-destination-segment__badge--live">
                  {t("premium.hero.destSegmentLabelAvailable")}
                </span>
              </button>
              <button
                type="button"
                disabled
                tabIndex={-1}
                aria-disabled="true"
                aria-label={`${t("premium.hero.destSeoul")}, ${t("premium.hero.destStatusComingSoon")}`}
                className="hero-destination-segment hero-destination-segment--disabled"
              >
                <span className="hero-destination-segment__name">{t("premium.hero.destSeoul")}</span>
                <span className="hero-destination-segment__badge hero-destination-segment__badge--stacked">
                  <span className="hero-destination-segment__badge-line">
                    {t("premium.hero.destComingSoonLine1")}
                  </span>
                  <span className="hero-destination-segment__badge-line">
                    {t("premium.hero.destComingSoonLine2")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                disabled
                tabIndex={-1}
                aria-disabled="true"
                aria-label={`${t("premium.hero.destBusan")}, ${t("premium.hero.destStatusComingSoon")}`}
                className="hero-destination-segment hero-destination-segment--disabled"
              >
                <span className="hero-destination-segment__name">{t("premium.hero.destBusan")}</span>
                <span className="hero-destination-segment__badge hero-destination-segment__badge--stacked">
                  <span className="hero-destination-segment__badge-line">
                    {t("premium.hero.destComingSoonLine1")}
                  </span>
                  <span className="hero-destination-segment__badge-line">
                    {t("premium.hero.destComingSoonLine2")}
                  </span>
                </span>
              </button>
            </div>
          </div>

          {destination === "jeju" ? (
            <div className="hero-planner-flow-step hero-planner-flow-step--preferences mt-5 border-t border-slate-200/65 pt-5 sm:mt-6 sm:pt-6">
              <label htmlFor="hero-intent-input" className="hero-planner-field-label">
                {t("premium.hero.textareaLabelJeju")}
              </label>
              <div className="hero-planner-desk-well mt-2">
                <textarea
                  id="hero-intent-input"
                  name="intent"
                  value={intent}
                  onChange={(e) => setIntent(e.target.value)}
                  rows={3}
                  placeholder={t("premium.hero.inputPlaceholder")}
                  className="hero-planner-field hero-planner-field--hero-primary"
                  autoComplete="off"
                />
              </div>

              <p className="hero-planner-chips-label hero-planner-chips-label--compact mt-4 text-center sm:mt-4 sm:text-left">
                {t("premium.hero.chipsLegend")}
              </p>
              <div
                className="hero-planner-chip-row--hero mt-2 flex flex-wrap justify-center gap-1 sm:justify-start sm:gap-1.5"
                role="group"
                aria-label={t("premium.comparison.chipsAria")}
              >
                {HOME_STYLE_OPTIONS.map(({ id, labelKey }) => {
                  const label = t(`premium.comparison.${labelKey}`);
                  const isActive = intent.includes(label);
                  return (
                    <button
                      key={id}
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => appendChip(label)}
                      className={
                        isActive
                          ? "hero-planner-chip hero-planner-chip--pill hero-planner-chip--active"
                          : "hero-planner-chip hero-planner-chip--pill"
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : null}

          <div
            className="hero-planner-trust-strip mt-5 px-3.5 py-3 sm:mt-6 sm:px-5 sm:py-3.5"
            aria-label={t("premium.hero.pricingRowLabel")}
          >
            <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-2 text-[11px] text-slate-800 sm:justify-between sm:gap-x-2.5 sm:text-[12px]">
              <span className="home-type-price-anchor whitespace-nowrap text-slate-900">{t("premium.hero.priceSmallGroup")}</span>
              <span
                className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300/90 sm:inline"
                aria-hidden
              />
              <span className="home-type-price-anchor whitespace-nowrap text-slate-900">{t("premium.hero.pricePrivate")}</span>
              <span
                className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300/90 sm:inline"
                aria-hidden
              />
              <span className="home-type-price-anchor whitespace-nowrap text-slate-900">{t("premium.hero.priceBus")}</span>
              <span
                className="hidden h-1 w-1 shrink-0 rounded-full bg-slate-300/90 sm:inline"
                aria-hidden
              />
              <span className="home-type-price-anchor whitespace-nowrap text-slate-800">{t("premium.hero.minGuests")}</span>
            </div>
          </div>

          <Link
            href={continueHref}
            className="hero-planner-cta hero-planner-cta--hero-primary mt-5 text-center sm:mt-6"
            onClick={() => analytics.heroFormStart()}
          >
            {t("premium.hero.findMatchCta")}
          </Link>
        </div>

        {/* Single best-match preview card — same glass language as product cards */}
        <article
          className="group relative isolate flex min-h-[19rem] flex-col overflow-hidden rounded-home-card border border-white/48 bg-white/[0.06] shadow-home-hero-match ring-1 ring-sky-400/52 transition-[transform,box-shadow,border-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] will-change-transform hover:-translate-y-0.5 hover:border-white/58 hover:shadow-home-hero-match-hover sm:min-h-[21rem] md:min-h-[22rem]"
          aria-labelledby="hero-best-match-title"
        >
          <Image
            src={matchBgSrc}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 896px"
            className="z-0 object-cover object-center transition duration-500 ease-out group-hover:scale-[1.02]"
            priority
          />
          <div
            className="pointer-events-none absolute inset-0 z-[2] rounded-home-card bg-gradient-to-b from-slate-900/40 via-slate-900/14 to-slate-950/[0.86] backdrop-blur-[10px] backdrop-saturate-[1.22]"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[3] h-[76%] rounded-b-home-card bg-gradient-to-t from-black/62 via-black/28 to-transparent"
            aria-hidden
          />
          <CardFilmGrain id="hero-best-match-grain" className="rounded-home-card opacity-[0.28]" />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-[5] h-px rounded-t-home-card bg-gradient-to-r from-transparent via-white/55 to-transparent opacity-95"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[5] h-px rounded-b-home-card bg-gradient-to-r from-transparent via-white/26 to-transparent opacity-78"
            aria-hidden
          />

          <Link
            href={EAST_JEJU_SMALL_GROUP_TOUR_HREF}
            className="absolute inset-0 z-[11] rounded-home-card outline-none ring-inset focus-visible:ring-2 focus-visible:ring-white/80"
            aria-label={`${t("premium.hero.bestMatchTitleLine1")} ${t("premium.hero.bestMatchTitleLine2")} — ${t("premium.hero.bestMatchCta")}`}
            onClick={() => analytics.heroFormStart()}
          />

          <div className="relative z-[12] flex h-full min-h-[19rem] flex-1 flex-col justify-end p-5 text-white pointer-events-none sm:min-h-[21rem] sm:p-6 md:min-h-[22rem] md:p-7">
            <span className="home-pill-badge-on-image home-pill-badge-on-image--cool">
              {t("premium.hero.bestMatchBadge")}
            </span>
            <h2
              id="hero-best-match-title"
              className="mt-3 text-[1.74rem] font-black leading-[1.02] tracking-[-0.038em] text-white drop-shadow-[0_3px_28px_rgba(0,0,0,0.48)] sm:text-[1.95rem]"
            >
              <span className="block">{t("premium.hero.bestMatchTitleLine1")}</span>
              <span className="block">{t("premium.hero.bestMatchTitleLine2")}</span>
            </h2>
            <ul className="mt-4 space-y-2.5 text-[12px] font-semibold leading-[1.55] tracking-[-0.012em] text-white drop-shadow-[0_1px_10px_rgba(0,0,0,0.35)] sm:text-[13px] sm:leading-[1.58]">
              {bestMatchLines.map((line) => (
                <li key={line} className="flex items-start gap-2">
                  <ProductCardCheckIcon />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
            <span className="offer-card-cta offer-card-cta--hero-match mt-4 inline-flex cursor-pointer sm:mt-5">
              {t("premium.hero.bestMatchCta")}
            </span>

            <p className="pointer-events-auto mt-4 border-t border-white/20 pt-3.5 text-center text-[10px] font-semibold leading-[1.5] tracking-[-0.01em] text-white/80 sm:text-[11px] sm:leading-[1.55]">
              <span className="mr-1.5 font-extrabold uppercase tracking-[0.2em] text-white/50 sm:tracking-[0.22em]">
                {t("premium.hero.alsoConsiderLabel")}
              </span>
              <Link
                href={CUSTOM_JOIN_HREF}
                className="inline-flex min-h-[40px] items-center text-white underline-offset-2 hover:text-white hover:underline sm:min-h-0"
              >
                {t("premium.hero.alsoConsiderPrivate")}
              </Link>
              <span className="mx-1.5 text-white/35 sm:mx-2" aria-hidden>
                ·
              </span>
              <Link
                href="/tours/list"
                className="inline-flex min-h-[40px] items-center text-white underline-offset-2 hover:text-white hover:underline sm:min-h-0"
              >
                {t("premium.hero.alsoConsiderBus")}
              </Link>
            </p>
          </div>
        </article>
      </div>
    </section>
  );
}
