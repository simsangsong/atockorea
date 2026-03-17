"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { ProposeTransitionLink } from "@/components/ProposeButton";
import { useState, useEffect, useCallback } from "react";
import { COPY } from "@/src/design/copy";

const PROPOSED_POLL_MS = 20000;
const PROPOSED_PREVIEW_LIMIT = 3;

interface ProposedTour {
  id: string;
  title: string;
  summary: string | null;
  participants: number;
  vehicle_type: "van" | "large_van";
  total_price_krw: number;
  schedule: Array<{ day: number; places: unknown[] }>;
  created_at: string;
}

export default function DestinationsCards() {
  const t = useTranslations();
  const [proposedTours, setProposedTours] = useState<ProposedTour[]>([]);

  const fetchProposed = useCallback(async () => {
    try {
      const res = await fetch("/api/custom-join-tour/proposed", { cache: "no-store" });
      const data = await res.json();
      setProposedTours((data.proposedTours || []).slice(0, PROPOSED_PREVIEW_LIMIT));
    } catch {
      setProposedTours([]);
    }
  }, []);

  useEffect(() => {
    fetchProposed();
    const interval = setInterval(fetchProposed, PROPOSED_POLL_MS);
    return () => clearInterval(interval);
  }, [fetchProposed]);

  return (
    <section className="pt-6 pb-12 md:pt-8 md:pb-14 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-white via-[#F5F7FA]/30 to-transparent">
      <div className="container mx-auto max-w-7xl">
        <h2 className="text-xl sm:text-2xl font-bold text-[#1A1A1A] mb-2 text-center">
          {COPY.destinations.title}
        </h2>

        {/* Destination cards: Jeju (live), Busan / Seoul (coming soon) */}
        <div className="grid gap-4 sm:grid-cols-3 mb-8 sm:mb-10">
          <ProposeTransitionLink
            href="/custom-join-tour"
            className="block rounded-xl border-2 border-[#1E4EDF]/30 bg-white p-4 sm:p-5 shadow-[0_4px_10px_rgba(0,0,0,0.06)] focus:outline-none focus:ring-2 focus:ring-[#1E4EDF] focus:ring-offset-2"
          >
            <h3 className="text-lg font-semibold text-[#1A1A1A]">Jeju</h3>
            <p className="text-sm font-medium text-[#1E4EDF] mt-1">{COPY.destinations.jeju}</p>
            <p className="text-sm text-[#666666] mt-2">AI tours available now.</p>
          </ProposeTransitionLink>
          <Link
            href="/contact"
            className="block rounded-xl border border-[#E1E5EA] bg-[#F5F7FA] p-4 sm:p-5 text-left focus:outline-none focus:ring-2 focus:ring-[#1E4EDF] focus:ring-offset-2"
          >
            <h3 className="text-lg font-semibold text-[#666666]">Busan</h3>
            <p className="text-sm text-[#666666] mt-1">{COPY.destinations.busan}</p>
            <span className="inline-block mt-3 text-sm font-semibold text-[#1E4EDF]">
              {COPY.destinations.notify}
            </span>
          </Link>
          <Link
            href="/contact"
            className="block rounded-xl border border-[#E1E5EA] bg-[#F5F7FA] p-4 sm:p-5 text-left focus:outline-none focus:ring-2 focus:ring-[#1E4EDF] focus:ring-offset-2"
          >
            <h3 className="text-lg font-semibold text-[#666666]">Seoul</h3>
            <p className="text-sm text-[#666666] mt-1">{COPY.destinations.seoul}</p>
            <span className="inline-block mt-3 text-sm font-semibold text-[#1E4EDF]">
              {COPY.destinations.notify}
            </span>
          </Link>
        </div>

        {/* Jeju AI customizing CTA — same href and behavior */}
        <div className="mb-6 sm:mb-8 max-w-7xl mx-auto">
          <ProposeTransitionLink
            href="/custom-join-tour"
            className="group block relative overflow-hidden rounded-2xl shadow-[0_12px_24px_rgba(0,0,0,0.10)] bg-[#0A1F44] focus:outline-none focus:ring-2 focus:ring-[#2EC4B6] focus:ring-offset-2 cursor-pointer"
          >
            <div className="absolute inset-0 z-0">
              <Image
                src="/images/destinations/jeju-card.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-cover opacity-40 mix-blend-overlay group-hover:scale-[1.02] transition-transform duration-300"
              />
            </div>
            <div className="absolute inset-0 z-[1] bg-gradient-to-r from-[#0A1F44]/90 via-[#1E4EDF]/80 to-[#0A1F44]/90" />
            <div className="relative z-10 min-h-[160px] sm:min-h-[180px] md:min-h-[200px] p-6 sm:p-8 md:p-10">
              <div className="flex flex-col justify-center text-left max-w-xl">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#2EC4B6]/20 border border-[#2EC4B6]/40 text-white text-xs font-semibold mb-4 w-fit">
                  <span className="w-2 h-2 rounded-full bg-[#2EC4B6] mr-2 animate-pulse" aria-hidden />
                  Semi-F.I.T
                </span>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold text-white tracking-tight mb-2">
                  {t("home.destinations.aiCustomizingTitle")}
                  <span className="text-[#2EC4B6] ml-1">(Beta)</span>
                </h3>
                <p className="text-sm text-white/90 mb-4 line-clamp-2">
                  {t("home.destinations.aiCustomizingDesc")}
                </p>
                <ul className="text-white/90 space-y-2 mb-4 text-sm font-medium">
                  <li className="flex items-center gap-2">
                    <span className="text-[#2EC4B6]" aria-hidden>✓</span>
                    {t("home.destinations.aiStep1")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#2EC4B6]" aria-hidden>✓</span>
                    {t("home.destinations.aiStep2")}
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-[#2EC4B6]" aria-hidden>✓</span>
                    {t("home.destinations.aiStep3")}
                  </li>
                </ul>
                <span className="inline-flex items-center gap-2 font-semibold text-white text-sm mt-2">
                  {t("home.destinations.aiCustomizingCta")}
                  <span aria-hidden>→</span>
                </span>
              </div>
            </div>
          </ProposeTransitionLink>
        </div>

        {/* Proposed tours — same fetch and links */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-end justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[#1A1A1A]">
                {t("home.proposedTours.sectionTitle")}
              </h3>
              <p className="text-xs text-[#666666] flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" aria-hidden />
                {t("home.proposedTours.sectionSubtitle")}
              </p>
            </div>
            <Link
              href="/custom-join-tour/proposed"
              className="text-sm font-semibold text-[#1E4EDF] hover:underline whitespace-nowrap min-h-[44px] inline-flex items-center"
            >
              {t("home.proposedTours.viewAll")}
            </Link>
          </div>
          <div className="rounded-xl border border-[#E1E5EA] bg-white p-3 sm:p-4 min-h-[80px]">
            {proposedTours.length === 0 ? (
              <p className="text-sm text-[#666666] py-2">{t("home.proposedTours.noItems")}</p>
            ) : (
              <ul className="space-y-2">
                {proposedTours.map((pt) => (
                  <li key={pt.id}>
                    <Link
                      href={`/custom-join-tour/proposed?id=${pt.id}`}
                      className="block rounded-lg border border-[#E1E5EA] bg-[#F5F7FA] px-3 py-2 hover:bg-[#E9EEF5] transition min-h-[44px]"
                    >
                      <p className="text-sm font-medium text-[#1A1A1A] line-clamp-1">{pt.title}</p>
                      <p className="text-xs text-[#666666] mt-0.5">
                        {t("home.proposedTours.participantsCount").replace("{{n}}", String(pt.participants))} · {pt.vehicle_type === "large_van" ? t("home.proposedTours.largeVan") : t("home.proposedTours.van")} · {(pt.total_price_krw / 10000).toFixed(0)}만 원
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
