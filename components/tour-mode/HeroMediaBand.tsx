'use client';

/**
 * SG-4 / SG-D9 — the hero photo band, shared by every card that earns one
 * (NowCard states, the lobby's tour hero; pickup joins in SG-5).
 *
 * Fixed 144px so CLS is zero by construction; no scrim and no text on the
 * photo — the contrast gates measure token pairs and photo luminance is an
 * unmeasurable variable, so words stay on the card surface. Failure falls
 * to the avatar swatch (removal would be a layout jump at exactly the
 * failure moment), and the `contrast` skin hides the band entirely via the
 * `.tr-hero-media` rule (that skin strips decoration; B10's own logic).
 */
import { useState } from 'react';
import { avatarColorFor } from '@/lib/tour-room/avatarColor';

export default function HeroMediaBand({
  photoUrl,
  seed,
}: {
  photoUrl?: string | null;
  /** Stable identity for the swatch tint — poi_key, never a localized name. */
  seed?: string | null;
}) {
  const [failed, setFailed] = useState(false);
  if (!photoUrl) return null;
  return (
    <div
      data-testid="hero-media"
      className="tr-hero-media -mx-4 -mt-4 mb-3 h-36 overflow-hidden rounded-t-[inherit]"
    >
      {failed ? (
        <div
          data-testid="hero-media-swatch"
          className="h-full w-full"
          style={{ background: avatarColorFor(seed ?? photoUrl).bg }}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt=""
          className="h-full w-full object-cover"
          fetchPriority="high"
          onError={() => setFailed(true)}
        />
      )}
    </div>
  );
}
