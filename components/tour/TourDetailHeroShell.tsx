'use client';

import Image from 'next/image';
import type { ReactNode } from 'react';

export type TourDetailHeroShellProps = {
  imageUrl: string | null;
  imageAlt: string;
  /** Primary / secondary badge row (e.g. tour badges). Omit for no badges. */
  badge?: ReactNode;
  title: ReactNode;
  /** Rating row and optional meta (duration, etc.) */
  meta: ReactNode;
  /** Optional top bar (e.g. actions). Omit to hide the top overlay row. */
  topBar?: ReactNode;
  imagePriority?: boolean;
};

/**
 * Tour detail hero visual shell (reference: premium full-bleed image, bottom-aligned title/meta).
 * No copy or URLs — parent supplies all content nodes.
 */
export function TourDetailHeroShell({
  imageUrl,
  imageAlt,
  badge,
  title,
  meta,
  topBar,
  imagePriority = true,
}: TourDetailHeroShellProps) {
  return (
    <section className="relative w-full" aria-label="Tour hero">
      <div className="relative h-[56vh] min-h-[380px] max-h-[520px] overflow-hidden md:h-[50vh] md:max-h-[480px] md:min-h-[420px] lg:h-[420px] lg:max-h-[520px]">
        <div className="absolute inset-0" aria-hidden>
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={imageAlt}
              fill
              className="object-cover"
              sizes="100vw"
              priority={imagePriority}
            />
          ) : (
            <div className="h-full w-full bg-slate-300" />
          )}
        </div>
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-black/5"
          aria-hidden
        />
        {topBar ? (
          <div className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4 pb-4 pt-[max(16px,env(safe-area-inset-top))]">
            {topBar}
          </div>
        ) : null}
        <div className="absolute bottom-0 left-0 right-0 z-10 flex flex-col items-stretch px-5 pb-8 text-left lg:px-8">
          {badge ? <div className="mb-4 flex flex-wrap gap-2">{badge}</div> : null}
          <h1 className="text-[26px] font-semibold leading-[1.15] tracking-tight text-white text-balance drop-shadow-sm md:text-3xl lg:text-4xl">
            {title}
          </h1>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[13px] text-white/95 drop-shadow-sm">
            {meta}
          </div>
        </div>
      </div>
    </section>
  );
}
