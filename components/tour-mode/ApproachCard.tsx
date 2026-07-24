'use client';

/**
 * §11.C C2 — approach preview card ("coming up", 1 km ring).
 *
 * Deliberately LIGHTER than ArrivalBundleCard / SpotArrivalCard: one compact
 * surface, a muted "coming up" badge with the distance, the POI name, an
 * optional hero thumbnail, two lines of teaser copy, and a map link. No
 * meeting strip, no follow/ticket badges, no facility maps, no expandable
 * rows — those belong to the arrival card, and the visual weight difference
 * IS the signal that this is a preview, not an operational instruction.
 *
 * The approved POI video is the one rich element that rides along: watching a
 * 60 s short is exactly what the ride into the stop is for.
 */

import { Navigation } from 'lucide-react';
import ArrivalVideoCard from '@/components/tour-mode/ArrivalVideoCard';
import { APPROACH_COPY, type ApproachCardMeta } from '@/lib/tour-room/approach';
import { formatDistance } from '@/lib/tour-room/eta';
import { isVideoCardMeta } from '@/lib/tour-room/poiVideos';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

function mapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(6)},${lng.toFixed(6)}`;
}

export default function ApproachCard({
  meta,
  locale,
}: {
  meta: ApproachCardMeta;
  locale: RoomLocale;
}) {
  const copy = APPROACH_COPY[locale];
  const hero = meta.content?.image ?? meta.content?.images?.[0] ?? null;
  const teaser = meta.content?.description?.trim() || null;
  const coords =
    typeof meta.poi_lat === 'number' && typeof meta.poi_lng === 'number'
      ? { lat: meta.poi_lat, lng: meta.poi_lng }
      : null;

  return (
    <div className="flex flex-col gap-2" data-testid="approach-card">
      <div className="flex items-center gap-3 rounded-[var(--tr-radius-card)] border border-dashed border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3.5 py-2.5">
        {hero ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={hero}
            alt=""
            aria-hidden
            loading="lazy"
            className="h-12 w-12 shrink-0 rounded-[10px] object-cover"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[10px] bg-[var(--tr-accent-soft)]">
            <Navigation size={18} strokeWidth={2} aria-hidden className="text-[var(--tr-ink-2)]" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <p className="tr-meta flex items-center gap-1.5 font-medium">
            <span>{copy.badge}</span>
            <span aria-hidden>·</span>
            <span data-testid="approach-distance">{formatDistance(meta.distance_m)}</span>
          </p>
          <p className="truncate text-sm font-semibold text-[var(--tr-ink)]">{meta.spot_title}</p>
          {teaser ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-[var(--tr-ink-2)]">{teaser}</p>
          ) : (
            <p className="text-xs leading-relaxed text-[var(--tr-ink-3)]">{copy.preview}</p>
          )}
        </div>

        {coords ? (
          <a
            href={mapsUrl(coords.lat, coords.lng)}
            target="_blank"
            rel="noreferrer"
            className="tr-pill flex min-h-[44px] shrink-0 items-center px-3 text-sm font-semibold text-[var(--tr-ink)]"
          >
            {copy.map}
          </a>
        ) : null}
      </div>

      {/* the produced POI short — the ride is the right moment to watch it */}
      {isVideoCardMeta(meta.video_card) ? <ArrivalVideoCard meta={meta.video_card} locale={locale} /> : null}
    </div>
  );
}
