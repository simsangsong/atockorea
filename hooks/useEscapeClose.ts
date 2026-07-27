'use client';

/**
 * O5 — Escape closes an overlay.
 *
 * The O0 baseline found that NOT ONE of the ops center's full-screen overlays
 * listened for Escape, while the smart app's `Sheet` has since PR #481. On a
 * phone that is invisible; on the desktop the dispatchers actually run the
 * board from, the 닫기 button is the only way out of a screen that covers
 * everything — and it moves per overlay.
 *
 * The room drawer's own listener is where this behaviour already lived; this
 * is that listener with a name, so six more surfaces can have it without six
 * more copies.
 *
 * Deliberately NOT capture-phase: an overlay stacked on top (a QR sheet inside
 * the room manager) has its own listener attached later, and the last one
 * registered on `document` runs first in the bubble phase — so the innermost
 * surface closes first, which is what a person expects.
 */

import { useEffect, useRef } from 'react';

export function useEscapeClose(onClose: () => void, enabled = true): void {
  // Ref so a caller passing an inline arrow doesn't re-bind on every render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!enabled) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
