"use client";

import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "@/lib/i18n";
import { ProposeTransitionLink } from "@/components/ProposeButton";
import { useState, useEffect, useCallback } from "react";

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
    <section className="pt-6 pb-12 md:pt-8 md:pb-14 bg-gradient-to-b from-white via-slate-50/20 to-transparent">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight mb-1 bg-gradient-to-r from-blue-500 via-blue-600 to-orange-500 bg-clip-text text-transparent">
            {t("home.destinations.title")}
          </h2>
          <p className="text-xs sm:text-sm text-gray-500">
            {t("home.destinations.subtitle")}
          </p>
        </div>

        {/* AI 커스터마이징 조인 투어 — 로봇 전환 오버레이 + circuit grid + glitch */}
        <div className="mb-6 sm:mb-8 max-w-7xl mx-auto">
          <ProposeTransitionLink
            href="/custom-join-tour"
            className="group block relative overflow-hidden rounded-3xl shadow-[0_20px_50px_rgba(8,_112,_184,_0.15)] bg-slate-900 focus:outline-none focus:ring-2 focus:ring-cyan-400/50 focus:ring-offset-2 focus:ring-offset-slate-900 cursor-pointer"
          >
            {/* 배경 이미지 + 호버 줌 */}
            <div className="absolute inset-0 z-0">
              <Image
                src="/images/destinations/jeju-card.jpg"
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 55vw"
                className="object-cover opacity-40 mix-blend-overlay group-hover:scale-[1.02] transition-transform duration-700"
              />
            </div>
            {/* 다크 그라데이션 오버레이 */}
            <div className="absolute inset-0 z-[1] bg-gradient-to-r from-slate-900/90 via-indigo-900/80 to-slate-900/90 backdrop-blur-[2px]" />
            <div className="relative z-10 grid grid-cols-1 min-h-[160px] sm:min-h-[180px] md:min-h-[200px] p-6 sm:p-8 md:p-10">
              <div className="flex flex-col justify-center text-left">
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-400/30 text-cyan-300 text-xs font-semibold mb-4 backdrop-blur-sm w-fit">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mr-2 animate-pulse" aria-hidden />
                  <Image src="/images/robot-icon.png" alt="" width={14} height={14} className="object-contain mr-1.5" />
                  Semi-F.I.T
                </span>
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-extrabold text-white tracking-tight mb-2">
                  {t("home.destinations.aiCustomizingTitle")}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400 ml-1">(Beta)</span>
                </h3>
                <p className="text-sm text-slate-300 mb-4 line-clamp-2 max-w-md">
                  {t("home.destinations.aiCustomizingDesc")}
                </p>
                <ul className="text-slate-300 space-y-2 mb-4 text-sm font-medium">
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.destinations.aiStep1")}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.destinations.aiStep2")}
                  </li>
                  <li className="flex items-center gap-2">
                    <svg className="w-4 h-4 text-cyan-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {t("home.destinations.aiStep3")}
                  </li>
                </ul>
                {/* HUD CTA — left panel */}
                <div className="hud-cta-btn mt-2 w-fit">
                  <span className="hud-icon">
                    <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden>
                      <path d="M20 40C20 25 35 15 50 15C65 15 80 25 80 40V65C80 75 70 85 50 85C30 85 20 75 20 65V40Z" stroke="#00ffff" strokeWidth="2.5"/>
                      <path d="M25 45C25 38 35 33 50 33C65 33 75 38 75 45V60C75 67 65 72 50 72C35 72 25 67 25 60V45Z" fill="rgba(0,255,255,0.07)" stroke="#9d00ff" strokeWidth="1.5"/>
                      <rect x="35" y="48" width="30" height="8" rx="4" fill="#00ffff" opacity="0.9"/>
                      <circle cx="37" cy="42" r="4" fill="#00ffff" opacity="0.85"/>
                      <circle cx="63" cy="42" r="4" fill="#00ffff" opacity="0.85"/>
                      <circle cx="50" cy="6" r="3" fill="#9d00ff"/>
                    </svg>
                  </span>
                  <span className="hud-text">
                    {t("home.destinations.aiCustomizingCta")}
                    <span className="hud-arrow">→</span>
                  </span>
                </div>
              </div>
            </div>
          </ProposeTransitionLink>
        </div>

        {/* 현재 발의된 투어 (실시간 갱신) */}
        <div className="mb-8 sm:mb-10">
          <div className="flex items-end justify-between gap-2 mb-3">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-gray-900">
                {t("home.proposedTours.sectionTitle")}
              </h3>
              <p className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                {t("home.proposedTours.sectionSubtitle")}
              </p>
            </div>
            <Link
              href="/custom-join-tour/proposed"
              className="text-xs sm:text-sm font-semibold text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              {t("home.proposedTours.viewAll")}
            </Link>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white/80 p-3 sm:p-4 min-h-[80px]">
            {proposedTours.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-500 py-2">{t("home.proposedTours.noItems")}</p>
            ) : (
              <ul className="space-y-2">
                {proposedTours.map((pt) => (
                  <li key={pt.id}>
                    <Link
                      href={`/custom-join-tour/proposed?id=${pt.id}`}
                      className="block rounded-lg border border-gray-100 bg-gray-50/50 px-3 py-2 hover:bg-gray-50 transition"
                    >
                      <p className="text-sm font-medium text-gray-900 line-clamp-1">{pt.title}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
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
