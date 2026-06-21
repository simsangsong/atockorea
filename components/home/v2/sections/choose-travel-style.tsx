"use client";

import type { CSSProperties } from "react";
import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { PartyStepper } from "@/components/home/v2/ui/PartyStepper";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ArrowRight, Car, Bus, Award, Users } from "lucide-react";
import { analytics } from "@/src/design/analytics";
import {
  HOME_CTA_BUS_LIST_HREF,
  HOME_CTA_PRIVATE_LIST_HREF,
  HOME_CTA_SMALL_GROUP_LIST_HREF,
} from "@/lib/home/home-cta-routes";
import { useTranslations } from "@/lib/i18n";
import { useCurrency } from "@/lib/currency";
import { getFeaturedJoinTourProduct } from "@/lib/home/featured-join-tour-offer";
import { CHOOSE_STYLE_CARD_USD } from "@/lib/home/choose-style-card-usd";
import { SnapScrollDots } from "@/components/home/v2/ui/SnapScrollDots";
import { homeBtnInverse, homeBtnPrimary } from "@/lib/home/home-button-classes";
import {
  REVEAL_ITEM_VARIANTS,
  useRevealContainerProps,
} from "@/components/home/v2/ui/reveal";
import { cn } from "@/lib/utils";

const chooseStyleFeaturedWhiteCtaStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-secondary)",
};

