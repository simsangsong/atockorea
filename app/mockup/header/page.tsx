"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

/* ─────────────────────────────────────────────────────────────────
 * Logo concepts — five reusable marks paired with refined wordmark.
 * Each component renders independently so we can A/B in the gallery
 * below and swap the chosen one into the live header.
 * ─────────────────────────────────────────────────────────────── */

/** Concept A — "Matched pin": geometric A-shape pin with target dot inside.
 * Says "destination matched" in a single glyph. Premium navy + amber. */
function LogoMatchedPin({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <defs>
        <linearGradient id="lp-a-bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0f172a" />
          <stop offset="1" stopColor="#1e293b" />
        </linearGradient>
      </defs>
      {/* Soft rounded squircle */}
      <rect x="2" y="2" width="36" height="36" rx="11" fill="url(#lp-a-bg)" />
      {/* Pin silhouette (path outline) */}
      <path
        d="M20 9c4.9 0 8.4 3.6 8.4 8.3 0 5.8-7 12.4-8.4 12.4S11.6 23 11.6 17.3C11.6 12.6 15.1 9 20 9z"
        fill="none"
        stroke="#ffffff"
        strokeWidth="2.2"
        strokeLinejoin="round"
      />
      {/* Bullseye / match-target inside pin */}
      <circle cx="20" cy="17" r="3.6" fill="#fbbf24" />
      <circle cx="20" cy="17" r="1.4" fill="#0f172a" />
    </svg>
  );
}

/** Concept B — "Compass A": minimal upper-case A as compass rose,
 * referencing direction-finding / matching. Outline + amber detail. */
function LogoCompassA({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="20" cy="20" r="17" fill="#0f172a" />
      {/* Cardinal ticks */}
      <line x1="20" y1="5" x2="20" y2="9" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="20" y1="31" x2="20" y2="35" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="5" y1="20" x2="9" y2="20" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
      <line x1="31" y1="20" x2="35" y2="20" stroke="#475569" strokeWidth="1.5" strokeLinecap="round" />
      {/* Compass A (north needle) */}
      <path
        d="M14 26L20 12L26 26L23 26L21.6 22.4H18.4L17 26Z M19 20.4L20 18L21 20.4Z"
        fill="#ffffff"
        fillRule="evenodd"
      />
      {/* Top accent triangle */}
      <path d="M20 12L21.4 15.4L18.6 15.4Z" fill="#fbbf24" />
    </svg>
  );
}

/** Concept C — "Tile mark": modular monogram inspired by 보자기 grid + 단청 palette.
 * Korean folk pattern meets Bauhaus. */
function LogoTileMark({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect x="2" y="2" width="36" height="36" rx="9" fill="#fef3c7" />
      <rect x="2" y="2" width="18" height="18" rx="9" fill="#0f172a" />
      <rect x="20" y="20" width="18" height="18" rx="9" fill="#dc2626" />
      <circle cx="11" cy="11" r="4" fill="#fbbf24" />
      <circle cx="29" cy="29" r="4" fill="#fef3c7" />
      <path d="M20 2L20 20L2 20" stroke="#ffffff" strokeWidth="2" fill="none" opacity="0.0" />
    </svg>
  );
}

/** Concept D — "Peak": minimalist mountain silhouette (Hallasan/Seoraksan reference)
 * with sun. Geo-emotional, less corporate. */
function LogoPeak({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <rect x="2" y="2" width="36" height="36" rx="11" fill="#0f172a" />
      {/* Sun */}
      <circle cx="14" cy="14" r="3.2" fill="#fbbf24" />
      {/* Twin peaks */}
      <path
        d="M5 30L13.5 18L19 25L24 19L35 30Z"
        fill="#ffffff"
      />
      {/* Snow caps */}
      <path d="M12 21L15 17L18 21Z" fill="#fbbf24" opacity="0.85" />
    </svg>
  );
}

/** Concept E — "Bullseye-O": no separate mark — the "o" in 'atoc' becomes
 * a target. Pure typographic confidence. */
function LogoBullseyeO({ size = 36 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      aria-hidden
      className="shrink-0"
    >
      <circle cx="20" cy="20" r="16" stroke="#0f172a" strokeWidth="2.4" fill="none" />
      <circle cx="20" cy="20" r="10" stroke="#0f172a" strokeWidth="2" fill="none" />
      <circle cx="20" cy="20" r="4.5" fill="#fbbf24" />
      <circle cx="20" cy="20" r="1.6" fill="#0f172a" />
    </svg>
  );
}

