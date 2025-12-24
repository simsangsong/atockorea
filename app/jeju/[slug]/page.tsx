// app/jeju/[slug]/page.tsx
"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { detailedTours, DetailedTour } from "../../../data/tours";
import GalleryGrid from "@/components/tour/GalleryGrid";

// ===== 타입 정의 =====
type Review = {
  id: number;
  author: string;
  rating: number;
  title: string;
  content: string;
  date: string;
  helpfulVotes: number;
};

type ReviewSort = "ratingDesc" | "ratingAsc" | "newest" | "oldest" | "helpful";

type PageProps = {
  params: {
    slug: string;
  };
};

type FAQItem = {
  question: string;
  answer: string;
};

// Recommended Routes Accordion Component
function RecommendedRoutesAccordion({ routes }: { routes: Array<{ title: string; items: string[] }> }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between text-left py-3 px-3 -mx-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-sm">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
          </div>
          <h3 className="text-base font-semibold text-gray-900">Recommended Routes</h3>
        </div>
        <svg
          className={`w-5 h-5 text-gray-400 flex-shrink-0 transition-transform duration-200 ${
            isOpen ? 'transform rotate-180' : ''
          }`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isOpen ? 'max-h-[2000px] opacity-100 mt-4' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="space-y-4">
          {routes.map((route, index) => (
            <div key={index} className="rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 border border-blue-200/60 p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-sm shadow-md flex-shrink-0">
                  {index + 1}
                </div>
                <h4 className="text-base font-bold text-gray-900">
                  {route.title === 'East' ? 'East Route' :
                   route.title === 'West' ? 'West Route' :
                   route.title === 'South' ? 'South Route' : route.title}
                </h4>
              </div>
              <ul className="space-y-2">
                {route.items.map((item, itemIndex) => (
                  <li key={itemIndex} className="flex items-start gap-2.5 text-sm text-gray-700">
                    <svg className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                    <span className="leading-relaxed">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Component to parse and display description with recommended routes
function DescriptionContent({ description }: { description: string }) {
  if (!description) return null;

  // Remove recommended routes section completely from description - AGGRESSIVE FILTERING
  let mainDescription = description;

  // Split by common route markers and take only the first part
  const splitPatterns = [
    /\*\*Recommended Routes?:\*\*/i,
    /\*\*추천 루트:\*\*/i,
    /Recommended Routes?:/i,
    /추천 루트:/i,
    /\*\*(East|West|South) Route:\*\*/i,
    /\*\*동부 루트:\*\*/i,
    /\*\*서부 루트:\*\*/i,
    /\*\*남부 루트:\*\*/i,
    /East Route:/i,
    /West Route:/i,
    /South Route:/i,
    /동부 루트:/i,
    /서부 루트:/i,
    /남부 루트:/i,
  ];

  // Find the earliest route marker and cut everything from there
  let earliestIndex = mainDescription.length;
  for (const pattern of splitPatterns) {
    const match = mainDescription.search(pattern);
    if (match !== -1 && match < earliestIndex) {
      earliestIndex = match;
    }
  }

  // Cut everything from the earliest route marker
  if (earliestIndex < mainDescription.length) {
    mainDescription = mainDescription.substring(0, earliestIndex).trim();
  }

  // Additional aggressive cleanup - remove any route-related content
  mainDescription = mainDescription
    .replace(/[\s\S]*\*\*Recommended Routes?[\s\S]*$/i, '')
    .replace(/[\s\S]*\*\*추천 루트[\s\S]*$/i, '')
    .replace(/[\s\S]*Recommended Routes?[\s\S]*$/i, '')
    .replace(/[\s\S]*추천 루트[\s\S]*$/i, '')
    .replace(/[\s\S]*\*\*(East|West|South) Route:[\s\S]*$/i, '')
    .replace(/[\s\S]*\*\*동부 루트:[\s\S]*$/i, '')
    .replace(/[\s\S]*\*\*서부 루트:[\s\S]*$/i, '')
    .replace(/[\s\S]*\*\*남부 루트:[\s\S]*$/i, '')
    .replace(/[\s\S]*Udo Island[\s\S]*$/i, '') // Remove if contains route items
    .replace(/[\s\S]*Seongsan Ilchulbong[\s\S]*$/i, '')
    .trim();

  // Just display the cleaned description without routes
  return (
    <div className="text-sm sm:text-base text-gray-700 leading-relaxed whitespace-pre-line">
      {mainDescription}
    </div>
  );
}

// ===== 페이지 컴포넌트 =====
export default function JejuTourDetailPage({ params }: PageProps) {
  const router = useRouter();
  const { slug } = params;
  const [tour, setTour] = useState<DetailedTour | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch tour from API
  useEffect(() => {
    const fetchTour = async () => {
      try {
        setLoading(true);
        setError(null);

        // Try to fetch from API first
        const response = await fetch(`/api/tours/${slug}`);
        
        if (response.ok) {
          const data = await response.json();
          const apiTour = data.tour;

          // Convert UUID string to a numeric hash for id field (DetailedTour expects number)
          const stringToNumber = (str: string): number => {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
              const char = str.charCodeAt(i);
              hash = ((hash << 5) - hash) + char;
              hash = hash & hash; // Convert to 32-bit integer
            }
            return Math.abs(hash);
          };

          // Transform API data to DetailedTour format
          const transformedTour: DetailedTour = {
            id: typeof apiTour.id === 'string' ? stringToNumber(apiTour.id) : apiTour.id,
            city: (apiTour.city || "Jeju") as "Jeju" | "Seoul" | "Busan",
            tag: apiTour.tag || apiTour.badges?.[0] || "Jeju Tour",
            title: apiTour.title,
            price: apiTour.originalPrice
              ? `₩${new Intl.NumberFormat('ko-KR').format(apiTour.originalPrice)} → ₩${new Intl.NumberFormat('ko-KR').format(apiTour.price)}`
              : `₩${new Intl.NumberFormat('ko-KR').format(apiTour.price)}`,
            imageUrl: apiTour.images?.[0]?.url || apiTour.image || '',
            duration: apiTour.duration || '',
            lunchIncluded: apiTour.lunchIncluded || false,
            ticketIncluded: apiTour.ticketIncluded || false,
            pickupInfo: apiTour.pickupInfo || '',
            notes: apiTour.notes || '',
            schedule: apiTour.itinerary?.map((item: any) => ({
              time: item.time || '',
              title: item.title || '',
              description: item.description || '',
            })) || [],
            slug: slug,
            reviews: [],
            galleryImages: apiTour.images?.map((img: any) => img.url) || [],
            subtitle: apiTour.tagline || '',
            description: apiTour.overview || apiTour.description || '',
            highlights: apiTour.inclusions?.map((inc: any) => inc.text || inc) || apiTour.highlights || [],
            includes: apiTour.inclusions?.map((inc: any) => inc.text || inc) || [],
            excludes: apiTour.exclusions?.map((exc: any) => exc.text || exc) || [],
            faqs: apiTour.faqs || [],
            priceType: apiTour.priceType || 'person',
          };

          setTour(transformedTour);
        } else if (response.status === 404) {
          // Fallback to static data if not found in API
          const staticTour = detailedTours.find((t) => t.slug === slug);
          if (staticTour) {
            setTour(staticTour);
          } else {
            setError('Tour not found');
          }
        } else {
          // Try static data as fallback
          const staticTour = detailedTours.find((t) => t.slug === slug);
          if (staticTour) {
            setTour(staticTour);
          } else {
            setError('Failed to fetch tour');
          }
        }
      } catch (err) {
        console.error('Error fetching tour:', err);
        // Fallback to static data
        const staticTour = detailedTours.find((t) => t.slug === slug);
        if (staticTour) {
          setTour(staticTour);
        } else {
          setError('Failed to load tour');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchTour();
  }, [slug]);

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-[#111] flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm">
          <div className="animate-pulse">
            <div className="h-6 bg-gray-200 rounded w-48 mb-4"></div>
            <div className="h-4 bg-gray-200 rounded w-64"></div>
          </div>
        </div>
      </div>
    );
  }

  // Error state or tour not found
  if (error || !tour) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] text-[#111] flex items-center justify-center">
        <div className="rounded-2xl bg-white px-6 py-8 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold">Tour not found</h1>
          <p className="text-sm text-[#555]">
            The Jeju tour you are looking for does not exist or is no longer
            available.
          </p>
        </div>
      </div>
    );
  }

  // ===== 기본 데이터 =====
  const gallery =
    tour.galleryImages && tour.galleryImages.length > 0
      ? tour.galleryImages
      : [tour.imageUrl];

  const [selectedImage, setSelectedImage] = useState<string | null>(
    gallery[0]
  );
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const heroImage = selectedImage ?? gallery[0];

  const initialReviews: Review[] = (tour.reviews || []) as Review[];
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [sortBy, setSortBy] = useState<ReviewSort>("ratingDesc");

  const [showFullItinerary, setShowFullItinerary] = useState(false);
  const [showAllPhotos, setShowAllPhotos] = useState(false);

  const [date, setDate] = useState<string>("");
  const [guests, setGuests] = useState<number>(2);

  const [newReview, setNewReview] = useState<{
    author: string;
    rating: number;
    title: string;
    content: string;
  }>({
    author: "",
    rating: 5,
    title: "",
    content: "",
  });

  const averageRating =
    reviews.length === 0
      ? 0
      : reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;

  // 정렬된 리뷰
  const sortedReviews = useMemo(() => {
    const arr = [...reviews];
    switch (sortBy) {
      case "ratingAsc":
        return arr.sort((a, b) => a.rating - b.rating);
      case "newest":
        return arr.sort(
          (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
        );
      case "oldest":
        return arr.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );
      case "helpful":
        return arr.sort((a, b) => b.helpfulVotes - a.helpfulVotes);
      case "ratingDesc":
      default:
        return arr.sort((a, b) => b.rating - a.rating);
    }
  }, [reviews, sortBy]);

  const visibleReviews = showAllReviews
    ? sortedReviews
    : sortedReviews.slice(0, 3);

  // FAQ - Use tour.faqs if available, otherwise use default
  const faqs: FAQItem[] = tour.faqs && tour.faqs.length > 0 
    ? tour.faqs.map(faq => ({
        question: faq.question || '',
        answer: faq.answer || '',
      }))
    : [
        {
          question: "What is the pickup time and location?",
          answer:
            "Pickup usually starts around 08:30–09:00 from Jeju City meeting points or your hotel (if included). Exact time and location will be confirmed in the confirmation email after booking.",
        },
        {
          question: "Is lunch included?",
          answer:
            tour.lunchIncluded
              ? "Lunch is included. Your guide will take you to a recommended local restaurant."
              : "Lunch is not included. The guide will recommend local restaurants where you can choose and pay on the spot.",
        },
        {
          question: "Can I join with a suitcase or luggage?",
          answer:
            "Yes, small and medium-size luggage can be stored in the vehicle. For very large luggage, please inform us in advance so we can prepare enough space.",
        },
        {
          question: "What happens in case of bad weather?",
          answer:
            "For safety reasons, outdoor activities or Haenyeo shows may be cancelled or replaced with alternative spots. The itinerary can change depending on weather and traffic conditions.",
        },
      ];

  // ===== 액션 핸들러 =====
  const handleBookNow = () => {
    if (!date) {
      alert("Please select a date first.");
      return;
    }

    const query = new URLSearchParams({
      tourSlug: tour.slug ?? "",
      date,
      guests: String(guests),
    }).toString();

    router.push(`/checkout?${query}`);
  };

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReview.author || !newReview.title || !newReview.content) {
      alert("Please fill in your name, title, and review text.");
      return;
    }

    const review: Review = {
      id: Date.now(),
      author: newReview.author,
      rating: newReview.rating,
      title: newReview.title,
      content: newReview.content,
      date: new Date().toISOString().slice(0, 10),
      helpfulVotes: 0,
    };

    setReviews((prev) => [review, ...prev]);
    setNewReview({
      author: "",
      rating: 5,
      title: "",
      content: "",
    });
  };

  // ===== 렌더링 =====
  return (
    <div className="min-h-screen bg-white text-gray-900">
      <main className="mx-auto max-w-5xl px-4 pb-20 pt-4 sm:px-6 sm:pb-28 lg:px-8">
        {/* ===== 1. Hero Image + Basic Info ===== */}
        <section className="rounded-2xl bg-white shadow-sm border border-gray-100 overflow-hidden">
          {/* Main Image + Thumbnail Swipe */}
          <div className="border-b border-gray-200">
            <div 
              className="relative aspect-[16/10] w-full overflow-hidden rounded-t-3xl bg-black sm:aspect-[16/9] cursor-pointer"
              onClick={() => setIsImageModalOpen(true)}
            >
              <Image
                src={heroImage}
                alt={tour.title}
                fill
                className="object-cover"
                priority
                sizes="100vw"
              />
              {/* Badge */}
              <div className="absolute bottom-3 left-3 rounded-full bg-black/60 px-3 py-1 text-[11px] text-white backdrop-blur-sm">
                {tour.tag}
              </div>
            </div>

            {/* Thumbnail Horizontal Scroll */}
            <div className="flex gap-2 overflow-x-auto px-3 pb-3 pt-2 sm:px-4">
              {gallery
                .slice(0, showAllPhotos ? gallery.length : 6)
                .map((url) => (
                  <button
                    key={url}
                    type="button"
                    onClick={() => setSelectedImage(url)}
                    className={`relative h-16 w-24 flex-shrink-0 overflow-hidden rounded-2xl border ${
                      heroImage === url
                        ? "border-[#007aff]"
                        : "border-[#e5e5ea]"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={url}
                      alt="Jeju tour thumbnail"
                      className="h-full w-full object-cover"
                    />
                  </button>
                ))}
              {gallery.length > 6 && (
                <button
                  type="button"
                  onClick={() => setShowAllPhotos((v) => !v)}
                  className="flex h-16 w-20 flex-shrink-0 items-center justify-center rounded-2xl border border-dashed border-[#d1d1d6] text-[11px] text-[#555]"
                >
                  {showAllPhotos ? "Hide" : `+${gallery.length - 6} more`}
                </button>
              )}
            </div>
          </div>

          {/* Basic Info Block */}
          <div className="px-5 pb-5 pt-4 sm:px-6 sm:pb-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 leading-tight mb-2">
                  {tour.title}
                </h1>
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <div className="flex items-center gap-1.5">
                    <svg className="w-5 h-5 text-yellow-400 fill-current" viewBox="0 0 20 20">
                      <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                    </svg>
                    <span className="font-semibold text-gray-900">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-gray-500">
                      ({reviews.length} reviews)
                    </span>
                  </div>
                  {tour.duration && (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-sm font-medium">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      {tour.duration}
                    </span>
                  )}
                </div>
              </div>
              {/* Action buttons */}
              <div className="flex items-center gap-2">
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                  </svg>
                </button>
                <button className="p-2 rounded-full hover:bg-gray-100 transition-colors">
                  <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* About this activity */}
        <section className="mt-4 rounded-xl bg-gradient-to-br from-blue-50 via-indigo-50/50 to-purple-50/30 border-2 border-blue-200 shadow-lg p-4 sm:p-5">
          <h2 className="text-base font-bold text-gray-900 mb-3 flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center shadow-sm">
              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            About this activity
          </h2>
          <div className="space-y-2.5">
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
              <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 mb-0.5">Free cancellation</div>
                <div className="text-xs text-gray-600 leading-relaxed">Cancel up to 24 hours in advance for a full refund</div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
              <div className="w-5 h-5 rounded-md bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 mb-0.5">Reserve now & pay later</div>
                <div className="text-xs text-gray-600 leading-relaxed">Keep your travel plans flexible — book your spot and pay nothing today</div>
              </div>
            </div>
            <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
              <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-bold text-gray-900 mb-0.5">Live tour guide</div>
                <div className="text-xs text-gray-600 leading-relaxed">English, Chinese, Korean</div>
              </div>
            </div>
            {tour.pickupInfo && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
                <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-sm">
                  <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-bold text-gray-900 mb-0.5">Pickup included</div>
                  <div className="text-xs text-gray-600 leading-relaxed">Please wait in the hotel lobby 10 minutes before your scheduled pickup time</div>
                </div>
              </div>
            )}
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
              <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l9-5-9-5-9 5 9 5z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-900">Wheelchair accessible</span>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/80 border border-blue-100 shadow-sm">
              <div className="w-5 h-5 rounded-md bg-blue-500 flex items-center justify-center flex-shrink-0 shadow-sm">
                <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
              </div>
              <span className="text-sm font-bold text-gray-900">Private group</span>
            </div>
          </div>
        </section>

        {/* ===== 2. Main Content Layout ===== */}
        <section className="mt-6 grid gap-6 sm:grid-cols-[minmax(0,2fr)_minmax(320px,1fr)]">
          {/* ----- LEFT: Content ----- */}
          <div className="space-y-6">
            {/* Description */}
            {tour.description && (
              <section
                id="description"
                className="rounded-2xl bg-white border border-gray-100 p-5 sm:p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Full Description
                </h2>
                <div className="prose prose-sm max-w-none">
                  <DescriptionContent description={tour.description} />
                </div>
              </section>
            )}

            {/* Photo Gallery */}
            {tour.galleryImages && tour.galleryImages.length > 0 && (
              <section id="gallery">
                <GalleryGrid 
                  images={tour.galleryImages.map((url: string, index: number) => ({
                    url,
                    title: `Gallery Image ${index + 1}`,
                    description: '',
                  }))} 
                />
              </section>
            )}

            {/* Highlights */}
            {tour.highlights && tour.highlights.length > 0 && (
              <section
                id="highlights"
                className="rounded-2xl bg-white border border-gray-100 p-5 sm:p-6"
              >
                <h2 className="text-xl font-semibold text-gray-900 mb-4">
                  Highlights
                </h2>
                <ul className="space-y-3 text-sm sm:text-base text-gray-700">
                  {tour.highlights.map((h) => (
                    <li key={h} className="flex items-start gap-3">
                      <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{h}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Itinerary */}
            {tour.schedule && tour.schedule.length > 0 && (
              <section
                id="itinerary"
                className="rounded-2xl bg-white border border-gray-100 p-5 sm:p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold text-gray-900">
                    Itinerary
                  </h2>
                  <button
                    type="button"
                    onClick={() => setShowFullItinerary((v) => !v)}
                    className="text-sm font-medium text-blue-600 hover:text-blue-700"
                  >
                    {showFullItinerary ? "Collapse" : "Show full itinerary"}
                  </button>
                </div>

                <div
                  className={`space-y-3 ${
                    !showFullItinerary ? "max-h-64 overflow-hidden" : ""
                  }`}
                >
                  {tour.schedule.map((item, index) => (
                    <div
                      key={item.time + item.title}
                      className="flex gap-4 rounded-xl bg-gray-50 p-4 border border-gray-100"
                    >
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-semibold flex-shrink-0">
                          {index + 1}
                        </div>
                        {tour.schedule && index < tour.schedule.length - 1 && (
                          <div className="w-0.5 h-full bg-gray-200 my-2" />
                        )}
                      </div>
                      <div className="flex-1 pt-1">
                        <div className="text-sm font-semibold text-blue-600 mb-1">
                          {item.time}
                        </div>
                        <div className="font-semibold text-gray-900 mb-1">{item.title}</div>
                        {item.description && (
                          <div className="text-sm text-gray-600">
                            {item.description}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {!showFullItinerary && tour.schedule && tour.schedule.length > 3 && (
                  <p className="mt-3 text-xs text-gray-500">
                    Itinerary may change depending on weather and traffic.
                  </p>
                )}
              </section>
            )}

            {/* What's Included/Excluded */}
            {(tour.includes || tour.excludes) && (
              <section className="rounded-2xl bg-white border border-gray-100 p-5 sm:p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-5">What's Included</h2>
                <div className="grid gap-6 sm:grid-cols-2">
                  {tour.includes && (
                    <div>
                      <h3 className="mb-3 text-base font-semibold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        Included
                      </h3>
                      <ul className="space-y-2.5 text-sm text-gray-700">
                        {tour.includes.map((inc) => (
                          <li key={inc} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                            </svg>
                            <span>{inc}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {tour.excludes && (
                    <div>
                      <h3 className="mb-3 text-base font-semibold text-gray-900 flex items-center gap-2">
                        <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        Not Included
                      </h3>
                      <ul className="space-y-2.5 text-sm text-gray-700">
                        {tour.excludes.map((ex) => (
                          <li key={ex} className="flex items-start gap-3">
                            <svg className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            <span>{ex}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Important Information */}
            {(tour.pickupInfo || tour.notes) && (
              <section className="rounded-2xl bg-white border border-gray-100 p-5 sm:p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-4">Important Information</h2>
                {tour.pickupInfo && (
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-gray-900 mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      Pickup & Drop-off
                    </h3>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {tour.pickupInfo}
                    </p>
                  </div>
                )}
                {tour.notes && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 p-4">
                    <h3 className="text-base font-semibold text-amber-900 mb-2 flex items-center gap-2">
                      <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Please Note
                    </h3>
                    <p className="text-sm text-amber-800 leading-relaxed whitespace-pre-line">
                      {tour.notes}
                    </p>
                  </div>
                )}
              </section>
            )}

            {/* Reviews */}
            <section
              id="reviews"
              className="rounded-2xl bg-white border border-gray-100 p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 mb-2">
                    Customer Reviews
                  </h2>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center gap-1">
                      <svg className="w-6 h-6 text-yellow-400 fill-current" viewBox="0 0 20 20">
                        <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                      </svg>
                      <span className="text-2xl font-bold text-gray-900">
                        {averageRating.toFixed(1)}
                      </span>
                    </div>
                    <span className="text-sm text-gray-600">
                      based on {reviews.length} reviews
                    </span>
                  </div>
                </div>

                {showAllReviews && reviews.length > 0 && (
                  <div className="flex items-center gap-2 text-[12px]">
                    <span className="text-[#666]">Sort by</span>
                    <select
                      value={sortBy}
                      onChange={(e) =>
                        setSortBy(e.target.value as ReviewSort)
                      }
                      className="rounded-full border border-[#ddd] bg-white px-3 py-1"
                    >
                      <option value="ratingDesc">Highest rating</option>
                      <option value="ratingAsc">Lowest rating</option>
                      <option value="newest">Newest</option>
                      <option value="oldest">Oldest</option>
                      <option value="helpful">Most helpful</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                {visibleReviews.map((r) => (
                  <article
                    key={r.id}
                    className="rounded-xl border border-gray-200 bg-gray-50 p-4"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm">
                          {r.author.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-gray-900">{r.author}</div>
                          <div className="text-xs text-gray-500">{r.date}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <svg
                            key={i}
                            className={`w-4 h-4 ${i < Math.round(r.rating) ? 'text-yellow-400 fill-current' : 'text-gray-300'}`}
                            viewBox="0 0 20 20"
                          >
                            <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z"/>
                          </svg>
                        ))}
                      </div>
                    </div>
                    <div className="text-sm font-semibold text-gray-900 mb-1">
                      {r.title}
                    </div>
                    <p className="text-sm text-gray-700 leading-relaxed">
                      {r.content}
                    </p>
                    {r.helpfulVotes > 0 && (
                      <div className="mt-3 text-xs text-gray-500">
                        {r.helpfulVotes} people found this helpful
                      </div>
                    )}
                  </article>
                ))}

                {reviews.length === 0 && (
                  <div className="text-center py-8">
                    <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                    <p className="text-sm text-gray-500">
                      There are no reviews yet. Be the first to share your experience.
                    </p>
                  </div>
                )}
              </div>

              {reviews.length > 3 && (
                <button
                  type="button"
                  onClick={() => setShowAllReviews((v) => !v)}
                  className="mt-4 w-full rounded-lg border-2 border-blue-600 bg-white py-3 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  {showAllReviews ? "Show top reviews only" : `View all ${reviews.length} reviews`}
                </button>
              )}

              {/* Review Form */}
              <div className="mt-6 border-t border-gray-200 pt-5">
                <h3 className="mb-4 text-lg font-semibold text-gray-900">
                  Write a review
                </h3>
                <form
                  onSubmit={handleSubmitReview}
                  className="space-y-4"
                >
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Your name
                      </label>
                      <input
                        type="text"
                        value={newReview.author}
                        onChange={(e) =>
                          setNewReview((prev) => ({
                            ...prev,
                            author: e.target.value,
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                        placeholder="Enter your name"
                      />
                    </div>
                    <div>
                      <label className="mb-2 block text-sm font-medium text-gray-700">
                        Rating
                      </label>
                      <select
                        value={newReview.rating}
                        onChange={(e) =>
                          setNewReview((prev) => ({
                            ...prev,
                            rating: Number(e.target.value),
                          }))
                        }
                        className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                      >
                        {[5, 4, 3, 2, 1].map((r) => (
                          <option key={r} value={r}>
                            {r} {r === 1 ? 'star' : 'stars'}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Review title
                    </label>
                    <input
                      type="text"
                      value={newReview.title}
                      onChange={(e) =>
                        setNewReview((prev) => ({
                          ...prev,
                          title: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                      placeholder="Give your review a title"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-sm font-medium text-gray-700">
                      Your experience
                    </label>
                    <textarea
                      rows={4}
                      value={newReview.content}
                      onChange={(e) =>
                        setNewReview((prev) => ({
                          ...prev,
                          content: e.target.value,
                        }))
                      }
                      className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors resize-none"
                      placeholder="Share your experience with others..."
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-3 text-sm font-semibold text-white shadow-sm transition-colors"
                  >
                    Submit review
                  </button>
                </form>
              </div>
            </section>

            {/* FAQ */}
            <section
              id="faq"
              className="rounded-2xl bg-white border border-gray-100 p-5 sm:p-6"
            >
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Frequently Asked Questions
              </h2>
              <div className="divide-y divide-gray-200">
                {faqs.map((faq, idx) => (
                  <details
                    key={faq.question}
                    className="py-4 first:pt-0"
                    open={idx === 0}
                  >
                    <summary className="cursor-pointer list-none font-semibold text-gray-900 hover:text-blue-600 transition-colors flex items-center justify-between">
                      <span>{faq.question}</span>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </summary>
                    <p className="mt-3 text-sm text-gray-700 leading-relaxed pl-6">
                      {faq.answer}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          </div>

          {/* ----- RIGHT: Booking Card (sticky) ----- */}
          <aside className="sm:sticky sm:top-24">
            <div className="rounded-2xl bg-white border-2 border-gray-200 shadow-lg p-5 sm:p-6">
              <div className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-3">
                Starting Price
              </div>

              <div className="mb-4">
                <div className="text-3xl font-bold text-gray-900 mb-1">
                  {tour.price}
                </div>
                <div className="text-sm text-gray-600">
                  {tour.priceType === 'group' ? 'per group up to 6' : 'per person'}
                </div>
              </div>

              <div className="space-y-3 mb-4 pb-4 border-b border-gray-200">
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Free cancellation up to 24 hours before (local time)</span>
                </div>
                <div className="flex items-start gap-2 text-xs text-gray-600">
                  <svg className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>Reserve now & pay later</span>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Select date
                  </label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-gray-700">
                    Participants
                  </label>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() =>
                        setGuests((g) => (g > 1 ? g - 1 : 1))
                      }
                      className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700 font-semibold"
                    >
                      –
                    </button>
                    <div className="flex-1 text-center text-base font-semibold text-gray-900">
                      {guests} {guests === 1 ? 'person' : 'people'}
                    </div>
                    <button
                      type="button"
                      onClick={() => setGuests((g) => g + 1)}
                      className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-gray-300 hover:border-blue-500 hover:bg-blue-50 transition-colors text-gray-700 font-semibold"
                    >
                      +
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBookNow}
                  className="w-full rounded-lg bg-blue-600 hover:bg-blue-700 py-3.5 text-base font-semibold text-white shadow-md transition-colors"
                >
                  Check availability
                </button>

                <p className="text-xs text-gray-500 text-center leading-relaxed">
                  You'll be redirected to the next step to complete your booking. Remaining balance can be paid in cash on the tour day.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </main>

      {/* Image Modal */}
      {isImageModalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black flex items-center justify-center"
          onClick={() => setIsImageModalOpen(false)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsImageModalOpen(false);
            }}
            className="absolute top-4 right-4 z-[101] p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors cursor-pointer"
            aria-label="Close"
            type="button"
          >
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div 
            className="relative w-full h-full flex items-center justify-center p-4" 
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={heroImage}
              alt={tour.title}
              fill
              className="object-contain"
              sizes="100vw"
            />
            {gallery.length > 1 && (
              <>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIndex = gallery.indexOf(heroImage);
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : gallery.length - 1;
                    setSelectedImage(gallery[prevIndex]);
                  }}
                  className="absolute left-4 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors z-10"
                  type="button"
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    const currentIndex = gallery.indexOf(heroImage);
                    const nextIndex = currentIndex < gallery.length - 1 ? currentIndex + 1 : 0;
                    setSelectedImage(gallery[nextIndex]);
                  }}
                  className="absolute right-4 p-3 bg-white/20 backdrop-blur-sm rounded-full hover:bg-white/30 transition-colors z-10"
                  type="button"
                >
                  <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 px-4 py-2 bg-black/50 backdrop-blur-sm rounded-full text-white text-sm z-10">
                  {gallery.indexOf(heroImage) + 1} / {gallery.length}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
