'use client';

/**
 * Inline map preview for a location message (driver "vehicle arrived" / parking
 * pin / lost-me). Renders a static-map thumbnail with a pin instead of a raw
 * maps URL; tapping opens native Google Maps. Falls back to a pin card if the
 * Static Maps API isn't enabled (onError). Theme-agnostic via tr-* tokens, so
 * it works in the customer chat and the dark driver cockpit alike.
 */

import { useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { staticMapUrl } from '@/lib/tour-room/locationMessage';

export default function LocationPreview({
  lat,
  lng,
  label,
  url,
}: {
  lat: number;
  lng: number;
  label: string;
  url: string;
}) {
  const [imgOk, setImgOk] = useState(true);
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="block max-w-[78vw] overflow-hidden rounded-[var(--tr-radius-bubble)] border border-[var(--tr-hairline)] bg-[var(--tr-bubble-in)]"
      data-testid="location-preview"
    >
      {imgOk ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={staticMapUrl(lat, lng)}
          alt={label || '지도'}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="h-32 w-full object-cover"
        />
      ) : (
        <div className="flex h-24 w-full items-center justify-center bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]">
          <MapPin size={30} strokeWidth={1.75} aria-hidden />
        </div>
      )}
      <div className="flex items-center gap-2 px-3 py-2">
        <MapPin size={15} className="shrink-0 text-[var(--tr-accent-deep)]" aria-hidden />
        <span className="tr-card-text min-w-0 flex-1 truncate text-[var(--tr-bubble-in-ink)]">
          {label || '위치 보기'}
        </span>
        <ExternalLink size={14} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
      </div>
    </a>
  );
}
