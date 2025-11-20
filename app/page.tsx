// app/page.tsx
"use client";

import React, { useState, useEffect } from "react";

type Destination = "All" | "Seoul" | "Busan" | "Jeju";

type Tour = {
  id: number;
  city: Destination;
  tag: string;
  title: string;
  desc: string;
  price: string;
  // 디테일 페이지 연결용 슬롯 (나중에 Link/router.push에 사용할 수 있음)
  href?: string;
};

const tours: Tour[] = [
  {
    id: 1,
    city: "Busan",
    tag: "Busan · Day tour",
    title: "Gamcheon Culture Village + Haeundae",
    desc: "Small-group · hotel pickup",
    price: "from US$79 / person",
    href: "/tours/busan-gamcheon-haeundae",
  },
  {
    id: 2,
    city: "Jeju",
    tag: "Jeju · Private",
    title: "East Jeju UNESCO highlights",
    desc: "Private van · flexible schedule",
    price: "from US$290 / group",
    href: "/tours/jeju-east-unesco",
  },
  {
    id: 3,
    city: "Busan",
    tag: "Busan · Night",
    title: "Gwangalli night view & local food",
    desc: "3–4 hours · foodie style",
    price: "from US$65 / person",
    href: "/tours/busan-gwangalli-night",
  },
];

/* ===================== Trust Bar ===================== */

function TrustBar() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-4">
      <div className="rounded-3xl border border-gray-200 bg-white px-5 py-3 shadow-sm">
        <div className="text-[13px] sm:text-[14px] font-semibold text-gray-900 tracking-tight">
          Licensed Korea-based platform for Busan &amp; Jeju day tours.
        </div>

        <div className="mt-2 flex flex-wrap gap-2.5 text-[11px] sm:text-[12px] text-gray-800 font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Licensed Korean travel agency
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Vetted local guides &amp; drivers
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Focus on Busan &amp; Jeju small-group &amp; private tours
          </span>
        </div>
      </div>
    </section>
  );
}

/* ================= Destinations Cards ================= */

type DestinationsProps = {
  selected: Destination;
  onChange: (d: Destination) => void;
};

