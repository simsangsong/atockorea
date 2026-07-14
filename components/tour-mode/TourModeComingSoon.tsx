'use client';

import { useMemo } from 'react';
import { detectEntryLocale, ENTRY_COPY } from '@/components/tour-mode/entryCopy';

/** Flag-off informational page (D-10). */
export default function TourModeComingSoon() {
  const copy = useMemo(() => ENTRY_COPY[detectEntryLocale()], []);
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center px-6 text-center">
      <div className="text-[40px]">🚌</div>
      <h1 className="mt-4 text-[22px] font-semibold text-gray-900">{copy.title}</h1>
      <p className="mt-3 text-[14px] leading-relaxed text-gray-600">{copy.comingSoon}</p>
    </div>
  );
}
