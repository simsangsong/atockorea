"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ArrowRight, Check, Car, Bus, Award } from "lucide-react";
import { analytics } from "@/src/design/analytics";
import {
  HOME_CTA_BROWSE_TOURS_HREF,
  HOME_CTA_MATCHING_HREF,
  HOME_CTA_SMALL_GROUP_LIST_HREF,
} from "@/lib/home/home-cta-routes";
import { useTranslations } from "@/lib/i18n";
import { getFeaturedJoinTourProduct, getProductPriceLabels } from "@/lib/home/featured-join-tour-offer";

/** White CTA on dark featured card — same secondary-depth language as `home-premium` buttons. */
const chooseStyleFeaturedWhiteCtaStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-secondary)",
};

export function ChooseTravelStyle() {
  const t = useTranslations("home");
  const containerRef = useRef<HTMLDivElement>(null);
  const featuredJoinPrices = useMemo(() => getProductPriceLabels(getFeaturedJoinTourProduct()), []);

  useEffect(() => {
    if (containerRef.current) {
      const children = containerRef.current.querySelectorAll("[data-animate]");
      children.forEach((child, index) => {
        window.setTimeout(() => {
          child.classList.add("visible");
        }, index * 100);
      });
    }
  }, []);

  return (
    <section className="py-14 md:py-20 px-4 md:px-6 bg-gradient-to-b from-slate-50/80 to-white">
      <div ref={containerRef} className="max-w-4xl mx-auto">
        <div className="text-center mb-10 md:mb-14">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 mb-3 rounded-full border border-white/80 bg-white/95 shadow-home-neutral-card backdrop-blur-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-primary/70" />
            <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-[0.08em]">
              {t("premium.v2.chooseStyle.eyebrow")}
            </span>
          </div>
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-800 tracking-tight mb-3">
            {t("premium.v2.chooseStyle.title")}
          </h2>
          <p className="text-slate-600 text-[14px] md:text-[15px] font-medium max-w-lg mx-auto leading-relaxed">
            {t("premium.v2.chooseStyle.subtitle")}
          </p>
        </div>

        <div className="relative mb-5 scroll-animate" data-animate>
          <div className="relative overflow-hidden rounded-home-card border border-slate-700/50 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-6 shadow-home-offer-smgroup transition-shadow duration-300 ease-out hover:shadow-home-offer-smgroup-hover md:p-8">
            <div className="absolute top-0 right-5 md:right-6 z-10">
              <div className="bg-emerald-500 text-white text-[9px] md:text-[10px] font-bold px-3 md:px-4 py-1.5 md:py-2 rounded-b-lg shadow-md flex items-center gap-1.5 tracking-wide">
                <Award className="w-3 h-3 md:w-3.5 md:h-3.5" />
                {t("premium.v2.chooseStyle.recommended")}
              </div>
            </div>

            <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full -mr-32 -mt-32" />

            <div className="relative">
              <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-5 md:gap-6 mb-6 md:mb-8">
                <div>
                  <h3 className="text-xl md:text-2xl lg:text-3xl font-bold text-white mb-2">
                    {t("premium.v2.chooseStyle.smallGroupTitle")}
                  </h3>
                  <p className="text-sm md:text-base text-slate-300 max-w-md leading-relaxed">
                    {t("premium.v2.chooseStyle.smallGroupDesc")}
                  </p>
                </div>
                <div className="text-left md:text-right flex-shrink-0">
                  <p className="text-xs text-slate-400 mb-1">{t("premium.v2.chooseStyle.from")}</p>
                  <div className="flex items-baseline gap-2">
                    {featuredJoinPrices.compareAtLabel ? (
                      <span className="text-base text-slate-500 line-through">
                        {featuredJoinPrices.compareAtLabel}
                      </span>
                    ) : null}
                    <span className="text-3xl md:text-4xl font-bold text-white">
                      {featuredJoinPrices.listLabel}
                    </span>
                  </div>
                  <p className="text-xs text-emerald-300 font-semibold">{t("premium.v2.chooseStyle.perPerson")}</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5 md:gap-3 mb-6 md:mb-8 p-4 md:p-5 bg-white/5 rounded-xl md:rounded-2xl border border-white/10">
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300" />
                  </div>
                  <span className="font-medium text-white/90 text-sm">{t("premium.v2.chooseStyle.sgFeature1")}</span>
                </div>
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300" />
                  </div>
                  <span className="font-medium text-white/90 text-sm">{t("premium.v2.chooseStyle.sgFeature2")}</span>
                </div>
                <div className="flex items-center gap-2.5 md:gap-3">
                  <div className="w-6 h-6 md:w-7 md:h-7 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <Check className="w-3 h-3 md:w-3.5 md:h-3.5 text-emerald-300" />
                  </div>
                  <span className="font-medium text-white/90 text-sm">{t("premium.v2.chooseStyle.sgFeature3")}</span>
                </div>
              </div>

              <V0ShadcnButton
                asChild
                size="lg"
                className="w-full rounded-xl bg-white py-5 text-[13px] font-semibold text-slate-900 transition-all duration-300 hover:bg-white/95 md:py-6 md:text-sm h-auto"
                style={chooseStyleFeaturedWhiteCtaStyle}
              >
                <Link
                  href={HOME_CTA_SMALL_GROUP_LIST_HREF}
                  onClick={() => {
                    analytics.homeCtaClick({ source: "choose_style_featured_join" });
                  }}
                >
                  {t("premium.v2.chooseStyle.sgCta")}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </V0ShadcnButton>
            </div>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <div
            className="group relative overflow-hidden scroll-animate rounded-home-card border border-slate-200/70 bg-white p-5 shadow-home-offer-private transition-all duration-300 hover:border-slate-300/90 hover:shadow-home-offer-private-hover md:p-6"
            data-animate
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300" />

            <div className="flex items-center justify-between mb-4">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Car className="w-4 h-4 md:w-5 md:h-5 text-amber-700" />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full tracking-wide">
                {t("premium.v2.chooseStyle.privateBadge")}
              </span>
            </div>

            <h3 className="text-lg md:text-xl font-bold text-slate-900 mb-1">{t("premium.v2.chooseStyle.privateTitle")}</h3>
            <div className="mb-3">
              <span className="text-xs text-slate-400 line-through mr-1.5">
                {t("premium.v2.chooseStyle.privatePriceWas")}
              </span>
              <span className="text-2xl md:text-3xl font-bold text-slate-900">
                {t("premium.v2.chooseStyle.privatePriceNow")}
              </span>
              <span className="text-slate-500 text-xs ml-1">{t("premium.v2.chooseStyle.perPersonShort")}</span>
            </div>

            <p className="text-[13px] md:text-[14px] text-slate-600 mb-5 leading-relaxed">
              {t("premium.v2.chooseStyle.privateDesc")}
            </p>

            <div className="space-y-2.5 mb-5">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[13px] md:text-[14px] text-slate-700">{t("premium.v2.chooseStyle.privateF1")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[13px] md:text-[14px] text-slate-700">{t("premium.v2.chooseStyle.privateF2")}</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-[13px] md:text-[14px] text-slate-700">{t("premium.v2.chooseStyle.privateF3")}</span>
              </div>
            </div>

            <V0ShadcnButton
              asChild
              variant="outline"
              size="lg"
              className="w-full border-amber-300/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-sm transition-all h-auto"
            >
              <Link
                href={HOME_CTA_MATCHING_HREF}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_private_custom" });
                }}
              >
                {t("premium.v2.chooseStyle.privateCta")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </V0ShadcnButton>
          </div>

          <div
            className="group relative overflow-hidden scroll-animate rounded-home-card border border-amber-200/60 bg-gradient-to-br from-amber-50/40 via-stone-50 to-orange-50/30 p-5 shadow-home-offer-bus transition-all duration-300 hover:border-amber-300/70 hover:shadow-home-offer-bus-hover md:p-6"
            data-animate
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300/80 via-stone-400 to-amber-300/80" />

            <div className="flex items-center justify-between mb-5">
              <div className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center border border-amber-200/60 shadow-[0_2px_8px_rgba(180,130,60,0.15)]">
                <Bus className="w-5 h-5 md:w-[22px] md:h-[22px] text-amber-700" />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200/70 px-3 py-1.5 rounded-lg tracking-wide shadow-sm">
                {t("premium.v2.chooseStyle.busBadge")}
              </span>
            </div>

            <h3 className="text-lg md:text-xl font-bold text-slate-800 tracking-tight mb-1.5">
              {t("premium.v2.chooseStyle.busTitle")}
            </h3>

            <div className="mb-4">
              <span className="text-2xl md:text-3xl font-bold text-slate-800 tracking-tight">
                {t("premium.v2.chooseStyle.busPrice")}
              </span>
              <span className="text-amber-700/70 text-xs font-medium ml-1.5">{t("premium.v2.chooseStyle.busPerPerson")}</span>
            </div>

            <p className="text-[13px] md:text-sm text-stone-600 mb-5 leading-relaxed">
              {t("premium.v2.chooseStyle.busDesc")}
            </p>

            <div className="space-y-2.5 mb-6">
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                  <Check className="w-3 h-3 text-amber-700" />
                </div>
                <span className="text-[13px] md:text-sm text-slate-700 font-medium">{t("premium.v2.chooseStyle.busF1")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                  <Check className="w-3 h-3 text-amber-700" />
                </div>
                <span className="text-[13px] md:text-sm text-slate-700 font-medium">{t("premium.v2.chooseStyle.busF2")}</span>
              </div>
              <div className="flex items-center gap-2.5">
                <div className="w-5 h-5 rounded-md bg-amber-100/80 border border-amber-200/60 flex items-center justify-center">
                  <Check className="w-3 h-3 text-amber-700" />
                </div>
                <span className="text-[13px] md:text-sm text-slate-700 font-medium">{t("premium.v2.chooseStyle.busF3")}</span>
              </div>
            </div>

            <V0ShadcnButton
              asChild
              variant="outline"
              size="lg"
              className="w-full border-amber-300/70 bg-white text-amber-800 hover:bg-amber-50 hover:border-amber-400 font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-sm transition-all h-auto"
            >
              <Link
                href={HOME_CTA_BROWSE_TOURS_HREF}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_browse_bus" });
                }}
              >
                {t("premium.v2.chooseStyle.busCta")}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Link>
            </V0ShadcnButton>
          </div>
        </div>
      </div>
    </section>
  );
}
