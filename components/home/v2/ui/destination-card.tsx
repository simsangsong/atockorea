"use client";

import Link from "next/link";
import Image from "next/image";

type DestinationCardProps = {
  name: string;
  imageSrc: string;
  imageAlt: string;
  count: number | null;
  countLabel?: string;
  href: string;
};

/**
 * Square destination card with soft-light (柔光) overlay. Image fills the card
 * with a top-down soft highlight + bottom-up dark gradient veil; serif city
 * name + live count chip overlay sit at the bottom-left.
 * Designed to read at a glance in a 3-up desktop grid or a horizontal snap
 * rail on mobile.
 */
export function DestinationCard({
  name,
  imageSrc,
  imageAlt,
  count,
  countLabel,
  href,
}: DestinationCardProps) {
  return (
    <Link
      href={href}
      className="group relative block aspect-square overflow-hidden rounded-home-card shadow-home-offer-base ring-1 ring-slate-900/5 transition-shadow duration-300 ease-out hover:shadow-home-offer-bus-hover focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
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
        className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/35 to-transparent"
        aria-hidden
      />

      {count != null && countLabel ? (
        <div className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white shadow-sm backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" aria-hidden />
          {countLabel}
        </div>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 md:px-5 md:pb-5">
        <h3
          className="text-xl font-bold leading-tight tracking-tight text-white md:text-2xl"
          style={{ textShadow: "0 2px 18px rgba(0,0,0,0.45)" }}
        >
          {name}
        </h3>
      </div>
    </Link>
  );
}
