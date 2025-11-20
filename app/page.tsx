// app/page.tsx
import React from "react";

const tours = [
  {
    id: 1,
    tag: "Busan · Day tour",
    title: "Gamcheon + Haeundae",
    desc: "6–8 guests · hotel pickup",
    price: "from US$79 / person",
  },
  {
    id: 2,
    tag: "Jeju · Private",
    title: "East Jeju UNESCO highlights",
    desc: "private van · flexible schedule",
    price: "from US$290 / group",
  },
  {
    id: 3,
    tag: "Busan · Night",
    title: "Gwangalli night & local food",
    desc: "3–4 hours · foodie style",
    price: "from US$65 / person",
  },
];

export default function Home() {
  return (
    <>
      {/* ===== HERO ===== */}
      <section className="relative w-full">
        <img
          src="https://images.unsplash.com/photo-1528155124524-3b29e35661c5?auto=format&fit=crop&w=1200&q=80"
          className="w-full h-[260px] sm:h-[300px] object-cover"
          alt="Korea coastal view"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/35 to-black/10" />

        <div className="absolute inset-0 flex flex-col justify-end px-6 pb-10 text-white sm:px-8 sm:pb-12 max-w-3xl mx-auto">
          <h1 className="text-[18px] sm:text-[22px] font-semibold leading-snug">
            Direct connection to trusted Korea tours.
          </h1>
          <p className="mt-1 text-[11px] sm:text-[12px] text-gray-100">
            Small deposit today, pay the balance on the tour day.
          </p>
          <button className="mt-4 inline-flex items-center justify-center rounded-2xl bg-white px-4 py-2 text-[11px] sm:text-[12px] font-semibold text-black shadow-sm">
            Find my day tour
          </button>
        </div>
      </section>

      {/* ===== TRUST / BAR ===== */}
      <section className="mx-auto max-w-6xl px-4 pt-6">
        <div className="rounded-3xl border border-gray-200 bg-white px-5 py-4">
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

      {/* ===== POPULAR TOURS ===== */}
      <section className="mx-auto max-w-6xl px-4 pt-6 pb-10">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-[15px] sm:text-[17px] font-semibold">
            Popular day tours on AtoC Korea
          </h2>
          <button className="text-[11px] text-gray-500 underline">
            View all
          </button>
        </div>

        <div className="flex gap-4 overflow-x-auto pb-1">
          {tours.map((tour) => (
            <div
              key={tour.id}
              className="min-w-[220px] max-w-[240px] rounded-3xl border border-gray-100 bg-white/95 shadow-sm flex-shrink-0"
            >
              <div className="h-[110px] bg-[#dde1ea] rounded-t-3xl" />
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
                <button className="mt-3 w-full rounded-xl border border-gray-200 py-2 text-[11px] font-semibold">
                  See details
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
