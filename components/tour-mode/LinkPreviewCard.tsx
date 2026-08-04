'use client';

/**
 * §5-4 — the text-only link preview card under a chat bubble.
 *
 * Fetches through the room's own API (session-gated, SSRF-guarded server
 * side), caches per URL for the component's lifetime, and renders nothing at
 * all when there is nothing true to show — a bare link is fine, a skeleton
 * that resolves into nothing is not. No image, ever (lib/tour-room/linkPreview
 * explains why).
 */

import { useEffect, useState } from 'react';
import { IconOpenExternal, TR_ICON } from '@/components/tour-mode/icons';

interface Preview {
  url: string;
  host: string;
  title: string | null;
  description: string | null;
}

const previewCache = new Map<string, Promise<Preview | null>>();

function loadPreview(bookingId: string, roomSession: string, url: string): Promise<Preview | null> {
  const key = `${bookingId}:${url}`;
  let entry = previewCache.get(key);
  if (!entry) {
    entry = fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/link-preview?url=${encodeURIComponent(url)}`, {
      headers: { 'x-tour-room-auth': roomSession },
    })
      .then(async (res) => {
        if (!res.ok) return null;
        const data = (await res.json()) as Preview;
        return data.title || data.description ? data : null;
      })
      .catch(() => null);
    previewCache.set(key, entry);
  }
  return entry;
}

export default function LinkPreviewCard({
  url,
  bookingId,
  roomSession,
}: {
  url: string;
  bookingId: string;
  roomSession: string;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  useEffect(() => {
    let alive = true;
    void loadPreview(bookingId, roomSession, url).then((data) => {
      if (alive) setPreview(data);
    });
    return () => {
      alive = false;
    };
  }, [bookingId, roomSession, url]);

  if (!preview) return null;
  return (
    <a
      href={preview.url}
      target="_blank"
      rel="noopener noreferrer"
      className="text-cjk-body mt-1 flex max-w-[280px] items-start gap-2 rounded-xl border border-[var(--tr-hairline)] bg-[var(--tr-surface)] px-3 py-2"
      data-testid="link-preview-card"
    >
      <span className="min-w-0 flex-1">
        {preview.title ? (
          <span className="tr-card-text block truncate font-semibold text-[var(--tr-ink)]">{preview.title}</span>
        ) : null}
        {preview.description ? (
          <span className="tr-meta line-clamp-2 block text-[var(--tr-ink-2)]">{preview.description}</span>
        ) : null}
        <span className="tr-meta block truncate text-[var(--tr-ink-3)]">{preview.host}</span>
      </span>
      <IconOpenExternal size={TR_ICON.chip} className="mt-0.5 shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
    </a>
  );
}
