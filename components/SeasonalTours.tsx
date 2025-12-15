"use client";

import { useState, useEffect } from "react";
import TourCard from "./TourCard";
import { useTranslations } from "@/lib/i18n";

interface Tour {
  id: number;
  title: string;
  city: string;
  price: number;
  original_price?: number | null;
  image?: string;
  images?: string[];
  rating?: number;
  review_count?: number;
  badges?: string[];
  price_type?: 'person' | 'group';
  duration?: string;
}

export default function SeasonalTours() {
  const t = useTranslations();
  const [seasonalTours, setSeasonalTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchSeasonalTours = async () => {
      try {
        setLoading(true);
        // Fetch tours that might be seasonal (you can add a filter for seasonal tours in the future)
        const response = await fetch('/api/tours?limit=6&sortBy=created_at&sortOrder=desc&isActive=true');
        if (!response.ok) {
          throw new Error('Failed to fetch tours');
        }
        const data = await response.json();
        // Transform API response to match our interface
        const transformedTours = (data.tours || []).map((tour: any) => ({
          id: tour.id,
          title: tour.title,
          city: tour.location || tour.city,
          price: tour.price,
          original_price: tour.originalPrice,
          image: tour.image,
          images: tour.images,
          rating: tour.rating,
          review_count: tour.reviewCount,
          badges: tour.badges,
          price_type: tour.priceType,
          duration: tour.duration,
        }));
        setSeasonalTours(transformedTours);
      } catch (error) {
        console.error('Error fetching seasonal tours:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchSeasonalTours();
  }, []);
  
  if (loading) {
    return (
      <section className="py-8 sm:py-12 bg-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
              {t('home.seasonal.title')}
            </h2>
            <p className="text-sm text-gray-500">
              {t('home.seasonal.subtitle')}
            </p>
          </div>
          <div className="overflow-x-auto pb-3 scrollbar-custom -mx-4 px-4 sm:mx-0 sm:px-0">
            <div className="flex gap-3 sm:gap-4 min-w-max sm:min-w-0">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="flex-shrink-0 w-[45.5vw] md:w-64 lg:w-72">
                  <div className="bg-gray-200 rounded-lg animate-pulse aspect-[4/5]" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  if (seasonalTours.length === 0) {
    return null;
  }
  
  return (
    <section className="py-8 sm:py-12 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title Section */}
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-1">
            {t('home.seasonal.title')}
          </h2>
          <p className="text-sm text-gray-500">
            {t('home.seasonal.subtitle')}
          </p>
        </div>
        
        {/* Horizontal Scrollable List */}
        <div className="overflow-x-auto pb-3 scrollbar-custom -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="flex gap-3 sm:gap-4 min-w-max sm:min-w-0">
            {seasonalTours.map((tour) => {
              const hasDiscount = tour.original_price && tour.original_price > tour.price;
              const discount = hasDiscount && tour.original_price 
                ? Math.round(((tour.original_price - tour.price) / tour.original_price) * 100) 
                : undefined;
              
              // Get image from tour data (image or first image in images array)
              const tourImage = tour.image || (tour.images && tour.images[0]) || "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80";
              
              return (
                <div
                  key={tour.id}
                  className="flex-shrink-0 w-[45.5vw] md:w-64 lg:w-72"
                >
                  <TourCard
                    id={tour.id}
                    title={tour.title}
                    location={tour.city}
                    type={tour.duration || "Seasonal"}
                    price={tour.price / 1000} // TourCard expects price in thousands (80 for 80000)
                    priceType={tour.price_type || "person"}
                    image={tourImage}
                    badge={tour.badges?.[0] || "Popular"}
                    rating={tour.rating || 4.5}
                    reviewCount={tour.review_count || 0}
                    discount={discount}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}

