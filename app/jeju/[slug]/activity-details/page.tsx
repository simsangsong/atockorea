"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { detailedTours } from "@/data/tours";
import BottomNav from "@/components/BottomNav";

const PICKUP_LOCATIONS = [
  {
    id: 1,
    name: "Ocean Suites Jeju",
    time: "08:30",
    address: "Ocean Suites Jeju Hotel",
  },
  {
    id: 2,
    name: "Jeju International Airport",
    time: "08:45",
    address: "Jeju Airport 3rd Floor, Gate 3 (Domestic Departures)",
  },
  {
    id: 3,
    name: "LOTTE City Hotel Jeju",
    time: "08:55",
    address: "LOTTE City Hotel Jeju",
  },
  {
    id: 4,
    name: "Shilla Duty-Free Jeju Store",
    time: "09:05",
    address: "Shilla Duty-Free Jeju Store",
  },
];

const DROPOFF_LOCATIONS = [
  {
    id: 1,
    name: "Ocean Suites Hotel Jeju",
  },
  {
    id: 2,
    name: "Jeju International Airport (Gate 1)",
  },
  {
    id: 3,
    name: "LOTTE City Hotel Jeju",
  },
  {
    id: 4,
    name: "Shilla Duty Free Shop Jeju",
  },
  {
    id: 5,
    name: "Dongmun Traditional Market",
  },
];

export default function ActivityDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || "";
  const date = searchParams.get("date") || "";
  const adults = searchParams.get("adults") || "1";
  const language = searchParams.get("language") || "English";
  const time = searchParams.get("time") || "";

  const tour = detailedTours.find((t) => t.slug === slug);

  const [pickupKnown, setPickupKnown] = useState<boolean | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<number | null>(null);
  const [selectedDropoff, setSelectedDropoff] = useState<number | null>(null);

  const pricePerPerson = 46.81;
  const totalPrice = pricePerPerson * parseInt(adults);

  const handleContinue = () => {
    if (pickupKnown === null) {
      alert("Please select if you know your pickup location");
      return;
    }

    if (pickupKnown && !selectedPickup) {
      alert("Please select a pickup location");
      return;
    }

    const params = new URLSearchParams({
      slug,
      date,
      adults,
      language,
      time,
      pickupKnown: pickupKnown.toString(),
      pickup: selectedPickup?.toString() || "",
      dropoff: selectedDropoff?.toString() || "",
    });

    router.push(`/jeju/${slug}/checkout?${params.toString()}`);
  };

  if (!tour) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Tour not found</h1>
          <button
            onClick={() => router.back()}
            className="text-blue-600 underline"
          >
            Go back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#e5e5ea]">
        <div className="flex items-center gap-4 px-4 py-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center w-8 h-8"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
          </button>
          <h1 className="text-[17px] font-semibold">Activity details</h1>
        </div>
      </header>

      <main className="pb-20">
        <section className="bg-white px-4 py-6">
          <h2 className="text-[17px] font-semibold mb-4">
            Do you know where you want to be picked up?*
          </h2>

          <div className="space-y-4">
            {/* Option 1: Yes, I can add it now */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="pickupKnown"
                checked={pickupKnown === true}
                onChange={() => {
                  setPickupKnown(true);
                  setSelectedPickup(null);
                }}
                className="mt-1 w-5 h-5 text-[#007aff]"
              />
              <div className="flex-1">
                <div className="text-[15px] font-medium">
                  Yes, I can add it now
                </div>
                {pickupKnown === true && (
                  <div className="mt-3 space-y-2">
                    <div className="text-[13px] text-[#666] mb-2">
                      Select pickup location:
                    </div>
                    <div className="space-y-2">
                      {PICKUP_LOCATIONS.map((location) => (
                        <label
                          key={location.id}
                          className={`flex items-start gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                            selectedPickup === location.id
                              ? "border-[#007aff] bg-blue-50"
                              : "border-[#e5e5ea] hover:bg-[#f5f5f7]"
                          }`}
                        >
                          <input
                            type="radio"
                            name="pickup"
                            checked={selectedPickup === location.id}
                            onChange={() => setSelectedPickup(location.id)}
                            className="mt-1 w-5 h-5 text-[#007aff]"
                          />
                          <div className="flex-1">
                            <div className="text-[15px] font-medium">
                              {location.name}
                            </div>
                            <div className="text-[13px] text-[#666] mt-1">
                              {location.address}
                            </div>
                            <div className="text-[12px] text-[#666] mt-1">
                              Pickup time: {location.time}
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </label>

            {/* Option 2: I don't know yet */}
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="pickupKnown"
                checked={pickupKnown === false}
                onChange={() => {
                  setPickupKnown(false);
                  setSelectedPickup(null);
                }}
                className="mt-1 w-5 h-5 text-[#007aff]"
              />
              <div className="text-[15px] font-medium">
                I don't know yet
              </div>
            </label>
          </div>
        </section>

        {/* Drop-off Location Selection */}
        {pickupKnown !== null && (
          <section className="bg-white mt-4 px-4 py-6 border-t border-[#e5e5ea]">
            <h2 className="text-[17px] font-semibold mb-4">
              Select drop-off location*
            </h2>
            <div className="space-y-2">
              {DROPOFF_LOCATIONS.map((location) => (
                <label
                  key={location.id}
                  className={`flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedDropoff === location.id
                      ? "border-[#007aff] bg-blue-50"
                      : "border-[#e5e5ea] hover:bg-[#f5f5f7]"
                  }`}
                >
                  <input
                    type="radio"
                    name="dropoff"
                    checked={selectedDropoff === location.id}
                    onChange={() => setSelectedDropoff(location.id)}
                    className="w-5 h-5 text-[#007aff]"
                  />
                  <span className="text-[15px]">{location.name}</span>
                </label>
              ))}
            </div>
          </section>
        )}

        {/* Order Summary */}
        <section className="bg-white mt-4 px-4 py-4 border-t border-[#e5e5ea]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[13px] text-[#666]">Order summary</span>
            <svg
              className="w-5 h-5 text-[#666]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
              <img
                src={tour.imageUrl}
                alt={tour.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-medium line-clamp-2">
                {tour.title}
              </div>
              <div className="text-[12px] text-[#666] mt-1">
                {date && new Date(date).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Footer with Price and Continue Button */}
        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5ea] px-4 py-4 safe-area-bottom">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-[13px] text-[#666]">Total</div>
              <div className="text-[20px] font-bold">€{totalPrice.toFixed(2)}</div>
            </div>
            <button
              onClick={handleContinue}
              disabled={
                pickupKnown === null ||
                (pickupKnown === true && !selectedPickup) ||
                !selectedDropoff
              }
              className="bg-[#007aff] text-white px-6 py-3 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
            >
              Book now
            </button>
          </div>
          <p className="text-[11px] text-[#666] text-center">
            Fill in all fields marked with a * to continue.
          </p>
        </footer>
      </main>

      <BottomNav />
    </div>
  );
}

