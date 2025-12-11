"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { detailedTours } from "@/data/tours";
import BottomNav from "@/components/BottomNav";

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || "";
  const date = searchParams.get("date") || "";
  const adults = searchParams.get("adults") || "1";
  const language = searchParams.get("language") || "English";
  const time = searchParams.get("time") || "";
  const pickup = searchParams.get("pickup") || "";
  const dropoff = searchParams.get("dropoff") || "";

  const tour = detailedTours.find((t) => t.slug === slug);

  const [formData, setFormData] = useState({
    fullName: "",
    email: "",
    country: "South Korea (+82)",
    phone: "",
  });

  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes in seconds
  const [showOrderSummary, setShowOrderSummary] = useState(false);

  const pricePerPerson = 46.81;
  const totalPrice = pricePerPerson * parseInt(adults);

  // Countdown timer
  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [timeLeft]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleContinue = () => {
    if (!formData.fullName || !formData.email || !formData.phone) {
      alert("Please fill in all required fields");
      return;
    }

    // Navigate to payment page
    const params = new URLSearchParams({
      slug,
      date,
      adults,
      language,
      time,
      pickup,
      dropoff,
      ...formData,
    });

    router.push(`/jeju/${slug}/payment?${params.toString()}`);
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

  const isFormValid =
    formData.fullName && formData.email && formData.phone;

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#e5e5ea]">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-4">
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
            <h1 className="text-[17px] font-semibold">Checkout</h1>
          </div>
          <button className="text-[#007aff] text-[15px] font-medium">
            Log in
          </button>
        </div>
      </header>

      <main className="pb-24">
        {/* Progress Bar */}
        <div className="bg-white border-b border-[#e5e5ea] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#007aff] text-white text-[12px] font-semibold flex items-center justify-center">
                  1
                </div>
                <span className="text-[13px] font-medium text-[#007aff]">
                  Contact
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gray-200 text-gray-500 text-[12px] font-semibold flex items-center justify-center">
                  2
                </div>
                <span className="text-[13px] font-medium text-gray-500">
                  Payment
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Timer Banner */}
        <div className="bg-pink-100 px-4 py-3 flex items-center gap-2">
          <svg
            className="w-5 h-5 text-pink-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="text-[13px] font-medium text-pink-600">
            We'll hold your spot for {formatTime(timeLeft)} minutes
          </span>
        </div>

        {/* Personal Details Form */}
        <section className="bg-white mt-4 px-4 py-6">
          <h2 className="text-[17px] font-semibold mb-2">
            Enter your personal details
          </h2>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <svg
                className="w-5 h-5 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span className="text-[13px] text-green-600">
                Checkout is fast and secure
              </span>
            </div>
            <span className="text-[12px] text-[#666]">*Required fields</span>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-[13px] font-medium mb-1">
                Full name*
              </label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => handleInputChange("fullName", e.target.value)}
                className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
                placeholder="Enter your full name"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1">
                Email address*
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange("email", e.target.value)}
                className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
                placeholder="Enter your email"
              />
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1">
                Country*
              </label>
              <select
                value={formData.country}
                onChange={(e) => handleInputChange("country", e.target.value)}
                className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff] bg-white"
              >
                <option value="South Korea (+82)">South Korea (+82)</option>
                <option value="United States (+1)">United States (+1)</option>
                <option value="China (+86)">China (+86)</option>
                <option value="Japan (+81)">Japan (+81)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-[13px] font-medium mb-1">
                Mobile phone number*
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange("phone", e.target.value)}
                className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
                placeholder="Enter your phone number"
              />
            </div>
          </div>

          <p className="mt-4 text-[12px] text-[#666]">
            We'll only contact you with essential updates or changes to your
            booking.
          </p>
        </section>

        {/* Order Summary */}
        <section className="bg-white mt-4 px-4 py-4 border-t border-[#e5e5ea]">
          <button
            onClick={() => setShowOrderSummary(!showOrderSummary)}
            className="w-full flex items-center justify-between"
          >
            <div>
              <div className="text-[13px] text-[#666]">Order summary</div>
              <div className="text-[13px] font-medium mt-1">1 activity</div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                <img
                  src={tour.imageUrl}
                  alt={tour.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <svg
                className={`w-5 h-5 text-[#666] transition-transform ${
                  showOrderSummary ? "rotate-180" : ""
                }`}
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
          </button>

          {showOrderSummary && (
            <div className="mt-4 pt-4 border-t border-[#e5e5ea] space-y-2 text-[13px]">
              <div className="font-medium">{tour.title}</div>
              <div className="text-[#666]">
                {date &&
                  new Date(date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
              </div>
              <div className="text-[#666]">
                {adults} {parseInt(adults) === 1 ? "Adult" : "Adults"}
              </div>
              <div className="text-[#666]">Language: {language}</div>
            </div>
          )}
        </section>
      </main>

      {/* Footer with Total and Continue Button */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5ea] px-4 py-4 safe-area-bottom">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[13px] text-[#666]">Total</div>
            <div className="text-[20px] font-bold">€{totalPrice.toFixed(2)}</div>
          </div>
          <button
            onClick={handleContinue}
            disabled={!isFormValid}
            className="bg-[#007aff] text-white px-8 py-3 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            Go to payment
          </button>
        </div>
      </footer>

      <BottomNav />
    </div>
  );
}


