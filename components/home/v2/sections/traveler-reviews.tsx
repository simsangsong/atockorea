"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { Star, ChevronRight, Award } from "lucide-react";
import { V0ShadcnButton } from "@/components/home/v2/ui/v0-shadcn-button";
import { HOME_CTA_REVIEWS_HREF } from "@/lib/home/home-cta-routes";

/**
 * TEMPORARY (migration): illustrative quotes for layout only — replace with live reviews / CMS.
 */
const REVIEWS_PLACEHOLDER: {
  quote: string;
  name: string;
  initials: string;
  location: string;
  tour: string;
  rating: number;
  date: string;
  accent: "primary" | "sky" | "emerald";
}[] = [
  {
    quote: "They named our hotel pickup zone and the exact wait point—no curb guesswork.",
    name: "Sarah M.",
    initials: "SM",
    location: "Singapore",
    tour: "East Jeju",
    rating: 5,
    date: "March 2024",
    accent: "primary",
  },
  {
    quote: "First Jeju trip; the route was full, but the day never felt like a sprint.",
    name: "James K.",
    initials: "JK",
    location: "Australia",
    tour: "West Jeju",
    rating: 5,
    date: "February 2024",
    accent: "sky",
  },
  {
    quote: "The small group size made it feel personal. Guide knew exactly when to give us space.",
    name: "Yuki T.",
    initials: "YT",
    location: "Japan",
    tour: "East Jeju",
    rating: 5,
    date: "January 2024",
    accent: "emerald",
  },
];

function avatarBg(accent: (typeof REVIEWS_PLACEHOLDER)[number]["accent"]) {
  switch (accent) {
    case "sky":
      return "bg-sky-500 shadow-md shadow-sky-500/25";
    case "emerald":
      return "bg-emerald-500 shadow-md shadow-emerald-500/25";
    default:
      return "bg-primary shadow-md shadow-primary/25";
  }
}

export function TravelerReviews() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (containerRef.current) {
      const children = containerRef.current.querySelectorAll("[data-review]");
      children.forEach((child, index) => {
        window.setTimeout(() => {
          child.classList.add("visible");
        }, index * 100);
      });
    }
  }, []);

  const barClass = (accent: (typeof REVIEWS_PLACEHOLDER)[number]["accent"]) => {
    switch (accent) {
      case "sky":
        return "bg-sky-500";
      case "emerald":
        return "bg-emerald-500";
      default:
        return "bg-primary";
    }
  };

  return (
    <section className="py-14 md:py-20 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10 md:mb-12">
          <h2 className="text-2xl md:text-3xl lg:text-4xl font-bold text-slate-900 tracking-tight mb-3">What travelers say</h2>

          <div className="flex items-center justify-center gap-3 md:gap-5 mb-4 px-4 py-2.5 bg-slate-50/80 rounded-xl border border-slate-200/60 w-fit mx-auto">
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span className="text-[11px] font-bold text-slate-700">4.9 rating</span>
            </div>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-semibold text-slate-700">234 verified reviews</span>
            <span className="text-slate-300">·</span>
            <span className="text-[11px] font-semibold text-slate-700">Asia & Oceania</span>
          </div>

          <p className="text-slate-600 text-[14px] md:text-[15px] font-medium">Real voices about fit, clarity, and pacing.</p>
        </div>

        <div ref={containerRef} className="space-y-3 md:space-y-4">
          {REVIEWS_PLACEHOLDER.map((review, index) => (
            <div
              key={index}
              data-review
              className="group relative bg-white rounded-2xl p-5 md:p-6 border border-slate-200/70 shadow-[0_4px_24px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_28px_rgba(0,0,0,0.07)] transition-all duration-300 overflow-hidden scroll-animate"
            >
              <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${barClass(review.accent)} opacity-90`} />

              <div className="flex items-start justify-between mb-5 pl-1">
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-11 h-11 rounded-full flex items-center justify-center text-white text-xs font-bold ${avatarBg(review.accent)}`}
                  >
                    {review.initials}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{review.name}</p>
                    <p className="text-xs text-slate-500 font-medium">
                      {review.location} · {review.tour}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-0.5 flex-shrink-0">
                  {[...Array(review.rating)].map((_, i) => (
                    <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>

              <p className="relative text-[15px] md:text-[17px] text-slate-700 leading-[1.6] mb-5 pl-1">
                <span className="text-slate-300 text-lg mr-0.5">&ldquo;</span>
                {review.quote}
                <span className="text-slate-300 text-lg ml-0.5">&rdquo;</span>
              </p>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100/50 pl-1">
                <span className="text-[11px] text-slate-500 font-semibold uppercase tracking-[0.08em]">
                  {review.date}
                </span>
              </div>
            </div>
          ))}
        </div>

        <div className="text-center mt-8">
          <V0ShadcnButton
            asChild
            variant="outline"
            className="border-slate-200/70 bg-white text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-semibold px-6 py-2.5 rounded-xl transition-all shadow-sm hover:shadow-md inline-flex items-center gap-2 h-auto"
          >
            <Link href={HOME_CTA_REVIEWS_HREF}>
              <Award className="w-4 h-4 text-amber-500" />
              Explore all 234 verified reviews
              <ChevronRight className="w-4 h-4" />
            </Link>
          </V0ShadcnButton>
        </div>
      </div>
    </section>
  );
}
