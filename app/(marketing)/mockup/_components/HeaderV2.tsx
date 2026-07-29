"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────
 * Shared logo + editorial header used by mockup pages.
 * ─────────────────────────────────────────────────────────────── */

export function LogoMatchedPin({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id="lp-a-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#lp-a-bg)" />
      <path
        d="M20 9c4.9 0 8.4 3.6 8.4 8.3 0 5.8-7 12.4-8.4 12.4S11.6 23 11.6 17.3C11.6 12.6 15.1 9 20 9z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="17" r="3.6" fill="#fbbf24" />
      <circle cx="20" cy="17" r="1.4" fill="#0f172a" />
    </svg>
  );
}

function Wordmark({ accent = "#d97706" }: { accent?: string }) {
  return (
    <div className="leading-none">
      <div className="flex items-baseline gap-1">
        <span className="text-[17px] sm:text-[19px] font-black tracking-tight text-slate-900">atoc</span>
        <span
          className="text-[10px] sm:text-[11px] font-bold tracking-[0.16em] sm:tracking-[0.18em] uppercase translate-y-[-1px]"
          style={{ color: accent }}
        >
          korea
        </span>
      </div>
      <div className="mt-0.5 hidden sm:block text-[9.5px] font-medium uppercase tracking-[0.22em] text-slate-500">
        Tour matching
      </div>
    </div>
  );
}

