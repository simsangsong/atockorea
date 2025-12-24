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
    <section className="pt-6 pb-16 md:pt-8 md:pb-16 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-gray-900 via-blue-700 to-orange-700 bg-clip-text text-transparent mb-2">
            {t('home.destinations.title')}
          </h2>
          <p className="text-sm sm:text-base text-gray-500 font-medium">
            {t('home.destinations.subtitle')}
          </p>
          <div className="inline-flex items-center gap-2 mt-3">
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent"></div>
          </div>
        </div>
        {/* Horizontal scroll for all devices */}
        <div className="overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-custom -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-3 md:gap-6 lg:gap-8 min-w-max md:min-w-0">
            {destinations.map((destination) => (
              <div
                key={destination.id}
                onClick={() => handleDestinationClick(destination.city)}
                className="group relative flex-shrink-0 w-[59.5vw] md:w-64 lg:w-72 overflow-hidden rounded-xl md:rounded-2xl transition-all duration-300 transform hover:-translate-y-1 md:hover:-translate-y-2 snap-start border border-gray-200/40 md:border-gray-200/30 bg-white/5 backdrop-blur-sm shadow-[0_2px_20px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)] md:shadow-[0_4px_30px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_40px_rgba(0,0,0,0.12),0_3px_16px_rgba(0,0,0,0.06)] md:hover:shadow-[0_8px_50px_rgba(0,0,0,0.1),0_4px_20px_rgba(0,0,0,0.05)] cursor-pointer"
              >
                <div className="relative h-[179px] md:h-64">
                  <Image
                    src={destination.image}
                    alt={destination.name}
                    fill
                    sizes="(max-width: 768px) 59.5vw, 256px"
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  {/* 흰색 이미지(제주)의 경우 더 강한 그라디언트 오버레이 */}
                  <div 
                    className={`absolute inset-0 ${
                      destination.isLightImage 
                        ? 'bg-gradient-to-t from-black/85 via-black/50 to-black/20' 
                        : 'bg-gradient-to-t from-black/70 via-black/20 to-transparent'
                    }`} 
                  />
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-6">
                    <h3 
                      className={`text-base md:text-2xl font-bold mb-0.5 md:mb-1 ${
                        destination.isLightImage
                          ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.8),0_0_8px_rgba(0,0,0,0.6)]'
                          : 'text-white'
                      }`}
                    >
                      {destination.name}
                    </h3>
                    <p 
                      className={`text-[10px] md:text-sm ${
                        destination.isLightImage
                          ? 'text-white/95 drop-shadow-[0_1px_3px_rgba(0,0,0,0.8),0_0_6px_rgba(0,0,0,0.6)]'
                          : 'text-white/90'
                      }`}
                    >
                      {destination.description}
                    </p>
                  </div>
                  {destination.available && (
                  <div className="absolute top-2 md:top-4 right-2 md:right-4">
                    <span className="px-1.5 md:px-3 py-0.5 md:py-1 bg-blue-600 text-white text-[9px] md:text-xs font-semibold rounded-full shadow-lg drop-shadow-md">
                      {t('home.destinations.available')}
                    </span>
                  </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

