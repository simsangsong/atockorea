"use client";

import { MapPinned, CloudSun, Bell, Smartphone } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

const PROOF_ITEMS = [
  { icon: MapPinned, titleKey: "card1Title" as const, lineKey: "card1Line" as const },
  { icon: CloudSun, titleKey: "card2Title" as const, lineKey: "card2Line" as const },
  { icon: Bell, titleKey: "card3Title" as const, lineKey: "card3Line" as const },
  { icon: Smartphone, titleKey: "card4Title" as const, lineKey: "card4Line" as const },
] as const;

const TRAVELER_NOTE_KEYS = [
  { quoteKey: "quote1" as const, tagKey: "quote1Tag" as const },
  { quoteKey: "quote2" as const, tagKey: "quote2Tag" as const },
] as const;

/**
 * Operational trust + quiet social proof (fit, pacing, pickup clarity).
 */
export default function TrustAndReviewsSection() {
  const t = useTranslations("home");

  return (
    <section
      className="home-section-y-homeflow home-section-divide relative bg-transparent px-4 sm:px-6 lg:px-8"
      aria-labelledby="home-trust-heading"
    >
      <div className="mx-auto max-w-6xl">
        <p className="home-type-eyebrow text-center text-slate-500">
          {t("premium.trust.eyebrow")}
        </p>
        <h2
          id="home-trust-heading"
          className="home-type-display mt-2 text-center text-[1.35rem] leading-[1.12] tracking-[-0.03em] sm:text-[1.55rem] md:text-[1.85rem]"
        >
          {t("premium.trust.title")}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-center text-[13px] font-semibold leading-snug text-slate-600 sm:text-[14px] sm:leading-snug">
          {t("premium.trust.subtitle")}
        </p>

        <ul
          className="mt-5 grid grid-cols-2 gap-2 sm:mt-5 sm:gap-2.5 md:gap-3 lg:mt-6 lg:grid-cols-4 lg:gap-3"
          role="list"
        >
          {PROOF_ITEMS.map(({ icon: Icon, titleKey, lineKey }) => (
            <li
              key={titleKey}
              className="home-neutral-trust-tile home-neutral-trust-tile--compact flex h-full min-h-0 flex-col p-3 sm:p-3.5 lg:p-4"
            >
              <span className="mb-1.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200/75 bg-gradient-to-b from-white to-slate-50/98 text-slate-600 shadow-[0_1px_0_rgba(255,255,255,0.98)_inset,0_1px_2px_rgba(15,23,42,0.04)] sm:mb-2 sm:h-8 sm:w-8 sm:rounded-xl">
                <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4" strokeWidth={1.5} aria-hidden />
              </span>
              <h3 className="break-words text-[12px] font-black leading-tight tracking-[-0.02em] text-slate-950 sm:text-[13px] md:text-[14px]">
                {t(`premium.trust.${titleKey}`)}
              </h3>
              <p className="mt-1 flex-1 text-[10.5px] font-medium leading-snug tracking-[-0.006em] text-slate-600 sm:mt-1.5 sm:text-[11.5px] sm:leading-relaxed md:text-[12px]">
                {t(`premium.trust.${lineKey}`)}
              </p>
            </li>
          ))}
        </ul>

        <div
          className="home-traveler-notes-stage mt-6 px-4 py-4 sm:mt-7 sm:px-5 sm:py-5 md:mt-8"
          aria-labelledby="home-reviews-heading"
        >
          <p className="text-center text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            {t("premium.reviews.eyebrow")}
          </p>
          <h3
            id="home-reviews-heading"
            className="mx-auto mt-2 max-w-md text-center text-[1.05rem] font-black leading-snug tracking-[-0.024em] text-slate-900 sm:mt-2.5 sm:text-[1.12rem]"
          >
            {t("premium.reviews.title")}
          </h3>
          <div className="mx-auto mt-4 grid max-w-3xl grid-cols-1 gap-3 sm:mt-5 sm:gap-3.5 md:grid-cols-2 md:gap-4">
            {TRAVELER_NOTE_KEYS.map(({ quoteKey, tagKey }) => (
              <blockquote
                key={quoteKey}
                className="home-traveler-note-card flex h-full min-h-0 flex-col justify-between gap-3"
              >
                <p className="home-traveler-note-card__quote text-[13px] font-semibold leading-[1.55] tracking-[-0.018em] text-slate-900 sm:text-[14px] sm:leading-[1.58]">
                  {t(`premium.reviews.${quoteKey}`)}
                </p>
                <footer>
                  <p className="border-t border-slate-200/80 pt-2.5 text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500 sm:text-[10px] sm:tracking-[0.2em]">
                    {t(`premium.reviews.${tagKey}`)}
                  </p>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
