'use client';

/**
 * Kakao-grade chat (Phase 2) — full-screen image viewer.
 *
 * Tapping a photo bubble opens it here: dark backdrop, the image centered and
 * contained, tap-anywhere / ✕ / Esc to close, and a download affordance. Body
 * scroll is locked while open. Deliberately dependency-free.
 */

import { useEffect } from 'react';
import { IconClose, IconInstall } from '@/components/tour-mode/icons';

export default function Lightbox({
  url,
  name,
  onClose,
}: {
  url: string | null;
  name?: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!url) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90"
      onClick={onClose}
      data-testid="lightbox"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="close"
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
        data-testid="lightbox-close"
      >
        <IconClose size={22} />
      </button>
      <a
        href={url}
        download={name ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label="download"
        className="absolute bottom-4 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
        data-testid="lightbox-download"
      >
        <IconInstall size={20} />
      </a>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={name ?? ''}
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] max-w-[96vw] object-contain"
      />
    </div>
  );
}
