'use client';

/**
 * Arrival video card (video W3 / join-tour J4) — the produced POI short
 * (Ken Burns stills + narration + burned subtitles) inside the arrival card.
 *
 * Poster-first: no video bytes load until the guest taps play, then it swaps
 * to a native <video controls autoPlay playsInline> (inline on iOS, no
 * fullscreen hijack). The URL is picked for the viewer's locale with an
 * English fallback. Legacy renders have burned-in subtitles; overlay renders
 * (one neutral silent MP4) attach the viewer-locale VTT as a <track> instead.
 * tr-* tokens only — light/dark and the cockpit alike.
 */

import { useState } from 'react';
import { Play, Clapperboard } from 'lucide-react';
import {
  formatVideoDuration,
  pickSubtitleUrl,
  pickVideoUrl,
  type ArrivalVideoCardMeta,
} from '@/lib/tour-room/poiVideos';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function ArrivalVideoCard({
  meta,
  locale,
}: {
  meta: ArrivalVideoCardMeta;
  locale: RoomLocale;
}) {
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  const url = pickVideoUrl(meta, locale);
  if (!url || broken) return null;

  // Overlay renders (neutral MP4): soft subtitles in the viewer's locale via
  // <track>. Legacy burned-in renders have no subtitle URL — no track, same
  // behavior as before. crossOrigin lets the browser fetch the VTT from the
  // public storage origin.
  const subtitleUrl = pickSubtitleUrl(meta, locale);
  const duration = formatVideoDuration(meta.duration_seconds);

  return (
    <div
      className="overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
      data-testid="arrival-video-card"
    >
      {playing ? (
        <video
          src={url}
          poster={meta.poster_url ?? undefined}
          controls
          autoPlay
          playsInline
          preload="metadata"
          crossOrigin={subtitleUrl ? 'anonymous' : undefined}
          onError={() => setBroken(true)}
          className="tr-anim-panel-in aspect-[9/16] max-h-[420px] w-full bg-black object-contain"
          data-testid="arrival-video-player"
        >
          {subtitleUrl ? (
            <track
              kind="subtitles"
              src={subtitleUrl}
              srcLang={locale}
              default
              data-testid="arrival-video-subtitles"
            />
          ) : null}
        </video>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative block w-full"
          data-testid="arrival-video-poster"
        >
          {meta.poster_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={meta.poster_url}
              alt=""
              loading="lazy"
              className="aspect-[9/16] max-h-[420px] w-full bg-black object-cover"
            />
          ) : (
            <div className="flex aspect-[9/16] max-h-[420px] w-full items-center justify-center bg-[var(--tr-surface-2)] text-[var(--tr-ink-3)]">
              <Clapperboard size={28} strokeWidth={1.75} aria-hidden />
            </div>
          )}
          <span className="absolute inset-0 flex items-center justify-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur-sm">
              <Play size={26} strokeWidth={2} fill="currentColor" aria-hidden className="ml-1" />
            </span>
          </span>
          {duration ? (
            <span className="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 text-[11px] font-semibold text-white">
              {duration}
            </span>
          ) : null}
        </button>
      )}
    </div>
  );
}
