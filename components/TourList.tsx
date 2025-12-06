"use client";

import TourCard from "./TourCard";

const tours = [
  {
    id: 1,
    title: "Gamcheon Culture Village + Haeundae",
    location: "Busan",
    type: "Small-group",
    duration: "Full day",
    price: 79,
    priceType: "person" as const,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80",
    badge: "Popular",
    rating: 4.8,
    reviewCount: 234,
  },
  {
    id: 2,
    title: "East Jeju UNESCO Highlights",
    location: "Jeju",
    type: "Private van",
    duration: "Full day",
    price: 290,
    priceType: "group" as const,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Private",
    rating: 4.9,
    reviewCount: 156,
  },
  {
    id: 3,
    title: "Gwangalli Night View & Local Food",
    location: "Busan",
    type: "Foodie style",
    duration: "3-4 hours",
    price: 65,
    priceType: "person" as const,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80",
    badge: "Night Tour",
    rating: 4.7,
    reviewCount: 189,
  },
  {
    id: 4,
    title: "Seoul Palace & Market Tour",
    location: "Seoul",
    type: "Small-group",
    duration: "Half day",
    price: 69,
    priceType: "person" as const,
    image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80",
    badge: "Cultural",
    rating: 4.6,
    reviewCount: 312,
  },
  {
    id: 5,
    title: "Jeju Island Nature Adventure",
    location: "Jeju",
    type: "Private",
    duration: "Full day",
    price: 320,
    priceType: "group" as const,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Adventure",
    rating: 4.9,
    reviewCount: 98,
  },
  {
    id: 6,
    title: "Busan Coastal Scenic Drive",
    location: "Busan",
    type: "Private car",
    duration: "Half day",
    price: 180,
    priceType: "group" as const,
    image: "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80",
    badge: "Scenic",
    rating: 4.5,
    reviewCount: 127,
  },
];

export default function TourList() {
  return (
    <section className="py-12 sm:py-16 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8 sm:mb-10">
          <div className="text-center mb-4">
            <div className="inline-flex items-center gap-2 mb-3">
              <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold bg-gradient-to-r from-gray-900 via-indigo-700 to-gray-900 bg-clip-text text-transparent mb-2">
              Popular Day Tours
            </h2>
            <p className="text-xs sm:text-sm text-gray-500 font-medium mb-3">
              Handpicked experiences for your perfect trip
            </p>
            <div className="inline-flex items-center gap-2">
              <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
              <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
              <div className="w-8 h-0.5 bg-gradient-to-r from-transparent via-indigo-500 to-transparent"></div>
            </div>
          </div>
          {/* View All button - centered below title */}
          <div className="text-center mb-6">
            <a
              href="/tours"
              className="inline-flex text-indigo-600 hover:text-indigo-700 font-semibold items-center gap-2 px-4 py-2 rounded-lg hover:bg-indigo-50 transition-colors shadow-sm hover:shadow-md"
            >
              View All
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </a>
          </div>
        </div>
        
        {/* Horizontal scroll for all devices */}
        <div className="overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-custom -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-4 sm:gap-6 lg:gap-8 min-w-max sm:min-w-0">
            {tours.map((tour) => (
              <div
                key={tour.id}
                className="flex-shrink-0 w-[65vw] sm:w-[220px] lg:w-[240px] snap-start"
              >
                <TourCard {...tour} />
              </div>
            ))}
          </div>
        </div>
        
        {/* View All button for mobile */}
        <div className="mt-6 sm:hidden text-center">
          <a
            href="/tours"
            className="text-blue-600 hover:text-blue-700 font-semibold flex items-center justify-center gap-2"
          >
            View All Tours
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </div>
    </section>
  );
}

