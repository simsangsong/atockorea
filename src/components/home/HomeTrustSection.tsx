"use client";

import { ShieldCheck, Sparkles } from "lucide-react";
import { useSiteCopy } from "@/src/lib/use-site-copy";
import { GlassPanel } from "@/src/components/v0-skin";
import { HomeLandingSection } from "./HomeLandingSection";

/**
 * Trust pillars + review placeholder (no fabricated quotes). Ready for future API-driven reviews.
 */
export default function HomeTrustSection() {
  const COPY = useSiteCopy();
  const TRUST_LINES = COPY.hero.trust;
  return (
    <HomeLandingSection aria-labelledby="home-trust-heading">
      <div className="mx-auto max-w-4xl">
        <p className="text-center text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
          Trust & transparency
        </p>
        <h2
          id="home-trust-heading"
          className="mt-2 text-center text-2xl font-black tracking-tight text-slate-900 sm:text-[1.75rem]"
        >
          Why book with AtoC Korea
        </h2>

        <ul className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {TRUST_LINES.map((line) => (
            <li key={line}>
              <GlassPanel
                variant="soft"
                className="flex items-start gap-3 p-4 sm:p-5"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-50 text-blue-600" aria-hidden>
                  <Sparkles className="h-4 w-4" />
                </span>
                <p className="text-sm font-medium leading-snug text-slate-800">{line}</p>
              </GlassPanel>
            </li>
          ))}
        </ul>

        <GlassPanel variant="soft" className="mt-6 p-5 text-center sm:p-6">
          <div className="mx-auto flex max-w-md flex-col items-center gap-2">
            <ShieldCheck className="h-8 w-8 text-slate-400" aria-hidden />
            <p className="text-sm font-semibold text-slate-800">Guest reviews</p>
            <p className="text-xs leading-relaxed text-slate-500">
              Verified traveler reviews will appear here when available. Your booking and tour experience always follow
              our published policies.
            </p>
          </div>
        </GlassPanel>
      </div>
    </HomeLandingSection>
  );
}
