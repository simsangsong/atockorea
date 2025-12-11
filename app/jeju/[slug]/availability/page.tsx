"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { detailedTours } from "@/data/tours";

export default function AvailabilityPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || "";
  
  const tour = detailedTours.find((t) => t.slug === slug);
  
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [adultCount, setAdultCount] = useState(1);
  const [selectedLanguage, setSelectedLanguage] = useState("English");
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [selectedPickup, setSelectedPickup] = useState<number | null>(null);
  const [promoCode, setPromoCode] = useState("");
  const [appliedPromo, setAppliedPromo] = useState(false);
  const [isBooking, setIsBooking] = useState(false);
  
  // Contact information
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  
  const timeLeft = 30 * 60; // 30 minutes in seconds

  const languages = ["English", "Chinese"];

  // Available time slots
  const timeSlots = ["8:30 AM"];

  // Pickup locations
  const PICKUP_LOCATIONS = [
    { id: 1, name: "Ocean Suites Jeju Hotel", address: "Ocean Suites Jeju Hotel, Jeju" },
    { id: 2, name: "Jeju International Airport", address: "Jeju Airport 3rd Floor, Gate 3 (Domestic Departures)" },
    { id: 3, name: "LOTTE City Hotel Jeju", address: "LOTTE City Hotel Jeju, Jeju" },
    { id: 4, name: "Shilla Duty-Free Jeju Store", address: "Shilla Duty-Free Jeju Store, Jeju" },
  ];

  // Price calculation - only adults
  const pricePerPerson = 46.81;
  const subtotal = pricePerPerson * adultCount;
  const promoDiscount = appliedPromo && promoCode === "SAVE10" ? subtotal * 0.1 : 0;
  const totalPrice = subtotal - promoDiscount;

  const handleApplyPromo = () => {
    if (promoCode === "SAVE10") {
      setAppliedPromo(true);
    } else {
      alert("Invalid promo code");
    }
  };

  const handleBooking = async () => {
    if (!selectedDate || !selectedTime || !selectedPickup) {
      alert("Please fill in all required fields");
      return;
    }
    if (!fullName || !email || !phone) {
      alert("Please fill in your contact information");
      return;
    }

    setIsBooking(true);
    
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 2000));
    
    // Navigate to confirmation or payment
    const params = new URLSearchParams({
      slug,
      date: selectedDate,
      adults: adultCount.toString(),
      language: selectedLanguage,
      time: selectedTime,
      pickup: selectedPickup.toString(),
      name: fullName,
      email,
      phone,
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
          <h1 className="text-[17px] font-semibold">Availability</h1>
        </div>
      </header>

      <main className="pb-20">
        {/* Tour Criteria Section */}
        <section className="bg-white border-b border-[#e5e5ea] px-4 py-4">
          <div className="space-y-3">
            <button
              onClick={() => {
                const input = document.createElement("input");
                input.type = "date";
                input.min = new Date().toISOString().split("T")[0];
                input.value = selectedDate;
                input.onchange = (e: any) => {
                  setSelectedDate(e.target.value);
                };
                input.click();
              }}
              className="w-full flex items-center justify-between text-left"
            >
              <div className="flex items-center gap-3 flex-1">
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
                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <div className="flex-1">
                  <div className="text-[13px] text-[#666]">Date</div>
                  <div className="text-[15px] font-medium">
                    {selectedDate
                      ? new Date(selectedDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Select date"}
                  </div>
                </div>
              </div>
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </button>

            <div className="w-full">
              <div className="text-[13px] text-[#666] mb-3">Number of Guests *</div>
              
              {/* Adults */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-[15px] font-medium">Adults</div>
                    <div className="text-[12px] text-[#666]">Age 13+</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setAdultCount((c) => Math.max(1, c - 1))}
                      className="w-8 h-8 rounded-full border border-[#ddd] flex items-center justify-center text-[#666]"
                    >
                      -
                    </button>
                    <span className="text-[15px] font-medium min-w-[30px] text-center">
                      {adultCount}
                    </span>
                    <button
                      onClick={() => setAdultCount((c) => c + 1)}
                      className="w-8 h-8 rounded-full border border-[#ddd] flex items-center justify-center text-[#666]"
                    >
                      +
                    </button>
                  </div>
                </div>
              </div>

            </div>

            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3">
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
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                  />
                </svg>
                <div>
                  <div className="text-[13px] text-[#666]">Language</div>
                  <select
                    value={selectedLanguage}
                    onChange={(e) => setSelectedLanguage(e.target.value)}
                    className="text-[15px] font-medium bg-transparent border-none outline-none p-0 cursor-pointer"
                  >
                    {languages.map((lang) => (
                      <option key={lang} value={lang}>
                        {lang}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
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
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </div>
          </div>
        </section>

        {/* Tour Option Section */}
        <section className="bg-white mt-4 px-4 py-4">
          <div className="text-[13px] text-[#666] mb-3">1 option available</div>
          
          <div className="border border-[#007aff] rounded-2xl p-4">
            <h2 className="text-[15px] font-semibold mb-2">{tour.title}</h2>
            
            <div className="space-y-2 text-[13px] text-[#666] mb-4">
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>{tour.duration}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                <span>Guide: {selectedLanguage}</span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7v8a2 2 0 002 2h6M8 7V5a2 2 0 012-2h4.586a1 1 0 01.707.293l4.414 4.414a1 1 0 01.293.707V15a2 2 0 01-2 2h-2M8 7H6a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2v-2" />
                </svg>
                <span className="text-[#007aff] underline">View 4 pickup locations</span>
              </div>
              <div className="text-[12px] text-[#666] mt-1">
                Pickup is available from multiple locations. You'll select yours at checkout.
              </div>
            </div>

            {selectedDate && (
              <>
                <div className="text-[13px] text-[#666] mb-2">Starting time</div>
                <div className="text-[13px] text-[#666] mb-2">
                  {new Date(selectedDate).toLocaleDateString("en-US", {
                    weekday: "long",
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </div>
                <div className="flex gap-2">
                  {timeSlots.map((time) => (
                    <button
                      key={time}
                      onClick={() => setSelectedTime(time)}
                      className={`px-4 py-2 rounded-lg text-[14px] font-medium ${
                        selectedTime === time
                          ? "bg-[#007aff] text-white"
                          : "bg-[#f5f5f7] text-[#111]"
                      }`}
                    >
                      {time}
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-3 text-orange-600 text-[13px]">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span>Only 2 hours left to book</span>
                </div>
              </>
            )}
          </div>

          {/* Pickup Location */}
          <div className="mt-4">
            <label className="block text-[13px] font-medium mb-2">
              Pickup Location *
            </label>
            <select
              value={selectedPickup || ""}
              onChange={(e) => setSelectedPickup(Number(e.target.value))}
              className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
            >
              <option value="">Select pickup location</option>
              {PICKUP_LOCATIONS.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                </option>
              ))}
            </select>
            {selectedPickup && (
              <div className="mt-2 flex items-center gap-2 text-[13px] text-[#666]">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{PICKUP_LOCATIONS.find(l => l.id === selectedPickup)?.address}</span>
              </div>
            )}
          </div>

          {/* Promo Code */}
          <div className="mt-4">
            <label className="block text-[13px] font-medium mb-2">
              Promo Code (Optional)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={promoCode}
                onChange={(e) => {
                  setPromoCode(e.target.value);
                  setAppliedPromo(false);
                }}
                placeholder="Enter code"
                className="flex-1 border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
              />
              <button
                onClick={handleApplyPromo}
                disabled={!promoCode || appliedPromo}
                className="px-4 py-2.5 bg-[#007aff] text-white rounded-lg font-medium disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                Apply
              </button>
            </div>
          </div>
        </section>

        {/* Contact Information */}
        <section className="bg-white mt-4 px-4 py-4">
          <h2 className="text-[17px] font-semibold mb-4">Contact Information *</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1">
                Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
              />
            </div>
            <div>
              <label className="block text-[13px] font-medium mb-1">
                Phone Number *
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter your phone number"
                className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
              />
            </div>
          </div>
        </section>

        {/* Price Summary */}
        <section className="bg-gradient-to-br from-blue-50 to-indigo-50 mt-4 px-4 py-4">
          <div className="space-y-2">
            <div className="flex justify-between text-[14px]">
              <span>Adults ({adultCount})</span>
              <span className="font-medium">€{subtotal.toFixed(2)}</span>
            </div>
            {appliedPromo && promoDiscount > 0 && (
              <div className="flex justify-between text-[14px] text-green-600">
                <span>Promo Discount</span>
                <span className="font-medium">-€{promoDiscount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-blue-200 pt-2 mt-2">
              <div className="flex justify-between items-center">
                <span className="text-[16px] font-bold">Total</span>
                <span className="text-[20px] font-bold">€{totalPrice.toFixed(2)}</span>
              </div>
            </div>
          </div>
        </section>

        {/* Booking Button */}
        <section className="bg-white mt-4 px-4 py-4">
          <button
            onClick={handleBooking}
            disabled={
              !selectedDate ||
              !selectedTime ||
              !selectedPickup ||
              !fullName ||
              !email ||
              !phone ||
              isBooking
            }
            className="w-full bg-gray-400 text-white py-3 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            {isBooking ? "Booking..." : "Book now"}
          </button>
          <div className="mt-3 flex items-center gap-2 text-[13px] text-green-600">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Free cancellation up to 24 hours</span>
          </div>
        </section>
      </main>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5ea] px-4 py-3 safe-area-bottom">
        <div className="flex items-center gap-3">
          <button className="flex-1 bg-[#007aff] text-white py-3 rounded-lg font-semibold text-center">
            Check Availability
          </button>
          <button className="px-4 py-3 border border-[#ddd] rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            <span className="text-[13px]">Wishlist</span>
          </button>
          <button className="px-4 py-3 border border-[#ddd] rounded-lg flex items-center gap-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
            </svg>
            <span className="text-[13px]">Share</span>
          </button>
        </div>
      </div>

      <div className="h-20" /> {/* Spacer for bottom nav */}
    </div>
  );
}

