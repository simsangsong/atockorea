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
};

/**
 * Square destination card with soft-light (柔光) overlay. Image fills the card
 * with a top-down soft highlight + bottom-up dark gradient veil; city name at
 * bottom-left and a regional character badge at top-right.
 * Designed to read at a glance in a 3-up desktop grid or a horizontal snap
 * rail on mobile.
 */
export function DestinationCard({
  name,
  imageSrc,
  imageAlt,
  badge,
  href,
}: DestinationCardProps) {
  return (
    <Link
      href={href}
      className="group relative block aspect-square overflow-hidden rounded-home-card shadow-[0_28px_64px_-32px_rgba(15,23,42,0.45)] ring-1 ring-slate-900/[0.06] transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_38px_80px_-36px_rgba(15,23,42,0.55)] focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35 motion-reduce:transition-shadow motion-reduce:hover:translate-y-0"
    >
      <div className="absolute inset-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 80vw, 33vw"
          className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>

      {/* 柔光 (soft-light) filter — subtle top-down highlight blended in */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(180deg, rgba(255,255,255,0.38) 0%, rgba(255,255,255,0.06) 45%, rgba(255,255,255,0) 70%)",
          mixBlendMode: "soft-light",
        }}
        aria-hidden
      />

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/[0.93] via-slate-950/30 to-transparent"
        aria-hidden
      />

      {badge ? (
        <div className="absolute right-3 top-3 max-w-[min(92%,240px)] text-right">
          <div className="inline-flex max-w-full items-start gap-1.5 rounded-xl border border-white/25 bg-white/12 px-2.5 py-1.5 text-left text-[10px] font-semibold leading-snug tracking-wide text-white shadow-[0_10px_30px_-12px_rgba(0,0,0,0.55)] backdrop-blur-md md:text-[11px]">
            <span className="mt-0.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.25)]" aria-hidden />
            <span className="min-w-0 line-clamp-2">{badge}</span>
          </div>
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 md:px-5 md:pb-5">
        <h3
          className="text-[1.25rem] font-semibold leading-tight tracking-tight text-white md:text-[1.5rem]"
          style={{ textShadow: "0 3px 24px rgba(0,0,0,0.5)" }}
        >
          {name}
        </h3>
      </div>
    </Link>
  );
}
