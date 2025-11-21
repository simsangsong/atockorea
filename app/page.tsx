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

/* =============== Destinations 纯代码插画 =============== */

type DestinationArtProps = {
  variant: "Seoul" | "Busan" | "Jeju";
};

function DestinationArt({ variant }: DestinationArtProps) {
  if (variant === "Seoul") {
    // 南山塔 + 城市剪影
    return (
      <svg
        viewBox="0 0 400 260"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="seoulGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7fbff" />
            <stop offset="100%" stopColor="#dce7ff" />
          </linearGradient>
        </defs>
        <rect width="400" height="260" fill="url(#seoulGrad)" />
        {/* 远山 */}
        <path
          d="M0 170 C 60 140 110 145 170 165 C 230 185 280 175 340 160 C 370 152 390 150 400 152 L400 260 L0 260 Z"
          fill="#cadaf7"
        />
        {/* 城市块状建筑 */}
        <rect x="40" y="140" width="30" height="50" fill="#b7c8f2" />
        <rect x="75" y="130" width="22" height="60" fill="#c3d0f4" />
        <rect x="110" y="150" width="26" height="40" fill="#b4c4f0" />
        <rect x="310" y="145" width="24" height="45" fill="#b4c4f0" />
        <rect x="336" y="135" width="20" height="55" fill="#c3d0f4" />
        {/* 南山塔 */}
        <g transform="translate(210,60)">
          {/* 山顶 */}
          <path
            d="M-80 140 C -40 110 40 110 80 140 L80 160 L-80 160 Z"
            fill="#b7c8f2"
          />
          {/* 塔身 */}
          <rect x="4" y="30" width="4" height="80" fill="#9fb6ea" />
          <rect x="-16" y="60" width="40" height="20" rx="10" fill="#9fb6ea" />
          {/* 上层 */}
          <rect x="5" y="10" width="2" height="40" fill="#9fb6ea" />
          <rect x="4" y="-10" width="4" height="20" fill="#9fb6ea" />
          <path d="M6 -25 L2 -10 L10 -10 Z" fill="#9fb6ea" />
        </g>
        {/* 前景雾 */}
        <rect
          x="0"
          y="180"
          width="400"
          height="80"
          fill="url(#seoulMist)"
        />
        <defs>
          <linearGradient id="seoulMist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#e3ecff" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#e3ecff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  if (variant === "Busan") {
    // 广安大桥 + 바다
    return (
      <svg
        viewBox="0 0 400 260"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="busanGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5fbff" />
            <stop offset="100%" stopColor="#cfe7ff" />
          </linearGradient>
        </defs>
        <rect width="400" height="260" fill="url(#busanGrad)" />
        {/* 远山线 */}
        <path
          d="M0 150 C 70 135 120 130 190 140 C 250 148 300 145 360 138 C 380 135 395 135 400 136 L400 260 L0 260 Z"
          fill="#c3d9f7"
        />
        {/* 大桥 */}
        <g transform="translate(30,130)">
          {/* 海面 */}
          <rect
            x="-30"
            y="60"
            width="460"
            height="80"
            fill="#cfe3ff"
          />
          {/* 桥面 */}
          <rect
            x="0"
            y="40"
            width="340"
            height="8"
            rx="4"
            fill="#b4c9f5"
          />
          {/* 桥墩 */}
          <rect x="40" y="48" width="14" height="38" fill="#b4c9f5" />
          <rect x="170" y="48" width="14" height="38" fill="#b4c9f5" />
          <rect x="300" y="48" width="14" height="38" fill="#b4c9f5" />
          {/* 主塔 */}
          <rect x="105" y="10" width="10" height="30" fill="#b4c9f5" />
          <rect x="225" y="10" width="10" height="30" fill="#b4c9f5" />
          {/* 吊索曲线 */}
          <path
            d="M110 10 C 140 30 165 40 195 40"
            stroke="#b4c9f5"
            strokeWidth="2"
            fill="none"
          />
          <path
            d="M230 10 C 200 30 175 40 195 40"
            stroke="#b4c9f5"
            strokeWidth="2"
            fill="none"
          />
        </g>
        {/* 前景薄雾 */}
        <rect
          x="0"
          y="190"
          width="400"
          height="70"
          fill="url(#busanMist)"
        />
        <defs>
          <linearGradient id="busanMist" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#dceaff" stopOpacity="0.95" />
            <stop offset="100%" stopColor="#dceaff" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
    );
  }

  // Jeju：汉拿山 + 해안 + 해
  return (
    <svg
      viewBox="0 0 400 260"
      xmlns="http://www.w3.org/2000/svg"
      className="h-full w-full"
    >
      <defs>
        <linearGradient id="jejuGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6fff9" />
          <stop offset="100%" stopColor="#d3f2e6" />
        </linearGradient>
      </defs>
      <rect width="400" height="260" fill="url(#jejuGrad)" />
      {/* 太阳 */}
      <circle cx="320" cy="70" r="26" fill="#ffe1a6" />
      {/* 远山（汉拿山形） */}
      <path
        d="M0 170 C 60 150 110 130 170 135 C 210 138 240 150 280 140 C 320 130 355 138 400 152 L400 260 L0 260 Z"
        fill="#b9ddc6"
      />
      {/* 海岸线 */}
      <path
        d="M0 190 C 80 195 150 200 230 198 C 290 196 340 192 400 188 L400 260 L0 260 Z"
        fill="#9fd7cf"
      />
      {/* 돌 & 귤나무 느낌的小元素 */}
      <circle cx="90" cy="188" r="8" fill="#8cafa0" />
      <circle cx="105" cy="185" r="5" fill="#8cafa0" />
      <rect
        x="260"
        y="178"
        width="5"
        height="18"
        rx="2"
        fill="#8fc39e"
      />
      <circle cx="262.5" cy="176" r="7" fill="#78b78f" />
    </svg>
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
    },
    {
      key: "Jeju" as Destination,
      label: "Jeju",
    },
    {
      key: "Seoul" as Destination,
      label: "Seoul (Coming Soon)",
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
              {/* 纯代码“图片” */}
              <div className="absolute inset-0">
                {card.key === "Busan" && <DestinationArt variant="Busan" />}
                {card.key === "Jeju" && <DestinationArt variant="Jeju" />}
                {card.key === "Seoul" && <DestinationArt variant="Seoul" />}
              </div>
              {/* 暗渐变覆盖，突出文字 */}
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
              {/* 这里的图片区域用渐变块代替真图片 */}
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
    <main className="min-h-screen bg-[#f5f5f7] text-[#111]">
      {/* ===== Apple 风 + 韩国要素 纯代码 HERO ===== */}
      <section className="relative w-full">
        <div className="mx-auto max-w-6xl px-4 pt-6">
          <div className="relative overflow-hidden rounded-[32px] bg-gradient-to-b from-[#f7f9ff] via-white to-[#e8f2ff] px-6 sm:px-8 pt-16 pb-10 shadow-[0_26px_60px_rgba(15,23,42,0.18)]">
            {/* 光斑 */}
            <div className="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-white/70 blur-[120px]" />
            <div className="pointer-events-none absolute -right-20 top-0 h-64 w-64 rounded-full bg-[#0c66ff]/18 blur-[110px]" />
            <div className="pointer-events-none absolute bottom-[-40px] left-1/2 h-60 w-60 -translate-x-1/2 rounded-full bg-[#6aa8ff]/20 blur-[110px]" />

            {/* 文案 */}
            <div className="relative z-10 max-w-xl space-y-5">
              <p className="text-[11px] uppercase tracking-[0.22em] text-gray-500">
                AtoC Korea · Agency to Customer
              </p>

              <h1 className="text-3xl sm:text-4xl md:text-5xl font-semibold leading-snug">
                Direct connection
                <br />
                to trusted Korea tours.
              </h1>

              <p className="text-[13px] sm:text-[14px] text-gray-500">
                Licensed Korean agencies, local guides and drivers — start with
                Busan and Jeju, with Seoul coming soon. Minimal, modern and
                transparent like an Apple product page.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2 text-sm">
                <button
                  className="inline-flex items-center justify-center rounded-full bg-[#0c66ff] px-6 py-2.5 text-[12px] font-medium text-white shadow hover:bg-[#0a54d0] transition"
                  type="button"
                  onClick={() => setIsSearchOpen(true)}
                >
                  Find my day tour
                </button>
                <button
                  className="inline-flex items-center justify-center rounded-full border border-gray-300 bg-white px-6 py-2.5 text-[12px] font-medium text-[#111] hover:bg-gray-50 transition"
                  type="button"
                >
                  Why AtoC?
                </button>
                <span className="text-[11px] text-gray-500">
                  Local-based platform · Lower than global OTAs
                </span>
              </div>
            </div>

            {/* 韩国剪影：南山塔 + 广安大桥风格 */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0">
              <svg
                viewBox="0 0 1200 260"
                xmlns="http://www.w3.org/2000/svg"
                className="h-40 w-full opacity-85"
              >
                {/* 远山 */}
                <path
                  d="M0 200 C 150 150 260 160 400 190 C 520 215 650 180 780 190 C 930 205 1040 185 1200 200 L1200 260 L0 260 Z"
                  fill="#dfe6fb"
                />
                {/* 中景山体 + 南山 */}
                <path
                  d="M200 210 C 320 150 430 135 540 155 C 640 175 720 190 830 210 C 930 230 1030 230 1200 225 L1200 260 L0 260 Z"
                  fill="#cfd9f7"
                />
                {/* 南山塔 */}
                <g transform="translate(540,70)">
                  <path
                    d="M-90 150 C -40 110 40 110 90 150 L90 170 L-90 170 Z"
                    fill="#bcccf4"
                  />
                  <rect x="2" y="10" width="4" height="90" fill="#9fb6ea" />
                  <rect
                    x="-16"
                    y="50"
                    width="36"
                    height="18"
                    rx="8"
                    fill="#9fb6ea"
                  />
                  <rect x="3" y="-40" width="2" height="50" fill="#9fb6ea" />
                  <rect x="2" y="-60" width="4" height="20" fill="#9fb6ea" />
                  <path d="M4 -80 L0 -60 L8 -60 Z" fill="#9fb6ea" />
                </g>
                {/* 广安大桥风格 */}
                <g transform="translate(80,150)">
                  <rect
                    x="0"
                    y="40"
                    width="520"
                    height="8"
                    rx="4"
                    fill="#c2d4f7"
                  />
                  <rect x="40" y="48" width="18" height="42" fill="#c2d4f7" />
                  <rect x="260" y="48" width="18" height="42" fill="#c2d4f7" />
                  <rect x="480" y="48" width="18" height="42" fill="#c2d4f7" />
                  <rect x="120" y="5" width="14" height="35" fill="#c2d4f7" />
                  <rect x="340" y="5" width="14" height="35" fill="#c2d4f7" />
                  <path
                    d="M127 5 C 160 30 200 40 240 40"
                    stroke="#c2d4f7"
                    strokeWidth="2"
                    fill="none"
                  />
                  <path
                    d="M347 5 C 314 30 274 40 240 40"
                    stroke="#c2d4f7"
                    strokeWidth="2"
                    fill="none"
                  />
                </g>
                {/* 海雾 */}
                <rect
                  x="0"
                  y="190"
                  width="1200"
                  height="70"
                  fill="url(#heroMist)"
                />
                <defs>
                  <linearGradient id="heroMist" x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="0%"
                      stopColor="#e4efff"
                      stopOpacity="0.9"
                    />
                    <stop
                      offset="100%"
                      stopColor="#e4efff"
                      stopOpacity="0"
                    />
                  </linearGradient>
                </defs>
              </svg>
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BAR */}
      <TrustBar />

      {/* DESTINATIONS (카드형, 纯代码插画) */}
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
    </main>
  );
}
