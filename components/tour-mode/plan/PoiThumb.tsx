'use client';

/**
 * P7.1 — the planner's POI thumbnail, and its honest empty state.
 *
 * Two jobs, both of which the planner previously got wrong:
 *
 * 1. **Try every candidate.** `poiImageCandidates` returns an ordered list
 *    because `images[0]` is not reliably the file that exists (measured: two
 *    Jeju POIs keep a live photo at index 1 and 2). A dead URL retires itself
 *    and the next one is tried, so a broken asset costs one photo, not all of
 *    that POI's photos.
 *
 * 2. **Fail to a SWATCH, not a hole.** The old fallback was
 *    `bg-[var(--tr-surface-2)]` with the img hidden on error — a pale empty
 *    square. 48 of 124 POIs have no photo at all, so that empty square was the
 *    planner's most common thumbnail. An empty square reads as "this screen is
 *    unfinished"; an initial on a tinted ground reads as "this place has no
 *    photo yet". Same information, opposite impression.
 *
 * The tint reuses `avatarColorFor` — the palette that already ships paired
 * bg/ink at ≥4.5:1 in both themes, and which `pickupGroupColor` already borrows
 * for a non-avatar purpose. A second palette here would be a second thing to
 * keep contrast-correct, and this repo has been bitten by exactly that.
 *
 * Seeded on `poi_key`, not the display name: the name is localised, and a place
 * should not change colour when the guest changes language.
 */

import { useState } from 'react';
import { avatarColorFor, avatarInitial } from '@/lib/tour-room/avatarColor';
import { poiImageCandidates, type PoiImageSource } from '@/lib/tour-room/poiImage';

const NO_BROKEN: ReadonlySet<string> = new Set();

export function PoiThumb({
  poi,
  seed,
  name,
  className = '',
  rounded = 'rounded-2xl',
}: {
  poi: PoiImageSource | null | undefined;
  /** Stable identity for the tint — the poi_key, never the localised name. */
  seed: string;
  /** Localised display name; only its first character is used, for the swatch. */
  name: string | null | undefined;
  /** Size utilities, e.g. `h-12 w-12`. */
  className?: string;
  rounded?: string;
}) {
  // Tracked by URL rather than by index so that a re-ordered or re-fetched
  // candidate list cannot resurrect a URL already known to 404.
  const [broken, setBroken] = useState<ReadonlySet<string>>(NO_BROKEN);

  const candidates = poiImageCandidates(poi);
  const src = candidates.find((url) => !broken.has(url)) ?? null;

  if (src) {
    return (
      <div
        className={`shrink-0 overflow-hidden bg-[var(--tr-surface-2)] ${rounded} ${className}`}
        data-testid="plan-poi-thumb"
        // Lets the walk harness count photos vs swatches EXACTLY. Counting
        // `.tr-card`s that happen to contain an <img> measured unrelated cards
        // and reported swatches on a screen showing "no places match".
        data-thumb="photo"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt=""
          loading="lazy"
          className="h-full w-full object-cover"
          onError={() =>
            setBroken((prev) => (prev.has(src) ? prev : new Set(prev).add(src)))
          }
        />
      </div>
    );
  }

  const tint = avatarColorFor(seed);
  return (
    <div
      className={`flex shrink-0 items-center justify-center ${rounded} ${className}`}
      style={{ backgroundColor: tint.bg, color: tint.ink }}
      data-testid="plan-poi-thumb"
      data-thumb="swatch"
      // The name is always rendered next to this, so the swatch is decoration.
      aria-hidden
    >
      <span className="tr-title font-bold leading-none">{avatarInitial(name)}</span>
    </div>
  );
}
