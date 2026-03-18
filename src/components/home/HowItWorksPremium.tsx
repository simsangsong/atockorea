"use client";

import { COPY } from "@/src/design/copy";

const STEPS = [
  { label: COPY.howItWorks.step1, step: 1 },
  { label: COPY.howItWorks.step2, step: 2 },
  { label: COPY.howItWorks.step3, step: 3 },
  { label: COPY.howItWorks.step4, step: 4 },
] as const;

export default function HowItWorksPremium() {
  return (
    <section
      className="py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8 bg-white"
      aria-labelledby="how-it-works-premium-heading"
    >
      <div className="container mx-auto max-w-4xl">
        <h2
          id="how-it-works-premium-heading"
          className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-4 sm:mb-6 text-center"
        >
          {COPY.howItWorks.title}
        </h2>
        <ol className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {STEPS.map(({ step, label }) => (
            <li
              key={step}
              className="flex flex-col items-center text-center p-4 rounded-xl bg-[#F5F7FA] border border-[#E1E5EA]"
            >
              <span
                className="flex-shrink-0 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-[#1E4EDF] text-white flex items-center justify-center text-base sm:text-lg font-bold mb-2 sm:mb-3 tabular-nums"
                aria-hidden
              >
                {step}
              </span>
              <span className="text-xs sm:text-sm font-medium text-slate-800 leading-snug">
                {label}
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
