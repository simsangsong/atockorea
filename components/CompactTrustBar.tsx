"use client";

import { useCopy } from "@/lib/i18n";

export default function CompactTrustBar() {
  const copy = useCopy();
  return (
    <section className="py-4 sm:py-6 -mt-2 md:-mt-4 relative z-10" aria-label="Why book with us">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
        <div className="bg-white/90 backdrop-blur-md border border-[#E1E5EA] rounded-2xl p-4 sm:p-5 shadow-[0_4px_10px_rgba(0,0,0,0.06)]">
          <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6">
            {copy.hero.trust.map((text, i) => (
              <span
                key={i}
                className="text-sm font-medium text-[#1A1A1A] text-center sm:text-left"
              >
                {text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
