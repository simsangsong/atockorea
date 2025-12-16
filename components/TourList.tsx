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

export default function TourList() {
  const t = useTranslations();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchTours = async () => {
      try {
        setLoading(true);
        const response = await fetch('/api/tours?limit=8&sortBy=rating&sortOrder=desc&isActive=true');
        if (!response.ok) {
          throw new Error('Failed to fetch tours');
        }
        const data = await response.json();
        // Transform API response to match our interface
        const transformedTours = (data.tours || []).map((tour: any) => ({
          id: tour.id,
          slug: tour.slug,
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
        setTours(transformedTours);
      } catch (error) {
        console.error('Error fetching tours:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTours();
  }, []);
  
  if (loading) {
    return (
      <section className="py-8 sm:py-12 bg-transparent">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
                {t('home.tourList.title')}
              </h2>
              <a
                href="/tours"
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                {t('home.tourList.seeMore')}
              </a>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-lg animate-pulse aspect-[4/5]" />
            ))}
          </div>
        </div>
      </section>
    );
  }
  
  if (tours.length === 0) {
    return null;
  }
  
  return (
    <section className="py-8 sm:py-12 bg-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Title Section */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900">
              {t('home.tourList.title')}
            </h2>
            <a
              href="/tours"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              {t('home.tourList.seeMore')}
            </a>
          </div>
        </div>
        
        {/* Grid Layout: mobile 2 columns, desktop 3-4 columns */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {tours.map((tour) => {
            const hasDiscount = tour.original_price && tour.original_price > tour.price;
            const discount = hasDiscount && tour.original_price 
              ? Math.round(((tour.original_price - tour.price) / tour.original_price) * 100) 
              : undefined;
            
            // Get image from tour data (image or first image in images array)
            const tourImage = tour.image || (tour.images && tour.images[0]) || "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80";
            
            return (
              <TourCard
                key={tour.id}
                id={tour.id}
                slug={tour.slug}
                title={tour.title}
                location={tour.city}
                type={tour.duration || "Day tour"}
                price={tour.price / 1000} // TourCard expects price in thousands (80 for 80000)
                priceType={tour.price_type || "person"}
                image={tourImage}
                badge={tour.badges?.[0] || "Popular"}
                rating={tour.rating || 4.5}
                reviewCount={tour.review_count || 0}
                discount={discount}
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

