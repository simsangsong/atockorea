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
      className="home-section-y-tight relative border-t border-slate-200/30 bg-transparent px-4 sm:px-6 lg:px-8"
      aria-labelledby="how-it-works-premium-heading"
    >
      <div className="container mx-auto max-w-2xl">
        <p className="home-type-eyebrow text-center">
          {t("premium.howItWorks.eyebrow")}
        </p>
        <h2
          id="how-it-works-premium-heading"
          className="home-type-display mt-2.5 text-center text-[1.85rem] leading-[1.08] sm:text-[2.25rem] md:text-[2.65rem]"
        >
          {t("premium.howItWorks.title")}
        </h2>
        <p className="home-type-body mx-auto mt-3 max-w-lg text-center sm:mt-4">
          {t("premium.howItWorks.subtitle")}
        </p>

        <ol className="mt-8 flex list-none flex-col gap-4 sm:mt-9 sm:gap-[1.1rem]">
          {MAIN_STEPS.map(({ step, titleKey, lineKey }) => (
            <li key={step} className="home-neutral-process flex items-start gap-4 px-5 py-4 sm:gap-5 sm:px-6 sm:py-[1.15rem]">
              <span
                className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-sky-50 to-sky-100/80 text-sm font-black text-sky-900 tabular-nums shadow-[0_1px_0_rgba(255,255,255,0.95)_inset] ring-1 ring-sky-200/85"
                aria-hidden
              >
                {String(step).padStart(2, "0")}
              </span>
              <div className="min-w-0 flex-1 text-left">
                <p className="home-support-title text-base sm:text-[17px]">{t(titleKey)}</p>
                <p className="home-type-body mt-1.5 leading-relaxed">{t(lineKey)}</p>
              </div>
            </li>
          ))}
        </ol>

        <div
          className="home-neutral-process-note mt-7 px-5 py-4 sm:mt-8 sm:px-6 sm:py-5"
          role="note"
          aria-label={t("premium.howItWorks.step5Aria")}
        >
          <div className="flex items-start gap-3.5 sm:items-center sm:gap-4">
            <span
              className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-b from-slate-100 to-slate-200/60 text-[11px] font-black text-slate-600 tabular-nums shadow-[0_1px_0_rgba(255,255,255,0.9)_inset] ring-1 ring-slate-200/90 sm:mt-0"
              aria-hidden
            >
              05
            </span>
            <div className="min-w-0 flex-1">
              <p className="home-support-title text-sm">{t("premium.howItWorks.step5Title")}</p>
              <p className="mt-1 text-[12px] font-semibold leading-[1.68] tracking-[-0.008em] text-slate-600 sm:mt-1.5 sm:text-[13px] sm:leading-[1.72]">
                {t("premium.howItWorks.step5Line")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
