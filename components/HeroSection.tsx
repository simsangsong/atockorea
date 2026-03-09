"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "@/lib/i18n";

const DESTINATION_OPTIONS = [
  { value: "Seoul", labelKey: "home.hero.destinations.seoul" as const },
  { value: "Busan", labelKey: "home.hero.destinations.busan" as const },
  { value: "Jeju", labelKey: "home.hero.destinations.jeju" as const },
];

function formatDateForInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export default function HeroSection() {
  const t = useTranslations();
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState("");
  const [travelers, setTravelers] = useState(1);

  const minDate = useMemo(() => formatDateForInput(new Date()), []);

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

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (destination) params.set("city", destination);
    if (date) params.set("date", date);
    if (travelers > 0) params.set("people", String(travelers));
    router.push(`/tours?${params.toString()}`);
  };

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

      {/* 검색 폼 — 히어로 바로 아래 (기능 유지) */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 -mt-4 md:-mt-6 relative z-10">
        <form
          onSubmit={handleSearch}
          className="max-w-3xl mx-auto flex flex-col sm:flex-row flex-wrap gap-2 p-3 sm:p-4 bg-white rounded-xl shadow-lg border border-gray-100"
        >
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="hero-destination" className="sr-only">{t("home.hero.destination")}</label>
            <select
              id="hero-destination"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
              aria-label={t("home.hero.destination")}
            >
              <option value="">{t("home.hero.destinationPlaceholder")}</option>
              {DESTINATION_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="hero-date" className="sr-only">{t("home.hero.travelDate")}</label>
            <input
              id="hero-date"
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
              aria-label={t("home.hero.travelDate")}
            />
          </div>
          <div className="w-24 min-w-[80px]">
            <label htmlFor="hero-travelers" className="sr-only">{t("home.hero.travelers")}</label>
            <input
              id="hero-travelers"
              type="number"
              min={1}
              max={99}
              value={travelers}
              onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-gray-50 text-gray-900 text-sm font-medium focus:ring-2 focus:ring-blue-400 outline-none"
              aria-label={t("home.hero.travelers")}
            />
          </div>
          <div className="w-full sm:w-auto">
            <button
              type="submit"
              className="w-full sm:w-auto px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-lg transition-colors shadow focus:ring-2 focus:ring-blue-400 focus:ring-offset-2"
            >
              {t("home.hero.findTours")}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
