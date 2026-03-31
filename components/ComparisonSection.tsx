"use client";

import { useCopy } from "@/lib/i18n";

export default function ComparisonSection() {
  const copy = useCopy();
  return (
    <section className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 bg-white" aria-labelledby="comparison-heading">
      <div className="container mx-auto max-w-4xl">
        <h2 id="comparison-heading" className="text-xl md:text-2xl font-semibold text-gray-900 mb-8 text-center">
          {copy.comparison.title}
        </h2>
        <ul className="grid gap-3 sm:gap-4 sm:grid-cols-2 lg:grid-cols-1">
          {copy.comparison.bullets.map((text, i) => (
            <li
              key={i}
              className="flex items-start gap-3 p-4 rounded-xl bg-[#F5F7FA] border border-[#E1E5EA] text-[#1A1A1A]"
            >
              <span
                className="flex-shrink-0 w-6 h-6 rounded-full bg-[#1E4EDF] text-white flex items-center justify-center text-sm font-semibold"
                aria-hidden
              >
                ✓
              </span>
              <span className="text-base leading-relaxed">{text}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
