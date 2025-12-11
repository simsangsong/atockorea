"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { detailedTours } from "@/data/tours";
import BottomNav from "@/components/BottomNav";

export default function ConfirmationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || "";
  const date = searchParams.get("date") || "";
  const adults = searchParams.get("adults") || "1";
  const language = searchParams.get("language") || "English";
  const time = searchParams.get("time") || "";
  const fullName = searchParams.get("fullName") || "";
  const email = searchParams.get("email") || "";
  const paymentMethod = searchParams.get("paymentMethod") || "";
  const total = searchParams.get("total") || "0";

  const tour = detailedTours.find((t) => t.slug === slug);

  useEffect(() => {
    // Scroll to top on mount
    window.scrollTo(0, 0);
  }, []);

  if (!tour) {
    return (
      <div className="min-h-screen bg-[#f5f5f7] flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-lg font-semibold mb-2">Tour not found</h1>
          <button
            onClick={() => router.push("/")}
            className="text-blue-600 underline"
          >
            Go to homepage
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] text-[#111]">
      {/* Header */}
      <header className="sticky top-0 z-10 bg-white border-b border-[#e5e5ea]">
        <div className="flex items-center justify-center px-4 py-3">
          <h1 className="text-[17px] font-semibold">Booking Confirmation</h1>
        </div>
      </header>

      <main className="pb-20">
        {/* Success Message */}
        <section className="bg-white px-4 py-8 text-center">
          <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-12 h-12 text-green-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
          <h2 className="text-[24px] font-bold mb-2">Booking Confirmed!</h2>
          <p className="text-[15px] text-[#666]">
            Your booking has been successfully confirmed. We've sent a
            confirmation email to {email}
          </p>
        </section>

        {/* Booking Details */}
        <section className="bg-white mt-4 px-4 py-4">
          <h2 className="text-[17px] font-semibold mb-4">Booking Details</h2>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-16 h-16 rounded-lg bg-gray-200 overflow-hidden flex-shrink-0">
                <img
                  src={tour.imageUrl}
                  alt={tour.title}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <div className="text-[15px] font-medium">{tour.title}</div>
                <div className="text-[13px] text-[#666] mt-1">
                  {date &&
                    new Date(date).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                      year: "numeric",
                    })}
                </div>
              </div>
            </div>

            <div className="border-t border-[#e5e5ea] pt-3 space-y-2 text-[14px]">
              <div className="flex justify-between">
                <span className="text-[#666]">Participants</span>
                <span className="font-medium">
                  {adults} {parseInt(adults) === 1 ? "Adult" : "Adults"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Language</span>
                <span className="font-medium">{language}</span>
              </div>
              {time && (
                <div className="flex justify-between">
                  <span className="text-[#666]">Start Time</span>
                  <span className="font-medium">{time}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#666]">Contact Name</span>
                <span className="font-medium">{fullName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Email</span>
                <span className="font-medium">{email}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#666]">Payment Method</span>
                <span className="font-medium capitalize">
                  {paymentMethod === "stripe" ? "Credit Card" : "PayPal"}
                </span>
              </div>
              <div className="border-t border-[#e5e5ea] pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[16px] font-bold">Total Paid</span>
                  <span className="text-[20px] font-bold">€{parseFloat(total).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Important Information */}
        <section className="bg-blue-50 border border-blue-200 mt-4 px-4 py-4 rounded-lg mx-4">
          <h3 className="text-[15px] font-semibold mb-3 flex items-center gap-2">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            Important Information
          </h3>
          <ul className="space-y-2 text-[13px] text-blue-900">
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>
                A confirmation email with all details has been sent to your
                email address.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>
                Please arrive at the pickup location 10 minutes before the
                scheduled time.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>
                Free cancellation up to 24 hours before the tour start time.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="mt-1">•</span>
              <span>
                If you have any questions, please contact us via email or
                phone.
              </span>
            </li>
          </ul>
        </section>

        {/* Action Buttons */}
        <section className="px-4 mt-6 space-y-3">
          <button
            onClick={() => router.push("/dashboard/bookings")}
            className="w-full bg-[#007aff] text-white py-3 rounded-lg font-semibold"
          >
            View My Bookings
          </button>
          <button
            onClick={() => router.push(`/jeju/${slug}`)}
            className="w-full bg-white border-2 border-[#007aff] text-[#007aff] py-3 rounded-lg font-semibold"
          >
            Book Another Tour
          </button>
          <button
            onClick={() => router.push("/")}
            className="w-full bg-white border border-[#ddd] text-[#666] py-3 rounded-lg font-medium"
          >
            Back to Home
          </button>
        </section>
      </main>

      <BottomNav />
    </div>
  );
}


