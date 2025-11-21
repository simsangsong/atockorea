// app/search/page.tsx
import React from "react";
import TourCardDetail from "../../components/TourCardDetail";
import { detailedTours } from "../../data/tours";

// Next.js app router에서 page 컴포넌트는 이렇게 props로 searchParams를 받습니다.
type SearchPageProps = {
  searchParams?: {
    city?: string;
    q?: string;
  };
};

export default function SearchPage({ searchParams }: SearchPageProps) {
  // searchParams가 없을 수도 있으니 안전하게 처리
  const cityRaw = searchParams?.city; // "Busan" | "Jeju" | "Seoul" | undefined
  const qRaw = searchParams?.q;       // 키워드

  const cityParam = cityRaw && cityRaw !== "All" ? cityRaw : null;
  const qParam = qRaw?.toLowerCase().trim() || "";

  // 1) 도시 필터 + 2) 키워드 필터
  const results = detailedTours.filter((tour) => {
    // 도시 조건
    if (cityParam && tour.city !== cityParam) return false;

    // 키워드 조건 (제목, 태그, 비고, 픽업정보까지 포함해서 검색)
    if (qParam) {
      const haystack = (
        tour.title +
        " " +
        tour.tag +
        " " +
        (tour.notes || "") +
        " " +
        tour.pickupInfo
      )
        .toLowerCase()
        .replace(/null|undefined/g, "");

      if (!haystack.includes(qParam)) return false;
    }

    return true;
  });

  return (
    <main className="min-h-screen bg-[#f5f5f7] py-4 sm:py-6">
      <div className="mx-auto w-[90%] max-w-3xl">
        <h1 className="mb-2 text-[16px] sm:text-[18px] font-semibold text-[#111]">
          Search results
        </h1>
        <p className="mb-4 text-[12px] text-gray-500">
          {cityParam && (
            <>
              Destination: <strong>{cityParam}</strong> ·{" "}
            </>
          )}
          Keyword: <strong>{qParam || "—"}</strong> ·{" "}
          {results.length} tour(s) found
        </p>
      </div>

      {results.length === 0 && (
        <p className="mx-auto w-[90%] max-w-3xl text-[13px] text-gray-500">
          검색 결과가 없습니다. 도시/키워드를 바꿔서 다시 검색해 주세요.
        </p>
      )}

      {results.map((tour) => (
        <TourCardDetail key={tour.id} tour={tour} />
      ))}
    </main>
  );
}
