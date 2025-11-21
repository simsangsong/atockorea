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
          Licensed Korea-based platform for Korea’s day tours.
        </div>

        <div className="mt-2 flex flex-wrap gap-2.5 text-[11px] sm:text-[12px] text-gray-800 font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Licensed Korean travel agencies
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Certificated local guides &amp; drivers
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Focus on group-tour &amp; private tours
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

type DestinationCard = {
  key: Destination;
  label: string;
  imageUrl?: string; // 여기에 나중에 이미지 링크 넣으면 됨
};

function Destinations({ selected, onChange }: DestinationsProps) {
  const cards: DestinationCard[] = [
    {
      key: "Busan",
      label: "Busan",
      imageUrl: "", // 예: "/images/busan.jpg"
    },
    {
      key: "Jeju",
      label: "Jeju",
      imageUrl: "", // 예: "/images/jeju.jpg"
    },
    {
      key: "Seoul",
      label: "Seoul (Coming Soon)",
      imageUrl: "", // 예: "/images/seoul.jpg"
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
              {/* 배경 그라디언트 + 이미지 슬롯 */}
              <div className="absolute inset-0 overflow-hidden">
                <div className="h-full w-full bg-gradient-to-br from-[#dbe3ff] via-[#d2dbff] to-[#b9c7ff]" />
                {/* 여기에 나중에 이미지 넣기 */}
                {card.imageUrl && (
                  <img
                    src={card.imageUrl}
                    alt={card.label}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
              </div>

              {/* 텍스트 오버레이 */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/30 to-black/5" />
              <div className="absolute inset-0 flex items-center justify-center px-4">
                <span className="text-white text-[16px] sm:text-[18px] font-semibold drop-shadow">
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
            Local platform. Lower Price.
          </h3>
          <p className="text-[11px] mt-1 text-gray-600">
            Direct partnership with local travel agencies allows us to offer
            lower prices than global OTAs.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 mt-4">
        <div className="rounded-2xl border border-gray-200 bg-white py-4 px-5 text-center shadow-sm">
          <p className="text-[11px] sm:text-[12px] text-gray-700">
            You pay a small deposit online to secure your spot, and then pay the
            remaining balance directly to your local guide or driver on the tour
            day.
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
    } catch {}
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(
        "atoc-search-history",
        JSON.stringify(searchHistory)
      );
    } catch {}
  }, [searchHistory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchQuery.trim();
    if (!trimmed) return;

    setSearchHistory((prev) => {
      const next = [trimmed, ...prev.filter((t) => t !== trimmed)];
      return next.slice(0, 10);
    });

    setIsSearchOpen(false);
  };

  return (
    <main className="min-h-screen bg-[#f5f5f7] text-[#111]">
      {/* ===== HERO (그라디언트만, 그림 제거) ===== */}
      <section className="relative w-full">
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <div
            className="
              relative overflow-hidden rounded-[32px]
              bg-gradient-to-b from-[#dbe3ff] via-[#d2dbff] to-[#b9c7ff]
              px-6 sm:px-8 pt-10 pb-8
              shadow-[0_22px_50px_rgba(15,23,42,0.25)]
            "
          >
            {/* 은은한 빛 효과만 유지 */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-white/40 blur-[110px]" />
            <div className="pointer-events-none absolute -right-16 top-4 h-56 w-56 rounded-full bg-[#0c46c5]/25 blur-[100px]" />
            <div className="pointer-events-none absolute bottom-[-60px] left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-[#405bff]/25 blur-[120px]" />

            {/* 텍스트 블록 */}
            <div className="relative z-10 max-w-xl space-y-3">
              <h1 className="text-base sm:text-lg md:text-xl font-semibold leading-snug">
                Direct connection
                <br />
                to trusted Korea tours.
              </h1>

              <div className="pt-3">
                <button
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                  className="inline-flex items-center justify-center rounded-full bg-[#0c66ff] px-6 py-2 text-[11px] font-medium text-white shadow hover:bg-[#0a54d0] transition"
                >
                  Find my day tour
                </button>
              </div>
            </div>
            {/* 하단 그림 SVG 전부 제거됨 */}
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <TrustBar />

      {/* DESTINATIONS */}
      <Destinations
        selected={selectedDestination}
        onChange={setSelectedDestination}
      />

      {/* PRICE & LOCAL PLATFORM BANNERS */}
      <PriceBanner />

      {/* FILTERED TOUR LIST */}
      <TourList selected={selectedDestination} />

      {/* 검색 오버레이 */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-40 flex items-start justify_center bg-black/40">
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
    </main>
  );
}
