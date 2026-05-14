"use client";

import { useEffect, useState } from "react";
import { HeaderV2 } from "../_components/HeaderV2";

/* ─────────────────────────────────────────────────────────────────
 * Landing v3 — Anthropic-tonal editorial.
 * Warm cream palette + clay accent + serif display + decorative marks.
 *
 * Palette
 *   paper       #FAF9F5    page background (warm cream)
 *   paper-2     #F5F2EB    inset cards
 *   ink         #1B1A19    headlines + body
 *   ink-2       #4A4742    secondary text
 *   ink-3       #9C988F    captions
 *   clay        #CC785C    primary accent
 *   clay-soft   #E8C9B8    accent inset
 *   line        #DCD7CB    hairlines on cream
 * ─────────────────────────────────────────────────────────────── */

const PALETTE = {
  paper: "#FAF9F5",
  paper2: "#F5F2EB",
  ink: "#1B1A19",
  ink2: "#4A4742",
  ink3: "#9C988F",
  clay: "#CC785C",
  claySoft: "#E8C9B8",
  line: "#DCD7CB",
};

/** Hand-drawn underline SVG — sits under an emphasized word. */
function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 200 14"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden
    >
      <path
        d="M2 8 C 35 3, 70 13, 100 6 S 165 12, 198 4"
        stroke={PALETTE.clay}
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/** Asterisk / spark mark — Anthropic-style ornament. */
function Asterisk({ className = "", size = 14 }: { className?: string; size?: number }) {
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      aria-hidden
    >
      <path
        d="M8 1v14M1 8h14M3 3l10 10M13 3L3 13"
        stroke={PALETTE.clay}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

const QUICK_PROMPTS = ["Family-friendly", "Photo-led", "Foodie route", "Hidden gems"];

const MATCH_EXAMPLES = [
  { input: "Family of 4, photo-led, low walking", output: "Jeju East UNESCO · Small Group" },
  { input: "Cruise day from Incheon, 7 hours", output: "Incheon → Seoul Cruise Day" },
  { input: "13 colleagues, DMZ + Paju, 10h", output: "Seoul DMZ Private — 13 pax" },
];

export default function LandingV2MockupPage() {
  const [exIdx, setExIdx] = useState(0);
  const [text, setText] = useState("");
  const example = MATCH_EXAMPLES[exIdx]!;

  useEffect(() => {
    if (text.trim().length > 0) return;
    const id = window.setInterval(() => setExIdx((i) => (i + 1) % MATCH_EXAMPLES.length), 4500);
    return () => window.clearInterval(id);
  }, [text]);

  return (
    <div
      className="min-h-screen antialiased"
      style={{ backgroundColor: PALETTE.paper, color: PALETTE.ink }}
    >
      <HeaderV2 />

      {/* ───────────── Hero — editorial ───────────── */}
      <section className="relative overflow-hidden">
        {/* Decorative ornaments */}
        <div className="pointer-events-none absolute inset-0 hidden lg:block" aria-hidden>
          <Asterisk className="absolute left-[8%] top-[18%]" size={20} />
          <Asterisk className="absolute right-[6%] top-[12%]" size={28} />
          <Asterisk className="absolute right-[40%] bottom-[14%]" size={14} />
        </div>

        <div className="relative mx-auto max-w-[1240px] px-5 sm:px-10 lg:px-14 pt-14 sm:pt-20 lg:pt-28 pb-24 sm:pb-32">
          <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-start">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: PALETTE.clay }}>
                <Asterisk size={12} />
                Korea tour matching
              </div>

              <h1
                className="mt-6 font-serif font-normal tracking-[-0.018em] leading-[0.98] text-[52px] sm:text-[80px] lg:text-[104px]"
                style={{ color: PALETTE.ink }}
              >
                Matched
                <br />
                to your{" "}
                <span className="relative inline-block">
                  Korea
                  <Squiggle className="absolute -bottom-2 left-0 right-0 h-3 sm:h-4" />
                </span>
                <br />
                <em className="font-serif italic" style={{ color: PALETTE.clay }}>
                  trip.
                </em>
              </h1>

              <p
                className="mt-8 max-w-md text-[16px] sm:text-[17px] leading-[1.65]"
                style={{ color: PALETTE.ink2 }}
              >
                30+ hand-picked tours from the same operators trusted by Klook, GetYourGuide
                and Viator. Booked direct here, at direct prices. We don't search keywords —
                we score fit.
              </p>

              {/* Match input — cream paper card */}
              <div
                className="mt-10 rounded-[20px] p-5 sm:p-6 shadow-[0_24px_60px_-30px_rgba(27,26,25,0.18)]"
                style={{ backgroundColor: PALETTE.paper2, border: `1px solid ${PALETTE.line}` }}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Asterisk size={14} />
                    <span className="text-[11px] uppercase tracking-[0.2em]" style={{ color: PALETTE.ink2 }}>
                      Describe your trip
                    </span>
                  </div>
                  <span className="text-[11px]" style={{ color: PALETTE.ink3 }}>
                    No signup · 30 s
                  </span>
                </div>
                <textarea
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder={`e.g. ${example.input}`}
                  rows={2}
                  className="mt-4 w-full resize-none bg-transparent text-[16px] sm:text-[17px] leading-relaxed focus:outline-none"
                  style={{ color: PALETTE.ink }}
                />
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {QUICK_PROMPTS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setText((t) => (t.length ? `${t}, ${p.toLowerCase()}` : p))}
                      className="rounded-full px-2.5 py-1 text-[12px] transition-colors"
                      style={{
                        border: `1px solid ${PALETTE.line}`,
                        color: PALETTE.ink2,
                        backgroundColor: "rgba(255,255,255,0.5)",
                      }}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="mt-5 pt-4 flex items-center justify-between" style={{ borderTop: `1px dashed ${PALETTE.line}` }}>
                  <span className="text-[11.5px] italic" style={{ color: PALETTE.ink3 }}>
                    "{example.input}"
                  </span>
                  <button
                    type="button"
                    className="group inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-[13px] font-medium text-white transition-all hover:opacity-95 active:scale-[0.98]"
                    style={{ backgroundColor: PALETTE.ink }}
                  >
                    Find my match
                    <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Right · editorial card stack */}
            <div className="lg:col-span-5 hidden lg:block">
              <div className="sticky top-32">
                {/* Decorative serif quote frame */}
                <div className="relative">
                  <div
                    className="rounded-[24px] overflow-hidden rotate-[-1.5deg] shadow-[0_30px_80px_-30px_rgba(27,26,25,0.25)]"
                    style={{ backgroundColor: "#fff", border: `1px solid ${PALETTE.line}` }}
                  >
                    {/* Visual */}
                    <div
                      className="relative aspect-[5/4]"
                      style={{
                        background: "linear-gradient(135deg, #C2B69C 0%, #8A7858 40%, #4A3C2A 100%)",
                      }}
                    >
                      <svg className="absolute inset-0 h-full w-full opacity-90" viewBox="0 0 400 320" preserveAspectRatio="xMidYMid slice" aria-hidden>
                        <defs>
                          <linearGradient id="hero-mtn" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0" stopColor="#1B1A19" stopOpacity="0.65" />
                            <stop offset="1" stopColor="#1B1A19" stopOpacity="1" />
                          </linearGradient>
                        </defs>
                        <circle cx="320" cy="80" r="42" fill="#E8C9B8" opacity="0.95" />
                        <path d="M0 230L70 170L150 200L220 140L300 190L400 160L400 320L0 320Z" fill="url(#hero-mtn)" />
                        <path d="M0 260L80 220L160 240L240 200L320 230L400 210L400 320L0 320Z" fill="#1B1A19" opacity="0.7" />
                      </svg>
                      <div className="absolute top-4 left-4 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[10.5px] font-medium tracking-wide text-[#1B1A19]">
                        <span style={{ color: PALETTE.clay }}>●</span>
                        Sample match
                      </div>
                    </div>
                    {/* Body */}
                    <div className="p-6">
                      <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: PALETTE.ink3 }}>
                        Jeju · Small group · 10 h
                      </div>
                      <h3 className="mt-2 font-serif text-[22px] leading-tight tracking-tight" style={{ color: PALETTE.ink }}>
                        Jeju East UNESCO Day Tour
                      </h3>
                      <div className="mt-3 flex items-center gap-2 text-[13px]" style={{ color: PALETTE.ink2 }}>
                        <span style={{ color: PALETTE.clay }}>★</span>
                        <span className="font-medium" style={{ color: PALETTE.ink }}>4.9</span>
                        <span style={{ color: PALETTE.ink3 }}>·</span>
                        <span>48 reviews</span>
                      </div>

                      <div className="mt-5 space-y-2.5">
                        {[
                          { k: "Photo-led", v: 92 },
                          { k: "Low walking", v: 65 },
                          { k: "Kid-friendly", v: 100 },
                        ].map((s) => (
                          <div key={s.k} className="flex items-center gap-3 text-[12px]">
                            <span className="w-[100px] shrink-0" style={{ color: PALETTE.ink3 }}>
                              {s.k}
                            </span>
                            <span className="flex-1 h-px relative" style={{ backgroundColor: PALETTE.line }}>
                              <span
                                className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                                style={{ width: `${s.v}%`, backgroundColor: PALETTE.clay }}
                              />
                            </span>
                            <span className="w-7 text-right text-[11px]" style={{ color: PALETTE.ink2 }}>{s.v}</span>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 pt-5 flex items-baseline justify-between" style={{ borderTop: `1px dashed ${PALETTE.line}` }}>
                        <div className="flex items-baseline gap-1.5">
                          <span className="text-[12px] line-through" style={{ color: PALETTE.ink3 }}>$69</span>
                          <span className="font-serif text-[28px] tracking-tight" style={{ color: PALETTE.ink }}>$59</span>
                        </div>
                        <span className="text-[12.5px] font-medium inline-flex items-center gap-1.5" style={{ color: PALETTE.clay }}>
                          See tour
                          <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                          </svg>
                        </span>
                      </div>
                    </div>
                  </div>
                  {/* Backing card peeking out */}
                  <div
                    className="absolute -bottom-3 -left-3 -right-3 rounded-[24px] -z-10 rotate-[1deg]"
                    style={{ backgroundColor: PALETTE.claySoft, height: "100%", border: `1px solid ${PALETTE.line}` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── § How matching works ───────────── */}
      <section
        className="relative border-t"
        style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper2 }}
      >
        <div className="mx-auto max-w-[1240px] px-5 sm:px-10 lg:px-14 py-20 sm:py-28">
          <div className="grid lg:grid-cols-12 gap-10 mb-14">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: PALETTE.clay }}>
                <Asterisk size={12} /> How it works
              </div>
              <h2
                className="mt-4 font-serif text-[40px] sm:text-[52px] leading-[1.02] tracking-tight"
                style={{ color: PALETTE.ink }}
              >
                We score fit on{" "}
                <em className="italic" style={{ color: PALETTE.clay }}>
                  twelve
                </em>{" "}
                dimensions.
              </h2>
            </div>
            <p
              className="lg:col-span-6 lg:col-start-7 self-end text-[15px] sm:text-[16px] leading-[1.7]"
              style={{ color: PALETTE.ink2 }}
            >
              Photo-led, walking demand, group size, kid-safe, port-aware. Your sentence
              becomes intent vectors. We rank, not retrieve — the highest-fit tour
              surfaces first.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-5">
            {[
              {
                num: "01",
                input: "Family of 4, photo-led, low walking",
                tour: "Jeju East UNESCO Day Tour",
                meta: "Small group · ★4.9 · 10h",
                price: { now: 59, was: 69 },
                scores: [
                  { k: "Photo-led", v: 92 },
                  { k: "Low walking", v: 65 },
                  { k: "Kid-friendly", v: 100 },
                ],
              },
              {
                num: "02",
                input: "Cruise day from Incheon, 7h",
                tour: "Incheon → Seoul Cruise Day",
                meta: "Bus tour · ★4.8 · 8h",
                price: { now: 69, was: 76 },
                scores: [
                  { k: "Port-aware", v: 100 },
                  { k: "Compact ≤ 8h", v: 90 },
                  { k: "1st-time stops", v: 88 },
                ],
              },
              {
                num: "03",
                input: "13 pax, DMZ + Paju, 10h",
                tour: "Seoul DMZ Private",
                meta: "Private · 13 pax · 10h",
                price: { now: 729, was: null },
                scores: [
                  { k: "13-pax bracket", v: 100 },
                  { k: "DMZ + Paju", v: 95 },
                  { k: "Private vehicle", v: 100 },
                ],
              },
            ].map((m) => (
              <article
                key={m.num}
                className="relative rounded-[20px] p-7 transition-shadow hover:shadow-[0_24px_60px_-30px_rgba(27,26,25,0.18)]"
                style={{ backgroundColor: "#fff", border: `1px solid ${PALETTE.line}` }}
              >
                <div className="flex items-baseline justify-between mb-5">
                  <span className="font-serif italic text-[34px] leading-none" style={{ color: PALETTE.clay }}>
                    {m.num}
                  </span>
                  <Asterisk size={14} />
                </div>
                <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: PALETTE.ink3 }}>
                  Traveler said
                </div>
                <p className="mt-2 font-serif italic text-[16px] leading-snug" style={{ color: PALETTE.ink2 }}>
                  "{m.input}"
                </p>
                <div className="my-5 h-px" style={{ backgroundColor: PALETTE.line }} />
                <div className="text-[11px] uppercase tracking-[0.18em]" style={{ color: PALETTE.ink3 }}>
                  Match
                </div>
                <h3 className="mt-1.5 font-serif text-[20px] leading-snug tracking-tight" style={{ color: PALETTE.ink }}>
                  {m.tour}
                </h3>
                <div className="mt-1 text-[12px]" style={{ color: PALETTE.ink3 }}>
                  {m.meta}
                </div>
                <ul className="mt-5 space-y-2">
                  {m.scores.map((s) => (
                    <li key={s.k} className="flex items-center gap-3 text-[12px]">
                      <span className="w-[110px] shrink-0" style={{ color: PALETTE.ink3 }}>{s.k}</span>
                      <span className="flex-1 h-px relative" style={{ backgroundColor: PALETTE.line }}>
                        <span
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                          style={{ width: `${s.v}%`, backgroundColor: PALETTE.clay }}
                        />
                      </span>
                      <span className="w-7 text-right text-[11px]" style={{ color: PALETTE.ink2 }}>{s.v}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-6 pt-5 flex items-baseline justify-between" style={{ borderTop: `1px dashed ${PALETTE.line}` }}>
                  <div className="flex items-baseline gap-1.5">
                    {m.price.was && (
                      <span className="text-[12px] line-through" style={{ color: PALETTE.ink3 }}>${m.price.was}</span>
                    )}
                    <span className="font-serif text-[24px] tracking-tight" style={{ color: PALETTE.ink }}>${m.price.now}</span>
                    <span className="text-[11px]" style={{ color: PALETTE.ink3 }}>
                      {m.price.now > 200 ? "/ vehicle" : "/ person"}
                    </span>
                  </div>
                  <span className="text-[12.5px] font-medium inline-flex items-center gap-1.5" style={{ color: PALETTE.clay }}>
                    See tour
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
                    </svg>
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── § Destinations — editorial magnet grid ───────────── */}
      <section className="border-t" style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper }}>
        <div className="mx-auto max-w-[1240px] px-5 sm:px-10 lg:px-14 py-20 sm:py-28">
          <div className="flex items-end justify-between flex-wrap gap-6 mb-12">
            <div className="max-w-xl">
              <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: PALETTE.clay }}>
                <Asterisk size={12} /> Where you can go
              </div>
              <h2
                className="mt-4 font-serif text-[40px] sm:text-[52px] leading-[1.02] tracking-tight"
                style={{ color: PALETTE.ink }}
              >
                Six regions,{" "}
                <em className="italic" style={{ color: PALETTE.clay }}>
                  hand-picked.
                </em>
              </h2>
            </div>
            <a
              href="/tours/list"
              className="inline-flex items-center gap-1.5 text-[13px] font-medium"
              style={{ color: PALETTE.ink }}
            >
              Browse all 30+ tours
              <svg className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
              </svg>
            </a>
          </div>

          {/* Asymmetric editorial grid */}
          <div className="grid grid-cols-2 lg:grid-cols-6 lg:grid-rows-2 gap-4 auto-rows-[180px] sm:auto-rows-[220px]">
            {[
              { name: "Jeju", tag: "Volcano island", count: 12, from: 59, color: "#7D8F65", span: "col-span-2 row-span-2 lg:col-span-3 lg:row-span-2" },
              { name: "Seoul", tag: "Capital + suburbs", count: 9, from: 47, color: "#8B5E3C", span: "col-span-2 lg:col-span-3 lg:row-span-1" },
              { name: "Busan", tag: "Coastal + Gyeongju", count: 6, from: 29, color: "#5B7C99", span: "col-span-1 lg:col-span-2" },
              { name: "DMZ", tag: "3rd Tunnel · bridge", count: 1, from: 419, unit: "/ vehicle", color: "#2C2A26", span: "col-span-1 lg:col-span-1" },
              { name: "Pocheon", tag: "Lake · herb · art", count: 1, from: 49, color: "#A87B5B", span: "col-span-1 lg:col-span-2" },
              { name: "Incheon", tag: "Cruise shore", count: 2, from: 69, color: "#3D5A6C", span: "col-span-1 lg:col-span-1" },
            ].map((d) => (
              <a
                key={d.name}
                href={`/${d.name.toLowerCase()}`}
                className={`relative overflow-hidden rounded-[20px] ${d.span} group transition-transform hover:-translate-y-0.5`}
                style={{
                  background: `linear-gradient(140deg, ${d.color} 0%, ${d.color}dd 60%, #1B1A19 130%)`,
                  border: `1px solid ${PALETTE.line}`,
                }}
              >
                {/* Faint mountain silhouette */}
                <svg className="absolute inset-x-0 bottom-0 w-full h-2/3 opacity-30" viewBox="0 0 400 200" preserveAspectRatio="xMidYMid slice" aria-hidden>
                  <path d="M0 130L60 90L130 110L200 70L270 100L330 80L400 110L400 200L0 200Z" fill="#1B1A19" />
                  <path d="M0 160L80 130L160 145L240 120L320 135L400 125L400 200L0 200Z" fill="#1B1A19" opacity="0.6" />
                </svg>
                {/* Sun */}
                <div
                  className="absolute right-6 top-6 h-10 w-10 rounded-full opacity-70"
                  style={{ backgroundColor: PALETTE.claySoft }}
                />
                {/* Tour count */}
                <div className="absolute top-5 left-5 inline-flex items-center gap-1 rounded-full bg-black/25 backdrop-blur-sm px-2 py-0.5 text-[10.5px] font-medium text-white">
                  {d.count} {d.count === 1 ? "tour" : "tours"}
                </div>
                {/* Content */}
                <div className="relative z-10 h-full flex flex-col justify-end p-6 text-white">
                  <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/70">
                    {d.tag}
                  </div>
                  <div className="mt-1 font-serif text-[28px] sm:text-[36px] leading-none tracking-tight">
                    {d.name}
                  </div>
                  <div className="mt-3 inline-flex items-baseline gap-1 text-[12px] text-white/80">
                    from
                    <span className="text-[16px] font-medium text-white">${d.from}</span>
                    <span className="text-white/60">{d.unit ?? "/ person"}</span>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── § Four promises ───────────── */}
      <section className="border-t" style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper2 }}>
        <div className="mx-auto max-w-[1240px] px-5 sm:px-10 lg:px-14 py-20 sm:py-28">
          <div className="grid lg:grid-cols-12 gap-10 mb-14">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: PALETTE.clay }}>
                <Asterisk size={12} /> Why ATOC
              </div>
              <h2
                className="mt-4 font-serif text-[40px] sm:text-[52px] leading-[1.02] tracking-tight"
                style={{ color: PALETTE.ink }}
              >
                Four promises,{" "}
                <em className="italic" style={{ color: PALETTE.clay }}>
                  with receipts.
                </em>
              </h2>
            </div>
            <p
              className="lg:col-span-6 lg:col-start-7 self-end text-[15px] sm:text-[16px] leading-[1.7]"
              style={{ color: PALETTE.ink2 }}
            >
              No vague pillars. Every claim ships with a concrete artifact —
              the operator's face, the score matrix, the platforms, the median response time.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-5">
            {/* 01 — Hand-picked */}
            <div className="rounded-[20px] p-8" style={{ backgroundColor: "#fff", border: `1px solid ${PALETTE.line}` }}>
              <div className="flex items-baseline justify-between mb-6">
                <span className="font-serif italic text-[34px] leading-none" style={{ color: PALETTE.clay }}>01</span>
                <Asterisk size={14} />
              </div>
              <h3 className="font-serif text-[22px] leading-tight tracking-tight" style={{ color: PALETTE.ink }}>
                Hand-picked, not pay-to-list.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                Every operator I've ridden with personally. Zero submissions.
              </p>
              <div className="mt-6 flex items-center gap-3 rounded-[14px] p-4" style={{ backgroundColor: PALETTE.paper2, border: `1px solid ${PALETTE.line}` }}>
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-white text-[11.5px] font-medium tracking-wide" style={{ backgroundColor: PALETTE.ink }}>
                  SS
                </div>
                <div className="min-w-0">
                  <div className="font-serif text-[15px]" style={{ color: PALETTE.ink }}>Sang Song</div>
                  <div className="text-[12px]" style={{ color: PALETTE.ink3 }}>Founder · Korea operations</div>
                </div>
              </div>
            </div>

            {/* 02 — Matched */}
            <div className="rounded-[20px] p-8" style={{ backgroundColor: "#fff", border: `1px solid ${PALETTE.line}` }}>
              <div className="flex items-baseline justify-between mb-6">
                <span className="font-serif italic text-[34px] leading-none" style={{ color: PALETTE.clay }}>02</span>
                <Asterisk size={14} />
              </div>
              <h3 className="font-serif text-[22px] leading-tight tracking-tight" style={{ color: PALETTE.ink }}>
                Matched on twelve dimensions.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                Same scoring across every tour. Sample below.
              </p>
              <div className="mt-6 rounded-[14px] p-4 space-y-2.5" style={{ backgroundColor: PALETTE.paper2, border: `1px solid ${PALETTE.line}` }}>
                {[
                  { k: "Photo-led", v: 92 },
                  { k: "Walking demand", v: 65 },
                  { k: "Kid-safe", v: 100 },
                ].map((s) => (
                  <div key={s.k} className="flex items-center gap-3 text-[12px]">
                    <span className="w-[110px] shrink-0" style={{ color: PALETTE.ink3 }}>{s.k}</span>
                    <span className="flex-1 h-px relative" style={{ backgroundColor: PALETTE.line }}>
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-[3px] rounded-full"
                        style={{ width: `${s.v}%`, backgroundColor: PALETTE.clay }}
                      />
                    </span>
                    <span className="w-7 text-right text-[11px]" style={{ color: PALETTE.ink2 }}>{s.v}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 03 — Licensed */}
            <div className="rounded-[20px] p-8" style={{ backgroundColor: "#fff", border: `1px solid ${PALETTE.line}` }}>
              <div className="flex items-baseline justify-between mb-6">
                <span className="font-serif italic text-[34px] leading-none" style={{ color: PALETTE.clay }}>03</span>
                <Asterisk size={14} />
              </div>
              <h3 className="font-serif text-[22px] leading-tight tracking-tight" style={{ color: PALETTE.ink }}>
                Licensed · listed elsewhere.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                Same operators you trust on:
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {["Klook", "GetYourGuide", "Viator", "Tripadvisor"].map((p) => (
                  <span
                    key={p}
                    className="inline-flex items-center rounded-full px-3 py-1.5 text-[12px]"
                    style={{ backgroundColor: PALETTE.paper2, border: `1px solid ${PALETTE.line}`, color: PALETTE.ink2 }}
                  >
                    {p}
                  </span>
                ))}
              </div>
            </div>

            {/* 04 — AI + humans */}
            <div className="rounded-[20px] p-8" style={{ backgroundColor: "#fff", border: `1px solid ${PALETTE.line}` }}>
              <div className="flex items-baseline justify-between mb-6">
                <span className="font-serif italic text-[34px] leading-none" style={{ color: PALETTE.clay }}>04</span>
                <Asterisk size={14} />
              </div>
              <h3 className="font-serif text-[22px] leading-tight tracking-tight" style={{ color: PALETTE.ink }}>
                AI 24/7 · humans 9–9 KST.
              </h3>
              <p className="mt-3 text-[14px] leading-relaxed" style={{ color: PALETTE.ink2 }}>
                Median response, last 30 days.
              </p>
              <div className="mt-6 rounded-[14px] p-4" style={{ backgroundColor: PALETTE.paper2, border: `1px solid ${PALETTE.line}` }}>
                <div className="flex items-end gap-1 h-12">
                  {[35, 28, 42, 25, 18, 22, 16].map((h, i) => (
                    <div key={i} className="flex-1 rounded-sm" style={{ height: `${h}%`, backgroundColor: PALETTE.clay, opacity: 0.55 + (i * 0.06) }} />
                  ))}
                </div>
                <div className="mt-4 flex items-baseline gap-4 text-[12px]">
                  <div>
                    <span className="font-serif text-[18px]" style={{ color: PALETTE.ink }}>~ 4 min</span>
                    <span className="ml-1.5" style={{ color: PALETTE.ink3 }}>AI</span>
                  </div>
                  <span style={{ color: PALETTE.line }}>·</span>
                  <div>
                    <span className="font-serif text-[18px]" style={{ color: PALETTE.ink }}>~ 18 min</span>
                    <span className="ml-1.5" style={{ color: PALETTE.ink3 }}>human</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── § Process — warm dark ───────────── */}
      <section className="border-t" style={{ borderColor: PALETTE.line, backgroundColor: "#1B1A19" }}>
        <div className="mx-auto max-w-[1240px] px-5 sm:px-10 lg:px-14 py-20 sm:py-28 text-white">
          <div className="grid lg:grid-cols-12 gap-10 mb-14">
            <div className="lg:col-span-5">
              <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: PALETTE.claySoft }}>
                <Asterisk size={12} /> The journey
              </div>
              <h2 className="mt-4 font-serif text-[40px] sm:text-[52px] leading-[1.02] tracking-tight">
                What we{" "}
                <em className="italic" style={{ color: PALETTE.claySoft }}>
                  actually do
                </em>{" "}
                — day by day.
              </h2>
            </div>
            <p className="lg:col-span-6 lg:col-start-7 self-end text-[15px] sm:text-[16px] leading-[1.7] text-white/70">
              Not generic "Send → Verify → Confirm → Book" buttons. The real operational
              promises we make, in writing, before you board.
            </p>
          </div>

          {/* Timeline with connector */}
          <div className="relative grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <div className="hidden lg:block absolute left-[10%] right-[10%] top-[42px] h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" aria-hidden />
            {[
              { d: "T − 2 days", title: "Match confirmed", body: "Korea ops WhatsApps within 30 min — operator name, pickup slot, what to bring." },
              { d: "T − 1 day", title: "Driver + plate", body: "Evening before: exact driver name, mobile, plate number, live pickup time." },
              { d: "T 0 · trip day", title: "Hotel pickup ± 15 min", body: "Driver pings on arrival. Live tracking link to you and one emergency contact." },
              { d: "T + 1 day", title: "Weather guarantee", body: "Key stop weather-canceled? Free re-book within 12 months. Otherwise, recap email." },
            ].map((step, i) => (
              <div key={i} className="relative rounded-[18px] p-7 bg-white/[0.04] border border-white/10">
                <div className="absolute -top-3 left-7 flex h-6 w-6 items-center justify-center rounded-full font-serif text-[12px]" style={{ backgroundColor: PALETTE.claySoft, color: PALETTE.ink }}>
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="text-[10.5px] uppercase tracking-[0.2em] text-white/60 mt-2">
                  {step.d}
                </div>
                <h3 className="mt-2.5 font-serif text-[19px] leading-snug tracking-tight">
                  {step.title}
                </h3>
                <p className="mt-3 text-[13px] leading-relaxed text-white/65">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───────────── § Reviews — magazine quotes ───────────── */}
      <section className="border-t" style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper }}>
        <div className="mx-auto max-w-[1240px] px-5 sm:px-10 lg:px-14 py-20 sm:py-28">
          <div className="grid lg:grid-cols-12 gap-10 mb-14">
            <div className="lg:col-span-7">
              <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: PALETTE.clay }}>
                <Asterisk size={12} /> What travelers say
              </div>
              <h2
                className="mt-4 font-serif text-[40px] sm:text-[52px] leading-[1.02] tracking-tight"
                style={{ color: PALETTE.ink }}
              >
                Reviewed in{" "}
                <em className="italic" style={{ color: PALETTE.clay }}>
                  six languages.
                </em>
              </h2>
            </div>
            <div className="lg:col-span-4 lg:col-start-9 self-end">
              <div className="flex items-baseline gap-2">
                <span className="font-serif text-[68px] leading-none tracking-tight" style={{ color: PALETTE.ink }}>
                  4.9
                </span>
                <span className="text-[24px]" style={{ color: PALETTE.clay }}>★</span>
              </div>
              <div className="text-[12.5px] mt-1" style={{ color: PALETTE.ink3 }}>
                from 230+ verified reviews · 30+ countries
              </div>
            </div>
          </div>

          {/* Magazine quote layout — staggered tilts */}
          <div className="-mx-5 sm:-mx-10 lg:-mx-14 px-5 sm:px-10 lg:px-14">
            <div className="flex gap-5 overflow-x-auto snap-x snap-mandatory pb-4 [scrollbar-width:thin]">
              {[
                { flag: "🇫🇷", name: "Marie L.", country: "Paris", body: "Sang's team matched us perfectly — kids loved every stop, no rushing. The driver knew exactly when to wait at Seongsan for the light.", tour: "Jeju East UNESCO Day", date: "Mar 2026", tilt: "rotate-[-1.2deg]" },
                { flag: "🇯🇵", name: "Takashi M.", country: "Tokyo", body: "クルーズ船からの当日の旅行で、時間管理が完璧でした。要所をすべて訪問できました。", tour: "Busan Cruise Shore", date: "Feb 2026", tilt: "rotate-[0.8deg]" },
                { flag: "🇺🇸", name: "Brian K.", country: "Seattle", body: "Booked for 9 colleagues. Per-pax tier pricing was transparent up front. Saved us $200 vs the listing on Klook.", tour: "Seoul DMZ Private", date: "Feb 2026", tilt: "rotate-[-0.6deg]" },
                { flag: "🇨🇳", name: "Wang Lin", country: "Shanghai", body: "中文の案内、好不容易能找到。沟通畅快，景点选择对于第一次来济州的家庭来说非常合适。", tour: "Jeju Grand Highlights", date: "Jan 2026", tilt: "rotate-[1.4deg]" },
                { flag: "🇪🇸", name: "Sofia R.", country: "Madrid", body: "Encontramos justo lo que buscábamos para escapar de Seúl. La concierge en español respondió a las 9 PM — un detallazo.", tour: "Pocheon Lake · Herb", date: "Jan 2026", tilt: "rotate-[-1deg]" },
                { flag: "🇹🇼", name: "Chen Y.", country: "Taipei", body: "原本擔心是否能像 Klook 一樣可靠 — 結果體驗更好，價格便宜 $7。司機準時，景點時間充足。", tour: "Suwon Hwaseong", date: "Dec 2025", tilt: "rotate-[0.6deg]" },
              ].map((r, i) => (
                <article
                  key={i}
                  className={`shrink-0 snap-start w-[300px] sm:w-[340px] rounded-[20px] p-7 ${r.tilt} transition-transform hover:rotate-0 hover:-translate-y-1`}
                  style={{ backgroundColor: "#fff", border: `1px solid ${PALETTE.line}`, boxShadow: "0 18px 50px -25px rgba(27,26,25,0.18)" }}
                >
                  <div className="font-serif text-[44px] leading-none" style={{ color: PALETTE.claySoft }}>"</div>
                  <p className="-mt-4 font-serif text-[15px] leading-[1.55] italic" style={{ color: PALETTE.ink }}>
                    {r.body}
                  </p>
                  <div className="mt-6 pt-5 flex items-center justify-between" style={{ borderTop: `1px dashed ${PALETTE.line}` }}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-2xl shrink-0" aria-hidden>{r.flag}</span>
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium" style={{ color: PALETTE.ink }}>{r.name}</div>
                        <div className="text-[11.5px]" style={{ color: PALETTE.ink3 }}>{r.country}</div>
                      </div>
                    </div>
                    <div style={{ color: PALETTE.clay }} className="text-[13px]">★★★★★</div>
                  </div>
                  <div className="mt-3 text-[11px] flex items-center justify-between" style={{ color: PALETTE.ink3 }}>
                    <span className="truncate pr-2">{r.tour}</span>
                    <span className="shrink-0">{r.date}</span>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ───────────── § Final CTA — editorial closing ───────────── */}
      <section className="border-t relative overflow-hidden" style={{ borderColor: PALETTE.line, backgroundColor: PALETTE.paper2 }}>
        {/* Decorative asterisks */}
        <Asterisk className="absolute left-[8%] top-[15%] hidden sm:block" size={22} />
        <Asterisk className="absolute right-[10%] top-[28%] hidden sm:block" size={16} />
        <Asterisk className="absolute left-[14%] bottom-[18%] hidden sm:block" size={14} />
        <Asterisk className="absolute right-[12%] bottom-[12%] hidden sm:block" size={26} />

        <div className="relative mx-auto max-w-[880px] px-5 sm:px-10 py-28 sm:py-36 text-center">
          <div className="inline-flex items-center gap-2 text-[12px] uppercase tracking-[0.2em]" style={{ color: PALETTE.clay }}>
            <Asterisk size={12} /> Ready when you are
          </div>

          <h2
            className="mt-6 font-serif leading-[1.0] tracking-[-0.02em] text-[52px] sm:text-[80px] lg:text-[96px]"
            style={{ color: PALETTE.ink }}
          >
            Stop searching.
            <br />
            <em className="italic" style={{ color: PALETTE.clay }}>
              Get
            </em>{" "}
            <span className="relative inline-block">
              matched.
              <Squiggle className="absolute -bottom-2 left-0 right-0 h-3 sm:h-4" />
            </span>
          </h2>

          <p
            className="mt-8 max-w-md mx-auto text-[15px] sm:text-[16px] leading-[1.7]"
            style={{ color: PALETTE.ink2 }}
          >
            One sentence. 30 seconds. No signup. Matched against the Korea tours our team
            has personally vetted.
          </p>

          <div className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/match"
              className="group inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full px-7 py-3.5 text-[14px] font-medium text-white transition-opacity hover:opacity-95"
              style={{ backgroundColor: PALETTE.ink }}
            >
              Match my Korea trip
              <svg className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" fill="none" stroke="currentColor" strokeWidth={2.2} viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
              </svg>
            </a>
            <a
              href="/tours/list"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-full px-7 py-3.5 text-[14px] font-medium transition-colors"
              style={{ color: PALETTE.ink, backgroundColor: "transparent", border: `1px solid ${PALETTE.ink}` }}
            >
              Browse all tours
            </a>
          </div>

          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-y-6 gap-x-4 max-w-2xl mx-auto">
            {[
              { v: "30+", l: "Hand-picked tours" },
              { v: "4.9", l: "★ from 230 reviews" },
              { v: "6", l: "Languages" },
              { v: "9–9", l: "Human concierge KST" },
            ].map((s) => (
              <div key={s.l}>
                <div className="font-serif text-[28px] sm:text-[34px] tracking-tight" style={{ color: PALETTE.ink }}>
                  {s.v}
                </div>
                <div className="mt-1 text-[11.5px]" style={{ color: PALETTE.ink3 }}>{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <MobileStickyCta />
    </div>
  );
}

function MobileStickyCta() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  return (
    <div
      className={`fixed bottom-3 left-3 right-3 z-40 lg:hidden transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-16 opacity-0 pointer-events-none"
      }`}
    >
      <a
        href="/match"
        className="flex items-center justify-between gap-3 w-full rounded-full px-5 py-3 text-white shadow-[0_18px_44px_-14px_rgba(27,26,25,0.55)]"
        style={{ backgroundColor: "#1B1A19", border: "1px solid rgba(255,255,255,0.08)" }}
      >
        <span className="font-serif text-[15px]">Match my Korea trip</span>
        <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24" aria-hidden>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14m-6-6l6 6-6 6" />
        </svg>
      </a>
    </div>
  );
}
