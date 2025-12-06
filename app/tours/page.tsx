'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import FilterSidebar from '@/components/tours/FilterSidebar';
import DetailedTourCard from '@/components/tours/DetailedTourCard';

// Sample tours data
const allTours = [
  {
    id: 1,
    title: 'Gamcheon Culture Village + Haeundae',
    location: 'Busan',
    rating: 4.8,
    reviewCount: 234,
    price: 79,
    originalPrice: 99,
    priceType: 'person' as const,
    duration: 'Full day',
    image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80',
    features: ['Tickets Included', 'Meals Included', 'Hotel Pickup'],
    itinerary: ['Gamcheon Culture Village', 'Haeundae Beach', 'Dongbaek Island', 'Lunch Break'],
    pickupPoints: 4,
    dropoffPoints: 2,
    destinations: ['Busan'],
    priceRange: [50, 100],
  },
  {
    id: 2,
    title: 'East Jeju UNESCO Highlights',
    location: 'Jeju',
    rating: 4.9,
    reviewCount: 156,
    price: 290,
    originalPrice: 350,
    priceType: 'group' as const,
    duration: 'Full day',
    image: 'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80',
    features: ['Tickets Included', 'Guide Included', 'Transportation'],
    itinerary: ['Seongsan Ilchulbong', 'Manjanggul Cave', 'Jeju Folk Village', 'Lunch'],
    pickupPoints: 3,
    dropoffPoints: 1,
    destinations: ['Jeju'],
    priceRange: [200, 400],
  },
  {
    id: 3,
    title: 'Gwangalli Night View & Local Food',
    location: 'Busan',
    rating: 4.7,
    reviewCount: 189,
    price: 65,
    originalPrice: 80,
    priceType: 'person' as const,
    duration: '3-4 hours',
    image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80',
    features: ['Meals Included', 'Guide Included'],
    itinerary: ['Gwangalli Beach', 'Local Food Tour', 'Night View'],
    pickupPoints: 2,
    dropoffPoints: 2,
    destinations: ['Busan'],
    priceRange: [50, 100],
  },
  {
    id: 4,
    title: 'Seoul Palace & Market Tour',
    location: 'Seoul',
    rating: 4.6,
    reviewCount: 312,
    price: 69,
    originalPrice: 85,
    priceType: 'person' as const,
    duration: 'Half day',
    image: 'https://images.unsplash.com/photo-1534274988757-a28bf1a57c17?w=600&q=80',
    features: ['Tickets Included', 'Guide Included'],
    itinerary: ['Gyeongbokgung Palace', 'Insadong', 'Traditional Market'],
    pickupPoints: 5,
    dropoffPoints: 3,
    destinations: ['Seoul'],
    priceRange: [50, 100],
  },
  {
    id: 5,
    title: 'Jeju Island Nature Adventure',
    location: 'Jeju',
    rating: 4.9,
    reviewCount: 98,
    price: 320,
    originalPrice: 380,
    priceType: 'group' as const,
    duration: 'Full day',
    image: 'https://images.unsplash.com/photo-1504817343863-5092a923803e?w=600&q=80',
    features: ['Tickets Included', 'Meals Included', 'Transportation'],
    itinerary: ['Hallasan Mountain', 'Waterfalls', 'Beach', 'Lunch'],
    pickupPoints: 3,
    dropoffPoints: 1,
    destinations: ['Jeju'],
    priceRange: [200, 400],
  },
  {
    id: 6,
    title: 'Busan Coastal Scenic Drive',
    location: 'Busan',
    rating: 4.5,
    reviewCount: 127,
    price: 180,
    originalPrice: 220,
    priceType: 'group' as const,
    duration: 'Half day',
    image: 'https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80',
    features: ['Transportation', 'Guide Included'],
    itinerary: ['Coastal Drive', 'Scenic Spots', 'Photo Stops'],
    pickupPoints: 2,
    dropoffPoints: 2,
    destinations: ['Busan'],
    priceRange: [100, 200],
  },
];

function ToursPageContent() {
  const searchParams = useSearchParams();
  const searchQuery = searchParams?.get('q') || '';

  const [filters, setFilters] = useState({
    destinations: [] as string[],
    priceRange: [0, 500] as [number, number],
    duration: [] as string[],
    features: [] as string[],
  });

  // Get unique destinations
  const allDestinations = Array.from(new Set(allTours.map((tour) => tour.location)));

  // Filter tours
  const filteredTours = allTours.filter((tour) => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch =
        tour.title.toLowerCase().includes(query) ||
        tour.location.toLowerCase().includes(query) ||
        tour.itinerary.some((item) => item.toLowerCase().includes(query));
      if (!matchesSearch) return false;
    }

    // Destination filter
    if (filters.destinations.length > 0 && !filters.destinations.includes(tour.location)) {
      return false;
    }

    // Price range filter
    if (tour.price < filters.priceRange[0] || tour.price > filters.priceRange[1]) {
      return false;
    }

    // Duration filter
    if (filters.duration.length > 0) {
      const tourDuration = tour.duration.toLowerCase();
      const matchesDuration = filters.duration.some((d) => tourDuration.includes(d.toLowerCase()));
      if (!matchesDuration) return false;
    }

    // Features filter
    if (filters.features.length > 0) {
      const matchesFeatures = filters.features.every((feature) =>
        tour.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()))
      );
      if (!matchesFeatures) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter Sidebar */}
          <aside className="lg:w-64 flex-shrink-0">
            <FilterSidebar
              destinations={allDestinations}
              filters={filters}
              onFiltersChange={setFilters}
            />
          </aside>

          {/* Tours List */}
          <div className="flex-1">
            {/* Header */}
            <div className="mb-6">
              <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
                {searchQuery ? `Search Results for "${searchQuery}"` : 'All Tours'}
              </h1>
              <p className="text-gray-600">
                Found {filteredTours.length} tour{filteredTours.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Tours Grid */}
            <div className="space-y-6">
              {filteredTours.length > 0 ? (
                filteredTours.map((tour) => <DetailedTourCard key={tour.id} tour={tour} />)
              ) : (
                <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
                  <p className="text-gray-600 text-lg">No tours found matching your criteria.</p>
                  <p className="text-gray-500 text-sm mt-2">Try adjusting your filters.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
      <BottomNav />
      <div className="h-16 md:hidden" />
    </div>
  );
}

export default function ToursPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading...</p>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    }>
      <ToursPageContent />
    </Suspense>
  );
}

