"use client";

import { useCopy } from "@/lib/i18n";

export default function HowItWorksSection() {
  const copy = useCopy();
  const steps = [
    { label: copy.howItWorks.step1, step: 1 },
    { label: copy.howItWorks.step2, step: 2 },
    { label: copy.howItWorks.step3, step: 3 },
    { label: copy.howItWorks.step4, step: 4 },
  ] as const;

  return (
    <section className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 bg-white" aria-labelledby="how-it-works-heading">
      <div className="container mx-auto max-w-4xl">
        <h2 id="how-it-works-heading" className="text-xl md:text-2xl font-bold text-[#1A1A1A] mb-8 text-center">
          {copy.howItWorks.title}
        </h2>
        <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map(({ step, label }) => (
            <li
              key={step}
              className="flex flex-col items-center text-center p-4 rounded-xl bg-[#F5F7FA] border border-[#E1E5EA]"
            >
              <span
                className="flex-shrink-0 w-10 h-10 rounded-full bg-[#1E4EDF] text-white flex items-center justify-center text-lg font-bold mb-3"
                aria-hidden
              >
                {step}
              </span>
              <span className="text-base font-medium text-[#1A1A1A]">{label}</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
