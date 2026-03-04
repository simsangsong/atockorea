"use client";

import Image from "next/image";
import { useTranslations } from "@/lib/i18n";
import { useMemo } from "react";
import { useRouter } from "next/navigation";

export default function DestinationsCards() {
  const t = useTranslations();
  const router = useRouter();
  
  const destinations = useMemo(() => [
    {
      id: 1,
      name: t('home.destinations.jeju'),
      description: t('home.destinations.jejuDesc'),
      image: "/images/destinations/jeju-card.jpg", // 제주 - 한라산 설경
      available: true,
      isLightImage: true, // 흰색 배경 이미지 플래그
      city: 'Jeju',
    },
    {
      id: 2,
      name: t('home.destinations.seoul'),
      description: t('home.destinations.seoulDesc'),
      image: "/images/destinations/seoul-card.jpg", // 서울 - 경복궁 야경
      available: true,
      isLightImage: false,
      city: 'Seoul',
    },
    {
      id: 3,
      name: t('home.destinations.busan'),
      description: t('home.destinations.busanDesc'),
      image: "/images/destinations/busan-card.jpg", // 부산 - 감천문화마을
      available: true,
      isLightImage: false,
      city: 'Busan',
    },
  ], [t]);

  const handleDestinationClick = (city: string) => {
    router.push(`/tours?city=${city}`);
  };
  
  return (
    <section className="pt-6 pb-12 md:pt-8 md:pb-14 bg-gradient-to-b from-white via-slate-50/20 to-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500 bg-clip-text text-transparent">
            {t('home.destinations.title')}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {t('home.destinations.subtitle')}
          </p>
        </div>
        <div className="overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-custom -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-3 md:gap-4 min-w-max md:min-w-0 md:justify-center">
            {destinations.map((destination) => (
              <button
                type="button"
                key={destination.id}
                onClick={() => handleDestinationClick(destination.city)}
                className="group relative flex-shrink-0 w-[40vw] sm:w-36 md:w-[23.8rem] lg:w-[27.2rem] overflow-hidden rounded-xl transition-all duration-300 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 snap-start cursor-pointer text-left bg-white border border-slate-200/70 shadow-[0_2px_12px_rgba(0,0,0,0.06)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.1)] hover:border-slate-200"
              >
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500 z-10" />
                <div className="relative aspect-[4/3] overflow-hidden">
                  <Image
                    src={destination.image}
                    alt={destination.name}
                    fill
                    sizes="(max-width: 640px) 40vw, (max-width: 768px) 144px, (max-width: 1024px) 381px, 435px"
                    className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
                  />
                  <div
                    className={`absolute inset-0 ${
                      destination.isLightImage
                        ? 'bg-gradient-to-t from-black/80 via-black/25 to-transparent'
                        : 'bg-gradient-to-t from-black/70 via-black/20 to-transparent'
                    }`}
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-2.5 sm:p-3">
                    <h3 className="text-sm sm:text-base font-bold text-white tracking-tight drop-shadow-md leading-tight">
                      {destination.name}
                    </h3>
                    <p className="text-[10px] sm:text-xs text-white/90 mt-0.5 line-clamp-2 drop-shadow-sm">
                      {destination.description}
                    </p>
                    <span className="inline-flex items-center gap-1 mt-1.5 text-white/90 text-[10px] font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                      {t('home.destinations.viewTours')}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" /></svg>
                    </span>
                  </div>
                  {destination.available && (
                    <span className="absolute top-2 right-2 px-1.5 py-0.5 bg-white/90 text-slate-700 text-[9px] font-semibold rounded-full shadow-sm">
                      {t('home.destinations.available')}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

