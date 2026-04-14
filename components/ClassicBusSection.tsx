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
      className="home-section-divide relative bg-transparent px-4 py-4 sm:px-6 sm:py-5 lg:px-8"
      aria-labelledby="classic-bus-heading"
    >
      <div className="mx-auto max-w-md">
        <div className="rounded-2xl border border-dashed border-slate-300/55 bg-white/45 px-4 py-3.5 text-center shadow-[0_6px_24px_-14px_rgba(15,23,42,0.07)] sm:px-5 sm:py-4">
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400 sm:text-[10px] sm:tracking-[0.22em]">
            {t("premium.classicBus.eyebrow")}
          </p>
          <h2
            id="classic-bus-heading"
            className="mt-1.5 text-[12px] font-semibold leading-snug tracking-[-0.012em] text-slate-600 sm:mt-2 sm:text-[13px] md:text-[14px]"
          >
            {t("premium.classicBus.title")}
          </h2>
          <Link
            href="/tours/list"
            className="home-btn-secondary home-btn-secondary--budget-fallback mt-3 inline-flex px-5 text-[11px] sm:mt-3 sm:px-6 sm:text-[12px]"
          >
            {t("premium.classicBus.cta")}
          </Link>
        </div>
      </div>
    </section>
  );
}
