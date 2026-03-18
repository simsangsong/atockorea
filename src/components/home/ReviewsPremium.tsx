"use client";

import { COPY } from "@/src/design/copy";

export default function ReviewsPremium() {
  return (
    <section
      className="py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8 bg-white"
      aria-labelledby="reviews-premium-heading"
    >
      <div className="container mx-auto max-w-4xl">
        <h2
          id="reviews-premium-heading"
          className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-4 sm:mb-6 text-center"
        >
          {COPY.reviews.title}
        </h2>
        <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
          {COPY.reviews.quotes.map((quote, i) => (
            <blockquote
              key={i}
              className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E1E5EA] text-slate-800 text-sm leading-relaxed"
            >
              &ldquo;{quote}&rdquo;
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
