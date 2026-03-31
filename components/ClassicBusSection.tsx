"use client";

import Link from "next/link";
import { useTranslations } from "@/lib/i18n";

/**
 * Homepage bus alternative: minimal, near footer — single secondary CTA, no tour grid.
 */
export default function ClassicBusSection() {
  const t = useTranslations("home");
  return (
    <section
      className="home-section-y-tight home-section-divide relative bg-gradient-to-b from-slate-50/85 to-slate-100/35 px-4 backdrop-blur-md sm:px-6 lg:px-8"
      aria-labelledby="classic-bus-heading"
    >
      <div className="mx-auto max-w-xl text-center">
        <p className="home-support-micro text-slate-500">{t("premium.classicBus.eyebrow")}</p>
        <h2
          id="classic-bus-heading"
          className="mt-2.5 text-[13px] font-bold leading-snug tracking-[-0.018em] text-slate-700 sm:text-sm md:text-[15px]"
        >
          {t("premium.classicBus.title")}
        </h2>
        <Link
          href="/tours/list"
          className="home-btn-secondary mt-4 px-7 text-[12px] sm:mt-4 sm:text-[13px]"
        >
          {t("premium.classicBus.cta")}
        </Link>
      </div>
    </section>
  );
}