function Destinations({ selected, onChange }: DestinationsProps) {
  const cards = [
    {
      key: "Busan" as Destination,
      label: "Busan",
      img: "https://images.unsplash.com/photo-1583407737804-4ab675d1b176?auto=format&fit=crop&w=900&q=80", // Busan 느낌
    },
    {
      key: "Jeju" as Destination,
      label: "Jeju",
      img: "https://images.unsplash.com/photo-1519120430-a7d2287c986a?auto=format&fit=crop&w=900&q=80", // Jeju 느낌
    },
    {
      key: "Seoul" as Destination,
      label: "Seoul (Coming Soon)",
      img: "https://images.unsplash.com/photo-1549692520-acc6669e2f0c?auto=format&fit=crop&w=900&q=80", // Seoul
    },
  ];

  return (
    <section className="mx-auto max-w-6xl px-4 pt-8">
      <h2 className="text-[16px] sm:text-[18px] font-semibold mb-3">
        Destinations
      </h2>

      <div className="flex gap-4 overflow-x-auto pb-1">
        {cards.map((card) => {
          const isActive = selected === card.key;
          const isSeoul = card.key === "Seoul";

          return (
            <button
              key={card.key}
              type="button"
              onClick={() => onChange(card.key)}
              className={[
                "relative rounded-3xl overflow-hidden flex-shrink-0",
                "min-w-[220px] h-[140px] sm:min-w-[260px] sm:h-[160px]",
                "transition transform",
                "hover:-translate-y-[3px] hover:shadow-md hover:shadow-gray-300",
                isActive ? "ring-2 ring-black/80 scale-[1.02]" : "ring-0",
              ].join(" ")}
            >
              <img
                src={card.img}
                alt={card.label}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-black/10" />
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <span className="text-white text-[16px] sm:text-[18px] font-semibold">
                  {card.label}
                </span>
              </div>
              {isSeoul && (
                <div className="absolute top-3 left-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-medium text-gray-800">
                  Coming soon
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* 예치금/결제 구조 설명: 히어로에서 내려온 내용 */}
      <p className="mt-3 max-w-3xl text-[11px] sm:text-[12px] text-gray-600">
        You pay a small deposit online to secure your spot, and then pay the
        remaining balance directly to your local guide or driver on the tour
        day.
      </p>
    </section>
  );
}

/* ================== Price / Local Banner ================== */

function PriceBanner() {
  return (
    <>
      <section className="mx-auto max-w-6xl px-4 mt-6">
        <div className="rounded-2xl bg-green-50 py-4 px-5 text-center">
          <h3 className="font-semibold text-[14px] text-gray-900">
            Local price. No extra marketplace markups.
          </h3>
          <p className="text-[11px] mt-1 text-gray-600">
            We work directly with local partners in Busan and Jeju, so prices
            are often lower than global OTAs that add additional margins.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 mt-4">
        <div className="rounded-2xl border border-gray-200 bg-white py-4 px-5 text-center shadow-sm">
          <p className="text-[11px] sm:text-[12px] text-gray-700">
            Each tour is operated by verified local partners with clear,
            transparent inclusions and exclusions before you pay anything.
          </p>
        </div>
      </section>
    </>
  );
}

/* ===================== Tour List ===================== */

type TourListProps = {
  selected: Destination;
};

function TourList({ selected }: TourListProps) {
  const filtered =
    selected === "All" ? tours : tours.filter((t) => t.city === selected);

  return (
    <section className="mx-auto max-w-6xl px-4 pt-7 pb-10">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-[15px] sm:text-[17px] font-semibold">
          {selected === "All" ? "Popular day tours" : `${selected} tours`}
        </h2>
        <button className="text-[11px] text-gray-500 underline">
          View all
        </button>
      </div>

      {selected === "Seoul" && (
        <div className="mb-4 rounded-2xl bg-gray-50 border border-dashed border-gray-200 px-4 py-3 text-[11px] sm:text-[12px] text-gray-600">
          Seoul products are being prepared. Busan and Jeju are available to
          book now.
        </div>
      )}

      {filtered.length === 0 && selected !== "Seoul" && (
        <p className="text-[11px] sm:text-[12px] text-gray-500 mt-3">
          No tours available yet for this destination.
        </p>
      )}

      {filtered.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-1">
          {filtered.map((tour) => (
            <article
              key={tour.id}
              className="min-w-[220px] max-w-[240px] rounded-3xl border border-gray-100 bg-white/95 shadow-sm flex-shrink-0 overflow-hidden transition transform hover:-translate-y-[3px] hover:shadow-md hover:shadow-gray-200"
            >
              <div className="h-[110px] bg-gradient-to-br from-[#dde1ea] to-[#f5f5f7]" />
              <div className="p-4">
                <div className="text-[10px] font-semibold text-blue-600">
                  {tour.tag}
                </div>
                <div className="mt-1 text-[14px] font-semibold">
                  {tour.title}
                </div>
                <div className="mt-1 text-[11px] text-gray-600">
                  {tour.desc}
                </div>
                <div className="mt-2 text-[12px] font-semibold">
                  {tour.price}
                </div>
                <button
                  className="mt-3 w-full rounded-xl border border-gray-200 py-2 text-[11px] font-semibold hover:bg-gray-50 transition"
                  type="button"
                  data-href={tour.href || ""}
                  // TODO: 여기에서 router.push(tour.href) 또는 <Link>로 연결하면 디테일 페이지 이동 가능
                >
                  See details
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

/* ===================== Main Page ===================== */

export default function Home() {
  const [selectedDestination, setSelectedDestination] =
    useState<Destination>("All");

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchHistory, setSearchHistory] = useState<string[]>([]);

  // 검색 기록 localStorage에서 복원
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const saved = window.localStorage.getItem("atoc-search-history");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const cleaned = parsed
            .filter((x) => typeof x === "string")
            .slice(0, 10);
          if (cleaned.length) {
            setSearchHistory(cleaned);
          }
        }
      }
    } catch {
      // 실패해도 무시 (가볍게 유지)
    }
  }, []);

  // 검색 기록 localStorage에 저장
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "atoc-search-history",
        JSON.stringify(searchHistory)
      );
    } catch {
      // 실패해도 무시
    }
  }, [searchHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setSearchHistory((prev) => {
      const next = [trimmed, ...prev.filter((t) => t !== trimmed)];
      return next.slice(0, 10);
    });

    // TODO: 여기서 실제 검색 로직이나 필터링을 연결할 수 있음
    setIsSearchOpen(false);
  };

  return (
    <>
      {/* HERO */}
      <section className="relative w-full">
        <div className="relative">
          <img
            src="https://images.unsplash.com/photo-1528155124524-3b29e35661c5?auto=format&fit=crop&w=1600&q=80"
            className="w-full h-[260px] sm:h-[320px] object-cover"
            alt="Korea coastal view"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/40 to-black/10" />

          <div className="absolute inset-0 flex flex-col justify-end px-6 pb-10 text-white sm:px-8 sm:pb-14 max-w-3xl mx-auto">
            <p className="text-[11px] sm:text-[12px] uppercase tracking-[0.16em] text-white/70 mb-1">
              Local day tours in Korea
            </p>
            <h1 className="text-[20px] sm:text-[24px] font-semibold leading-snug">
              Direct connection to trusted Korea tours.
            </h1>

            {/* 히어로의 예치금 설명 문장은 Destinations 아래로 이동했음 */}

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-[11px] sm:text-[12px] font-semibold text-black shadow-sm"
                type="button"
                onClick={() => setIsSearchOpen(true)}
              >
                Find my day tour
              </button>
              {/* 버튼 옆 문구 제거 */}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <TrustBar />

      {/* DESTINATIONS (카드형) */}
      <Destinations
        selected={selectedDestination}
        onChange={setSelectedDestination}
      />

      {/* PRICE & LOCAL PLATFORM BANNERS */}
      <PriceBanner />

      {/* FILTERED TOUR LIST */}
      <TourList selected={selectedDestination} />

      {/* 검색 오버레이 (반투명, 가볍게 구현) */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify-center bg-black/40">
          <div className="mt-24 w-full max-w-md mx-4 rounded-2xl bg-white/90 backdrop-blur px-4 py-4 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-[13px] font-semibold text-gray-900">
                Search day tours
              </h2>
              <button
                type="button"
                className="text-[11px] text-gray-500"
                onClick={() => setIsSearchOpen(false)}
              >
                Close
              </button>
            </div>

            <form
              onSubmit={handleSearchSubmit}
              className="flex items-center gap-2"
            >
              <input
                className="flex-1 rounded-xl border border-gray-200 bg-white/80 px-3 py-2 text-[12px] text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#0c66ff]"
                placeholder="Search by city, tour type, or keyword…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              <button
                type="submit"
                className="rounded-xl bg-black px-3 py-2 text-[11px] font-semibold text-white"
              >
                Search
              </button>
            </form>

            {searchHistory.length > 0 && (
              <div className="mt-3">
                <div className="mb-1 text-[11px] text-gray-500">
                  Recent searches
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {searchHistory.map((term) => (
                    <button
                      key={term}
                      type="button"
                      className="rounded-full border border-gray-200 bg-white/80 px-2.5 py-1 text-[11px] text-gray-700"
                      onClick={() => setSearchQuery(term)}
                    >
                      {term}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
