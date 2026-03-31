"use client";

import { useCopy } from "@/lib/i18n";

export default function ReviewsSection() {
  const copy = useCopy();
  return (
    <section className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 bg-white" aria-labelledby="reviews-heading">
      <div className="container mx-auto max-w-4xl">
        <h2 id="reviews-heading" className="text-xl md:text-2xl font-bold text-[#1A1A1A] mb-8 text-center">
          {copy.reviews.title}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          {copy.reviews.quotes.map((quote, i) => (
            <blockquote
              key={i}
              className="p-4 rounded-xl bg-[#F5F7FA] border border-[#E1E5EA] text-[#1A1A1A] text-base leading-relaxed"
            >
              &ldquo;{quote}&rdquo;
            </blockquote>
          ))}
        </div>
      </div>
    </section>
  );
}
