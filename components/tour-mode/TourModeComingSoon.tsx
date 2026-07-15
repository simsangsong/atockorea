'use client';

import { useMemo } from 'react';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';
import { IconPickup } from '@/components/tour-mode/icons';

/** Flag-off informational page (D-10). */
export default function TourModeComingSoon() {
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);
  return (
    <div className="tr-root mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center bg-[var(--tr-canvas)] px-6 text-center">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--tr-surface)] text-[var(--tr-accent-deep)]">
        <IconPickup size={28} strokeWidth={1.75} aria-hidden />
      </span>
      <h1 className="mt-4 text-[22px] font-semibold text-[var(--tr-ink)]">{copy.title}</h1>
      <p className="tr-body mt-3 text-[var(--tr-ink-2)]">{copy.comingSoon}</p>
    </div>
  );
}
