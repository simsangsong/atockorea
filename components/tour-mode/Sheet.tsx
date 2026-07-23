'use client';

/**
 * U0.6 — room bottom sheet (plan §E: emergency contacts/SOS, vision panel,
 * and future overflow actions all share this one surface).
 *
 * Backdrop fade + spring slide-up, Escape/backdrop close, focus moved into
 * the panel on open and restored on close. Motion honors
 * prefers-reduced-motion via framer's useReducedMotion.
 */

import { useEffect, useRef, type ReactNode } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { IconClose } from '@/components/tour-mode/icons';

export default function Sheet({
  open,
  onClose,
  title,
  children,
  closeLabel = 'Close',
}: {
  open: boolean;
  onClose: () => void;
  /** Rendered as the sheet header row next to the close button. */
  title?: ReactNode;
  children: ReactNode;
  closeLabel?: string;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  const reduced = useReducedMotion();

  // A1 bug fix (plan §11.A): keep the latest onClose in a ref so the focus
  // effect below depends on `open` only. Callers pass inline arrows for
  // onClose, so with [open, onClose] deps the effect re-ran on EVERY parent
  // re-render while open — and each re-run stole focus back to the panel
  // (`panelRef.focus()`), blurring any input inside the sheet. On mobile the
  // loop was deterministic: tapping the concierge input opened the keyboard →
  // visualViewport resize → RoomShell re-render (useKeyboardOpen) → focus
  // stolen → keyboard closed. Guests could never type into the Smart Guide.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      restoreRef.current?.focus?.();
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" data-testid="room-sheet">
          <motion.button
            type="button"
            aria-label={closeLabel}
            className="absolute inset-0 bg-black/40"
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduced ? 0 : 0.18 }}
            data-testid="room-sheet-backdrop"
          />
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className="tr-safe-bottom relative w-full max-w-2xl rounded-t-[calc(var(--tr-radius-card)+4px)] bg-[var(--tr-surface)] outline-none"
            style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
            initial={reduced ? { opacity: 0 } : { y: '100%' }}
            animate={reduced ? { opacity: 1 } : { y: 0 }}
            exit={reduced ? { opacity: 0 } : { y: '100%' }}
            transition={reduced ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 34 }}
          >
            <div className="mx-auto mt-2.5 h-1 w-9 rounded-full bg-[var(--tr-bubble-system)]" aria-hidden />
            <div className="flex items-center justify-between px-5 pb-1 pt-3">
              <div className="tr-title min-w-0 text-[var(--tr-ink)]">{title}</div>
              <button
                type="button"
                onClick={onClose}
                aria-label={closeLabel}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[var(--tr-ink-3)] active:bg-[var(--tr-bubble-system)]"
                data-testid="room-sheet-close"
              >
                <IconClose size={20} />
              </button>
            </div>
            <div className="max-h-[70dvh] overflow-y-auto px-5 pb-5">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
