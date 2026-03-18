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
    <section className="py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8 bg-white" aria-labelledby="classic-bus-heading">
      <div className="container mx-auto mb-4">
        <h2 id="classic-bus-heading" className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900">
          {COPY.fallback.title}
        </h2>
      </div>
      <HomeTourSections />
    </section>
  );
}
