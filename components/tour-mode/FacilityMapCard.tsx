'use client';

/**
 * Scoped facility map card (W2.3) — the current attraction's restroom or photo
 * pins on one Static Maps thumbnail (via the /api/maps/static proxy) with a
 * numbered name list below; tapping a row opens native Google Maps directions.
 *
 * Rendered inside a concierge answer (inline banner + panel thread). tr-* tokens
 * only, so it works in the customer chat and the dark driver cockpit alike.
 * Falls back to the name list alone when the Static Maps image can't load.
 */

import { useState } from 'react';
import { MapPin, Navigation, Toilet, Camera, Utensils, Star, Ticket } from 'lucide-react';
import {
  facilityStaticMapPath,
  pinDirectionsUrl,
  guestPinLabel,
  type FacilityKind,
  type FacilityPin,
} from '@/lib/tour-room/facilityPins';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const KIND_HEX: Record<FacilityKind, string> = {
  restroom: '#2563eb',
  photo: '#db2777',
  restaurant: '#f59e0b',
  ticket_booth: '#16a34a',
};
const KIND_ALT: Record<FacilityKind, string> = {
  restroom: '화장실 지도',
  photo: '포토스팟 지도',
  restaurant: '맛집 지도',
  ticket_booth: '매표소 지도',
};

function compactCount(n: number): string {
  return n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}k` : String(n);
}

export default function FacilityMapCard({
  kind,
  pins,
  locale,
}: {
  kind: FacilityKind;
  pins: FacilityPin[];
  locale: RoomLocale;
}) {
  const [imgOk, setImgOk] = useState(true);
  if (pins.length === 0) return null;

  const path = facilityStaticMapPath(pins);
  const Icon =
    kind === 'restroom' ? Toilet : kind === 'restaurant' ? Utensils : kind === 'ticket_booth' ? Ticket : Camera;

  return (
    <div
      className="mt-2 overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
      data-testid="facility-map-card"
    >
      {imgOk && path ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/api/maps/static${path}`}
          alt={KIND_ALT[kind]}
          loading="lazy"
          onError={() => setImgOk(false)}
          className="h-36 w-full object-cover"
        />
      ) : (
        <div className="flex h-16 w-full items-center justify-center bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]">
          <MapPin size={24} strokeWidth={1.75} aria-hidden />
        </div>
      )}
      <ul className="divide-y divide-[var(--tr-hairline)]">
        {pins.map((pin, i) => (
          <li key={`${pin.lat},${pin.lng},${i}`}>
            <a
              href={pinDirectionsUrl(pin)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2.5 px-3 py-2 active:bg-[var(--tr-surface-2)]"
              data-testid="facility-pin-row"
            >
              <span
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
                style={{ background: KIND_HEX[kind] }}
                aria-hidden
              >
                {i + 1}
              </span>
              {pin.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={pin.photoUrl} alt="" className="h-7 w-7 shrink-0 rounded object-cover" loading="lazy" />
              ) : (
                <Icon size={15} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
              )}
              <span className="tr-card-text min-w-0 flex-1 truncate text-[var(--tr-ink)]">
                {guestPinLabel(pin, locale)}
              </span>
              {kind === 'restaurant' && typeof pin.rating === 'number' && (
                <span className="tr-meta flex shrink-0 items-center gap-0.5 text-[var(--tr-ink-2)]">
                  <Star size={11} className="fill-current text-amber-500" aria-hidden />
                  {pin.rating.toFixed(1)}
                  {typeof pin.reviewCount === 'number' && pin.reviewCount > 0 && (
                    <span className="text-[var(--tr-ink-3)]">·{compactCount(pin.reviewCount)}</span>
                  )}
                </span>
              )}
              <Navigation size={14} className="shrink-0 text-[var(--tr-accent-deep)]" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
