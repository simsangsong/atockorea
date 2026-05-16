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
 * Portrait destination card with bottom-up dark gradient veil. The glass-pill
 * region badge was removed in favour of an unframed uppercase region label
 * sitting in the top-left, so the photograph carries the visual weight.
 * Designed for a 3-up desktop grid or a portrait-oriented snap rail on mobile
 * where each photo gets meaningful presence.
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
      className="group relative block aspect-[3/4] overflow-hidden rounded-card shadow-2 transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 hover:shadow-3 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/35 motion-reduce:transition-shadow motion-reduce:hover:translate-y-0"
    >
      <div className="absolute inset-0">
        <Image
          src={imageSrc}
          alt={imageAlt}
          fill
          sizes="(max-width: 768px) 70vw, 33vw"
          className="object-cover transition-transform duration-[600ms] ease-out group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
        />
      </div>

      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-t from-slate-950/[0.85] via-slate-950/20 to-transparent"
        aria-hidden
      />

      {badge ? (
        <span className="absolute left-4 top-4 text-micro font-semibold uppercase tracking-[0.18em] text-white/75 md:left-5 md:top-5">
          {badge}
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 px-4 pb-4 md:px-5 md:pb-5">
        <h3
          className="text-[1.5rem] font-semibold leading-tight tracking-tight text-white md:text-[1.75rem]"
          style={{ textShadow: "0 3px 24px rgba(0,0,0,0.5)" }}
        >
          {name}
        </h3>
      </div>
    </Link>
  );
}
