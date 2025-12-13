"use client";

import Image from "next/image";

const destinations = [
  {
    id: 1,
    name: "Seoul",
    description: "Capital city with rich history",
    image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=800&q=80",
    available: true,
  },
  {
    id: 2,
    name: "Busan",
    description: "Coastal city with beautiful beaches",
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=800&q=80",
    available: true,
  },
  {
    id: 3,
    name: "Jeju Island",
    description: "Natural paradise and UNESCO sites",
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=800&q=80",
    available: true,
  },
];

export default function DestinationsCards() {
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
            Popular Destinations
          </h2>
          <p className="text-sm sm:text-base text-gray-500 font-medium">
            Discover the most beautiful places in Korea
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
                className="group relative flex-shrink-0 w-[59.5vw] md:w-64 lg:w-72 overflow-hidden rounded-xl md:rounded-2xl transition-all duration-300 transform hover:-translate-y-1 md:hover:-translate-y-2 snap-start border border-gray-200/40 md:border-gray-200/30 bg-white/5 backdrop-blur-sm shadow-[0_2px_20px_rgba(0,0,0,0.08),0_1px_8px_rgba(0,0,0,0.04)] md:shadow-[0_4px_30px_rgba(0,0,0,0.06),0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_40px_rgba(0,0,0,0.12),0_3px_16px_rgba(0,0,0,0.06)] md:hover:shadow-[0_8px_50px_rgba(0,0,0,0.1),0_4px_20px_rgba(0,0,0,0.05)]"
              >
                <div className="relative h-[179px] md:h-64">
                  <Image
                    src={destination.image}
                    alt={destination.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-3 md:p-6">
                    <h3 className="text-base md:text-2xl font-bold text-white mb-0.5 md:mb-1">
                      {destination.name}
                    </h3>
                    <p className="text-white/90 text-[10px] md:text-sm">
                      {destination.description}
                    </p>
                  </div>
                  {destination.available && (
                  <div className="absolute top-2 md:top-4 right-2 md:right-4">
                    <span className="px-1.5 md:px-3 py-0.5 md:py-1 bg-blue-600 text-white text-[9px] md:text-xs font-semibold rounded-full shadow-lg drop-shadow-md">
                      Available
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

