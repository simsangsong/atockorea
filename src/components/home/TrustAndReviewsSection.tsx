"use client";

import { MapPinned, CloudSun, Bell, Smartphone } from "lucide-react";
import { useTranslations } from "@/lib/i18n";

const PROOF_ITEMS = [
  { icon: MapPinned, titleKey: "card1Title" as const, lineKey: "card1Line" as const },
  { icon: CloudSun, titleKey: "card2Title" as const, lineKey: "card2Line" as const },
  { icon: Bell, titleKey: "card3Title" as const, lineKey: "card3Line" as const },
  { icon: Smartphone, titleKey: "card4Title" as const, lineKey: "card4Line" as const },
] as const;

/**
 * Operational trust + quiet social proof (fit, pacing, pickup clarity).
 */
export default function TrustAndReviewsSection() {
  const t = useTranslations("home");
  const reviewQuotes = [t("premium.reviews.quote1"), t("premium.reviews.quote2"), t("premium.reviews.quote3")] as const;

  return (
    <section
      className="home-section-y-tight relative border-t border-slate-200/30 bg-transparent px-4 sm:px-6 lg:px-8"
      aria-labelledby="home-trust-heading"
    >
      <div className="mx-auto max-w-6xl">
        <p className="home-type-eyebrow text-center">
          {t("premium.trust.eyebrow")}
        </p>
        <h2
          id="home-trust-heading"
          className="home-type-display mt-2 text-center text-[1.35rem] leading-tight sm:text-[1.55rem] md:text-[1.85rem]"
        >
          {t("premium.trust.title")}
        </h2>
        <p className="home-type-body mx-auto mt-2 max-w-md text-center">
          {t("premium.trust.subtitle")}
        </p>

        <ul
          className="mt-7 grid grid-cols-1 gap-3.5 sm:mt-8 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4 lg:gap-4"
          role="list"
        >
          {PROOF_ITEMS.map(({ icon: Icon, titleKey, lineKey }) => (
            <li key={titleKey} className="home-neutral-trust-tile flex h-full flex-col p-5 sm:p-[1.15rem]">
              <span className="mb-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/70 bg-gradient-to-b from-white to-slate-50/98 text-slate-600 shadow-[0_1px_0_rgba(255,255,255,0.98)_inset,0_1px_2px_rgba(15,23,42,0.04)]">
                <Icon className="h-[1.2rem] w-[1.2rem]" strokeWidth={1.5} aria-hidden />
              </span>
              <h3 className="home-support-title text-[14px] sm:text-[15px]">{t(`premium.trust.${titleKey}`)}</h3>
              <p className="home-type-body mt-2 flex-1 text-[12px] leading-relaxed sm:text-[13px]">
                {t(`premium.trust.${lineKey}`)}
              </p>
            </li>
          ))}
        </ul>

        <div
          className="home-neutral-quotes-stage mt-9 px-5 py-6 sm:mt-10 sm:px-6 sm:py-7 md:py-7"
          aria-labelledby="home-reviews-heading"
        >
          <p className="home-support-micro text-center text-slate-600">
            {t("premium.reviews.eyebrow")}
          </p>
          <h3
            id="home-reviews-heading"
            className="home-support-title mx-auto mt-2.5 max-w-md text-center text-[1.08rem] leading-snug sm:text-[1.15rem]"
          >
            {t("premium.reviews.title")}
          </h3>
          <div className="mx-auto mt-5 grid max-w-4xl grid-cols-1 gap-3.5 sm:mt-6 sm:grid-cols-3 sm:gap-4">
            {reviewQuotes.map((quote, i) => (
              <blockquote
                key={i}
                className="home-neutral-quote flex h-full min-h-0 flex-col p-[1.05rem] text-[12px] font-semibold leading-[1.68] tracking-[-0.012em] text-slate-800 sm:p-5 sm:text-[13px] sm:leading-[1.72]"
              >
                &ldquo;{quote}&rdquo;
              </blockquote>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
