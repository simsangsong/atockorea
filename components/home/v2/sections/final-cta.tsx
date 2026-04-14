"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { ArrowRight, Clock, Users, Star, CheckCircle } from "lucide-react";
import { analytics } from "@/src/design/analytics";
import {
  HOME_CTA_BROWSE_TOURS_HREF,
  HOME_CTA_CUSTOM_JOIN_HREF,
} from "@/lib/home/home-cta-routes";

export function FinalCTA() {
  const blockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (blockRef.current) {
      blockRef.current.classList.add("visible");
    }
  }, []);

  return (
    <section
      className="py-14 md:py-20 px-4"
      style={{ background: "linear-gradient(to bottom, rgba(252, 249, 245, 0.7), rgba(255, 250, 244, 0.5))" }}
    >
      <div className="max-w-2xl mx-auto">
        <div ref={blockRef} className="relative scroll-animate">
          <div className="absolute -inset-2 bg-gradient-to-br from-primary/5 via-sky-400/3 to-amber-400/2 rounded-[24px] blur-xl opacity-40" />

          <div className="relative bg-white/95 rounded-2xl border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.05)] p-6 md:p-10 text-center overflow-hidden">
            <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary/15 to-transparent" />

            <h2 className="text-2xl md:text-3xl font-bold text-slate-800 mb-2 tracking-tight leading-snug">
              Ready to plan your Jeju trip the smarter way?
            </h2>
            <p className="text-slate-600 text-[14px] md:text-[15px] mb-6 font-medium">
              Start with your preferences and discover the tour style that fits you best.
            </p>

            <div className="grid grid-cols-2 md:flex md:flex-wrap md:items-center md:justify-center gap-3 md:gap-5 mb-8 p-4 md:p-5 bg-slate-50/80 rounded-xl border border-slate-200/60">
              <div className="flex items-center gap-2 justify-center">
                <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">4.9 rated</span>
              </div>
              <div className="flex items-center gap-2 justify-center">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">Free cancellation</span>
              </div>
              <div className="flex items-center gap-2 justify-center md:col-span-2 md:col-auto">
                <Clock className="w-4 h-4 text-primary" />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">24hr response</span>
              </div>
              <div className="flex items-center gap-2 justify-center md:col-span-2 md:col-auto">
                <Users className="w-4 h-4 text-sky-600" />
                <span className="text-[12px] md:text-sm font-semibold text-slate-700">Deposit only</span>
              </div>
            </div>

            <div className="space-y-3">
              <V0ShadcnButton
                asChild
                size="lg"
                className="h-auto w-full bg-primary hover:bg-primary/95 text-white font-semibold py-6 md:py-7 rounded-xl text-[14px] md:text-base shadow-[0_4px_16px_rgba(30,58,95,0.18)] hover:shadow-[0_6px_20px_rgba(30,58,95,0.22)] transition-all duration-300"
              >
                <Link
                  href={HOME_CTA_CUSTOM_JOIN_HREF}
                  onClick={() => {
                    analytics.heroFormStart();
                  }}
                >
                  Find my best-fit tour
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </V0ShadcnButton>

              <div className="flex items-center gap-3 py-0.5">
                <div className="flex-1 h-px bg-slate-200/70" />
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">or</span>
                <div className="flex-1 h-px bg-slate-200/70" />
              </div>

              <V0ShadcnButton
                asChild
                variant="outline"
                size="lg"
                className="h-auto w-full border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-semibold py-5 md:py-6 rounded-xl text-[13px] md:text-sm transition-all duration-300"
              >
                <Link
                  href={HOME_CTA_BROWSE_TOURS_HREF}
                  onClick={() => {
                    analytics.heroFormStart();
                  }}
                >
                  Browse all tour styles
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Link>
              </V0ShadcnButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
