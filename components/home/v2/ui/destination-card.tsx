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
 * Photo treatment (aggressive editorial pass per user direction):
 *   • B2-family filter dialed up — saturate 1.18 / contrast 1.18 / brightness 0.92
 *     (deeper magazine cover tone, slight darken accepted as the price of premium)
 *   • SVG fractalNoise film grain (opacity 0.16, mix-blend-overlay) — stronger
 *     than hero's 0.12 because portrait cards read closer
 *   • Corner roll-off vignette (transparent 50% → rgba(0,0,0,0.28))
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
      className="group relative block aspect-[4/5] overflow-hidden rounded-card shadow-2 transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35 motion-reduce:transition-shadow motion-reduce:hover:translate-y-0"
    >
      <div className="absolute inset-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 60vw, 33vw"
          className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
          style={{ filter: "saturate(1.18) contrast(1.18) brightness(0.92)" }}
        />
      </div>

      {/* Editorial film grain — same fractalNoise recipe as hero / TourListCard,
          opacity bumped 0.12→0.16 because the portrait card reads at closer
          range and the grain needs to register. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg xmlns='http%3A//www.w3.org/2000/svg' width='200' height='200'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/%3E%3CfeColorMatrix values='0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.55 0'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
          opacity: 0.16,
        }}
      />
      {/* Corner roll-off vignette — deeper than hero's (0.15 → 0.28) for that
          editorial "shot for print" feel. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.28) 100%)",
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
          className="font-magazine-serif-ko text-[1.75rem] font-light leading-[0.95] tracking-[0.02em] text-white md:text-[2.1rem]"
          style={{ textShadow: "0 3px 28px rgba(0,0,0,0.55), 0 1px 4px rgba(0,0,0,0.6)" }}
        >
          {name}
        </h3>
      </div>
    </Link>
  );
}
