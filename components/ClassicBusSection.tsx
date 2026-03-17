"use client";

import { COPY } from "@/src/design/copy";
import HomeTourSections from "@/components/HomeTourSections";

/**
 * Wrapper that adds the spec title "Prefer a classic group tour instead?"
 * and renders the existing HomeTourSections unchanged.
 * Do not change HomeTourSections internals (section count, order, fetch URLs, params, or response handling).
 */
export default function ClassicBusSection() {
  return (
    <section className="pt-10 pb-6 px-4 sm:px-6 lg:px-8 bg-white" aria-labelledby="classic-bus-heading">
      <div className="container mx-auto mb-4">
        <h2 id="classic-bus-heading" className="text-xl md:text-2xl font-bold text-[#1A1A1A]">
          {COPY.fallback.title}
        </h2>
      </div>
      <HomeTourSections />
    </section>
  );
}
