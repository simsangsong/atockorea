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
      className="home-section-y-homeflow-close home-section-divide relative bg-transparent px-4 sm:px-6 lg:px-8"
      aria-labelledby="final-cta-premium-heading"
    >
      <div className="container mx-auto max-w-2xl">
        <div className="home-panel-closing rounded-[1.75rem] px-5 py-7 text-center sm:rounded-[2rem] sm:px-8 sm:py-8 md:py-9">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
            {t("premium.finalCta.eyebrow")}
          </p>
          <h2
            id="final-cta-premium-heading"
            className="home-type-display mx-auto mt-2 max-w-[22rem] text-[1.22rem] leading-[1.14] tracking-[-0.034em] sm:mt-2.5 sm:max-w-lg sm:text-[1.38rem] md:text-[1.52rem]"
          >
            {t("premium.finalCta.title")}
          </h2>
          <div className="mx-auto mt-4 flex max-w-md flex-col items-stretch gap-1 sm:mt-5 sm:max-w-none sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-3 sm:gap-y-2">
            <Link
              href={JOIN_HREF}
              className="home-btn-primary order-1 w-full sm:order-1 sm:w-auto sm:min-w-[12.5rem] sm:flex-none sm:px-9 sm:text-[15px]"
            >
              {t("premium.finalCta.cta")}
            </Link>
            <span
              className="order-2 py-1 text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 sm:order-2 sm:px-0.5 sm:py-0"
              aria-hidden
            >
              {t("premium.finalCta.divider")}
            </span>
            <Link
              href={privateHref}
              className="home-btn-secondary home-btn-secondary--cta-alt order-3 w-full sm:order-3 sm:w-auto sm:min-w-[12.5rem] sm:flex-none"
            >
              {t("premium.finalCta.ctaPrivate")}
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
