// app/page.tsx
"use client";

import React, { useState } from "react";

type Destination = "All" | "Seoul" | "Busan" | "Jeju";

type Tour = {
  id: number;
  city: Destination;
  tag: string;
  title: string;
  desc: string;
  price: string;
};

const tours: Tour[] = [
  {
    id: 1,
    city: "Busan",
    tag: "Busan · Day tour",
    title: "Gamcheon Culture Village + Haeundae",
    desc: "Small-group · hotel pickup",
    price: "from US$79 / person",
  },
  {
    id: 2,
    city: "Jeju",
    tag: "Jeju · Private",
    title: "East Jeju UNESCO highlights",
    desc: "Private van · flexible schedule",
    price: "from US$290 / group",
  },
  {
    id: 3,
    city: "Busan",
    tag: "Busan · Night",
    title: "Gwangalli night view & local food",
    desc: "3–4 hours · foodie style",
    price: "from US$65 / person",
  },
];

/* ===================== Trust Bar ===================== */

function TrustBar() {
  return (
    <section className="mx-auto max-w-6xl px-4 pt-6">
      <div className="rounded-3xl border border-gray-200 bg-white px-5 py-4 shadow-sm">
        <div className="text-[13px] sm:text-[14px] font-semibold text-gray-900 tracking-tight">
          Local platform. Verified local partner network.
        </div>
        <p className="mt-1 text-[11px] sm:text-[12px] text-gray-500">
          Built in Korea with on-the-ground agencies, guides, and drivers.
        </p>

        <div className="mt-3 flex flex-wrap gap-2.5 text-[11px] sm:text-[12px] text-gray-800 font-medium">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Korea-based support team
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Curated local agencies &amp; guides
          </span>

          <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5">
            <span className="text-[#0c66ff] text-xs">✓</span>
            Focus on Busan &amp; Jeju day tours
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
            Local price. No middlemen.
          </h3>
          <p className="text-[11px] mt-1 text-gray-600">
            As a Korea-based platform, AtoC Korea can offer lower prices than
            global OTAs. No extra marketplace markups.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 mt-4">
        <div className="rounded-2xl border border-gray-200 bg-white py-4 px-5 text-center shadow-sm">
          <p className="text-[11px] sm:text-[12px] text-gray-700">
            You book directly with verified local partners. We only take a small
            deposit online – the rest is paid on the tour day.
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
    selected === "All"
      ? tours
      : tours.filter((t) => t.city === selected);

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
              className="min-w-[220px] max-w-[240px] rounded-3xl border border-gray-100 bg-white/95 shadow-sm flex-shrink-0 overflow-hidden"
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
                <button className="mt-3 w-full rounded-xl border border-gray-200 py-2 text-[11px] font-semibold hover:bg-gray-50 transition">
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
            <p className="mt-2 text-[11px] sm:text-[12px] text-gray-100">
              Book with a small deposit today and pay the balance on the tour
              day to your local guide or driver.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button className="inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-[11px] sm:text-[12px] font-semibold text-black shadow-sm">
                Find my day tour
              </button>
              <span className="text-[10px] sm:text-[11px] text-gray-100">
                Busan · Jeju private & small-group tours
              </span>
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
    </>
  );
}
