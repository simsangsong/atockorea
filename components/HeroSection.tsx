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
    <div className="relative w-full aspect-video md:aspect-[4/1] overflow-hidden md:rounded-b-2xl md:mx-4 md:shadow-xl">
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

      {/* Content Overlay: compact title + search (semi-transparent so hero image shows) */}
      <div className="absolute inset-0 flex items-end md:items-center">
        <div className="container mx-auto px-3 sm:px-6 lg:px-8 pb-4 pt-3 md:pb-8 md:pt-0">
          <div className="max-w-xl">
            <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white mb-2 sm:mb-3 drop-shadow-md leading-tight">
              {t("home.hero.searchTitle")}
            </h1>

            <form
              onSubmit={handleSearch}
              className="flex flex-col sm:flex-row flex-wrap gap-2 p-2.5 sm:p-3 rounded-lg bg-white/15 backdrop-blur-sm border border-white/25 shadow-lg"
            >
              <div className="w-20 sm:w-24">
                <label htmlFor="hero-destination" className="sr-only">{t("home.hero.destination")}</label>
                <select
                  id="hero-destination"
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md border border-white/40 bg-white/90 text-gray-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                  aria-label={t("home.hero.destination")}
                >
                  <option value="">{t("home.hero.destinationPlaceholder")}</option>
                  {DESTINATION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
                  ))}
                </select>
              </div>
              <div className="w-20 sm:w-24">
                <label htmlFor="hero-date" className="sr-only">{t("home.hero.travelDate")}</label>
                <input
                  id="hero-date"
                  type="date"
                  value={date}
                  min={minDate}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full px-2 py-1.5 rounded-md border border-white/40 bg-white/90 text-gray-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-400 focus:border-blue-400 outline-none"
                  aria-label={t("home.hero.travelDate")}
                />
              </div>
              <div className="w-20 sm:w-24">
                <label htmlFor="hero-travelers" className="sr-only">{t("home.hero.travelers")}</label>
                <input
                  id="hero-travelers"
                  type="number"
                  min={1}
                  max={99}
                  value={travelers}
                  onChange={(e) => setTravelers(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  className="w-full px-2 py-1.5 rounded-md border border-white/40 bg-white/90 text-gray-900 text-xs sm:text-sm font-medium focus:ring-2 focus:ring-blue-400 outline-none"
                  aria-label={t("home.hero.travelers")}
                />
              </div>
              <div className="w-full sm:w-auto">
                <button
                  type="submit"
                  className="w-full sm:w-auto px-4 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-semibold rounded-md transition-colors shadow focus:ring-2 focus:ring-blue-400 focus:ring-offset-1"
                >
                  {t("home.hero.findTours")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Dots indicator (small, ~1/3 size) */}
      <div className="absolute bottom-1.5 md:bottom-4 left-1/2 transform -translate-x-1/2 flex gap-0.5 sm:gap-1 items-center">
        {heroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`rounded-full transition-all ${
              index === currentIndex ? "w-2 h-1.5 sm:w-2 sm:h-1.5" : "w-1 h-1 sm:w-1.5 sm:h-1.5"
            } ${index === currentIndex ? "bg-white" : "bg-white/50 hover:bg-white/70"}`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}