export function LogoLockup() {
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <div className="sm:hidden">
        <LogoMatchedPin size={32} />
      </div>
      <div className="hidden sm:block">
        <LogoMatchedPin size={36} />
      </div>
      <Wordmark />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────────
 * Editorial header with integrated match input card.
 * ─────────────────────────────────────────────────────────────── */
export function HeaderV2() {
  const [scrolled, setScrolled] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled ? "backdrop-blur-xl backdrop-saturate-150 bg-white/85" : "bg-white"
      }`}
    >
      <div className="border-b border-stone-200/70">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-14">
          {/* Top row */}
          <div className="flex items-center justify-between gap-3 h-[64px] sm:h-[80px]">
            <Link href="/" className="group flex items-center shrink-0 transition-opacity hover:opacity-90">
              <LogoLockup />
            </Link>

            <nav className="hidden lg:flex items-center gap-7 xl:gap-9">
              <div
                className="relative"
                onMouseEnter={() => setDestOpen(true)}
                onMouseLeave={() => setDestOpen(false)}
              >
                <button className="group relative inline-flex items-center gap-1.5 py-2 text-[13.5px] font-semibold tracking-tight text-slate-700 transition-colors hover:text-slate-900">
                  <span className="relative">
                    Destinations
                    <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
                  </span>
                  <svg
                    className={`h-3 w-3 text-slate-400 transition-transform ${destOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
                  </svg>
                </button>
                {destOpen && (
                  <div className="absolute left-0 top-full mt-1 w-[640px] rounded-2xl border border-stone-200 bg-white p-5 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)]">
                    <div className="grid grid-cols-3 gap-5">
                      {[
                        { name: "Seoul", desc: "Capital city day & suburb trips", count: 9, emoji: "🗼" },
                        { name: "Jeju", desc: "Volcano island small-group tours", count: 12, emoji: "🌋" },
                        { name: "Busan", desc: "Coastal city & Gyeongju heritage", count: 6, emoji: "🌊" },
                        { name: "DMZ", desc: "Private 3rd Tunnel & bridge tours", count: 1, emoji: "🌉" },
                        { name: "Pocheon", desc: "Lake + herb island + art valley", count: 1, emoji: "🌿" },
                        { name: "From Incheon", desc: "Cruise shore excursions", count: 2, emoji: "🚢" },
                      ].map((d) => (
                        <a
                          key={d.name}
                          href={`/${d.name.toLowerCase()}`}
                          className="group flex items-start gap-3 rounded-xl p-2.5 transition-colors hover:bg-stone-50"
                        >
                          <span className="text-2xl">{d.emoji}</span>
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-1.5">
                              <span className="font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                                {d.name}
                              </span>
                              <span className="text-[10.5px] font-semibold text-slate-400">· {d.count}</span>
                            </div>
                            <p className="mt-0.5 text-[12px] leading-snug text-slate-500">{d.desc}</p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div
                className="relative"
                onMouseEnter={() => setStyleOpen(true)}
                onMouseLeave={() => setStyleOpen(false)}
              >
                <button className="group relative inline-flex items-center gap-1.5 py-2 text-[13.5px] font-semibold tracking-tight text-slate-700 transition-colors hover:text-slate-900">
                  <span className="relative">
                    Tour styles
                    <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
                  </span>
                  <svg
                    className={`h-3 w-3 text-slate-400 transition-transform ${styleOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
                  </svg>
                </button>
                {styleOpen && (
                  <div className="absolute left-0 top-full mt-1 w-[320px] rounded-2xl border border-stone-200 bg-white p-2 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)]">
                    {[
                      { label: "Small group", sub: "Up to 8 · shared van", icon: "👥" },
                      { label: "Private charter", sub: "Your own vehicle + driver", icon: "🚐" },
                      { label: "Bus day tours", sub: "Coach with hotel pickup", icon: "🚌" },
                      { label: "Cruise shore", sub: "Incheon · Busan · Jeju ports", icon: "⚓" },
                    ].map((s) => (
                      <a
                        key={s.label}
                        href="#"
                        className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors hover:bg-stone-50"
                      >
                        <span className="text-xl">{s.icon}</span>
                        <div className="min-w-0">
                          <div className="text-[13.5px] font-bold text-slate-900 group-hover:text-amber-700 transition-colors">
                            {s.label}
                          </div>
                          <div className="text-[11.5px] text-slate-500">{s.sub}</div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>

              <Link href="#" className="group relative py-2 text-[13.5px] font-semibold tracking-tight text-slate-700 transition-colors hover:text-slate-900">
                <span className="relative">
                  Why ATOC
                  <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
                </span>
              </Link>
              <Link href="#" className="group relative py-2 text-[13.5px] font-semibold tracking-tight text-slate-700 transition-colors hover:text-slate-900">
                <span className="relative">
                  Reviews
                  <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
                </span>
              </Link>
            </nav>

            <div className="flex items-center gap-1 sm:gap-3 lg:gap-4">
              <div className="relative" onMouseLeave={() => setLocaleOpen(false)}>
                <button
                  onClick={() => setLocaleOpen(!localeOpen)}
                  onMouseEnter={() => setLocaleOpen(true)}
                  aria-label="Language & currency"
                  className="inline-flex items-center gap-1.5 px-2 py-1.5 text-[12.5px] font-semibold text-slate-600 transition-colors hover:text-slate-900"
                >
                  <svg className="h-[18px] w-[18px] sm:h-4 sm:w-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden>
                    <circle cx="12" cy="12" r="9" />
                    <path d="M3 12h18M12 3a14 14 0 010 18M12 3a14 14 0 000 18" strokeLinecap="round" />
                  </svg>
                  <span className="hidden sm:inline tracking-wide">EN · USD</span>
                  <svg className={`hidden sm:inline h-3 w-3 text-slate-400 transition-transform ${localeOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
                  </svg>
                </button>
              </div>

              <Link href="/signin" className="hidden md:inline-flex items-center text-[13px] font-semibold tracking-tight text-slate-600 transition-colors hover:text-slate-900">
                Sign in
              </Link>

              <button aria-label="Menu" className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-stone-100">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </div>
          </div>

          {/* Integrated match input card */}
          <div className="pb-3 sm:pb-5">
            <Link
              href="/match"
              className="group relative flex items-center gap-3 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-3 sm:p-4 shadow-[0_18px_44px_-18px_rgba(15,23,42,0.45)] transition-all hover:shadow-[0_24px_60px_-20px_rgba(15,23,42,0.55)] active:scale-[0.995]"
            >
              <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-400/15 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
              <span className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 ring-1 ring-amber-300/30">
                <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                  <path d="M10 0l2.6 7.4L20 10l-7.4 2.6L10 20l-2.6-7.4L0 10l7.4-2.6L10 0z" />
                </svg>
              </span>
              <div className="relative flex-1 min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
                  ATOC ONLY · Tour matching
                </div>
                <div className="mt-0.5 text-[14px] sm:text-[15px] font-semibold text-white truncate">
                  Tell us your Korea trip
                  <span className="hidden xs:inline text-slate-400 font-normal"> — small group, private, photo, food…</span>
                </div>
              </div>
              <span className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 transition-transform group-hover:translate-x-0.5">
                <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                </svg>
              </span>
            </Link>
          </div>
        </div>
      </div>

      {/* Trust ribbon */}
      <div className="border-b border-stone-200/70 bg-stone-50/60">
        <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-14">
          <div className="flex items-center justify-between gap-3 py-2 text-[10.5px] sm:text-[11px] tracking-wide text-slate-500">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold text-slate-700">AI 24/7</span>
              <span className="text-stone-300">·</span>
              <span className="truncate">Humans 9 AM–9 PM KST</span>
            </div>
            <div className="hidden sm:flex items-center gap-3 text-slate-500">
              <span>Free cancellation 24h</span>
              <span className="text-stone-300">·</span>
              <span>Hotel pickup</span>
              <span className="text-stone-300">·</span>
              <span>Klook · GYG · Viator listed</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
