"use client";

import { useState, useEffect } from "react";
import TourCard from "./TourCard";
import { useTranslations, useI18n } from "@/lib/i18n";

interface Tour {
  id: number | string;
  slug?: string;
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
  const { locale } = useI18n();
  const [tours, setTours] = useState<Tour[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchTours = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/tours?limit=8&sortBy=rating&sortOrder=desc&isActive=true&locale=${encodeURIComponent(locale)}`);
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
  }, [locale]);
  
  if (loading) {
    return (
      <section className="py-10 sm:py-14 bg-white/80 backdrop-blur-sm border-y border-gray-100">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8">
            <div className="h-11 w-48 bg-gray-200 rounded-full animate-pulse mx-auto" />
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 rounded-2xl animate-pulse aspect-[5/4.6]" />
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
    <section className="py-10 sm:py-14 bg-white/80 backdrop-blur-sm border-y border-gray-100">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* View all tours — logo-matching blue–orange gradient (above cards) */}
        <div className="text-center mb-8">
          <a
            href="/tours"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500 hover:from-blue-600 hover:via-blue-700 hover:to-orange-500 shadow-md hover:shadow-lg transition-all duration-300"
          >
            {t('home.tourList.seeMore')}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </a>
        </div>

        {/* Grid: mobile 2 cols, desktop 3–4 cols */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
          {tours.map((tour) => {
            const hasDiscount = tour.original_price && tour.original_price > tour.price;
            const discount = hasDiscount && tour.original_price 
              ? Math.round(((tour.original_price - tour.price) / tour.original_price) * 100) 
              : undefined;
            
            const tourImage = tour.image || (tour.images && tour.images[0]) || "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80";
            
            return (
              <TourCard
                key={tour.id}
                id={tour.id}
                slug={tour.slug}
                title={tour.title}
                location={tour.city}
                type={tour.duration || "Day tour"}
                price={tour.price / 1000}
                originalPriceKRW={tour.original_price && tour.original_price > tour.price ? tour.original_price : undefined}
                priceType={tour.price_type || "person"}
                image={tourImage}
                badge={tour.badges?.[0] || "Day tour"}
                rating={tour.rating || 4.5}
                reviewCount={tour.review_count || 0}
                discount={discount}
                badgeVariant="brand"
                variant="home"
              />
            );
          })}
        </div>
      </div>
    </section>
  );
}

