"use client";

import Link from "next/link";
import { COPY } from "@/src/design/copy";

const CTA_HREF = "/custom-join-tour";

export default function FinalCtaPremium() {
  return (
    <section
      className="py-8 sm:py-10 md:py-14 px-4 sm:px-6 lg:px-8 bg-[#0A1F44]"
      aria-labelledby="final-cta-premium-heading"
    >
      <div className="container mx-auto max-w-2xl text-center">
        <h2
          id="final-cta-premium-heading"
          className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight mb-5 sm:mb-6 leading-snug"
        >
          {COPY.finalCta.title}
        </h2>
        <Link
          href={CTA_HREF}
          className="inline-flex items-center justify-center font-semibold min-h-[44px] px-6 sm:px-8 py-3 text-base rounded-full bg-[#1E4EDF] text-white shadow-lg shadow-[#1E4EDF]/30 hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0A1F44] transition-opacity duration-200 ease-out"
        >
          {COPY.finalCta.cta}
        </Link>
      </div>
    </section>
  );
}
