"use client";

import TourCard from "./TourCard";

const seasonalTours = [
  {
    id: 101,
    title: "Winter Jeju Snow & Tangerine Experience",
    location: "Jeju",
    type: "Seasonal",
    price: 95,
    image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=600&q=80",
    badge: "Winter Special",
    rating: 4.8,
    reviewCount: 456,
  },
  {
    id: 102,
    title: "Spring Cherry Blossom Tour Seoul",
    location: "Seoul",
    type: "Seasonal",
    price: 75,
    image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80",
    badge: "Spring Special",
    rating: 4.9,
    reviewCount: 892,
  },
  {
    id: 103,
    title: "Summer Beach & Water Sports Busan",
    location: "Busan",
    type: "Seasonal",
    price: 85,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80",
    badge: "Summer Special",
    rating: 4.7,
    reviewCount: 623,
  },
  {
    id: 104,
    title: "Autumn Foliage & Hot Springs Jeju",
    location: "Jeju",
    type: "Seasonal",
    price: 90,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Autumn Special",
    rating: 4.9,
    reviewCount: 334,
  },
  {
    id: 105,
    title: "New Year Sunrise Tour Seongsan",
    location: "Jeju",
    type: "Seasonal",
    price: 100,
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80",
    badge: "New Year Special",
    rating: 5.0,
    reviewCount: 278,
  },
  {
    id: 106,
    title: "Valentine's Day Couple Tour",
    location: "Seoul",
    type: "Seasonal",
    price: 120,
    image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80",
    badge: "Romantic",
    rating: 4.8,
    reviewCount: 189,
  },
];

export default function SeasonalTours() {
  return (
    <section className="py-8 sm:py-12 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title Section */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
            Seasonal Specials
          </h2>
          <p className="text-sm text-gray-500">
            Limited-time offers for the best seasonal experiences
          </p>
        </div>
        
        {/* Horizontal Scrollable List */}
        <div className="overflow-x-auto pb-3 scrollbar-custom -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 sm:gap-4 min-w-max sm:min-w-0">
            {seasonalTours.map((tour) => (
              <div
                key={tour.id}
                className="flex-shrink-0 w-[45.5vw] md:w-64 lg:w-72"
              >
                <TourCard {...tour} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

