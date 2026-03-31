"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useCopy } from "@/lib/i18n";
import { analytics } from "@/src/design/analytics";

const HERO_IMAGES = [
  { id: 1, image: "/images/hero/jeju-hero.jpg", alt: "Jeju" },
  { id: 2, image: "/images/hero/busan-hero.jpg", alt: "Busan" },
  { id: 3, image: "/images/hero/seoul-hero.jpg", alt: "Seoul" },
];

const CTA_HREF = "/custom-join-tour";

export default function HeroSection() {
  const copy = useCopy();
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative" aria-label="Hero">
      <div className="relative w-full aspect-video md:aspect-[21/8] overflow-hidden md:rounded-b-2xl md:mx-4 md:shadow-xl bg-[#0A1F44]">
        <div className="relative w-full h-full">
          {HERO_IMAGES.map((item, index) => (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-1000 ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${item.image})` }}
              >
                <div className="absolute inset-0 bg-[#0A1F44]/60" aria-hidden />
              </div>
            </div>
          ))}
        </div>

        <div className="absolute inset-0 flex flex-col justify-end">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-6 md:pb-8 md:pt-8">
            <div className="max-w-xl">
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
                {copy.hero.headline}
              </h1>
              <p className="text-sm sm:text-base text-white/95 mt-2 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
                {copy.hero.sub}
              </p>
              <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-xs sm:text-sm text-white/90" aria-label="Why book with us">
                {copy.hero.trust.map((text, i) => (
                  <li key={i}>{text}</li>
                ))}
              </ul>
              <Link
                href={CTA_HREF}
                className="mt-6 inline-flex items-center justify-center font-semibold min-h-[44px] px-6 py-3 text-base rounded-lg bg-[#1E4EDF] text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-[#0A1F44]"
                onClick={() => analytics.heroFormStart()}
              >
                {copy.hero.cta}
              </Link>
            </div>
          </div>
        </div>

        <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 items-center">
          {HERO_IMAGES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`rounded-full transition-all ${
                index === currentIndex ? "bg-white w-2.5 h-2 sm:w-3 sm:h-2" : "bg-white/50 w-2 h-2 sm:w-2 sm:h-2 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
