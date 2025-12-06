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
    <section className="py-16 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-12">
          <div className="inline-flex items-center gap-2 mb-3">
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-700 to-gray-900 bg-clip-text text-transparent mb-2">
            Popular Destinations
          </h2>
          <p className="text-sm sm:text-base text-gray-500 font-medium">
            Discover the most beautiful places in Korea
          </p>
          <div className="inline-flex items-center gap-2 mt-3">
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
            <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
            <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
          </div>
        </div>
        {/* Horizontal scroll for all devices */}
        <div className="overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-custom -mx-4 px-4 md:mx-0 md:px-0">
          <div className="flex gap-4 md:gap-6 lg:gap-8 min-w-max md:min-w-0">
            {destinations.map((destination) => (
              <div
                key={destination.id}
                className="group relative flex-shrink-0 w-[85vw] md:w-80 lg:w-96 overflow-hidden rounded-2xl shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:-translate-y-2 snap-start border border-white/40 backdrop-blur-sm"
              >
                <div className="relative h-64">
                  <Image
                    src={destination.image}
                    alt={destination.name}
                    fill
                    className="object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 right-0 p-6">
                    <h3 className="text-2xl font-bold text-white mb-1">
                      {destination.name}
                    </h3>
                    <p className="text-white/90 text-sm">
                      {destination.description}
                    </p>
                  </div>
                  {destination.available && (
                  <div className="absolute top-4 right-4">
                    <span className="px-3 py-1 bg-blue-600 text-white text-xs font-semibold rounded-full shadow-lg drop-shadow-md">
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

