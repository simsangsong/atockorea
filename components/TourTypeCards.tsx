"use client";

import Link from "next/link";
import { COPY } from "@/src/design/copy";
import { HOMEPAGE_AI_PRICES } from "@/src/design/homepage";
import { Card, CardHeader, CardTitle, CardContent } from "@/src/components/ui/card";

const CUSTOM_JOIN_HREF = "/custom-join-tour";
const TOURS_LIST_HREF = "/tours/list";

const primaryBtn =
  "inline-flex items-center justify-center font-semibold min-h-[44px] w-full px-6 py-3 text-base rounded-lg bg-[#1E4EDF] text-white hover:opacity-95 focus:outline-none focus:ring-2 focus:ring-[#1E4EDF] focus:ring-offset-2";
const outlineBtn =
  "inline-flex items-center justify-center font-semibold min-h-[44px] w-full px-6 py-3 text-base rounded-lg border-2 border-[#1E4EDF] text-[#1E4EDF] bg-transparent hover:bg-[#1E4EDF]/5 focus:outline-none focus:ring-2 focus:ring-[#1E4EDF] focus:ring-offset-2";

export default function TourTypeCards() {
  return (
    <section className="py-10 md:py-14 px-4 sm:px-6 lg:px-8 bg-[#F5F7FA]" aria-labelledby="tour-types-heading">
      <div className="container mx-auto max-w-6xl">
        <h2 id="tour-types-heading" className="text-xl md:text-2xl font-bold text-[#1A1A1A] mb-8 text-center">
          Choose your style
        </h2>

        <div className="grid gap-6 md:grid-cols-3">
          {/* Card 1: AI Private — highest visual priority, visible price */}
          <Card variant="elevated" padding="lg" className="md:border-2 md:border-[#1E4EDF]/20">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl text-[#1A1A1A]">
                {COPY.tourTypes.privateTitle}
              </CardTitle>
              <p className="text-base font-bold text-[#1E4EDF] mt-1" aria-label="Price">
                {HOMEPAGE_AI_PRICES.privatePriceLabel}
              </p>
              <p className="text-xs text-[#1A1A1A]/80 mt-0.5">
                {HOMEPAGE_AI_PRICES.privatePriceSub}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-[#1A1A1A] text-sm md:text-base">
              <p>{COPY.tourTypes.privateBody}</p>
              <ul className="space-y-1.5">
                {COPY.tourTypes.privatePoints.map((point, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-[#1E4EDF]" aria-hidden>•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
            <div className="mt-4">
              <Link href={CUSTOM_JOIN_HREF} className={primaryBtn}>
                {COPY.tourTypes.privateCta}
              </Link>
            </div>
          </Card>

          {/* Card 2: AI Small-Group Join — visible price */}
          <Card variant="elevated" padding="lg">
            <CardHeader>
              <CardTitle className="text-lg md:text-xl text-[#1A1A1A]">
                {COPY.tourTypes.joinTitle}
              </CardTitle>
              <p className="text-base font-bold text-[#1E4EDF] mt-1" aria-label="Price">
                {HOMEPAGE_AI_PRICES.joinPriceLabel}
              </p>
              <p className="text-xs text-[#1A1A1A]/80 mt-0.5">
                {HOMEPAGE_AI_PRICES.joinPriceSub}
              </p>
            </CardHeader>
            <CardContent className="space-y-3 text-[#1A1A1A] text-sm md:text-base">
              <p>{COPY.tourTypes.joinBody}</p>
              <ul className="space-y-1.5">
                {COPY.tourTypes.joinPoints.map((point, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <span className="text-[#2EC4B6]" aria-hidden>•</span>
                    {point}
                  </li>
                ))}
              </ul>
            </CardContent>
            <div className="mt-4">
              <Link href={CUSTOM_JOIN_HREF} className={primaryBtn}>
                {COPY.tourTypes.joinCta}
              </Link>
            </div>
          </Card>

          {/* Card 3: Classic Bus — smaller visual priority */}
          <Card variant="muted" padding="lg" className="opacity-95">
            <CardHeader>
              <CardTitle className="text-base md:text-lg text-[#1A1A1A] font-semibold">
                {COPY.tourTypes.busTitle}
              </CardTitle>
              <p className="text-sm text-[#666666] mt-1">{HOMEPAGE_AI_PRICES.busPriceLabel}</p>
            </CardHeader>
            <CardContent className="text-[#1A1A1A] text-sm">
              <p>{COPY.tourTypes.busBody}</p>
            </CardContent>
            <div className="mt-4">
              <Link href={TOURS_LIST_HREF} className={outlineBtn}>
                {COPY.tourTypes.busCta}
              </Link>
            </div>
          </Card>
        </div>
      </div>
    </section>
  );
}
