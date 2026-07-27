'use client';

/**
 * R2 (docs/ops-staff-design-unification-master-plan-2026-07-27.md §D-2) —
 * hardware/browser back must never quit the installed PWA.
 *
 * RoomShell has carried this trap since T1.6, but every page reachable
 * standalone from an email link (the /plan editor, check-in, join) had no
 * trap at all: one back press on a freshly-opened PWA has nothing to pop, so
 * the app closes — exactly the owner's device report.
 *
 * How it works: push one sentinel history entry on mount, so a back press
 * fires `popstate` instead of unwinding past the app's first entry. The
 * handler asks the caller what to do:
 *
 *   'stayed' — the caller consumed the press (closed a sheet, popped a tab);
 *              re-arm the sentinel so the NEXT press is trapped too.
 *   'exit'   — nothing left to consume and the caller has an in-app
 *              destination; the caller navigates (we don't re-arm).
 *   'noop'   — nothing to consume and nowhere to go (a guest at the root):
 *              re-arm anyway. Staying put beats closing the app.
 *
 * The handler is read through a ref so the listener registers once and still
 * sees fresh state on every press.
 */

import { useEffect, useRef } from 'react';

export type BackTrapResult = 'stayed' | 'exit' | 'noop';

export function useBackTrap(onBack: () => BackTrapResult, enabled = true): void {
  const handlerRef = useRef(onBack);
  useEffect(() => {
    handlerRef.current = onBack;
  });

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    window.history.pushState({ tourBackTrap: true }, '');
    const onPop = () => {
      const result = handlerRef.current();
      // Re-arm unless the caller is navigating away on purpose.
      if (result !== 'exit') window.history.pushState({ tourBackTrap: true }, '');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [enabled]);
}
