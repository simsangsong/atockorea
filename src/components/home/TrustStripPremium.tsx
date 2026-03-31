"use client";

import { useCopy } from "@/lib/i18n";

export default function TrustStripPremium() {
  const copy = useCopy();
  return (
    <section
      className="py-3 sm:py-5 -mt-1 md:-mt-4 relative z-10"
      aria-label="Why book with us"
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
        <div className="bg-white/95 backdrop-blur-sm border border-[#E1E5EA] rounded-xl sm:rounded-2xl px-4 py-3 sm:py-4 shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <ul className="flex flex-wrap items-center justify-center gap-x-3 sm:gap-x-5 gap-y-2 text-center sm:text-left list-none">
            {copy.hero.trust.map((text, i) => (
              <li key={i} className="flex items-center gap-x-3 sm:gap-x-5 shrink-0">
                {i > 0 && <span className="text-slate-300 text-sm" aria-hidden>·</span>}
                <span className="text-sm sm:text-base font-medium text-slate-800 tabular-nums leading-snug">
                  {text}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
