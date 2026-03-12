"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations, useI18n } from "@/lib/i18n";
import { useState, useEffect, useCallback } from "react";
import TourCard from "@/components/TourCard";

const FIXED_TOURS_LIMIT = 4;
const PROPOSED_POLL_MS = 20000;
const PROPOSED_PREVIEW_LIMIT = 3;

interface ProposedTour {
  id: string;
  title: string;
  summary: string | null;
  participants: number;
  vehicle_type: "van" | "large_van";
  total_price_krw: number;
  schedule: Array<{ day: number; places: unknown[] }>;
  created_at: string;
}

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
  price_type?: "person" | "group";
  duration?: string;
}

export default function DestinationsCards() {
  const t = useTranslations();
  const { locale } = useI18n();
  const [tours, setTours] = useState<Tour[]>([]);
  const [toursLoading, setToursLoading] = useState(true);
  const [proposedTours, setProposedTours] = useState<ProposedTour[]>([]);

  const fetchProposed = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-join-tour/proposed", { cache: "no-store" });
      const data = await res.json();
      setProposedTours((data.proposedTours || []).slice(0, PROPOSED_PREVIEW_LIMIT));
    } catch {
      setProposedTours([]);
    }
  }, []);

  useEffect(() => {
    fetchProposed();
    const interval = setInterval(fetchProposed, PROPOSED_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchProposed]);

  useEffect(() => {
    const fetchTours = async () => {
      try {
        setToursLoading(true);
        const response = await fetch(
          `/api/tours?limit=${FIXED_TOURS_LIMIT}&sortBy=rating&sortOrder=desc&isActive=true&locale=${encodeURIComponent(locale)}`
        );
        if (!response.ok) throw new Error("Failed to fetch tours");
        const data = await response.json();
        const list = data.tours || [];
        const transformed: Tour[] = list.slice(0, FIXED_TOURS_LIMIT).map((tour: Record<string, unknown>) => ({
          id: tour.id,
          slug: tour.slug,
          title: String(tour.title ?? ""),
          city: String(tour.location ?? tour.city ?? ""),
          price: Number(tour.price ?? 0),
          original_price: tour.originalPrice != null ? Number(tour.originalPrice) : null,
          image: tour.image as string | undefined,
          images: tour.images as string[] | undefined,
          rating: tour.rating != null ? Number(tour.rating) : undefined,
          review_count: tour.reviewCount != null ? Number(tour.reviewCount) : undefined,
          badges: tour.badges as string[] | undefined,
          price_type: (tour.priceType as "person" | "group") ?? "person",
          duration: tour.duration as string | undefined,
        }));
        setTours(transformed);
      } catch (err) {
        console.error("DestinationsCards fetch error:", err);
      } finally {
        setToursLoading(false);
      }
    };
    fetchTours();
  }, [locale]);

  return (
    <section className="pt-6 pb-12 md:pt-8 md:pb-14 bg-gradient-to-b from-white via-slate-50/20 to-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500 bg-clip-text text-transparent">
            {t("home.destinations.title")}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {t("home.destinations.subtitle")}
          </p>
        </div>

        {/* AI 커스터마이징 조인 투어 — 모던 & 테크(科技感) */}
        <div className="mb-6 sm:mb-8 max-w-7xl mx-auto">
          <Link
            href="/custom-join-tour"
            className="group block relative overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.15)] bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            {/* 배경 이미지 + 호버 줌 */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/images/destinations/jeju-card.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-cover opacity-40 mix-blend-overlay group-hover:scale-[1.02] transition-transform duration-700"
              />
            </div>
            {/* 다크 그라데이션 오버레이 */}
            <div className="absolute inset-0 z-[1] bg-gradient-to-r from-slate-900/90 via-indigo-900/80 to-slate-900/90 backdrop-blur-[2px]" />
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-[1.1fr_1fr] min-h-[160px] sm:min-h-[180px] md:min-h-[200px] p-6 sm:p-8 md:p-10">
              <div className="flex flex-col justify-center text-left">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-semibold mb-4 backdrop-blur-sm w-fit">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mr-2 animate-pulse" aria-hidden />
                  <Image src="/images/robot-icon.png" alt="" width={14} height={14} className="object-contain mr-1.5" />
                  Semi-F.I.T
                </span>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
                  {t("home.destinations.aiCustomizingTitle")}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 ml-1">(Beta)</span>
                </h3>
                <p className="text-sm text-slate-300 mb-4 line-clamp-2 max-w-md">
                  {t("home.destinations.aiCustomizingDesc")}
                </p>
                <ul className="text-slate-300 space-y-2 mb-4 text-sm font-medium">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.destinations.aiStep1")}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.destinations.aiStep2")}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.destinations.aiStep3")}
                  </li>
                </ul>
                <span className="inline-flex items-center gap-1.5 mt-2 text-white font-semibold text-sm group-hover:gap-2 transition-all w-fit">
                  {t("home.destinations.aiCustomizingCta")}
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </div>
              <div className="hidden md:flex flex-col justify-center">
                <div className="w-full max-w-sm bg-white/10 p-1.5 rounded-2xl backdrop-blur-md border border-white/20">
                  <div className="rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 font-semibold text-white text-center shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-transform group-hover:scale-105">
                    {t("home.destinations.aiCustomizingCta")}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        </div>

        {/* 현재 발의된 투어 (실시간 갱신) */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-end justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {t("home.proposedTours.sectionTitle")}
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {t("home.proposedTours.sectionSubtitle")}
              </p>
            </div>
            <Link
              href="/custom-join-tour/proposed"
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              {t("home.proposedTours.viewAll")}
            </Link>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white/80 p-3 sm:p-4 min-h-[80px]">
            {proposedTours.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-500 py-2">{t("home.proposedTours.noItems")}</p>
            ) : (
              <ul className="space-y-2">
                {proposedTours.map((pt) => (
                  <li key={pt.id}>
                    <Link
                      href={`/custom-join-tour/proposed?id=${pt.id}`}
                      className="block rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 hover:bg-gray-50 transition"
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{pt.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {t("home.proposedTours.participantsCount").replace("{{n}}", String(pt.participants))} · {pt.vehicle_type === "large_van" ? t("home.proposedTours.largeVan") : t("home.proposedTours.van")} · {(pt.total_price_krw / 10000).toFixed(0)}만 원
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Fixed Itinerary Tours — 2열 2줄 */}
        <div>
          <div className="flex items-end justify-between gap-4 mb-4 sm:mb-5">
            <div>
              <h3 className="text-lg sm:text-xl font-bold text-gray-900">
                {t("home.destinations.fixedItineraryTitle")}
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
                {t("home.destinations.fixedItinerarySubtitle")}
              </p>
            </div>
            <Link
              href="/tours"
              className="text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap flex items-center gap-1"
            >
              {t("home.tourList.seeMore")}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            </Link>
          </div>

          {toursLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="bg-gray-100 rounded-lg aspect-[4/3] animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {tours.map((tour) => {
                const hasDiscount = tour.original_price != null && tour.original_price > tour.price;
                const discount =
                  hasDiscount && tour.original_price
                    ? Math.round(((tour.original_price - tour.price) / tour.original_price) * 100)
                    : undefined;
                const tourImage =
                  tour.image ||
                  (tour.images && tour.images[0]) ||
                  "https://images.unsplash.com/photo-1534008897995-27a23e859048?w=600&q=80";
                return (
                  <TourCard
                    key={tour.id}
                    id={tour.id}
                    slug={tour.slug}
                    title={tour.title}
                    location={tour.city}
                    type={tour.duration ?? "Day tour"}
                    duration={tour.duration}
                    price={tour.price / 1000}
                    originalPriceKRW={tour.original_price != null && tour.original_price > tour.price ? tour.original_price : undefined}
                    priceType={tour.price_type ?? "person"}
                    image={tourImage}
                    badge={tour.badges?.[0] ?? "Day tour"}
                    rating={tour.rating ?? 4.5}
                    reviewCount={tour.review_count ?? 0}
                    discount={discount}
                    badgeVariant="brand"
                  />
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
