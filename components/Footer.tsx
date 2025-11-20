// components/Footer.tsx
import React from "react";

export default function Footer() {
  return (
    <footer className="mt-8 px-4 pb-8 text-[13px] text-[#444]">
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-5 shadow-sm">

        <h2 className="text-[16px] font-semibold mb-2">AtoC Korea</h2>

        <p className="mb-1">
          <strong>Business Registration Number:</strong> 09898099
        </p>
        <p className="mb-1">
          <strong>E-commerce Registration Number:</strong> Jeju Yeondong-0000
        </p>
        <p className="mb-1">
          <strong>Address:</strong> Yeondong, Jeju City, xxxx, xxho
        </p>

        {/* Contact + Email (same line) */}
        <p className="mb-2">
          <strong>Contact:</strong> 010-8973-0913&nbsp;&nbsp;
          <strong>Email:</strong> support@atoc.kr
        </p>

        {/* Payment Logos */}
        <div className="flex items-center gap-4 mb-2">
          <img
            src="https://www.paypalobjects.com/webstatic/mktg/logo/pp_cc_mark_111x69.jpg"
            alt="PayPal"
            className="h-5"
          />
          <img
            src="https://unpkg.com/simple-icons@latest/icons/stripe.svg"
            alt="Stripe"
            className="h-5"
          />
        </div>

        {/* Secure payment note */}
        <p className="text-[12px] text-[#555] mb-2">
          Secure online payments processed via global providers.
        </p>

        {/* Terms + Privacy */}
        <div className="flex items-center gap-3 text-[13px] mb-2">
          <a href="#" className="hover:underline">
            Terms of Service
          </a>
          <span>|</span>
          <a href="#" className="hover:underline">
            Privacy Policy
          </a>
        </div>

        {/* Bottom */}
        <p className="text-[12px] text-[#777]">
          © AtoC Korea. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
