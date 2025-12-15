"use client";

import { useState, useEffect, useMemo } from "react";
import { useTranslations } from "@/lib/i18n";

export default function HeroSection() {
  const t = useTranslations();
  const [currentIndex, setCurrentIndex] = useState(0);

  const heroImages = useMemo(() => [
    {
      id: 1,
      image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1920&q=80",
      title: t('home.hero.discoverKorea'),
      subtitle: t('home.hero.directConnection'),
    },
    {
      id: 2,
      image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1920&q=80",
      title: t('home.hero.exploreJeju'),
      subtitle: t('home.hero.jejuSubtitle'),
    },
    {
      id: 3,
      image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1920&q=80",
      title: t('home.hero.experienceBusan'),
      subtitle: t('home.hero.busanSubtitle'),
    },
  ], [t]);

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  return (
    <div className="relative w-full aspect-video md:aspect-[4/1] overflow-hidden">
      {/* Image Carousel */}
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
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/40 to-transparent" />
            </div>
          </div>
        ))}
      </div>

      {/* Content Overlay */}
      <div className="absolute inset-0 flex items-end">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 pb-11 md:pb-16">
          <div className="max-w-2xl">
            <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4 drop-shadow-lg leading-tight">
              {heroImages[currentIndex].title}
            </h1>
            <p className="text-sm sm:text-base md:text-lg text-white/90 mb-4 sm:mb-6 drop-shadow-md">
              {heroImages[currentIndex].subtitle}
            </p>
            <button
              onClick={() => {
                // Scroll to top and trigger search
                window.scrollTo({ top: 0, behavior: 'smooth' });
                // Dispatch custom event to open search
                setTimeout(() => {
                  window.dispatchEvent(new CustomEvent('openSearch'));
                }, 300);
              }}
              className="px-3 py-1 sm:px-4 sm:py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-[10px] sm:text-[14px] font-semibold rounded-lg transition-all duration-200 shadow-lg hover:shadow-xl transform hover:scale-105 drop-shadow-lg"
            >
              {t('home.hero.findTour')}
            </button>
          </div>
        </div>
      </div>

      {/* Dots Indicator - Very small on mobile, original size on desktop */}
      <div className="absolute bottom-2 md:bottom-6 left-1/2 transform -translate-x-1/2 flex gap-1 md:gap-1.5">
        {heroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`rounded-full transition-all scale-50 md:scale-100 ${
              index === currentIndex
                ? 'w-[1px] h-[1px] md:w-8 md:h-2.5'
                : 'w-[1px] h-[1px] md:w-2.5 md:h-2.5'
            } ${
              index === currentIndex
                ? 'bg-white/30 md:bg-white'
                : 'bg-white/20 md:bg-white/50 hover:bg-white/75'
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

