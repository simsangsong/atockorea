'use client';

/**
 * U1.6 — is the on-screen keyboard up? (plan §E: the bottom tab bar hides
 * while typing so the composer docks to the keyboard.)
 *
 * visualViewport is the only reliable signal on mobile Safari/Chrome; on
 * desktop (or without support) this simply stays false.
 */

import { useEffect, useState } from 'react';

const KEYBOARD_MIN_PX = 140;

export function useKeyboardOpen(): boolean {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const onChange = () => {
      setOpen(window.innerHeight - viewport.height > KEYBOARD_MIN_PX);
    };
    viewport.addEventListener('resize', onChange);
    viewport.addEventListener('scroll', onChange);
    onChange();
    return () => {
      viewport.removeEventListener('resize', onChange);
      viewport.removeEventListener('scroll', onChange);
    };
  }, []);

  return open;
}
