'use client';

/**
 * Inline map preview for a location message (driver "vehicle arrived" / parking
 * pin / lost-me / M-D4 "meet me exactly here"). Renders a static-map thumbnail
 * with a pin instead of a raw maps URL. Theme-agnostic via tr-* tokens, so it
 * works in the customer chat and the dark driver cockpit alike.
 *
 * M-D2 (docs/meet-exactly-master-plan-2026-07-27.md) — the audience decides
 * where the pin OPENS. One WGS84 coordinate, two worlds:
 *   guest  → thumbnail tap opens Google Maps (unchanged), Google/Naver chips.
 *   staff  → thumbnail tap opens the Kakao Maps car route, and a chip row
 *            offers 카카오내비(app) · 카카오맵(web) · 티맵 — the driver
 *            navigates without ever touching a Google URL.
 */

import { useState } from 'react';
import { IconArrived, IconOpenExternal, TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';
import { staticMapUrl } from '@/lib/tour-room/locationMessage';
import NavBrandButton from '@/components/tour-mode/NavBrandButton';
import { kakaoWebRouteUrl, navChipsFor } from '@/lib/tour-room/nav-links';

export default function LocationPreview({
  lat,
  lng,
  label,
  url,
  audience = 'guest',
}: {
  lat: number;
  lng: number;
  label: string;
  url: string;
  /** M-D2 — 'staff' swaps the open target + chips to Kakao/TMAP. */
  audience?: 'guest' | 'staff';
}) {
  const [imgOk, setImgOk] = useState(true);
  const dest = { lat, lng, name: label || undefined };
  const openHref = audience === 'staff' ? kakaoWebRouteUrl(dest) : url;
  const chips = navChipsFor(audience, dest);
  return (
    <div
      className="max-w-[78vw] overflow-hidden rounded-[var(--tr-radius-bubble)] border border-[var(--tr-hairline)] bg-[var(--tr-bubble-in)]"
      data-testid="location-preview"
      data-audience={audience}
    >
      <a href={openHref} target="_blank" rel="noopener noreferrer" className="text-cjk-safe block">
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
            <IconArrived size={TR_ICON.tile} strokeWidth={TR_STROKE.default} aria-hidden />
          </div>
        )}
        <div className="flex items-center gap-2 px-3 py-2">
          <IconArrived size={TR_ICON.chip} className="shrink-0 text-[var(--tr-accent-deep)]" aria-hidden />
          <span className="tr-card-text min-w-0 flex-1 truncate text-[var(--tr-bubble-in-ink)]">
            {label || '위치 보기'}
          </span>
          <IconOpenExternal size={TR_ICON.meta} className="shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
        </div>
      </a>
      {/* M-D2 — nav chips. App schemes fail silently without the app, so the
          web-fallback chip always sits beside the scheme chip. */}
      <div className="tr-hairline-t flex flex-wrap items-center gap-0.5 px-1.5 py-1" data-testid="location-nav-chips">
        {chips.map((chip) => (
          <NavBrandButton
            key={chip.key}
            chipKey={chip.key}
            label={chip.label}
            href={chip.href}
            testId={`nav-chip-${chip.key}`}
          />
        ))}
      </div>
    </div>
  );
}
