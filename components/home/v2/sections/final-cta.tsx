"use client";

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import Link from "next/link";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ArrowRight, Clock, Users, ShieldCheck, CheckCircle, Sparkles } from "lucide-react";
import { analytics } from "@/src/design/analytics";
import {
  HOME_CTA_BROWSE_TOURS_HREF,
  HOME_CTA_MATCHING_HREF,
} from "@/lib/home/home-cta-routes";
import { useTranslations } from "@/lib/i18n";
import { homeBtnInverse } from "@/lib/home/home-button-classes";
import { cn } from "@/lib/utils";

const finalCtaPrimaryStyle: CSSProperties = {
  boxShadow: "var(--home-shadow-btn-primary)",
};

const finalCtaSecondaryOutlineDarkClassName =
  "h-auto w-full rounded-full border border-white/25 bg-transparent py-4 text-sm font-semibold text-white/90 transition-colors duration-300 hover:border-white/45 hover:bg-white/[0.06] hover:text-white";

export function FinalCTA() {
  const t = useTranslations("home");
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blockRef.current) {
      blockRef.current.classList.add("visible");
    }
  }, []);

  return (
    <section
      data-home-final-cta
      className="section-py-lg px-4"
      style={{ background: "linear-gradient(to bottom, #141008, #0E0B05)" }}
    >
      <div className="max-w-2xl mx-auto">
        <div ref={blockRef} className="relative scroll-animate text-center">
          <p className="mb-3 text-eyebrow text-amber-300 md:mb-4">
            {t("premium.v2.finalCtaBlock.eyebrow")}
          </p>
          <h2 className="mb-3 text-balance text-display text-white">
            {t("premium.v2.finalCtaBlock.title")}
          </h2>
          <p className="mb-8 text-h3 font-medium text-slate-300 md:mb-10">
            {t("premium.v2.finalCtaBlock.subtitle")}
          </p>

          {/* Trust strip: compact operational reassurance before the CTA. */}
          <div className="mb-8 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 md:mb-10 md:gap-x-7">
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-white/85">
              <ShieldCheck className="h-4 w-4 text-amber-300" aria-hidden />
              {t("premium.v2.finalCtaBlock.trust1Fallback")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-white/85">
              <CheckCircle className="h-4 w-4 text-white/55" aria-hidden />
              {t("premium.v2.finalCtaBlock.trust2")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-white/85">
              <Clock className="h-4 w-4 text-white/55" aria-hidden />
              {t("premium.v2.finalCtaBlock.trust3")}
            </span>
            <span className="inline-flex items-center gap-1.5 text-caption font-semibold text-white/85">
              <Users className="h-4 w-4 text-white/55" aria-hidden />
              {t("premium.v2.finalCtaBlock.trust4")}
            </span>
          </div>

          <div className="space-y-3 mx-auto md:max-w-md">
            <V0ShadcnButton
              asChild
              size="lg"
              className={homeBtnInverse}
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
              <span className="text-micro font-medium uppercase tracking-wider text-white/40">
                {t("premium.v2.finalCtaBlock.orDivider")}
              </span>
            </div>

            <V0ShadcnButton
              asChild
              variant="outline"
              size="lg"
              className={cn(finalCtaSecondaryOutlineDarkClassName)}
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

            {/* L4 (chatbot promo) — tertiary "ask the AI agent" affordance.
                Opens the global assistant in place instead of routing away. */}
            <button
              type="button"
              onClick={() => {
                analytics.homeCtaClick({ source: "chatbot_open_final_cta" });
                if (typeof window !== "undefined") {
                  window.dispatchEvent(
                    new CustomEvent("atc:open-assistant", { detail: { source: "final_cta" } }),
                  );
                }
              }}
              className="focus-ring group inline-flex w-full items-center justify-center gap-1.5 py-1.5 text-caption font-semibold text-white/55 transition-colors duration-200 hover:text-amber-300"
            >
              <Sparkles className="h-3.5 w-3.5 flex-none text-amber-300" aria-hidden />
              {t("premium.v2.finalCtaBlock.askAgent")}
              <ArrowRight className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
