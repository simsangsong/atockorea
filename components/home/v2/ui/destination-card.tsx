"use client";

import Link from "next/link";
import Image from "next/image";

type DestinationCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  /** Short regional character line (e.g. palaces & night markets). */
  badge?: string;
  href: string;
  onClick?: () => void;
};

/**
 * Portrait destination card — Vogue/Bazaar cover treatment (2026-05-25).
 *
 * Photo treatment (refined 2026-05-25 — user note: "조금만 밝고 고급지게,
 * 그렇다고 너무 밝게는 말고"):
 *   • Filter softened from the first pass — saturate 1.14 / contrast 1.10 /
 *     brightness 0.98 (was 1.18/1.18/0.92). Still richer than neutral but
 *     the moodiness no longer reads as "underexposed"
 *   • SVG fractalNoise film grain opacity 0.13 (was 0.16) so the grain
 *     supports tone instead of muddying it
 *   • Corner roll-off vignette transparent 55% → rgba(0,0,0,0.20) (was
 *     50%→0.28) — same shape, lighter outer ring
 *   • Existing bottom-up dark gradient retained for name legibility
 *
 * Typography (Kinfolk / Vogue Korea cover, upright serif — italic banned per §B
 * reversal 2026-05-20):
 *   • Region name: `font-magazine-serif-ko` (Noto Serif KR → Cormorant Garamond),
 *     light weight + wider tracking + small-caps-feeling capital-only setup
 *   • Top badge eyebrow: same magazine serif family, light weight, wider tracking,
 *     softer alpha so the photo carries the eye
 */
export function DestinationCard({
  name,
  imageSrc,
  imageAlt,
  badge,
  href,
  onClick,
}: DestinationCardProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      /* 2026-07-14 owner: destination cards were too big — the 4:5 portrait
         "cover" ratio is compacted to 4:3 landscape. The editorial treatment
         (film grain / vignette / serif title) is preserved deliberately. */
      className="group relative block aspect-[4/3] overflow-hidden rounded-card shadow-2 transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35 motion-reduce:transition-shadow motion-reduce:hover:translate-y-0"
    >
      <div className="absolute inset-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 46vw, 33vw"
          className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          style={{ filter: "saturate(1.14) contrast(1.10) brightness(0.98)" }}
        />
      </div>

      {/* Editorial film grain — same fractalNoise recipe as hero / TourListCard,
          opacity 0.13 (softened from initial 0.16 after the photo brightness
          was nudged up — grain supports tone instead of muddying it). */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          opacity: 0.13,
        }}
      />
      {/* Corner roll-off vignette — softened from initial pass (50%→0.28) to
          a more present-but-airy 55%→0.20 so the photo breathes under the
          new brightness target. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.20) 100%)",
        }}
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/[0.85] via-slate-950/20 to-transparent"
        aria-hidden
      />

      {badge ? (
        <span
          className="font-magazine-serif-ko absolute left-4 top-4 text-[0.62rem] font-light uppercase leading-tight tracking-[0.32em] text-white/70 md:left-5 md:top-5 md:text-[0.68rem]"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.55)" }}
        >
          {badge}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 md:px-5 md:pb-5">
        <h3
          className="font-magazine-serif-ko text-[1.35rem] font-light leading-[0.95] tracking-[0.02em] text-white md:text-[1.7rem]"
          style={{ textShadow: "0 3px 28px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.6)" }}
        >
          {name}
        </h3>
      </div>
    </Link>
  );
}
