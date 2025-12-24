'use client';

// Force dynamic rendering to avoid I18nProvider issues during static generation
export const dynamic = 'force-dynamic';

import { useState, useEffect, Suspense, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import BottomNav from '@/components/BottomNav';
import FilterSidebar from '@/components/tours/FilterSidebar';
import DetailedTourCard from '@/components/tours/DetailedTourCard';
import { useTranslations } from '@/lib/i18n';

interface Tour {
  id: string;
  title: string;
  location: string;
  city: string;
  rating: number;
  reviewCount: number;
  price: number;
  originalPrice: number | null;
  priceType: 'person' | 'group';
  duration: string;
  image: string;
  images: string[];
  features: string[];
  itinerary: string[];
  pickupPoints: any[];
  pickupPointsCount: number;
  dropoffPointsCount: number;
  lunchIncluded: boolean;
  ticketIncluded: boolean;
  includes: string[];
  excludes: string[];
  schedule: Array<{ time: string; title: string; description?: string }>;
  pickupInfo: string;
  notes: string;
  destinations: string[];
  priceRange: [number, number];
}

function ToursContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const t = useTranslations();
  const [allTours, setAllTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState({
    destinations: [] as string[],
    priceRange: [0, 500] as [number, number],
    duration: [] as string[],
    features: [] as string[],
  });

  // Get initial filters from URL
  useEffect(() => {
    const city = searchParams.get('city');
    const q = searchParams.get('q');
    const minPrice = searchParams.get('minPrice');
    const maxPrice = searchParams.get('maxPrice');

    if (city) {
      setFilters((prev) => ({
        ...prev,
        destinations: [city],
      }));
    }

    if (minPrice || maxPrice) {
      setFilters((prev) => ({
        ...prev,
        priceRange: [
          minPrice ? parseInt(minPrice) : 0,
          maxPrice ? parseInt(maxPrice) : 500,
        ],
      }));
    }

    fetchTours(city || undefined, q || undefined, minPrice || undefined, maxPrice || undefined);
  }, [searchParams]);

  const fetchTours = async (
    city?: string,
    searchQuery?: string,
    minPrice?: string,
    maxPrice?: string
  ) => {
    try {
      setLoading(true);
      setError(null);

      const params = new URLSearchParams();
      if (city) params.append('city', city);
      if (searchQuery) params.append('q', searchQuery);
      if (minPrice) params.append('minPrice', minPrice);
      if (maxPrice) params.append('maxPrice', maxPrice);

      const response = await fetch(`/api/tours?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch tours');
      }

      const data = await response.json();
      const transformedTours: Tour[] = (data.tours || []).map((tour: any) => ({
        id: tour.id,
        title: tour.title,
        location: tour.city,
        city: tour.city,
        rating: tour.rating || 0,
        reviewCount: tour.reviewCount || tour.review_count || 0,
        price: parseFloat(tour.price?.toString() || '0'),
        originalPrice: tour.originalPrice || (tour.original_price ? parseFloat(tour.original_price.toString()) : null),
        priceType: tour.priceType || tour.price_type || 'person',
        duration: tour.duration || '',
        image: tour.image || tour.image_url || (tour.images && tour.images[0]) || '',
        images: tour.images || [],
        features: tour.highlights || [],
        itinerary: tour.schedule || [],
        pickupPoints: tour.pickupPoints || tour.pickup_points || [],
        pickupPointsCount: tour.pickupPointsCount || tour.pickup_points_count || 0,
        dropoffPointsCount: tour.dropoffPointsCount || tour.dropoff_points_count || 0,
        lunchIncluded: tour.lunchIncluded !== undefined ? tour.lunchIncluded : (tour.lunch_included || false),
        ticketIncluded: tour.ticketIncluded !== undefined ? tour.ticketIncluded : (tour.ticket_included || false),
        includes: tour.includes || [],
        excludes: tour.excludes || [],
        schedule: tour.schedule || [],
        pickupInfo: tour.pickupInfo || tour.pickup_info || '',
        notes: tour.notes || '',
        destinations: [tour.city],
        priceRange: [0, parseFloat(tour.price?.toString() || '500')],
      }));

      setAllTours(transformedTours);
    } catch (err: any) {
      console.error('Error fetching tours:', err);
      setError(err.message || 'Failed to load tours');
    } finally {
      setLoading(false);
    }
  };

  const handleFiltersChange = useCallback((newFilters: typeof filters) => {
    setFilters(newFilters);

    // Update URL with filter parameters
    const params = new URLSearchParams();
    if (newFilters.destinations.length > 0) {
      params.append('city', newFilters.destinations[0]);
    }
    if (newFilters.priceRange[0] > 0) {
      params.append('minPrice', newFilters.priceRange[0].toString());
    }
    if (newFilters.priceRange[1] < 500) {
      params.append('maxPrice', newFilters.priceRange[1].toString());
    }

    const queryString = params.toString();
    router.push(`/tours${queryString ? `?${queryString}` : ''}`, { scroll: false });
  }, [router]);

  // Extract unique destinations from tours
  const destinations = Array.from(new Set(allTours.map((tour) => tour.city)));

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading tours...</p>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
        <Header />
        <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-800 mb-4">Error: {error}</p>
            <button
              onClick={() => fetchTours()}
              className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
            >
              Try Again
            </button>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-indigo-50/50">
      <Header />
      <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('tour.allTours')}</h1>
          <p className="text-gray-600">
            {t('tour.discoverAmazing')}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* Filter Sidebar */}
          <div className="lg:w-64 flex-shrink-0">
            <FilterSidebar
              destinations={destinations}
              filters={filters}
              onFiltersChange={handleFiltersChange}
            />
          </div>

          {/* Tour List */}
          <div className="flex-1">
            {allTours.length === 0 ? (
              <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/50 p-12 text-center">
                <div className="max-w-md mx-auto">
                  <svg
                    className="mx-auto h-16 w-16 text-gray-400 mb-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                    />
                  </svg>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {searchParams.get('city') 
                      ? `${searchParams.get('city')} ${t('tour.noToursFound') || 'No tours found'}`
                      : t('tour.noToursFound') || 'No tours found'}
                  </h3>
                  <p className="text-gray-600 mb-6">
                    {searchParams.get('city')
                      ? `We're working on adding more tours in ${searchParams.get('city')}. Check back soon!`
                      : 'No tours match your search criteria. Try adjusting your filters.'}
                  </p>
                  <button
                    onClick={() => router.push('/tours')}
                    className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                  >
                    View All Tours
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                {allTours.map((tour) => (
                  <DetailedTourCard key={tour.id} tour={tour} />
                ))}
              </div>
            )}
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
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </main>
        <Footer />
        <BottomNav />
      </div>
    }>
      <ToursContent />
    </Suspense>
  );
}
