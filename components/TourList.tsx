"use client";

import TourCard from "./TourCard";

const tours = [
  {
    id: 1,
    title: "Jeju: Eastern UNESCO Join in Tour (Seongsan, Haenyeo Show)",
    location: "Jeju",
    type: "Day tour",
    price: 46.81,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Top rated",
    rating: 4.9,
    reviewCount: 89,
  },
  {
    id: 2,
    title: "Jeju's Southern Euphoria Tour",
    location: "Jeju",
    type: "Day tour",
    price: 80,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Popular",
    rating: 4.9,
    reviewCount: 1213,
  },
  {
    id: 3,
    title: "Jeju Island One Day Authentic Experience",
    location: "Jeju",
    type: "Day tour",
    price: 80,
    image: "https://images.unsplash.com/photo-1517154421773-0529f29ea451?w=600&q=80",
    badge: "Popular",
    rating: 5.0,
    reviewCount: 2371,
  },
  {
    id: 4,
    title: "Jeju UNESCO Top Attractions Tour",
    location: "Jeju",
    type: "Day tour",
    price: 80,
    image: "https://images.unsplash.com/photo-1571896349842-33c89424de2d?w=600&q=80",
    badge: "Popular",
    rating: 4.9,
    reviewCount: 1396,
  },
  {
    id: 5,
    title: "Jeju island Charms Join in Tour",
    location: "Jeju",
    type: "Day tour",
    price: 80,
    image: "https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80",
    badge: "Popular",
    rating: 4.9,
    reviewCount: 506,
  },
  {
    id: 6,
    title: "UNESCO Day Trip Jeju",
    location: "Jeju",
    type: "Day tour",
    price: 63,
    image: "https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80",
    badge: "Year End Special",
    rating: 4.9,
    reviewCount: 63,
    discount: 20,
  },
];

export default function TourList() {
  return (
    <section className="py-8 sm:py-12 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              Travelers' picks
            </h2>
            <a
              href="/tours"
              className="text-sm text-indigo-600 hover:text-indigo-700 font-medium"
            >
              See more
            </a>
          </div>
        </div>
        
        {/* Grid Layout: mobile 2 columns, desktop 3-4 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {tours.map((tour) => (
            <TourCard key={tour.id} {...tour} />
          ))}
        </div>
      </div>
    </section>
  );
}