/** Refined wordmark — sm screens drop the tagline + tighten kerning. */
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

type LogoVariant = "matched-pin" | "compass-a" | "tile-mark" | "peak" | "bullseye-o";

function LogoLockup({ variant }: { variant: LogoVariant }) {
  const Mark = {
    "matched-pin": LogoMatchedPin,
    "compass-a": LogoCompassA,
    "tile-mark": LogoTileMark,
    "peak": LogoPeak,
    "bullseye-o": LogoBullseyeO,
  }[variant];
  return (
    <div className="flex items-center gap-2 sm:gap-2.5">
      <div className="sm:hidden">
        <Mark size={32} />
      </div>
      <div className="hidden sm:block">
        <Mark size={36} />
      </div>
      <Wordmark />
    </div>
  );
}

export default function HeaderMockupPage() {
  const [scrolled, setScrolled] = useState(false);
  const [destOpen, setDestOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [localeOpen, setLocaleOpen] = useState(false);
  const [activeVariant, setActiveVariant] = useState<LogoVariant>("matched-pin");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="min-h-[200vh] bg-gradient-to-b from-stone-50 to-white">
      {/* ─────────────────────── v2: Editorial Hero Header ─────────────────────── */}
      <header
        className={`sticky top-0 z-50 transition-all duration-300 ${
          scrolled ? "backdrop-blur-xl backdrop-saturate-150 bg-white/80" : "bg-white"
        }`}
      >
        {/* Single bordered container — no dark utility bar.
            Mobile uses 2 rows (logo+icons, then full-width Match input).
            Desktop uses 1 generous row with refined center nav. */}
        <div className="border-b border-stone-200/70">
          <div className="mx-auto max-w-[1400px] px-4 sm:px-6 md:px-10 lg:px-14">
            {/* Top row — desktop: full layout; mobile: just logo + icons */}
            <div className="flex items-center justify-between gap-3 h-[64px] sm:h-[80px]">
              {/* Logo lockup */}
              <Link href="/" className="group flex items-center shrink-0 transition-opacity hover:opacity-90">
                <LogoLockup variant={activeVariant} />
              </Link>

            {/* Center nav — editorial spacing, no pill bg */}
            <nav className="hidden lg:flex items-center gap-7 xl:gap-9">
              {/* Destinations — editorial underline-grow */}
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
                              <span className="text-[10.5px] font-semibold text-slate-400">
                                · {d.count}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[12px] leading-snug text-slate-500">
                              {d.desc}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                    <div className="mt-4 border-t border-stone-100 pt-3 flex items-center justify-between">
                      <span className="text-[12px] text-slate-500">
                        Tours across 6 regions
                      </span>
                      <a
                        href="/tours/list"
                        className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-slate-900 hover:text-amber-700 transition-colors"
                      >
                        Browse all
                        <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor" aria-hidden>
                          <path
                            fillRule="evenodd"
                            d="M7.21 5.23a.75.75 0 011.06-.02l4.39 4.25a.75.75 0 010 1.08l-4.39 4.25a.75.75 0 11-1.04-1.08L11.06 10 7.19 6.29a.75.75 0 01.02-1.06z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </a>
                    </div>
                  </div>
                )}
              </div>

              {/* Tour styles — editorial underline */}
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

              <Link
                href="#"
                className="group relative py-2 text-[13.5px] font-semibold tracking-tight text-slate-700 transition-colors hover:text-slate-900"
              >
                <span className="relative">
                  Why ATOC
                  <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
                </span>
              </Link>
              <Link
                href="#"
                className="group relative py-2 text-[13.5px] font-semibold tracking-tight text-slate-700 transition-colors hover:text-slate-900"
              >
                <span className="relative">
                  Reviews
                  <span className="absolute -bottom-0.5 left-0 h-[1.5px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full" />
                </span>
              </Link>
            </nav>

            {/* Right cluster — refined, no CTA up here on mobile */}
            <div className="flex items-center gap-1 sm:gap-3 lg:gap-4">
              {/* Locale + currency pill — icon-only on mobile, full on sm+ */}
              <div
                className="relative"
                onMouseLeave={() => setLocaleOpen(false)}
              >
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
                  <svg
                    className={`hidden sm:inline h-3 w-3 text-slate-400 transition-transform ${localeOpen ? "rotate-180" : ""}`}
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden
                  >
                    <path d="M5.23 7.21a.75.75 0 011.06.02L10 11.06l3.71-3.83a.75.75 0 111.08 1.04l-4.25 4.39a.75.75 0 01-1.08 0L5.21 8.27a.75.75 0 01.02-1.06z" />
                  </svg>
                </button>
                {localeOpen && (
                  <div className="absolute right-0 top-full mt-1 w-[280px] rounded-2xl border border-stone-200 bg-white p-3 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18)]">
                    <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Language
                    </div>
                    <div className="grid grid-cols-3 gap-1 mb-3">
                      {[
                        { code: "EN", label: "English" },
                        { code: "KO", label: "한국어" },
                        { code: "JA", label: "日本語" },
                        { code: "ZH", label: "中文 (简)" },
                        { code: "TW", label: "中文 (繁)" },
                        { code: "ES", label: "Español" },
                      ].map((l, i) => (
                        <button
                          key={l.code}
                          className={`rounded-lg px-2 py-1.5 text-[12px] font-semibold transition-colors ${
                            i === 0
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-stone-100"
                          }`}
                        >
                          {l.label}
                        </button>
                      ))}
                    </div>
                    <div className="mb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">
                      Currency
                    </div>
                    <div className="grid grid-cols-4 gap-1">
                      {["USD", "KRW", "EUR", "JPY", "CNY", "TWD", "GBP", "AUD"].map((c, i) => (
                        <button
                          key={c}
                          className={`rounded-lg px-2 py-1.5 text-[11.5px] font-semibold transition-colors ${
                            i === 0
                              ? "bg-slate-900 text-white"
                              : "text-slate-700 hover:bg-stone-100"
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Sign in — refined text link, no pill */}
              <Link
                href="/signin"
                className="hidden md:inline-flex items-center text-[13px] font-semibold tracking-tight text-slate-600 transition-colors hover:text-slate-900"
              >
                Sign in
              </Link>

              {/* Hamburger (mobile + tablet) */}
              <button
                aria-label="Menu"
                className="lg:hidden inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-700 transition-colors hover:bg-stone-100"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </div>
          </div>

            {/* ────── Hero match input — full-bleed on mobile, inline pill on desktop ────── */}
            <div className="pb-3 sm:pb-5">
              <Link
                href="/match"
                className="group relative flex items-center gap-3 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 via-slate-900 to-slate-800 p-3 sm:p-4 shadow-[0_18px_44px_-18px_rgba(15,23,42,0.45)] transition-all hover:shadow-[0_24px_60px_-20px_rgba(15,23,42,0.55)] active:scale-[0.995]"
              >
                {/* Amber shimmer */}
                <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-amber-400/15 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />

                {/* Sparkle icon */}
                <span className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 ring-1 ring-amber-300/30">
                  <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px] text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
                    <path d="M10 0l2.6 7.4L20 10l-7.4 2.6L10 20l-2.6-7.4L0 10l7.4-2.6L10 0z" />
                  </svg>
                </span>

                {/* Input-style placeholder */}
                <div className="relative flex-1 min-w-0">
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-300/90">
                    ATOC ONLY · Tour matching
                  </div>
                  <div className="mt-0.5 text-[14px] sm:text-[15px] font-semibold text-white truncate">
                    Tell us your Korea trip
                    <span className="hidden xs:inline text-slate-400 font-normal"> — small group, private, photo, food…</span>
                  </div>
                </div>

                {/* Arrow capsule */}
                <span className="relative flex h-9 w-9 sm:h-10 sm:w-10 shrink-0 items-center justify-center rounded-xl bg-white text-slate-900 transition-transform group-hover:translate-x-0.5">
                  <svg className="h-4 w-4 sm:h-[18px] sm:w-[18px]" fill="none" stroke="currentColor" strokeWidth={2.4} viewBox="0 0 24 24" aria-hidden>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                  </svg>
                </span>
              </Link>
            </div>
          </div>
        </div>

        {/* Thin trust ribbon — sits inside header border, very subtle */}
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

      {/* ─────────────────────── Logo lab ─────────────────────── */}
      <main className="mx-auto max-w-[1400px] px-5 md:px-8 lg:px-12 py-12">
        <div className="mb-6">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600">
            Logo lab
          </div>
          <h1 className="mt-1 text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
            Pick a direction — the header above updates live.
          </h1>
          <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-slate-600">
            Five marks paired with the same refined wordmark. Click any card to
            preview it in the live header.
          </p>
        </div>

        {/* Gallery */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {([
            {
              v: "matched-pin",
              title: "A. Matched pin",
              tag: "Recommended",
              body: "Map pin with a target inside — destination + match in one glyph. Reads premium navy + amber accent, scales down to favicon cleanly.",
            },
            {
              v: "compass-a",
              title: "B. Compass A",
              tag: "Direction-finding",
              body: "Letter A as compass needle with cardinal ticks. On-message for 'matched, not searched' — points you somewhere.",
            },
            {
              v: "bullseye-o",
              title: "C. Bullseye-O",
              tag: "Pure typographic",
              body: "No separate mark — the 'o' in atoc is the target. Confident, modern, the wordmark itself becomes memorable.",
            },
            {
              v: "peak",
              title: "D. Peak & sun",
              tag: "Geo-emotional",
              body: "Korean peaks (Hallasan/Seoraksan) with sun. Warmer, more travel-feeling — works well for hero/Instagram.",
            },
            {
              v: "tile-mark",
              title: "E. 보자기 tile",
              tag: "Cultural",
              body: "Modular tile inspired by Korean folk grids + 단청 palette. Distinct but less neutral — best when paired with strong photography.",
            },
          ] as { v: LogoVariant; title: string; tag: string; body: string }[]).map((opt) => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setActiveVariant(opt.v)}
              className={`group rounded-3xl border p-5 text-left transition-all ${
                activeVariant === opt.v
                  ? "border-slate-900 bg-white shadow-[0_18px_40px_-18px_rgba(15,23,42,0.25)]"
                  : "border-stone-200 bg-white hover:border-slate-300 hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-500">
                  {opt.title}
                </div>
                <span
                  className={`text-[9.5px] font-bold uppercase tracking-[0.16em] px-2 py-0.5 rounded-full ${
                    activeVariant === opt.v
                      ? "bg-slate-900 text-amber-300"
                      : "bg-stone-100 text-slate-500"
                  }`}
                >
                  {opt.tag}
                </span>
              </div>

              {/* Large preview */}
              <div className="mt-4 mb-3 flex items-center justify-center rounded-2xl border border-stone-100 bg-stone-50/70 py-8">
                <div className="scale-[1.6]">
                  <LogoLockup variant={opt.v} />
                </div>
              </div>

              {/* Mini preview row */}
              <div className="flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2">
                <div className="[&_*]:!text-white">
                  <div className="scale-90 origin-left">
                    <div className="flex items-center gap-2">
                      <div className="[&>svg]:!opacity-100">
                        {opt.v === "matched-pin" && <LogoMatchedPin size={28} />}
                        {opt.v === "compass-a" && <LogoCompassA size={28} />}
                        {opt.v === "tile-mark" && <LogoTileMark size={28} />}
                        {opt.v === "peak" && <LogoPeak size={28} />}
                        {opt.v === "bullseye-o" && <LogoBullseyeO size={28} />}
                      </div>
                      <span className="text-[14px] font-black">atoc</span>
                      <span className="text-[9px] font-bold tracking-[0.18em] text-amber-300">
                        KOREA
                      </span>
                    </div>
                  </div>
                </div>
                <span className="text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                  Dark BG
                </span>
              </div>

              <p className="mt-3 text-[12px] leading-snug text-slate-600">{opt.body}</p>
            </button>
          ))}

          {/* Favicon test — show all 5 at favicon scale for at-a-glance */}
          <div className="rounded-3xl border border-stone-200 bg-white p-5">
            <div className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-slate-500">
              Favicon test
            </div>
            <p className="mt-1 text-[12px] text-slate-600">
              How each reads at 16/24/32 px (browser tab, app icon).
            </p>
            <div className="mt-4 grid grid-cols-5 gap-2">
              {(["matched-pin", "compass-a", "bullseye-o", "peak", "tile-mark"] as LogoVariant[]).map((v) => (
                <div key={v} className="flex flex-col items-center gap-1 text-center">
                  <div className="text-[9px] text-slate-400">{v}</div>
                  <div className="flex items-end justify-center gap-1">
                    {v === "matched-pin" && (
                      <>
                        <LogoMatchedPin size={16} />
                        <LogoMatchedPin size={24} />
                        <LogoMatchedPin size={32} />
                      </>
                    )}
                    {v === "compass-a" && (
                      <>
                        <LogoCompassA size={16} />
                        <LogoCompassA size={24} />
                        <LogoCompassA size={32} />
                      </>
                    )}
                    {v === "bullseye-o" && (
                      <>
                        <LogoBullseyeO size={16} />
                        <LogoBullseyeO size={24} />
                        <LogoBullseyeO size={32} />
                      </>
                    )}
                    {v === "peak" && (
                      <>
                        <LogoPeak size={16} />
                        <LogoPeak size={24} />
                        <LogoPeak size={32} />
                      </>
                    )}
                    {v === "tile-mark" && (
                      <>
                        <LogoTileMark size={16} />
                        <LogoTileMark size={24} />
                        <LogoTileMark size={32} />
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-3xl border border-stone-200 bg-stone-50/60 p-6">
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
            Currently active in header
          </div>
          <div className="mt-3 flex items-center justify-between gap-4">
            <div className="scale-[1.4] origin-left">
              <LogoLockup variant={activeVariant} />
            </div>
            <div className="text-[12px] text-slate-500">
              Scroll up to see it in the header. Click another card above to swap.
            </div>
          </div>
        </div>

        {/* ─────────────────────── Landing audit & upgrade roadmap ─────────────────────── */}
        <section className="mt-16 border-t border-stone-200 pt-14">
          <div className="mb-8">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-600">
              Landing audit · upgrade plan
            </div>
            <h2 className="mt-1 text-3xl sm:text-4xl font-black tracking-tight text-slate-900">
              Where the home page is leaking value — and how to fix it.
            </h2>
            <p className="mt-2 max-w-2xl text-[14.5px] leading-relaxed text-slate-600">
              현재 8개 섹션 (Hero · Best match · Destinations · Choose style ·
              Featured · Why ATOC · Process · Final CTA)를 훑고 강점/약점/개선
              우선순위를 정리. 진짜 차별점인 "matched not searched"이 메시지로
              잘 안 박히고, 추상적 신뢰 카드가 많아 감정 연결이 약함.
            </p>
          </div>

          {/* 8-section audit matrix */}
          <div className="mb-12">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              1 · Section-by-section audit
            </h3>
            <div className="overflow-hidden rounded-2xl border border-stone-200 bg-white">
              <table className="w-full text-[13px]">
                <thead className="bg-stone-50/60 text-[10.5px] uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-bold">Section</th>
                    <th className="px-3 py-2.5 text-left font-bold">Job to be done</th>
                    <th className="px-3 py-2.5 text-left font-bold text-emerald-700">Strength</th>
                    <th className="px-3 py-2.5 text-left font-bold text-rose-700">Gap</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      n: "Hero",
                      job: "First impression + matching entry",
                      s: "Trust badges above input (4.9★, 100K+, 8 platforms)",
                      g: "Looks like an OTA search box — 'matched' message buried in chips",
                    },
                    {
                      n: "Best Match",
                      job: "AI result preview after submit",
                      s: "3-state UX (idle / loading / result) with skeleton + ping",
                      g: "Image error recovery is retry-only; no 'why this match' explanation",
                    },
                    {
                      n: "Destinations",
                      job: "City-level entry to catalog",
                      s: "Snap rail → grid transition is smooth",
                      g: "Hard-coded 3 cities; no DMZ/Pocheon/Incheon coverage; no live tour count",
                    },
                    {
                      n: "Choose style",
                      job: "Small group vs private vs bus",
                      s: "Visual hierarchy is clear (recommended dark card)",
                      g: "68vw mobile snap clips text; no real comparison metric (per-pax math)",
                    },
                    {
                      n: "Featured",
                      job: "Social proof via popular tours",
                      s: "Real DB fetch with image/price/title guards",
                      g: "6 fixed skeletons feel off when result <6; no review snippets per card",
                    },
                    {
                      n: "Why ATOC",
                      job: "4 differentiators (curated · AI · licensed · support)",
                      s: "Icon + accent color separation, warm cream bg",
                      g: "Text-heavy, no proof imagery; abstract — could be any OTA's pillars",
                    },
                    {
                      n: "Process",
                      job: "How booking flows (4 steps)",
                      s: "Dark premium tone; gradient connector line",
                      g: "Send→Verify→Confirm→Book is generic; doesn't show ATOC-specific value",
                    },
                    {
                      n: "Final CTA",
                      job: "Last-mile conversion",
                      s: "2-CTA hierarchy (primary blue / secondary outline)",
                      g: "Generic trust badges — no concrete numbers (vs 'reviewed by 230 travelers')",
                    },
                  ].map((row) => (
                    <tr key={row.n} className="border-t border-stone-100">
                      <td className="px-3 py-3 align-top">
                        <div className="font-bold text-slate-900">{row.n}</div>
                      </td>
                      <td className="px-3 py-3 align-top text-slate-700">{row.job}</td>
                      <td className="px-3 py-3 align-top">
                        <span className="text-emerald-700">{row.s}</span>
                      </td>
                      <td className="px-3 py-3 align-top">
                        <span className="text-rose-700">{row.g}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Cross-cutting themes */}
          <div className="mb-12">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              2 · Cross-cutting themes
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  emoji: "🎯",
                  title: "차별점이 약하게 전달됨",
                  body: "'matched not searched', 'AI 24/7 + Humans 9-9 KST', 'ATOC ONLY' 메시지가 hero 헤드라인이 아닌 작은 배지·칩에 묻혀 있음. 첫 1초에 'OTA와 어떻게 다른가' 인식 불가.",
                },
                {
                  emoji: "📷",
                  title: "감정 연결고리 부족",
                  body: "Why ATOC, Process는 추상적 텍스트만. 운영자 얼굴, 실제 픽업 차량, 가이드, 후기 영상이 없어 'hand-picked'가 신뢰감으로 전환 안 됨.",
                },
                {
                  emoji: "💰",
                  title: "가격 투명성 비교 없음",
                  body: "'Klook · GYG · Viator listed' 문구는 있지만 실제로 'same operator $62 → $49 here'처럼 차이를 보여주는 비교 위젯이 없음. 핵심 차별점인데 증거 없음.",
                },
                {
                  emoji: "🤖",
                  title: "AI 매칭 데모 부재",
                  body: "Best Match는 결과만 보여줌. '왜 이 투어가 매칭됐는지' (예: 사진 ↑, 도보 ↓, 어린이 ✓) 매칭 점수 분해가 없어 키워드 검색과 차별화 모호.",
                },
                {
                  emoji: "🗣",
                  title: "Voice of customer 약함",
                  body: "Featured에 별점은 있지만 실제 후기 인용·고객 사진·국적 다양성이 보이는 reviews 섹션 별도 없음. 다국적(6 locale) 후기 노출이 핵심인데 누락.",
                },
                {
                  emoji: "📱",
                  title: "모바일 sticky CTA 없음",
                  body: "긴 페이지를 스크롤하다 보면 hero에서 멀어지면서 '매칭하기' 진입 경로가 사라짐. 하단 sticky 'Match my trip' CTA 없어 전환 누수.",
                },
              ].map((t) => (
                <div key={t.title} className="rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="flex items-start gap-2.5">
                    <span className="text-2xl shrink-0" aria-hidden>{t.emoji}</span>
                    <div className="min-w-0">
                      <div className="text-[13.5px] font-bold text-slate-900">{t.title}</div>
                      <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                        {t.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Upgrade roadmap */}
          <div className="mb-12">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              3 · Priority-ranked upgrade roadmap
            </h3>
            <div className="space-y-3">
              {[
                {
                  p: "P0",
                  pColor: "bg-rose-100 text-rose-700",
                  title: "Hero를 'matched not searched' 메인 입력 카드로 재설계",
                  why: "현재 OTA-스타일 검색 박스 → 차별점 약함. 헤더 mockup에 만든 슬레이트 카드를 hero에 풀폭으로 배치. 입력하면 우측에 실시간 매칭 미리보기 카드 등장.",
                  effort: "M",
                  impact: "★★★",
                },
                {
                  p: "P0",
                  pColor: "bg-rose-100 text-rose-700",
                  title: "AI 매칭 reasoning 노출 ('Why this match')",
                  why: "Best Match 결과 카드에 매칭 점수 분해 (예: 사진중심 0.9, 도보 0.4, 어린이 ✓). 검색≠매칭 차별점을 시각적으로 증명.",
                  effort: "M",
                  impact: "★★★",
                },
                {
                  p: "P0",
                  pColor: "bg-rose-100 text-rose-700",
                  title: "가격 비교 위젯 (Klook/GYG/Viator vs ATOC)",
                  why: "'Same operator. Direct price.' 한 줄 + 실제 같은 투어 가격 비교 카드 ($62 → $49). 신뢰 + 가격 차별점 동시 증명. 4-5개 투어 샘플로 충분.",
                  effort: "S",
                  impact: "★★★",
                },
                {
                  p: "P1",
                  pColor: "bg-amber-100 text-amber-700",
                  title: "Reviews 섹션 신규 추가 — 다국적 후기 캐러셀",
                  why: "현재 review_count만 노출, 실제 후기 본문 없음. 영문/한글/일문/중문 후기 4-6개 카드 캐러셀. 국기 + 별점 + 본문 1-2줄 + 작은 인물 아이콘. 6 locale 차별점이 사회증거로 전환.",
                  effort: "M",
                  impact: "★★",
                },
                {
                  p: "P1",
                  pColor: "bg-amber-100 text-amber-700",
                  title: "Why ATOC 재설계 — 텍스트 → 이미지 + 증거",
                  why: "각 pillar에 1) Hand-picked: 운영자 얼굴/팀 사진 2) Matched: 매칭 점수 시각화 3) Licensed: 실제 라이선스 번호/스크린샷 4) Support: live ping + 응답 시간 분포 그래프.",
                  effort: "L",
                  impact: "★★",
                },
                {
                  p: "P1",
                  pColor: "bg-amber-100 text-amber-700",
                  title: "Process Operational 재설계 — 추상 → 실제 journey",
                  why: "Send→Verify→Confirm→Book → 'D-1 운전자 이름·차량번호 알림 / D-day 호텔 픽업 8:45 / D+1 날씨 악화 시 무료 재예약' 같은 구체적 약속. ATOC가 OTA와 다르게 운영하는 부분 명시.",
                  effort: "S",
                  impact: "★★",
                },
                {
                  p: "P1",
                  pColor: "bg-amber-100 text-amber-700",
                  title: "Destinations 확장 — 3 → 6+ regions, 실시간 카운트",
                  why: "DMZ · Pocheon · 인천 cruise port 추가. 각 카드에 'X tours · from $Y' 라이브 데이터. 캐러셀 → 매그닛 그리드 (불규칙 사이즈로 인기 도시 강조).",
                  effort: "S",
                  impact: "★",
                },
                {
                  p: "P2",
                  pColor: "bg-sky-100 text-sky-700",
                  title: "모바일 sticky bottom CTA 'Match my trip'",
                  why: "긴 스크롤 중 어디서나 매칭 진입 가능. 5초 노출 후 페이드인. hero CTA와 동일 톤(슬레이트 + amber 별).",
                  effort: "S",
                  impact: "★★",
                },
                {
                  p: "P2",
                  pColor: "bg-sky-100 text-sky-700",
                  title: "Final CTA 신뢰 배지 → 구체 숫자",
                  why: "'Verified operators' 같은 generic → '4.9★ · 230 reviews · 30+ Korea tours · 6 langs supported'. 모든 신뢰 신호에 숫자 박기.",
                  effort: "XS",
                  impact: "★",
                },
                {
                  p: "P2",
                  pColor: "bg-sky-100 text-sky-700",
                  title: "Featured Products 카드에 review snippet 추가",
                  why: "각 카드에 짧은 인용 1줄 ('Highlight of our trip — Marie 🇫🇷'). 카드 클릭 동인 강화.",
                  effort: "XS",
                  impact: "★",
                },
              ].map((row, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 rounded-2xl border border-stone-200 bg-white p-4 transition-shadow hover:shadow-[0_8px_24px_-12px_rgba(15,23,42,0.12)]"
                >
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${row.pColor}`}>
                    {row.p}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <h4 className="font-bold text-slate-900 text-[14px]">{row.title}</h4>
                      <span className="hidden sm:inline text-[11px] text-slate-500 shrink-0">
                        effort {row.effort} · impact {row.impact}
                      </span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-slate-600">
                      {row.why}
                    </p>
                    <div className="mt-1.5 sm:hidden text-[11px] text-slate-500">
                      effort {row.effort} · impact {row.impact}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 90-day phased plan */}
          <div className="mb-12">
            <h3 className="mb-4 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500">
              4 · 90-day phased rollout
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                {
                  label: "Week 1–2 (P0)",
                  color: "from-rose-50 to-white border-rose-200",
                  items: [
                    "Hero re-design with match input card",
                    "Best Match 'why this match' reasoning",
                    "Price compare widget (5 sample tours)",
                  ],
                  outcome: "차별점 메시지가 첫 화면에 명확히 박힘. 검색≠매칭이 1초 안에 전달.",
                },
                {
                  label: "Week 3–6 (P1)",
                  color: "from-amber-50 to-white border-amber-200",
                  items: [
                    "Reviews 캐러셀 신규 섹션",
                    "Why ATOC 재설계 (이미지+증거)",
                    "Process Operational 구체화",
                    "Destinations 6+ 확장",
                  ],
                  outcome: "감정 연결 + 사회증거 + 운영 약속이 갖춰져 신뢰가 단단해짐.",
                },
                {
                  label: "Week 7–12 (P2)",
                  color: "from-sky-50 to-white border-sky-200",
                  items: [
                    "모바일 sticky bottom CTA",
                    "Final CTA 숫자 박힌 배지",
                    "Featured 카드 review snippet",
                    "A/B 테스트 + 측정",
                  ],
                  outcome: "전환 누수 차단 + 데이터로 검증해 다음 사이클 우선순위 잡기.",
                },
              ].map((phase) => (
                <div
                  key={phase.label}
                  className={`rounded-2xl border bg-gradient-to-b p-5 ${phase.color}`}
                >
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-700">
                    {phase.label}
                  </div>
                  <ul className="mt-3 space-y-1.5">
                    {phase.items.map((it) => (
                      <li key={it} className="flex items-start gap-2 text-[12.5px] text-slate-700">
                        <span className="mt-1.5 inline-flex h-1 w-1 shrink-0 rounded-full bg-slate-500" aria-hidden />
                        <span>{it}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-3 border-t border-stone-200/70 pt-3 text-[11.5px] italic text-slate-600">
                    {phase.outcome}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendation panel */}
          <div className="rounded-3xl border border-slate-900 bg-slate-900 p-6 sm:p-8 text-white">
            <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-amber-300">
              My recommendation
            </div>
            <h3 className="mt-2 text-2xl sm:text-3xl font-black tracking-tight">
              Start with the 3 P0 items. They flip the brand promise on-page.
            </h3>
            <p className="mt-3 text-[14px] leading-relaxed text-slate-300 max-w-3xl">
              Hero 재설계 + AI 매칭 reasoning + 가격 비교 위젯 — 이 셋만 잘 되면 사이트
              방문자의 첫 30초가 완전히 다르게 보임. 나머지 P1/P2는 신뢰 강화와
              전환 최적화의 영역이라 차례로 쌓아가도 늦지 않음. 어디부터
              시작할지 알려주면 바로 design + 구현 들어갈게.
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 ring-1 ring-amber-300/30 px-3 py-1.5 text-[12px] font-semibold text-amber-300">
                P0 · Hero redesign
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 ring-1 ring-amber-300/30 px-3 py-1.5 text-[12px] font-semibold text-amber-300">
                P0 · Match reasoning
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/15 ring-1 ring-amber-300/30 px-3 py-1.5 text-[12px] font-semibold text-amber-300">
                P0 · Price compare
              </span>
            </div>
          </div>
        </section>

        <div className="mt-16 h-[40vh] rounded-3xl border border-dashed border-stone-300 bg-white/40 flex items-center justify-center text-slate-400 text-sm">
          Scroll target — header compacts above
        </div>
      </main>
    </div>
  );
}
