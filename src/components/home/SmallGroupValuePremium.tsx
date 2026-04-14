"use client";

import { useTranslations } from "@/lib/i18n";

const BRAND_NAVY = "#0A1F44";

/**
 * Tier value (bus vs small group vs private)—not a second recommendation pitch.
 * Stacked bands in one frosted card — not a SaaS pricing table.
 */
export default function SmallGroupValuePremium() {
  const t = useTranslations("home");

  return (
    <section
      className="home-section-divide relative bg-transparent px-4 py-7 sm:px-6 sm:py-8 md:py-[2.35rem] lg:px-8 lg:py-[2.5rem]"
      aria-labelledby="small-group-value-heading"
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-6 text-center sm:mb-7 md:mb-8">
          <p className="home-type-eyebrow text-slate-500">
            {t("premium.smallGroupValue.eyebrow")}
          </p>
          <h2
            id="small-group-value-heading"
            className="home-type-display mt-2 text-[1.52rem] leading-[1.08] sm:mt-2.5 sm:text-[1.78rem] md:text-[1.95rem]"
            style={{ color: BRAND_NAVY }}
          >
            {t("premium.smallGroupValue.title")}
          </h2>
          <p className="home-type-body mx-auto mt-2 max-w-md text-[13px] leading-snug text-slate-600 sm:mt-2.5 sm:text-[14px] sm:leading-snug">
            {t("premium.smallGroupValue.subtitle")}
          </p>
        </header>

        <div className="home-panel-pricing-story home-panel-pricing-story--value-ladder p-4 sm:p-5 md:p-6">
          <div className="flex flex-col gap-2.5 sm:gap-3">
            {/* Bus — secondary, muted */}
            <div className="home-tier-row-muted px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-0.5">
                <span className="home-support-micro text-slate-500">
                  {t("premium.smallGroupValue.busLabel")}
                </span>
                <span className="home-type-price-anchor text-base text-slate-800 sm:text-lg">
                  {t("premium.smallGroupValue.busPrice")}
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] font-medium leading-snug text-slate-600 sm:text-[12px]">
                {t("premium.smallGroupValue.busLine")}
              </p>
            </div>

            {/* Small group — hero band */}
            <div className="home-tier-row-hero home-tier-row-hero--compact px-4 py-5 sm:px-5 sm:py-6 md:px-6 md:py-7">
              <div className="pointer-events-none absolute inset-x-3 top-0 z-0 h-px rounded-full bg-gradient-to-r from-transparent via-sky-300/65 to-transparent sm:inset-x-4" aria-hidden />
              <div className="relative flex flex-wrap items-start justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <span className="home-tier-hero-pill home-tier-hero-pill--compact">
                    {t("premium.smallGroupValue.heroBadge")}
                  </span>
                  <p className="mt-1.5 text-[10.5px] font-extrabold uppercase tracking-[0.16em] text-sky-900 sm:mt-2 sm:text-[11px] sm:tracking-[0.18em] md:text-xs md:tracking-[0.2em]">
                    {t("premium.smallGroupValue.heroLabel")}
                  </p>
                </div>
                <p className="home-type-price-anchor shrink-0 text-[1.85rem] leading-none text-sky-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.95),0_2px_14px_rgba(14,165,233,0.18)] sm:text-[2.05rem] md:text-[2.25rem]">
                  {t("premium.smallGroupValue.heroPrice")}
                </p>
              </div>
              <p className="relative mt-3 max-w-lg text-[12.5px] font-semibold leading-[1.52] tracking-[-0.01em] text-slate-800 sm:mt-4 sm:text-[14px] sm:leading-[1.6] md:text-[15px]">
                {t("premium.smallGroupValue.heroLine")}
              </p>
            </div>

            {/* Private — premium upsell, not equal to hero */}
            <div className="home-tier-row-upsell px-3.5 py-2.5 sm:px-4 sm:py-3">
              <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-0.5">
                <span className="home-support-micro text-violet-700/90">
                  {t("premium.smallGroupValue.privateLabel")}
                </span>
                <span className="home-type-price-anchor text-lg text-violet-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.55)] sm:text-xl">
                  {t("premium.smallGroupValue.privatePrice")}
                </span>
              </div>
              <p className="mt-1.5 text-[11.5px] font-medium leading-snug text-violet-900/80 sm:text-[12px]">
                {t("premium.smallGroupValue.privateLine")}
              </p>
            </div>
          </div>
        </div>

        <p className="mx-auto mt-4 max-w-lg text-center text-[12.5px] font-semibold leading-snug tracking-[-0.012em] text-slate-500 sm:mt-5 sm:text-[13px] sm:leading-relaxed">
          {t("premium.smallGroupValue.footerLine")}
        </p>
      </div>
    </section>
  );
}
