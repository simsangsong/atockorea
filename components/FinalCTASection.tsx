"use client";

import Link from "next/link";
import { COPY } from "@/src/design/copy";

const CTA_HREF = "/custom-join-tour";

export default function FinalCTASection() {
  return (
    <section className="py-12 md:py-16 px-4 sm:px-6 lg:px-8 bg-[#0A1F44]" aria-labelledby="final-cta-heading">
      <div className="container mx-auto max-w-2xl text-center">
        <h2 id="final-cta-heading" className="text-xl md:text-2xl font-bold text-white mb-6">
          {COPY.finalCta.title}
        </h2>
        <Link
          href={CTA_HREF}
          className="inline-flex items-center justify-center font-semibold min-h-[44px] px-8 py-3 text-base rounded-lg bg-[#1E4EDF] text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0A1F44]"
        >
          {COPY.finalCta.cta}
        </Link>
      </div>
    </section>
  );
}
