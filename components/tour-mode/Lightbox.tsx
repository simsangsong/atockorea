'use client';

/**
 * Kakao-grade chat (Phase 2) — full-screen image viewer.
 *
 * Tapping a photo bubble opens it here: dark backdrop, the image centered and
 * contained, tap-anywhere / ✕ / Esc to close, and a download affordance. Body
 * scroll is locked while open. Deliberately dependency-free.
 */

import { useEffect, useRef } from 'react';
import { IconClose, IconInstall, TR_ICON } from '@/components/tour-mode/icons';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

// A1.1 — screen-reader labels (the two icon-only controls were English-fixed).
const A11Y: Record<RoomLocale, { close: string; download: string; viewer: string }> = {
  en: { close: 'Close', download: 'Download', viewer: 'Photo viewer' },
  ko: { close: '닫기', download: '다운로드', viewer: '사진 보기' },
  ja: { close: '閉じる', download: 'ダウンロード', viewer: '写真ビューア' },
  es: { close: 'Cerrar', download: 'Descargar', viewer: 'Visor de fotos' },
  zh: { close: '关闭', download: '下载', viewer: '图片查看器' },
  'zh-TW': { close: '關閉', download: '下載', viewer: '圖片檢視器' },
  fr: { close: 'Fermer', download: 'Télécharger', viewer: 'Visionneuse photo' },
  de: { close: 'Schließen', download: 'Herunterladen', viewer: 'Fotoansicht' },
  ru: { close: 'Закрыть', download: 'Скачать', viewer: 'Просмотр фото' },
  it: { close: 'Chiudi', download: 'Scarica', viewer: 'Visualizzatore foto' },
};

export default function Lightbox({
  url,
  name,
  onClose,
  locale = 'en',
}: {
  url: string | null;
  name?: string | null;
  onClose: () => void;
  locale?: RoomLocale;
}) {
  const a11y = A11Y[locale] ?? A11Y.en;
  const containerRef = useRef<HTMLDivElement | null>(null);
  const restoreRef = useRef<HTMLElement | null>(null);
  // A1.1 — mirror Sheet's dismissable discipline. onClose is passed as an inline
  // arrow, so a [url, onClose] dep re-ran this effect on every parent re-render
  // while open (re-binding the key listener and re-locking scroll each time);
  // ref it and depend on `url` only. Also move focus into the dialog on open and
  // restore it on close, and mark the container role=dialog/aria-modal so a
  // screen reader treats the full-screen viewer as the modal it is.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });
  useEffect(() => {
    if (!url) return;
    restoreRef.current = (document.activeElement as HTMLElement | null) ?? null;
    containerRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      restoreRef.current?.focus?.();
    };
  }, [url]);

  if (!url) return null;

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-label={a11y.viewer}
      tabIndex={-1}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 outline-none"
      onClick={onClose}
      data-testid="lightbox"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label={a11y.close}
        className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
        data-testid="lightbox-close"
      >
        <IconClose size={TR_ICON.nav} />
      </button>
      <a
        href={url}
        download={name ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        onClick={(e) => e.stopPropagation()}
        aria-label={a11y.download}
        className="absolute bottom-4 right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/10 text-white"
        data-testid="lightbox-download"
      >
        <IconInstall size={TR_ICON.action} />
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
