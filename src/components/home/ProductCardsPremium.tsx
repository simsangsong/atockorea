"use client";

import Link from "next/link";
import { COPY } from "@/src/design/copy";
import { HOMEPAGE_AI_PRICES } from "@/src/design/homepage";

const CUSTOM_JOIN_HREF = "/custom-join-tour";
const TOURS_LIST_HREF = "/tours/list";

type PremiumProductCard = {
  title: string;
  description: string;
  bestFor: string;
  priceLabel: string;
  badge: string;
  href: string;
  cta: string;
  emphasized?: boolean;
};

const cards: PremiumProductCard[] = [
  {
    title: COPY.tourTypes.joinTitle,
    description: COPY.tourTypes.joinBody,
    bestFor: "Best for comfort + value",
    priceLabel: HOMEPAGE_AI_PRICES.joinPriceLabel,
    badge: "Most balanced",
    href: CUSTOM_JOIN_HREF,
    cta: COPY.tourTypes.joinCta,
    emphasized: true,
  },
  {
    title: COPY.tourTypes.privateTitle,
    description: COPY.tourTypes.privateBody,
    bestFor: "Best for families and friends",
    priceLabel: HOMEPAGE_AI_PRICES.privatePriceLabel,
    badge: "Most flexible",
    href: CUSTOM_JOIN_HREF,
    cta: COPY.tourTypes.privateCta,
  },
  {
    title: COPY.tourTypes.busTitle,
    description: COPY.tourTypes.busBody,
    bestFor: "Best for budget-first travelers",
    priceLabel: HOMEPAGE_AI_PRICES.busPriceLabel,
    badge: "Best budget",
    href: TOURS_LIST_HREF,
    cta: COPY.tourTypes.busCta,
  },
];

export default function ProductCardsPremium() {
  return (
    <section
      className="py-6 sm:py-8 md:py-12 px-4 sm:px-6 lg:px-8 bg-[#F5F7FA]"
      aria-labelledby="product-cards-premium-heading"
    >
      <div className="container mx-auto max-w-6xl">
        <h2
          id="product-cards-premium-heading"
          className="text-lg sm:text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-4 sm:mb-6 text-center"
        >
          Choose your style
        </h2>

        <div className="grid gap-4 sm:gap-5 md:grid-cols-3">
          {cards.map((card) => (
            <Link
              key={card.title}
              href={card.href}
              className={`block rounded-xl border p-4 sm:p-5 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition duration-200 ease-out hover:shadow-[0_4px_10px_rgba(0,0,0,0.08)] focus:outline-none focus:ring-2 focus:ring-[#1E4EDF] focus:ring-offset-2 min-h-[44px] ${
                card.emphasized
                  ? "border-[#1E4EDF]/40 bg-white ring-1 ring-[#1E4EDF]/20"
                  : "border-[#E1E5EA] bg-white"
              }`}
            >
              <div className="mb-2.5 inline-flex rounded-full bg-[#0A1F44] px-3 py-1 text-xs font-semibold text-white">
                {card.badge}
              </div>

              <h3 className="text-base sm:text-lg font-bold tracking-tight text-slate-900">
                {card.title}
              </h3>

              <p className="mt-1.5 text-sm text-slate-600 leading-snug line-clamp-2">
                {card.description}
              </p>

              <div className="mt-4">
                <div className="text-xs uppercase tracking-wide text-slate-500">
                  Starting from
                </div>
                <div className="mt-0.5 text-lg sm:text-xl font-bold tracking-tight text-slate-900 tabular-nums">
                  {card.priceLabel}
                </div>
                <div className="mt-0.5 text-xs sm:text-sm text-slate-600">{card.bestFor}</div>
              </div>

              <div
                className={`mt-4 inline-flex min-h-[44px] items-center justify-center rounded-full px-4 py-2.5 text-sm font-semibold text-white ${
                  card.emphasized ? "bg-[#1E4EDF] shadow-md shadow-[#1E4EDF]/25" : "bg-[#0A1F44]"
                }`}
              >
                {card.cta}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
