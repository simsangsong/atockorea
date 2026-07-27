'use client';

import { useMemo } from 'react';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { IconPickup, TR_ICON, TR_STROKE } from '@/components/tour-mode/icons';

/** Flag-off informational page (D-10). */
export default function TourModeComingSoon() {
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);
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
