// app/search/page.tsx
"use client";

import React, { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import TourCardDetail from "../../components/TourCardDetail";

function SearchResults() {
  const searchParams = useSearchParams();
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cityRaw = searchParams.get("city");
  const qRaw = searchParams.get("q");

  const cityParam = cityRaw && cityRaw !== "All" ? cityRaw : null;
  const qParam = qRaw?.trim() || "";

  useEffect(() => {
    const fetchTours = async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams();
        
        if (cityParam) {
          params.append('city', cityParam);
        }
        
        if (qParam) {
          params.append('search', qParam);
        }

        const response = await fetch(`/api/tours?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch tours');
        }

        const data = await response.json();
        
        // Transform API data to match TourCardDetail expectations
        const transformedTours = data.tours.map((tour: any) => ({
          id: tour.id,
          title: tour.title,
          city: tour.city,
          tag: tour.badges?.join(', ') || '',
          price: tour.price,
          originalPrice: tour.originalPrice,
          priceType: tour.priceType,
          image: tour.image,
          duration: tour.duration,
          rating: tour.rating,
          reviewCount: tour.reviewCount,
          notes: tour.description || '',
          pickupInfo: tour.pickupPoints?.length > 0 
            ? `${tour.pickupPoints.length} pickup point${tour.pickupPoints.length > 1 ? 's' : ''}`
            : 'No pickup points',
          slug: tour.id, // Use ID as slug for now
        }));

        setResults(transformedTours);
      } catch (err: any) {
        console.error('Error fetching tours:', err);
        setError(err.message || 'Failed to load tours');
      } finally {
        setLoading(false);
      }
    };

    fetchTours();
  }, [cityParam, qParam]);

  return (
    <>
      {/* 상단 그라데이션 영역 */}
      <section className="border-b border-[#e5e5ea]/70 bg-gradient-to-b from-white via-[#f9f9fb] to-[#f5f5f7]">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 px-4 pt-4 pb-4 sm:pt-6 sm:pb-5">
          <div>
            <h1 className="text-[20px] sm:text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">
              Search results
            </h1>
            <p className="mt-1 text-[12px] sm:text-[13px] text-[#6e6e73]">
              Find the right tour in seconds. Refine by destination and keyword.
            </p>
          </div>

          {/* 요약/필터 상태 바 */}
          <div className="flex flex-wrap items-center gap-2 rounded-3xl bg-white/80 px-3 py-2 shadow-[0_6px_18px_rgba(0,0,0,0.04)]">
            <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] font-medium text-[#3a3a3c]">
              {results.length} tour{results.length !== 1 && "s"} found
            </span>

            {cityParam ? (
              <span className="rounded-full bg-[#0c66ff]/10 px-2.5 py-1 text-[11px] font-medium text-[#0c66ff]">
                Destination: {cityParam}
              </span>
            ) : (
              <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] text-[#6e6e73]">
                Destination: All
              </span>
            )}

            <span className="rounded-full bg-[#f2f2f7] px-2.5 py-1 text-[11px] text-[#6e6e73]">
              Keyword: {qParam ? <b>{qParam}</b> : "—"}
            </span>
          </div>
        </div>
      </section>

      {/* 결과 리스트 영역 */}
      <section className="mx-auto mt-4 w-full max-w-5xl px-2 sm:px-4">
        {loading ? (
          <div className="mx-auto mt-10 w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[13px] text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-[#111111]">Loading search results...</p>
          </div>
        ) : error ? (
          <div className="mx-auto mt-10 w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[13px] text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <p className="font-medium text-red-600 mb-2">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
            >
              Retry
            </button>
          </div>
        ) : results.length === 0 ? (
          <div className="mx-auto mt-10 w-[90%] max-w-3xl rounded-3xl bg-white/95 px-4 py-6 text-center text-[13px] text-[#6e6e73] shadow-[0_10px_30px_rgba(0,0,0,0.04)]">
            <p className="font-medium text-[#111111]">
              No tours match your search.
            </p>
            <p className="mt-1 text-[12px] text-[#6e6e73]">
              Try removing some filters or using a broader keyword like
              <span className="font-semibold"> "Busan"</span> or{" "}
              <span className="font-semibold">"UNESCO"</span>.
            </p>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {results.map((tour) => (
              <TourCardDetail key={tour.id} tour={tour} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default function SearchPage() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] pb-10">
      <Suspense fallback={
        <div className="min-h-screen bg-[#f5f5f7] pb-10 flex items-center justify-center">
          <div className="text-center">
            <p className="text-[#6e6e73]">Loading search results...</p>
          </div>
        </div>
      }>
        <SearchResults />
      </Suspense>
    </main>
  );
}
