"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ArrowRight, Clock, Users, Star, CheckCircle } from "lucide-react";
import { analytics } from "@/src/design/analytics";
import {
  HOME_CTA_BROWSE_TOURS_HREF,
  HOME_CTA_MATCHING_HREF,
} from "@/lib/home/home-cta-routes";
import { useTranslations } from "@/lib/i18n";

const finalCtaPrimaryStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-primary)",
};

const finalCtaSecondaryStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-secondary)",
};

export function FinalCTA() {
  const t = useTranslations("home");
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blockRef.current) {
      blockRef.current.classList.add("visible");
    }
  }, []);

  return (
    <section data-home-final-cta className="py-14 md:py-20 px-4 bg-white">
      <div className="max-w-2xl mx-auto">
        <div ref={blockRef} className="relative scroll-animate">
          <div
            className="absolute -inset-2 rounded-card bg-amber-400/[0.04] opacity-60 blur-xl"
            aria-hidden
          />

          <div className="home-panel-elevated relative overflow-hidden p-6 text-center md:p-10">
            <div className="absolute left-1/4 right-1/4 top-0 h-px bg-gradient-to-r from-transparent via-slate-300/40 to-transparent" />

            <h2 className="mb-2 text-balance text-2xl font-bold leading-snug tracking-tight text-slate-800 md:text-3xl">
              {t("premium.v2.finalCtaBlock.title")}
            </h2>
            <p className="mb-6 text-[14px] font-medium text-slate-600 md:text-[15px]">
              {t("premium.v2.finalCtaBlock.subtitle")}
            </p>

            <div className="home-neutral-trust-tile home-neutral-trust-tile--compact mb-8 grid grid-cols-2 gap-3 p-4 md:flex md:flex-wrap md:items-center md:justify-center md:gap-5 md:p-5">
              <div className="flex items-center gap-2 justify-center">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" aria-hidden />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust1Fallback")}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle className="w-4 h-4 text-slate-500" />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust2")}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center md:col-span-2 md:col-auto">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust3")}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center md:col-span-2 md:col-auto">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust4")}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <V0ShadcnButton
                asChild
                size="lg"
                className="h-auto w-full rounded-xl bg-primary py-6 text-[14px] font-semibold text-white transition-all duration-300 hover:bg-primary/95 md:py-7 md:text-base"
                style={finalCtaPrimaryStyle}
              >
                <Link
                  href={HOME_CTA_MATCHING_HREF}
                  onClick={() => {
                    analytics.homeCtaClick({ source: "final_cta_custom_join" });
                  }}
                >
                  {t("premium.v2.finalCtaBlock.primaryCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </V0ShadcnButton>

              <div className="flex items-center gap-3 py-0.5">
                <div className="h-px flex-1 bg-slate-200/70" />
                <span className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  {t("premium.v2.finalCtaBlock.orDivider")}
                </span>
                <div className="h-px flex-1 bg-slate-200/70" />
              </div>

              <V0ShadcnButton
                asChild
                variant="outline"
                size="lg"
                className="h-auto w-full rounded-xl border-slate-200/75 bg-white/95 py-5 text-[13px] font-semibold text-slate-800 backdrop-blur-sm transition-all duration-300 hover:border-slate-300/90 hover:bg-white md:py-6 md:text-sm"
                style={finalCtaSecondaryStyle}
              >
                <Link
                  href={HOME_CTA_BROWSE_TOURS_HREF}
                  onClick={() => {
                    analytics.homeCtaClick({ source: "final_cta_browse_styles" });
                  }}
                >
                  {t("premium.v2.finalCtaBlock.secondaryCta")}
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </V0ShadcnButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
