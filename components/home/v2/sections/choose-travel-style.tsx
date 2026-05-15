"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ArrowRight, Car, Bus, Award, Users } from "lucide-react";
import { analytics } from "@/src/design/analytics";
import {
  HOME_CTA_BROWSE_TOURS_HREF,
  HOME_CTA_MATCHING_HREF,
  HOME_CTA_SMALL_GROUP_LIST_HREF,
} from "@/lib/home/home-cta-routes";
import { useTranslations } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { getFeaturedJoinTourProduct } from "@/lib/home/featured-join-tour-offer";
import { CHOOSE_STYLE_CARD_USD } from "@/lib/home/choose-style-card-usd";

const chooseStyleFeaturedWhiteCtaStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-secondary)",
};

export function ChooseTravelStyle() {
  const t = useTranslations("home");
  const { formatPrice } = useCurrency();
  const containerRef = useRef<HTMLDivElement>(null);
  const featuredJoin = useMemo(() => getFeaturedJoinTourProduct(), []);

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
    <section className="py-10 md:py-14 px-4 md:px-6 bg-slate-50 border-t border-slate-100">
      <div ref={containerRef} className="max-w-4xl mx-auto">
        <div className="text-center mb-7 md:mb-9">
          <p className="mb-3 text-eyebrow md:mb-4">
            {t("premium.v2.chooseStyle.eyebrow")}
          </p>
          <h2 className="text-h2 text-slate-900">
            {t("premium.v2.chooseStyle.title")}
          </h2>
        </div>

        {/* relative wrapper hosts the right-edge fade overlay so users see
            "more →" on mobile where the scrollbar is hidden. */}
        <div className="relative -mx-4 md:mx-0">
        <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 scrollbar-none md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none">
          {/* Small Group — featured (dark navy, emerald accent) */}
          <div
            className="relative w-[68vw] flex-none snap-start overflow-hidden rounded-card border border-slate-700/50 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-800 p-4 md:p-5 shadow-home-offer-smgroup transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-home-offer-smgroup-hover scroll-animate flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto"
            data-animate
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-400" />
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-bl from-emerald-500/10 to-transparent rounded-full -mr-20 -mt-20 pointer-events-none" />

            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-emerald-400" />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-1 rounded-full tracking-wide flex items-center gap-1">
                <Award className="w-3 h-3" />
                {t("premium.v2.chooseStyle.recommended")}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-white mb-1">
              {t("premium.v2.chooseStyle.smallGroupTitle")}
            </h3>
            <p className="text-[12.5px] text-slate-300 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.smallGroupDesc")}
            </p>

            <div className="mb-4">
              <p className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-2">
                {featuredJoin.compareAtPriceUsd != null ? (
                  <span className="text-sm text-slate-500 line-through">
                    {formatPrice(featuredJoin.compareAtPriceUsd)}
                  </span>
                ) : null}
                <span className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {formatPrice(featuredJoin.listPriceUsd)}
                </span>
                <span className="text-[11px] text-emerald-300 font-semibold">{t("premium.v2.chooseStyle.perPerson")}</span>
              </div>
            </div>

            <V0ShadcnButton
              asChild
              size="lg"
              className="w-full rounded-xl bg-white py-3 text-[13px] font-semibold text-slate-900 transition-all duration-300 hover:bg-white/95 h-auto"
              style={chooseStyleFeaturedWhiteCtaStyle}
            >
              <Link
                href={HOME_CTA_SMALL_GROUP_LIST_HREF}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_featured_join" });
                }}
              >
                {t("premium.v2.chooseStyle.sgCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </div>

          {/* Private — amber accent */}
          <div
            className="group relative w-[68vw] flex-none snap-start overflow-hidden scroll-animate rounded-card border border-slate-200/70 bg-white p-4 md:p-5 shadow-home-offer-private transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-slate-300/90 hover:shadow-home-offer-private-hover flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto"
            data-animate
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-orange-400 to-amber-300" />

            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-amber-100 to-orange-100 flex items-center justify-center">
                <Car className="w-4 h-4 md:w-5 md:h-5 text-amber-700" />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full tracking-wide">
                {t("premium.v2.chooseStyle.privateBadge")}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">{t("premium.v2.chooseStyle.privateTitle")}</h3>
            <p className="text-[12.5px] text-slate-600 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.privateDesc")}
            </p>

            <div className="mb-4">
              <p className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  {formatPrice(CHOOSE_STYLE_CARD_USD.private.list)}
                </span>
                <span className="text-slate-500 text-[11px] font-semibold">{t("premium.v2.chooseStyle.privatePerVehicle")}</span>
              </div>
            </div>

            <V0ShadcnButton
              asChild
              variant="outline"
              size="lg"
              className="w-full border-amber-300/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100 hover:border-amber-400 font-semibold py-3 rounded-xl text-[13px] transition-all h-auto mt-4"
            >
              <Link
                href={HOME_CTA_MATCHING_HREF}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_private_custom" });
                }}
              >
                {t("premium.v2.chooseStyle.privateCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </div>

          {/* Bus — stone/amber warm */}
          <div
            className="group relative w-[68vw] flex-none snap-start overflow-hidden scroll-animate rounded-card border border-amber-200/60 bg-gradient-to-br from-amber-50/40 via-stone-50 to-orange-50/30 p-4 md:p-5 shadow-home-offer-bus transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-amber-300/70 hover:shadow-home-offer-bus-hover flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto"
            data-animate
          >
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-300/80 via-stone-400 to-amber-300/80" />

            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-gradient-to-br from-amber-100 to-stone-100 flex items-center justify-center border border-amber-200/60 shadow-1">
                <Bus className="w-4 h-4 md:w-5 md:h-5 text-amber-700" />
              </div>
              <span className="text-[9px] md:text-[10px] font-bold text-amber-800 bg-amber-100/90 border border-amber-200/70 px-2.5 py-1 rounded-full tracking-wide shadow-sm">
                {t("premium.v2.chooseStyle.busBadge")}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-slate-800 tracking-tight mb-1">
              {t("premium.v2.chooseStyle.busTitle")}
            </h3>
            <p className="text-[12.5px] text-stone-600 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.busDesc")}
            </p>

            <div className="mb-4">
              <p className="text-[10px] text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">
                  {formatPrice(CHOOSE_STYLE_CARD_USD.bus.from)}
                </span>
                <span className="text-amber-700/70 text-[11px] font-semibold">{t("premium.v2.chooseStyle.busPerPerson")}</span>
              </div>
            </div>

            <V0ShadcnButton
              asChild
              variant="outline"
              size="lg"
              className="w-full border-amber-300/70 bg-white text-amber-800 hover:bg-amber-50 hover:border-amber-400 font-semibold py-3 rounded-xl text-[13px] transition-all h-auto mt-4"
            >
              <Link
                href={HOME_CTA_BROWSE_TOURS_HREF}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_browse_bus" });
                }}
              >
                {t("premium.v2.chooseStyle.busCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </div>
        </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-14 bg-gradient-to-l from-slate-50 via-slate-50/90 to-transparent md:hidden"
          />
        </div>
      </div>
    </section>
  );
}
