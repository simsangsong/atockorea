"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Network, MapPin, ShieldCheck, Star } from "lucide-react";
import { COPY } from "@/src/design/copy";
import { tokens } from "@/src/design/tokens";
import { analytics } from "@/src/design/analytics";

const CTA_HREF = "/custom-join-tour";

const HERO_IMAGES = [
  { id: 1, image: "/images/hero/jeju-hero.jpg", alt: "Jeju" },
  { id: 2, image: "/images/hero/busan-hero.jpg", alt: "Busan" },
  { id: 3, image: "/images/hero/seoul-hero.jpg", alt: "Seoul" },
];

const BADGE_ORANGE = "#E85D22";

/** Value props: icon + title (bold) + subtitle (regular), matching reference layout. */
const VALUE_PROPS = [
  { icon: Network, title: COPY.hero.trust[0], subtitle: COPY.hero.valuePropSubtitles[0], circle: "bg-orange-50", iconColor: "text-orange-500" },
  { icon: MapPin, title: COPY.hero.trust[1], subtitle: COPY.hero.valuePropSubtitles[1], circle: "bg-sky-50", iconColor: "text-sky-500" },
  { icon: ShieldCheck, title: COPY.hero.trust[3], subtitle: COPY.hero.valuePropSubtitles[2], circle: "bg-emerald-50", iconColor: "text-emerald-500" },
] as const;

export default function HeroPremium() {
  const [currentIndex, setCurrentIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % HERO_IMAGES.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative w-full" aria-label="Hero">
      {/* 1. Background: dark gradient (darker top/bottom, lighter middle), badge + headline + rating */}
      <div className="relative w-full h-[380px] sm:h-[450px] lg:h-[550px] overflow-hidden rounded-b-[40px] md:mx-4 bg-[#0A1F44]">
        <div className="relative w-full h-full">
          {HERO_IMAGES.map((item, index) => (
            <div
              key={item.id}
              className={`absolute inset-0 transition-opacity duration-1000 ease-out ${
                index === currentIndex ? "opacity-100" : "opacity-0"
              }`}
            >
              <div
                className="w-full h-full bg-cover bg-center"
                style={{ backgroundImage: `url(${item.image})` }}
              />
            </div>
          ))}
        </div>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "linear-gradient(to bottom, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.28) 40%, rgba(0,0,0,0.28) 60%, rgba(0,0,0,0.6) 100%)",
          }}
          aria-hidden
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-4 pt-4 sm:pt-10">
          <span
            className="text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest px-4 py-2 rounded-full mb-3 sm:mb-4 shadow-[0_2px_8px_rgba(0,0,0,0.15)]"
            style={{ backgroundColor: BADGE_ORANGE }}
          >
            {COPY.hero.badge}
          </span>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.3)] px-2 max-w-4xl leading-tight">
            {COPY.hero.headline}
          </h1>
          <div className="flex items-center justify-center gap-2 sm:gap-3 text-white/95">
            <div className="flex items-center gap-0.5 text-amber-400">
              {[1, 2, 3, 4, 5].map((i) => (
                <Star key={i} className="w-4 h-4 sm:w-5 sm:h-5 fill-current" />
              ))}
            </div>
            <span className="text-base sm:text-lg font-bold">5.0</span>
            <span className="text-xs sm:text-sm font-normal opacity-90">(20 Reviews)</span>
          </div>
        </div>

        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 items-center z-10">
          {HERO_IMAGES.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => setCurrentIndex(index)}
              className={`rounded-full transition-all duration-200 ${
                index === currentIndex ? "bg-white w-2.5 h-2 sm:w-3 sm:h-2" : "bg-white/50 w-2 h-2 hover:bg-white/70"
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* 2. Floating card: 32px radius, soft diffuse shadow, generous padding, title + subtitle per row */}
      <div className="relative w-full -mt-16 sm:-mt-24 lg:-mt-32 px-4 sm:px-6 lg:px-8 z-10">
        <div className="w-full max-w-4xl mx-auto">
          <div
            className="rounded-[32px] bg-white p-6 sm:p-8 md:p-10 border border-neutral-100/80"
            style={{ boxShadow: "0 25px 50px -12px rgba(0,0,0,0.12), 0 12px 24px -8px rgba(0,0,0,0.08)" }}
          >
            <p className="text-sm sm:text-base text-neutral-600 font-normal leading-snug mb-6 sm:mb-8">
              {COPY.hero.subCard}
            </p>

            <ul className="space-y-6 sm:space-y-8 mb-8 sm:mb-10">
              {VALUE_PROPS.map(({ icon: Icon, title, subtitle, circle, iconColor }) => (
                <li key={title} className="flex items-start gap-4 sm:gap-5">
                  <div className={`flex-shrink-0 w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center ${circle}`}>
                    <Icon className={`w-5 h-5 sm:w-6 sm:h-6 ${iconColor}`} aria-hidden />
                  </div>
                  <div className="min-w-0 pt-0.5">
                    <p className="font-bold text-base sm:text-lg text-neutral-900 leading-tight">
                      {title}
                    </p>
                    <p className="text-sm sm:text-base text-neutral-500 font-normal mt-1 leading-snug">
                      {subtitle}
                    </p>
                  </div>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3">
              <Link
                href={CTA_HREF}
                className="inline-flex items-center justify-center font-bold min-h-[52px] px-8 py-3.5 text-base rounded-2xl text-white shadow-lg hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-neutral-100 w-full sm:w-auto sm:px-10 transition-opacity"
                style={{ backgroundColor: tokens.color.brand.blue }}
                onClick={() => analytics.heroFormStart()}
              >
                {COPY.hero.cta}
              </Link>
              <p className="text-xs sm:text-sm text-neutral-500 font-normal">
                {COPY.hero.trustCta}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
