"use client";

import { MapPin, CreditCard, ShieldCheck } from "lucide-react";
import {
  HOMEPAGE_COMPARISON,
  HOMEPAGE_PICKUP,
  HOMEPAGE_DEPOSIT_BALANCE,
  HOMEPAGE_BOOKING_RULES,
} from "@/src/design/homepage";

const BRAND_NAVY = "#0A1F44";
const BRAND_BLUE = "#1E4EDF";

export default function ComparisonPanelPremium() {
  const { title, subtitle, rows } = HOMEPAGE_COMPARISON;

  return (
    <section
      className="w-full py-10 sm:py-14 md:py-16 bg-[#F8FAFC]"
      aria-labelledby="comparison-premium-heading"
    >
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
        {/* Section Header — text-brand-navy, tabular-nums */}
        <div className="mb-8 md:mb-10 text-center">
          <h2
            id="comparison-premium-heading"
            className="text-2xl sm:text-3xl font-extrabold tracking-tight tabular-nums"
            style={{ color: BRAND_NAVY }}
          >
            {title}
          </h2>
          <p className="mt-2 text-slate-500 font-medium text-sm sm:text-base">
            {subtitle}
          </p>
        </div>

        {/* 1. Ultra-clean comparison table — single white card, minimal borders */}
        <div
          className="mb-6 sm:mb-8 overflow-hidden rounded-[24px] bg-white border border-slate-100 shadow-sm"
          role="region"
          aria-label="Tour comparison"
        >
          {/* Header — only bottom divider, no grid lines */}
          <div className="grid grid-cols-4 border-b border-slate-100">
            <div className="p-4 md:p-6" />
            <div className="p-4 md:p-6 text-center bg-blue-50/30">
              <h3 className="font-extrabold text-sm md:text-base tracking-wide tabular-nums" style={{ color: BRAND_BLUE }}>
                AI JOIN
              </h3>
            </div>
            <div className="p-4 md:p-6 text-center">
              <h3 className="font-bold text-sm md:text-base tracking-wide tabular-nums" style={{ color: BRAND_NAVY }}>
                PRIVATE
              </h3>
            </div>
            <div className="p-4 md:p-6 text-center">
              <h3 className="font-semibold text-slate-400 text-sm md:text-base tracking-wide tabular-nums">
                BUS
              </h3>
            </div>
          </div>

          {/* Body — divide-y only, hover for feedback */}
          <div className="divide-y divide-slate-50">
            {rows.map((row) => (
              <div
                key={row.label}
                className="grid grid-cols-4 items-center hover:bg-slate-50/50 transition-colors duration-150"
              >
                <div className="p-4 md:p-6 text-xs md:text-sm font-semibold text-slate-700 tabular-nums">
                  {row.label}
                </div>
                <div className="p-4 md:p-6 text-center text-xs md:text-sm font-bold tabular-nums bg-blue-50/30" style={{ color: BRAND_BLUE }}>
                  {row.ai}
                </div>
                <div className="p-4 md:p-6 text-center text-xs md:text-sm text-slate-600 font-medium tabular-nums">
                  {row.private}
                </div>
                <div className="p-4 md:p-6 text-center text-xs md:text-sm text-slate-400 tabular-nums">
                  {row.bus}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 2. Compact trust & rules — 3-column grid, white cards, icon + short copy */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="rounded-[20px] bg-white p-5 border border-slate-100 shadow-sm flex items-start gap-4">
            <div className="rounded-full bg-blue-50 p-2.5 text-[#1E4EDF] shrink-0" aria-hidden>
              <MapPin size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm mb-1 tabular-nums" style={{ color: BRAND_NAVY }}>
                {HOMEPAGE_PICKUP.title}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                {HOMEPAGE_PICKUP.body}
              </p>
            </div>
          </div>

          <div className="rounded-[20px] bg-white p-5 border border-slate-100 shadow-sm flex items-start gap-4">
            <div className="rounded-full bg-emerald-50 p-2.5 text-emerald-600 shrink-0" aria-hidden>
              <CreditCard size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm mb-1 tabular-nums" style={{ color: BRAND_NAVY }}>
                {HOMEPAGE_DEPOSIT_BALANCE.title}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Pay <span className="tabular-nums font-medium text-slate-600">20%</span> today. We never auto-charge the rest. Pay balance manually in My Tours.
              </p>
            </div>
          </div>

          <div className="rounded-[20px] bg-white p-5 border border-slate-100 shadow-sm flex items-start gap-4">
            <div className="rounded-full bg-slate-50 p-2.5 text-slate-700 shrink-0" aria-hidden>
              <ShieldCheck size={20} />
            </div>
            <div className="min-w-0">
              <h4 className="font-bold text-sm mb-1 tabular-nums" style={{ color: BRAND_NAVY }}>
                {HOMEPAGE_BOOKING_RULES.title}
              </h4>
              <p className="text-xs text-slate-500 leading-relaxed">
                Free cancellation until <span className="tabular-nums">24h</span> before. Balance in My Tours; no automatic charges.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
