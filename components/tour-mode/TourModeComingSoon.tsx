'use client';

import { ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { useEntryLocale } from '@/components/tour-mode/useEntryLocale';
import { IconPickup, TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

/** Flag-off informational page (D-10). */
export default function TourModeComingSoon({ initialLocale = 'en' }: { initialLocale?: RoomLocale }) {
  // N6 — was `detectEntryLocale()` at render time, which is a server/client
  // branch by another name: server 'en', client the device locale, tree thrown
  // away on hydration for every non-English guest.
  const copy = ENTRY_COPY[useEntryLocale(initialLocale)];
  return (
    <div className="tr-safe-top tr-safe-bottom tr-root mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--tr-surface)] text-[var(--tr-accent-deep)]">
        <IconPickup size={TR_ICON.tile} strokeWidth={TR_STROKE.default} aria-hidden />
      </span>
      <h1 className="tr-display mt-4 font-semibold text-[var(--tr-ink)]">{copy.title}</h1>
      <p className="tr-body mt-3 text-[var(--tr-ink-2)]">{copy.comingSoon}</p>
    </div>
  );
}
