"use client";

import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

const JOIN_HREF = "/custom-join-tour";
const PRIVATE_INTENT = "Private tour day";

export default function FinalCtaPremium() {
  const t = useTranslations("home");
  const privateHref = `${JOIN_HREF}?intent=${encodeURIComponent(PRIVATE_INTENT)}`;

  return (
    <section
      className="home-section-y-tight home-section-divide relative px-4 sm:px-6 lg:px-8"
      aria-labelledby="final-cta-premium-heading"
    >
      <div className="container mx-auto max-w-2xl">
        <div className="home-panel-closing rounded-[2rem] px-6 py-9 text-center sm:px-9 sm:py-10 md:py-11">
          <p className="home-support-micro text-slate-500">{t("premium.finalCta.eyebrow")}</p>
          <h2
            id="final-cta-premium-heading"
            className="home-type-display mb-4 mt-3 text-[1.28rem] leading-[1.12] sm:mb-5 sm:text-[1.45rem] md:text-[1.65rem]"
          >
            {t("premium.finalCta.title")}
          </h2>
          <div className="flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center sm:gap-3.5">
            <Link
              href={JOIN_HREF}
              className="home-btn-primary flex-1 sm:min-w-[12rem] sm:flex-none sm:px-9 sm:text-base"
            >
              {t("premium.finalCta.cta")}
            </Link>
            <Link
              href={privateHref}
              className="home-btn-secondary flex-1 sm:min-w-[12rem] sm:flex-none sm:px-9 sm:text-base"
            >
              {t("premium.finalCta.ctaPrivate")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
