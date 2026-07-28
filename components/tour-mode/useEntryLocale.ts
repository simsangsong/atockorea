'use client';

/**
 * N6 — the client half of the entry-locale contract.
 *
 * The rule this enforces: the first client render must produce byte-identical
 * output to the server's, so it starts from `initialLocale` (which the server
 * resolved from the same cookie + Accept-Language the browser will consult) and
 * only re-checks afterwards, in an effect.
 *
 * The effect is not redundant. It covers the cases the request headers cannot:
 * a browser whose `navigator.language` disagrees with the `Accept-Language` it
 * sent, a cached HTML response served to a different device, and a cookie
 * written after the page was generated. Those are rare; the mismatch they used
 * to cause was not.
 */
import { useEffect, useState } from 'react';
import { detectEntryLocale } from '@/components/tour-mode/entryCopy';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export function useEntryLocale(initialLocale: RoomLocale): RoomLocale {
  const [locale, setLocale] = useState<RoomLocale>(initialLocale);
  useEffect(() => {
    const detected = detectEntryLocale();
    setLocale((current) => (detected === current ? current : detected));
  }, []);
  return locale;
}
