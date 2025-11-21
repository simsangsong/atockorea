// components/TourCardDetail.tsx
import React from "react";

export type DetailedTour = {
  id: number;
  city: string;
  tag: string;
  title: string;
  price: string;
  imageUrl: string;

  // Right-side info section
  duration: string;        // "9:00–17:00 · 8 hours"
  lunchIncluded: boolean;
  ticketIncluded: boolean;
  pickupInfo: string;      // "Hotel pickup in Haeundae / Seomyeon"
  notes?: string;          // e.g. "Minimum 4 guests to depart"
};

type Props = {
  tour: DetailedTour;
};

export default function TourCardDetail({ tour }: Props) {
  return (
    <article className="mx-auto mb-4 w-[90%] max-w-3xl">
      <div
        className="
          group flex flex-col sm:flex-row
          gap-3 sm:gap-4
          rounded-3xl bg-white/95
          border border-[#e5e5ea]
          shadow-[0_8px_24px_rgba(0,0,0,0.03)]
          hover:shadow-[0_16px_40px_rgba(0,0,0,0.06)]
          transition-shadow duration-200
          px-3 py-3 sm:px-4 sm:py-4
        "
      >
        {/* ===== Left: image + title + price ===== */}
        <div className="flex w-full flex-col sm:w-[32%]">
          {/* Image block */}
          <div
            className="
              relative w-full overflow-hidden rounded-2xl
              bg-[#f2f2f7]
            "
          >
            <img
              src={tour.imageUrl}
              alt={tour.title}
              className="
                h-[180px] w-full object-cover
                sm:h-[160px]
                md:h-[180px]
                transition-transform duration-300
                group-hover:scale-[1.02]
              "
            />
          </div>

          {/* Tag / title / price */}
          <div className="mt-2 sm:mt-3">
            <p className="text-[11px] sm:text-[11px] font-medium uppercase tracking-[0.06em] text-[#86868b]">
              {tour.tag}
            </p>
            <h3 className="mt-0.5 line-clamp-2 text-[14px] sm:text-[15px] font-semibold text-[#111111]">
              {tour.title}
            </h3>
            <p className="mt-1 text-[12px] sm:text-[13px] font-semibold text-[#0c66ff]">
              {tour.price}
            </p>
          </div>
        </div>

        {/* ===== Right: details ===== */}
        <div
          className="
            flex-1
            text-[11px] sm:text-[13px]
            text-[#1c1c1e]
            sm:pl-1
            mt-2 sm:mt-0
          "
        >
          <ul className="space-y-1.5 sm:space-y-2">
            <li className="flex items-start gap-1.5">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#0c66ff]" />
              <div>
                <span className="text-[11px] sm:text-[12px] font-semibold text-[#3a3a3c]">
                  Duration
                </span>
                <div className="text-[11px] sm:text-[13px] text-[#1c1c1e]">
                  {tour.duration}
                </div>
              </div>
            </li>

            <li className="flex items-start gap-1.5">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#34c759]" />
              <div>
                <span className="text-[11px] sm:text-[12px] font-semibold text-[#3a3a3c]">
                  Lunch
                </span>
                <div className="text-[11px] sm:text-[13px] text-[#1c1c1e]">
                  {tour.lunchIncluded ? "Lunch included" : "Not included"}
                </div>
              </div>
            </li>

            <li className="flex items-start gap-1.5">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#ff9500]" />
              <div>
                <span className="text-[11px] sm:text-[12px] font-semibold text-[#3a3a3c]">
                  Tickets
                </span>
                <div className="text-[11px] sm:text-[13px] text-[#1c1c1e]">
                  {tour.ticketIncluded ? "Tickets included" : "Not included"}
                </div>
              </div>
            </li>

            <li className="flex items-start gap-1.5">
              <span className="mt-[3px] h-1.5 w-1.5 rounded-full bg-[#5856d6]" />
              <div>
                <span className="text-[11px] sm:text-[12px] font-semibold text-[#3a3a3c]">
                  Pickup
                </span>
                <div className="text-[11px] sm:text-[13px] text-[#1c1c1e]">
                  {tour.pickupInfo}
                </div>
              </div>
            </li>

            {tour.notes && (
              <li className="mt-1 border-t border-[#e5e5ea] pt-2 text-[11px] sm:text-[12px] text-[#6e6e73]">
                {tour.notes}
              </li>
            )}
          </ul>
        </div>
      </div>
    </article>
  );
}
