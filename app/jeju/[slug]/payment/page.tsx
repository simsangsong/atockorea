"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState, useEffect } from "react";
import { detailedTours } from "@/data/tours";
import BottomNav from "@/components/BottomNav";

type PaymentMethod = "stripe" | "paypal" | null;

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const slug = searchParams.get("slug") || "";
  const date = searchParams.get("date") || "";
  const adults = searchParams.get("adults") || "1";
  const language = searchParams.get("language") || "English";
  const time = searchParams.get("time") || "";
  const pickup = searchParams.get("pickup") || "";
  const dropoff = searchParams.get("dropoff") || "";
  const fullName = searchParams.get("fullName") || "";
  const email = searchParams.get("email") || "";
  const phone = searchParams.get("phone") || "";

  const tour = detailedTours.find((t) => t.slug === slug);

  const [selectedPaymentMethod, setSelectedPaymentMethod] =
    useState<PaymentMethod>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30 * 60); // 30 minutes

  // Stripe card form data
  const [cardData, setCardData] = useState({
    cardNumber: "",
    expiryDate: "",
    cvv: "",
    cardholderName: "",
  });

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

  const formatCardNumber = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    const matches = v.match(/\d{4,16}/g);
    const match = (matches && matches[0]) || "";
    const parts = [];
    for (let i = 0, len = match.length; i < len; i += 4) {
      parts.push(match.substring(i, i + 4));
    }
    if (parts.length) {
      return parts.join(" ");
    } else {
      return v;
    }
  };

  const formatExpiryDate = (value: string) => {
    const v = value.replace(/\s+/g, "").replace(/[^0-9]/gi, "");
    if (v.length >= 2) {
      return v.substring(0, 2) + "/" + v.substring(2, 4);
    }
    return v;
  };

  const handleCardInputChange = (field: string, value: string) => {
    let formattedValue = value;
    if (field === "cardNumber") {
      formattedValue = formatCardNumber(value);
    } else if (field === "expiryDate") {
      formattedValue = formatExpiryDate(value);
    } else if (field === "cvv") {
      formattedValue = value.replace(/\D/g, "").substring(0, 4);
    }
    setCardData((prev) => ({ ...prev, [field]: formattedValue }));
  };

  const handlePayment = async () => {
    if (!selectedPaymentMethod) {
      alert("Please select a payment method");
      return;
    }

    if (selectedPaymentMethod === "stripe") {
      // Validate card data
      if (
        !cardData.cardNumber ||
        !cardData.expiryDate ||
        !cardData.cvv ||
        !cardData.cardholderName
      ) {
        alert("Please fill in all card details");
        return;
      }

      if (cardData.cardNumber.replace(/\s/g, "").length < 13) {
        alert("Please enter a valid card number");
        return;
      }

      if (cardData.expiryDate.length < 5) {
        alert("Please enter a valid expiry date");
        return;
      }

      if (cardData.cvv.length < 3) {
        alert("Please enter a valid CVV");
        return;
      }
    }

    setIsProcessing(true);

    // TODO: Connect to actual payment API
    // For now, simulate payment processing
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate success
    const params = new URLSearchParams({
      slug,
      date,
      adults,
      language,
      time,
      pickup,
      dropoff,
      fullName,
      email,
      phone,
      paymentMethod: selectedPaymentMethod,
      total: totalPrice.toString(),
    });

    router.push(`/jeju/${slug}/confirmation?${params.toString()}`);
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

  const PICKUP_LOCATIONS = [
    { id: 1, name: "Ocean Suites Jeju Hotel" },
    { id: 2, name: "Jeju International Airport" },
    { id: 3, name: "LOTTE City Hotel Jeju" },
    { id: 4, name: "Shilla Duty-Free Jeju Store" },
  ];

  const selectedPickupLocation = PICKUP_LOCATIONS.find(
    (loc) => loc.id === Number(pickup)
  );

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
            <h1 className="text-[17px] font-semibold">Payment</h1>
          </div>
        </div>
      </header>

      <main className="pb-24">
        {/* Progress Bar */}
        <div className="bg-white border-b border-[#e5e5ea] px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-green-500 text-white text-[12px] font-semibold flex items-center justify-center">
                  ✓
                </div>
                <span className="text-[13px] font-medium text-gray-500">
                  Contact
                </span>
              </div>
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-[#007aff] text-white text-[12px] font-semibold flex items-center justify-center">
                  2
                </div>
                <span className="text-[13px] font-medium text-[#007aff]">
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

        {/* Order Summary */}
        <section className="bg-white mt-4 px-4 py-4">
          <h2 className="text-[17px] font-semibold mb-4">Order Summary</h2>
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
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                </div>
                <div className="text-[13px] text-[#666]">
                  {adults} {parseInt(adults) === 1 ? "Adult" : "Adults"}
                </div>
              </div>
            </div>

            <div className="border-t border-[#e5e5ea] pt-3 space-y-2">
              <div className="flex justify-between text-[14px]">
                <span className="text-[#666]">Subtotal</span>
                <span className="font-medium">€{totalPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[14px]">
                <span className="text-[#666]">Taxes & Fees</span>
                <span className="font-medium">€0.00</span>
              </div>
              <div className="border-t border-[#e5e5ea] pt-2 mt-2">
                <div className="flex justify-between items-center">
                  <span className="text-[16px] font-bold">Total</span>
                  <span className="text-[20px] font-bold">€{totalPrice.toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Payment Methods */}
        <section className="bg-white mt-4 px-4 py-4">
          <h2 className="text-[17px] font-semibold mb-4">Payment Method</h2>
          
          <div className="space-y-3">
            {/* Stripe Option */}
            <label
              className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedPaymentMethod === "stripe"
                  ? "border-[#007aff] bg-blue-50"
                  : "border-[#e5e5ea] hover:border-[#007aff]/50"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="stripe"
                checked={selectedPaymentMethod === "stripe"}
                onChange={() => setSelectedPaymentMethod("stripe")}
                className="w-5 h-5 text-[#007aff]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#635BFF] rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.594-7.305h.003z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[15px] font-medium">Credit or Debit Card</div>
                    <div className="text-[12px] text-[#666]">
                      Visa, Mastercard, Amex
                    </div>
                  </div>
                </div>
              </div>
            </label>

            {/* PayPal Option */}
            <label
              className={`flex items-center gap-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                selectedPaymentMethod === "paypal"
                  ? "border-[#007aff] bg-blue-50"
                  : "border-[#e5e5ea] hover:border-[#007aff]/50"
              }`}
            >
              <input
                type="radio"
                name="paymentMethod"
                value="paypal"
                checked={selectedPaymentMethod === "paypal"}
                onChange={() => setSelectedPaymentMethod("paypal")}
                className="w-5 h-5 text-[#007aff]"
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-[#0070BA] rounded flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944.901C5.026.382 5.474 0 5.998 0h7.46c2.57 0 4.578.543 5.69 1.81 1.174 1.305 1.06 2.716.978 3.456v.12c-.078.765-.137 1.339-.137 1.339l-.137.765c-.078.543-.195.978-.195 1.339 0 .382.195.765.468.978.195.137.468.195.765.195.195 0 .39-.039.585-.117.39-.137.703-.39.937-.743.195-.312.312-.665.39-1.038.078-.39.117-.78.117-1.19 0-.39-.039-.78-.117-1.19-.195-1.19-.78-2.15-1.716-2.716-.937-.585-2.15-.937-3.54-.937H8.76l-2.15 12.716h3.54c.39 0 .703.312.78.703l.39 2.15c.078.39-.234.78-.624.78z"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[15px] font-medium">PayPal</div>
                    <div className="text-[12px] text-[#666]">
                      Pay with your PayPal account
                    </div>
                  </div>
                </div>
              </div>
            </label>
          </div>
        </section>

        {/* Stripe Card Form */}
        {selectedPaymentMethod === "stripe" && (
          <section className="bg-white mt-4 px-4 py-4">
            <h2 className="text-[17px] font-semibold mb-4">Card Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium mb-1">
                  Card Number *
                </label>
                <input
                  type="text"
                  value={cardData.cardNumber}
                  onChange={(e) =>
                    handleCardInputChange("cardNumber", e.target.value)
                  }
                  placeholder="1234 5678 9012 3456"
                  maxLength={19}
                  className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
                />
              </div>

              <div>
                <label className="block text-[13px] font-medium mb-1">
                  Cardholder Name *
                </label>
                <input
                  type="text"
                  value={cardData.cardholderName}
                  onChange={(e) =>
                    handleCardInputChange("cardholderName", e.target.value)
                  }
                  placeholder="John Doe"
                  className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[13px] font-medium mb-1">
                    Expiry Date *
                  </label>
                  <input
                    type="text"
                    value={cardData.expiryDate}
                    onChange={(e) =>
                      handleCardInputChange("expiryDate", e.target.value)
                    }
                    placeholder="MM/YY"
                    maxLength={5}
                    className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium mb-1">
                    CVV *
                  </label>
                  <input
                    type="text"
                    value={cardData.cvv}
                    onChange={(e) =>
                      handleCardInputChange("cvv", e.target.value)
                    }
                    placeholder="123"
                    maxLength={4}
                    className="w-full border border-[#ddd] rounded-lg px-3 py-2.5 text-[15px] focus:outline-none focus:border-[#007aff]"
                  />
                </div>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-2 text-[12px] text-[#666]">
              <svg
                className="w-4 h-4 text-green-600"
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
              <span>Your payment information is secure and encrypted</span>
            </div>
          </section>
        )}

        {/* PayPal Info */}
        {selectedPaymentMethod === "paypal" && (
          <section className="bg-white mt-4 px-4 py-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <svg
                  className="w-5 h-5 text-blue-600 mt-0.5"
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
                <div className="flex-1">
                  <div className="text-[14px] font-medium text-blue-900 mb-1">
                    PayPal Payment
                  </div>
                  <div className="text-[13px] text-blue-700">
                    You will be redirected to PayPal to complete your payment
                    securely.
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Booking Details */}
        <section className="bg-white mt-4 px-4 py-4">
          <h2 className="text-[17px] font-semibold mb-4">Booking Details</h2>
          <div className="space-y-3 text-[14px]">
            <div className="flex justify-between">
              <span className="text-[#666]">Contact Name</span>
              <span className="font-medium">{fullName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">Email</span>
              <span className="font-medium">{email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#666]">Phone</span>
              <span className="font-medium">{phone}</span>
            </div>
            {selectedPickupLocation && (
              <div className="flex justify-between">
                <span className="text-[#666]">Pickup Location</span>
                <span className="font-medium text-right">
                  {selectedPickupLocation.name}
                </span>
              </div>
            )}
          </div>
        </section>

        {/* Security Badges */}
        <section className="bg-white mt-4 px-4 py-4">
          <div className="flex items-center justify-center gap-6 text-[12px] text-[#666]">
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-green-600"
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
              <span>SSL Encrypted</span>
            </div>
            <div className="flex items-center gap-2">
              <svg
                className="w-4 h-4 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
              <span>Secure Payment</span>
            </div>
          </div>
        </section>
      </main>

      {/* Footer with Total and Pay Button */}
      <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#e5e5ea] px-4 py-4 safe-area-bottom">
        <div className="flex items-center justify-between mb-2">
          <div>
            <div className="text-[13px] text-[#666]">Total</div>
            <div className="text-[20px] font-bold">€{totalPrice.toFixed(2)}</div>
          </div>
          <button
            onClick={handlePayment}
            disabled={!selectedPaymentMethod || isProcessing}
            className="bg-[#007aff] text-white px-8 py-3 rounded-lg font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed min-w-[120px]"
          >
            {isProcessing ? (
              <span className="flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  ></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                Processing...
              </span>
            ) : (
              "Pay Now"
            )}
          </button>
        </div>
        <p className="text-[11px] text-[#666] text-center">
          By completing this purchase, you agree to our Terms of Service and
          Privacy Policy
        </p>
      </footer>

      <BottomNav />
    </div>
  );
}


