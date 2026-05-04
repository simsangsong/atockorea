'use client';

import { useEffect } from 'react';
import { NEXT_DEV_CHUNK_RELOAD_KEY } from '@/lib/dev-chunk-recovery';

/** Clears dev chunk-retry flag after successful mount so future ChunkLoadErrors can auto-retry once. */
export function DevChunkRecoveryCleanup() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'development') return;
    try {
      sessionStorage.removeItem(NEXT_DEV_CHUNK_RELOAD_KEY);
    } catch {
      // ignore
    }
  }, []);
  return null;
}
