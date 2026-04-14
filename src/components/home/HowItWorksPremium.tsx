"use client";

import { useTranslations } from "@/lib/i18n";

const MAIN_STEPS = [
  { step: 1, titleKey: "premium.howItWorks.step1Title" as const, lineKey: "premium.howItWorks.step1Line" as const },
  { step: 2, titleKey: "premium.howItWorks.step2Title" as const, lineKey: "premium.howItWorks.step2Line" as const },
  { step: 3, titleKey: "premium.howItWorks.step3Title" as const, lineKey: "premium.howItWorks.step3Line" as const },
  { step: 4, titleKey: "premium.howItWorks.step4Title" as const, lineKey: "premium.howItWorks.step4Line" as const },
] as const;

/**
 * Post-submit sequence: inputs → operating-day fit → fixed spine → bounded flex → desk support.
 */
export default function HowItWorksPremium() {
  const t = useTranslations("home");

  return (
    <section
      className="home-section-y-homeflow home-section-divide relative bg-transparent px-4 sm:px-6 lg:px-8"
      aria-labelledby="how-it-works-premium-heading"
    >
      <div className="container mx-auto max-w-2xl md:max-w-3xl">
        <p className="home-type-eyebrow text-center text-slate-500">
          {t("premium.howItWorks.eyebrow")}
        </p>
        <h2
          id="how-it-works-premium-heading"
          className="home-type-display mt-2 text-center text-[1.52rem] leading-[1.08] sm:mt-2.5 sm:text-[1.85rem] md:text-[2.1rem]"
        >
          {t("premium.howItWorks.title")}
        </h2>
        <p className="mx-auto mt-2 max-w-lg text-center text-[13px] font-semibold leading-snug text-slate-600 sm:mt-2.5 sm:text-[14px] sm:leading-snug">
          {t("premium.howItWorks.subtitle")}
        </p>

        <div className="mt-4 grid grid-cols-1 gap-2 sm:mt-5 sm:gap-2.5 md:grid-cols-2 md:gap-x-4 md:gap-y-2.5 lg:gap-x-5">
          <ol className="contents list-none">
            {MAIN_STEPS.map(({ step, titleKey, lineKey }) => (
              <li
                key={step}
                className="home-neutral-process home-neutral-process--timeline flex items-start gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-3.5 sm:py-3"
              >
                <span
                  className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-sky-50 to-sky-100/80 text-[10px] font-black text-sky-900 tabular-nums shadow-[0_1px_0_rgba(255,255,255,0.95)_inset] ring-1 ring-sky-200/85 sm:text-[11px]"
                  aria-hidden
                >
                  {String(step).padStart(2, "0")}
                </span>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-[14px] font-black leading-tight tracking-[-0.02em] text-slate-950 sm:text-[15px]">
                    {t(titleKey)}
                  </p>
                  <p className="mt-1 text-[12px] font-medium leading-snug tracking-[-0.006em] text-slate-600 sm:text-[13px] sm:leading-relaxed">
                    {t(lineKey)}
                  </p>
                </div>
              </li>
            ))}
          </ol>

          <div
            className="home-neutral-process-note home-neutral-process-note--timeline flex items-start gap-2.5 px-3 py-2.5 sm:gap-3 sm:px-3.5 sm:py-3 md:col-span-2"
            role="note"
            aria-label={t("premium.howItWorks.step5Aria")}
          >
            <span
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-slate-100 to-slate-200/60 text-[10px] font-black text-slate-600 tabular-nums shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-slate-200/90 sm:text-[11px]"
              aria-hidden
            >
              05
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-[14px] font-black leading-tight tracking-[-0.02em] text-slate-950 sm:text-[15px]">
                {t("premium.howItWorks.step5Title")}
              </p>
              <p className="mt-1 text-[12px] font-medium leading-snug tracking-[-0.006em] text-slate-600 sm:text-[13px] sm:leading-relaxed">
                {t("premium.howItWorks.step5Line")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