export function ChooseTravelStyle() {
  const t = useTranslations("home");
  const { formatPrice } = useCurrency();
  const scrollRef = useRef<HTMLDivElement>(null);
  const featuredJoin = useMemo(() => getFeaturedJoinTourProduct(), []);
  const reveal = useRevealContainerProps();

  // Reform U2/V6 — party drives the (Wave 1) live price + dynamic recommend.
  // In Wave 0 it carries forward into the card links so the catalogue can
  // pre-fill group size (U9 continuity seed). Default 2, no gate.
  const [party, setParty] = useState(2);
  const withParty = (href: string) =>
    `${href}${href.includes("?") ? "&" : "?"}party=${party}`;
  const handleStepperChange = (next: number) => {
    setParty(next);
    analytics.homePartyStepperChange({ party: next });
  };

  return (
    <section className="section-py-sm px-4 md:px-6 bg-slate-50">
      <motion.div {...reveal} className="max-w-4xl mx-auto">
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="text-center mb-5 md:mb-6">
          <p className="mb-3 text-eyebrow md:mb-4">
            {t("premium.v2.chooseStyle.eyebrow")}
          </p>
          {/* Standard section heading (Inter sans) — matches Featured / Why /
              Process headings. V1's magazine serif was rejected here: it reads
              as out-of-place on a plain section title (the editorial serif
              belongs on photo-card titles like Destinations, not section h2s). */}
          <h2 className="text-h2 text-slate-900">
            {t("premium.v2.chooseStyle.title")}
          </h2>
        </motion.div>

        {/* U2/V6 — party stepper. Sits directly above the cards so changing it
            visibly drives the cards (live price lands Wave 1). */}
        <motion.div variants={REVEAL_ITEM_VARIANTS} className="mb-6 md:mb-7">
          <PartyStepper
            value={party}
            onChange={handleStepperChange}
            label={t("premium.v2.chooseStyle.partyLabel")}
            caption={t("premium.v2.chooseStyle.partyCaption", { count: party })}
            decreaseAria={t("premium.v2.chooseStyle.partyDecrease")}
            increaseAria={t("premium.v2.chooseStyle.partyIncrease")}
          />
        </motion.div>

        {/* relative wrapper hosts the right-edge fade overlay so users see
            "more →" on mobile where the scrollbar is hidden. */}
        <div className="relative -mx-4 md:mx-0">
        <div ref={scrollRef} className="flex snap-x snap-mandatory scroll-px-6 gap-3 overflow-x-auto pb-2 pl-6 pr-10 scrollbar-none md:grid md:grid-cols-3 md:gap-4 md:overflow-visible md:px-0 md:pb-0 md:snap-none">
          {/* Small Group — featured (dark slate, amber accent only) */}
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            className="relative w-[68vw] flex-none snap-start overflow-hidden rounded-card border border-slate-700/50 bg-slate-900 p-4 md:p-5 shadow-2 transition-all duration-300 ease-out hover:-translate-y-0.5 flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto"
          >
            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center">
                <Users className="w-4 h-4 md:w-5 md:h-5 text-white" />
              </div>
              <span className="text-micro font-bold text-amber-300 bg-white/5 border border-white/15 px-2.5 py-1 rounded-full tracking-wide flex items-center gap-1">
                <Award className="w-3 h-3" />
                {t("premium.v2.chooseStyle.recommended")}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-white mb-1">
              {t("premium.v2.chooseStyle.smallGroupTitle")}
            </h3>
            <p className="text-caption text-slate-300 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.smallGroupDesc")}
            </p>

            <div className="mb-4">
              <p className="text-micro text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-2">
                {featuredJoin.compareAtPriceUsd != null ? (
                  <span className="text-sm text-slate-500 line-through">
                    {formatPrice(featuredJoin.compareAtPriceUsd)}
                  </span>
                ) : null}
                <span className="text-xl md:text-2xl font-bold text-white tracking-tight">
                  {formatPrice(featuredJoin.listPriceUsd)}
                </span>
                <span className="text-micro text-white/70 font-semibold">{t("premium.v2.chooseStyle.perPerson")}</span>
              </div>
              {/* U1 live price — per-person × party = total for the group. */}
              <p className="mt-1.5 text-micro font-semibold tabular-nums text-amber-200/90">
                {t("premium.v2.chooseStyle.totalForParty", {
                  total: formatPrice(featuredJoin.listPriceUsd * party),
                  count: party,
                })}
              </p>
            </div>

            <V0ShadcnButton
              asChild
              size="lg"
              className={homeBtnInverse}
              style={chooseStyleFeaturedWhiteCtaStyle}
            >
              <Link
                href={withParty(HOME_CTA_SMALL_GROUP_LIST_HREF)}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_featured_join" });
                  analytics.homeTourTypeCardClick({ type: "small_group", party });
                }}
              >
                {t("premium.v2.chooseStyle.sgCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </motion.div>

          {/* Private — white pod with subtle mint warm-light (premium, not minty) */}
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            className="group relative w-[68vw] flex-none snap-start overflow-hidden rounded-card border border-emerald-100/60 bg-gradient-to-b from-white via-white to-emerald-50/40 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04),0_8px_22px_-12px_rgba(16,122,87,0.10),0_18px_36px_-18px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-emerald-200/75 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(15,23,42,0.05),0_10px_28px_-12px_rgba(16,122,87,0.16),0_22px_42px_-18px_rgba(15,23,42,0.16)] flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto"
          >
            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-emerald-50/70 border border-emerald-100/70 flex items-center justify-center">
                <Car className="w-4 h-4 md:w-5 md:h-5 text-slate-700" />
              </div>
              <span className="text-micro font-bold text-slate-700 bg-white/70 border border-emerald-100/60 px-2.5 py-1 rounded-full tracking-wide backdrop-blur-[2px]">
                {t("premium.v2.chooseStyle.privateBadge")}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-slate-900 mb-1">{t("premium.v2.chooseStyle.privateTitle")}</h3>
            <p className="text-caption text-slate-600 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.privateDesc")}
            </p>

            <div className="mb-4">
              <p className="text-micro text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  {formatPrice(CHOOSE_STYLE_CARD_USD.private.list)}
                </span>
                <span className="text-slate-500 text-micro font-semibold">{t("premium.v2.chooseStyle.privatePerVehicle")}</span>
              </div>
              {/* U1 live price — one vehicle ÷ party = effective per-person. */}
              <p className="mt-1.5 text-micro font-semibold tabular-nums text-emerald-700">
                {t("premium.v2.chooseStyle.perPersonForParty", {
                  perPerson: formatPrice(Math.round(CHOOSE_STYLE_CARD_USD.private.list / party)),
                  count: party,
                })}
              </p>
            </div>

            <V0ShadcnButton
              asChild
              size="lg"
              className={cn(homeBtnPrimary, "mt-4")}
            >
              <Link
                href={withParty(HOME_CTA_PRIVATE_LIST_HREF)}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_private_custom" });
                  analytics.homeTourTypeCardClick({ type: "private", party });
                }}
              >
                {t("premium.v2.chooseStyle.privateCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </motion.div>

          {/* Bus — white pod with subtle mint warm-light (matches Private card) */}
          <motion.div
            variants={REVEAL_ITEM_VARIANTS}
            className="group relative w-[68vw] flex-none snap-start overflow-hidden rounded-card border border-emerald-100/60 bg-gradient-to-b from-white via-white to-emerald-50/40 p-4 md:p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_1px_2px_rgba(15,23,42,0.04),0_8px_22px_-12px_rgba(16,122,87,0.10),0_18px_36px_-18px_rgba(15,23,42,0.12)] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-emerald-200/75 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.95),0_2px_4px_rgba(15,23,42,0.05),0_10px_28px_-12px_rgba(16,122,87,0.16),0_22px_42px_-18px_rgba(15,23,42,0.16)] flex flex-col motion-reduce:hover:translate-y-0 motion-reduce:transition-none md:w-auto"
          >
            <div className="flex items-center justify-between mb-4 mt-1">
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-emerald-50/70 border border-emerald-100/70 flex items-center justify-center">
                <Bus className="w-4 h-4 md:w-5 md:h-5 text-slate-700" />
              </div>
              <span className="text-micro font-bold text-slate-700 bg-white/70 border border-emerald-100/60 px-2.5 py-1 rounded-full tracking-wide backdrop-blur-[2px]">
                {t("premium.v2.chooseStyle.busBadge")}
              </span>
            </div>

            <h3 className="text-base md:text-lg font-bold text-slate-900 tracking-tight mb-1">
              {t("premium.v2.chooseStyle.busTitle")}
            </h3>
            <p className="text-caption text-slate-600 mb-3 leading-relaxed line-clamp-3 flex-1">
              {t("premium.v2.chooseStyle.busDesc")}
            </p>

            <div className="mb-4">
              <p className="text-micro text-slate-400 mb-0.5 uppercase tracking-wider">{t("premium.v2.chooseStyle.from")}</p>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight">
                  {formatPrice(CHOOSE_STYLE_CARD_USD.bus.from)}
                </span>
                <span className="text-slate-500 text-micro font-semibold">{t("premium.v2.chooseStyle.busPerPerson")}</span>
              </div>
              {/* U1 live price — per-person × party = total for the group. */}
              <p className="mt-1.5 text-micro font-semibold tabular-nums text-emerald-700">
                {t("premium.v2.chooseStyle.totalForParty", {
                  total: formatPrice(CHOOSE_STYLE_CARD_USD.bus.from * party),
                  count: party,
                })}
              </p>
            </div>

            <V0ShadcnButton
              asChild
              size="lg"
              className={cn(homeBtnPrimary, "mt-4")}
            >
              <Link
                href={withParty(HOME_CTA_BUS_LIST_HREF)}
                onClick={() => {
                  analytics.homeCtaClick({ source: "choose_style_browse_bus" });
                  analytics.homeTourTypeCardClick({ type: "bus", party });
                }}
              >
                {t("premium.v2.chooseStyle.busCta")}
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Link>
            </V0ShadcnButton>
          </motion.div>
        </div>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-slate-50 via-slate-50/65 to-transparent md:hidden"
          />
        </div>
        <SnapScrollDots containerRef={scrollRef} count={3} />
      </motion.div>
    </section>
  );
}
