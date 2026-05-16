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
import { homeBtnPrimary, homeBtnSecondary } from "@/lib/home/home-button-classes";

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
    <section data-home-final-cta className="section-py-lg px-4 bg-white">
      <div className="max-w-2xl mx-auto">
        <div ref={blockRef} className="relative scroll-animate">
          <div className="home-panel-elevated relative overflow-hidden p-6 text-center md:p-10">
            <h2 className="mb-2 text-balance text-h2 text-slate-900">
              {t("premium.v2.finalCtaBlock.title")}
            </h2>
            <p className="mb-6 text-body font-medium text-slate-600">
              {t("premium.v2.finalCtaBlock.subtitle")}
            </p>

            <div className="home-neutral-trust-tile home-neutral-trust-tile--compact mb-8 grid grid-cols-2 gap-3 p-4 md:flex md:flex-wrap md:items-center md:justify-center md:gap-5 md:p-5">
              <div className="flex items-center gap-2 justify-center">
                <Star className="w-4 h-4 text-slate-500" aria-hidden />
                <span className="text-caption font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust1Fallback")}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle className="w-4 h-4 text-slate-500" />
                <span className="text-caption font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust2")}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center md:col-span-2 md:col-auto">
                <Clock className="w-4 h-4 text-slate-500" />
                <span className="text-caption font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust3")}
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center md:col-span-2 md:col-auto">
                <Users className="w-4 h-4 text-slate-500" />
                <span className="text-caption font-semibold text-slate-700">
                  {t("premium.v2.finalCtaBlock.trust4")}
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <V0ShadcnButton
                asChild
                size="lg"
                className={homeBtnPrimary}
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

              <div className="py-1.5 text-center">
                <span className="text-micro font-medium uppercase tracking-wider text-slate-400">
                  {t("premium.v2.finalCtaBlock.orDivider")}
                </span>
              </div>

              <V0ShadcnButton
                asChild
                variant="outline"
                size="lg"
                className={homeBtnSecondary}
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
