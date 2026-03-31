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
      className="home-section-y-tight home-section-divide relative bg-transparent px-4 sm:px-6 lg:px-8"
      aria-labelledby="small-group-value-heading"
    >
      <div className="mx-auto max-w-3xl">
        <header className="mb-8 text-center sm:mb-9 md:mb-10">
          <p className="home-type-eyebrow">
            {t("premium.smallGroupValue.eyebrow")}
          </p>
          <h2
            id="small-group-value-heading"
            className="home-type-display mt-3 text-[1.65rem] leading-tight sm:text-[1.9rem] md:text-[2.1rem]"
            style={{ color: BRAND_NAVY }}
          >
            {t("premium.smallGroupValue.title")}
          </h2>
          <p className="home-type-body mx-auto mt-3 max-w-md leading-snug">
            {t("premium.smallGroupValue.subtitle")}
          </p>
        </header>

        <div className="home-panel-pricing-story p-5 sm:p-6 md:p-7">
          <div className="flex flex-col gap-3.5 sm:gap-4">
            {/* Bus — secondary, muted */}
            <div className="home-tier-row-muted px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <span className="home-support-micro text-slate-500">
                  {t("premium.smallGroupValue.busLabel")}
                </span>
                <span className="home-type-price-anchor text-lg text-slate-800 sm:text-xl">
                  {t("premium.smallGroupValue.busPrice")}
                </span>
              </div>
              <p className="mt-2 text-[12px] font-medium leading-snug text-slate-600">{t("premium.smallGroupValue.busLine")}</p>
            </div>

            {/* Small group — hero band */}
            <div className="home-tier-row-hero px-5 py-7 sm:px-6 sm:py-8 md:px-7 md:py-9">
              <div className="pointer-events-none absolute inset-x-3 top-0 z-0 h-px rounded-full bg-gradient-to-r from-transparent via-sky-300/65 to-transparent sm:inset-x-4" aria-hidden />
              <div className="relative flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <span className="home-tier-hero-pill">{t("premium.smallGroupValue.heroBadge")}</span>
                  <p className="mt-2.5 text-[11px] font-extrabold uppercase tracking-[0.18em] text-sky-900 sm:text-xs sm:tracking-[0.2em]">
                    {t("premium.smallGroupValue.heroLabel")}
                  </p>
                </div>
                <p className="home-type-price-anchor shrink-0 text-[2.05rem] leading-none text-sky-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.95),0_2px_14px_rgba(14,165,233,0.18)] sm:text-[2.2rem] md:text-[2.4rem]">
                  {t("premium.smallGroupValue.heroPrice")}
                </p>
              </div>
              <p className="relative mt-5 max-w-lg text-[13px] font-semibold leading-[1.62] tracking-[-0.01em] text-slate-800 sm:mt-6 sm:text-[15px] sm:leading-[1.68]">
                {t("premium.smallGroupValue.heroLine")}
              </p>
            </div>

            {/* Private — premium upsell, not equal to hero */}
            <div className="home-tier-row-upsell px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
                <span className="home-support-micro text-violet-700/90">
                  {t("premium.smallGroupValue.privateLabel")}
                </span>
                <span className="home-type-price-anchor text-xl text-violet-950 drop-shadow-[0_1px_0_rgba(255,255,255,0.55)] sm:text-2xl">
                  {t("premium.smallGroupValue.privatePrice")}
                </span>
              </div>
              <p className="mt-2 text-[12px] font-medium leading-snug text-violet-900/80">{t("premium.smallGroupValue.privateLine")}</p>
            </div>
          </div>
        </div>

        <p className="home-type-meta mt-7 text-center text-slate-500 sm:mt-8">
          {t("premium.smallGroupValue.footerLine")}
        </p>
      </div>
    </section>
  );
}
