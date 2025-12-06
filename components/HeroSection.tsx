"use client";

import { useState, useEffect } from "react";

const heroImages = [
  {
    id: 1,
    image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=1920&q=80",
    title: "Discover Amazing Korea",
    subtitle: "Direct connection to trusted Korea tours",
  },
  {
    id: 2,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=1920&q=80",
    title: "Explore Jeju Island",
    subtitle: "Natural wonders and cultural experiences",
  },
  {
    id: 3,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=1920&q=80",
    title: "Experience Busan",
    subtitle: "Coastal beauty and vibrant culture",
  },
];

export default function HeroSection() {
  const [currentIndex, setCurrentIndex] = useState(0);

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
    <div className="relative h-[400px] sm:h-[500px] md:h-[600px] overflow-hidden">
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
      <div className="absolute inset-0 flex items-center">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-3 sm:mb-4 drop-shadow-lg leading-tight">
              {heroImages[currentIndex].title}
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl text-white/90 mb-6 sm:mb-8 drop-shadow-md">
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
              className="px-6 py-3 sm:px-8 sm:py-4 bg-blue-600 hover:bg-blue-700 text-white text-sm sm:text-base font-semibold rounded-xl transition-all duration-200 shadow-xl hover:shadow-2xl transform hover:scale-105 drop-shadow-lg"
            >
              Find My Day Tour
            </button>
          </div>
        </div>
      </div>

      {/* Dots Indicator */}
      <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 flex gap-2">
        {heroImages.map((_, index) => (
          <button
            key={index}
            onClick={() => goToSlide(index)}
            className={`w-2.5 h-2.5 rounded-full transition-all ${
              index === currentIndex
                ? "bg-white w-8"
                : "bg-white/50 hover:bg-white/75"
            }`}
            aria-label={`Go to slide ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

