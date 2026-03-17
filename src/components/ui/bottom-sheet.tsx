"use client";

import { useEffect, type ReactNode } from "react";
import { clsx } from "clsx";

export interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Accessible label for close button */
  closeLabel?: string;
  className?: string;
}

/**
 * Mobile-first bottom sheet. Use for optional details, filters, or actions.
 * Critical information must not be hover-only; this provides a touch-friendly surface.
 */
export function BottomSheet({
  open,
  onClose,
  title,
  children,
  closeLabel = "Close",
  className,
}: BottomSheetProps) {
  useEffect(() => {
    if (!open) return;
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <>
      <div
        role="presentation"
        className="fixed inset-0 z-40 bg-black/40 transition-opacity duration-motion-base"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "bottom-sheet-title" : undefined}
        className={clsx(
          "fixed bottom-0 left-0 right-0 z-50 max-h-[90vh] overflow-hidden rounded-t-design-lg bg-white shadow-design-lg",
          "flex flex-col transition-transform duration-motion-slow transition-timing-motion-ease",
          className
        )}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 px-4 py-3">
          {title ? (
            <h2 id="bottom-sheet-title" className="text-lg font-semibold text-gray-900">
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            className="min-h-touch min-w-touch flex items-center justify-center rounded text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2"
            aria-label={closeLabel}
          >
            <span className="text-xl leading-none" aria-hidden>
              ×
            </span>
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    </>
  );
}
