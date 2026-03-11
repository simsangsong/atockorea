"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "@/lib/i18n";

export default function HeroSection() {
  const t = useTranslations();
  const [currentIndex, setCurrentIndex] = useState(0);

  const heroImages = useMemo(
    () => [
      { id: 1, image: "/images/hero/jeju-hero.jpg", title: t("home.hero.exploreJeju") },
      { id: 2, image: "/images/hero/busan-hero.jpg", title: t("home.hero.experienceBusan") },
      { id: 3, image: "/images/hero/seoul-hero.jpg", title: t("home.hero.discoverKorea") },
    ],
    [t]
  );

  const currentSlide = heroImages[currentIndex];

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, [heroImages.length]);

  const goToSlide = (index: number) => setCurrentIndex(index);

  return (
    <section className="relative">
      {/* Hero: 앱과 동일 — 이미지 + 어두운 오버레이 + 좌하단 타이틀/서브타이틀 + 도트 */}
      <div className="relative w-full aspect-video md:aspect-[4/1] overflow-hidden md:rounded-b-2xl md:mx-4 md:shadow-xl">
        <div className="relative w-full h-full">
          {heroImages.map((item, index) => (
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
                <div className="absolute inset-0 bg-black/40" aria-hidden />
              </div>
            </div>
          ))}
        </div>

        {/* 텍스트 좌하단 (앱 스타일) */}
        <div className="absolute inset-0 flex items-end justify-start">
          <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-6 pt-4 md:pb-8 md:pt-6">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white leading-tight drop-shadow-[0_1px_3px_rgba(0,0,0,0.5)]">
              {currentSlide?.title}
            </h1>
            <p className="text-sm sm:text-base text-white/95 mt-1 drop-shadow-[0_1px_2px_rgba(0,0,0,0.4)]">
              {t("home.hero.searchTitle")}
            </p>
          </div>
        </div>

        {/* Dots — 하단 중앙 */}
        <div className="absolute bottom-2 md:bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 sm:gap-2 items-center">
          {heroImages.map((_, index) => (
            <button
              key={index}
              type="button"
              onClick={() => goToSlide(index)}
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
