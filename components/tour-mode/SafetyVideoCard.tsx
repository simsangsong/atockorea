'use client';

/**
 * The 30-second safety film — multi-track WebVTT player (plan §5.6.3).
 *
 * Unlike ArrivalVideoCard (one MP4 per language, subtitles burned in), this is
 * ONE silent render with ten `<track kind="subtitles">` elements. The viewer's
 * language gets `default`, and the browser's own caption menu handles the rest,
 * so a guest whose language is not one of the five room locales still reads the
 * safety rules in their own language.
 *
 * Poster-first: no video bytes load until the guest taps play. Muted + inline,
 * because the render has no audio and iOS must not hijack it to fullscreen.
 * tr-* tokens only — light/dark and the cockpit alike.
 */

import { useState } from 'react';
import { Play, ShieldCheck } from 'lucide-react';
import { formatVideoDuration } from '@/lib/tour-room/poiVideos';
import {
  defaultSafetySubtitleLocale,
  type SafetyVideoCardMeta,
} from '@/lib/tour-room/safetyVideo';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

export default function SafetyVideoCard({
  meta,
  locale,
  preferredLocale = null,
  label,
}: {
  meta: SafetyVideoCardMeta;
  locale: RoomLocale;
  /** The viewer's own chat language ('de', 'fr' …) when the bridge knows it. */
  preferredLocale?: string | null;
  /** Localized "Watch the 30-second safety clip". */
  label: string;
}) {
  const [playing, setPlaying] = useState(false);
  const [broken, setBroken] = useState(false);
  if (!meta.video_url || broken) return null;

  const defaultTrack = defaultSafetySubtitleLocale(locale, preferredLocale);
  const duration = formatVideoDuration(meta.duration_seconds);
  const tracks = Array.isArray(meta.tracks) ? meta.tracks : [];

  return (
    <div
      className="overflow-hidden rounded-[var(--tr-radius-card)] border border-[var(--tr-hairline)] bg-[var(--tr-surface)]"
      data-testid="safety-video-card"
    >
      {playing ? (
        <video
          src={meta.video_url}
          poster={meta.poster_url ?? undefined}
          controls
          autoPlay
          muted
          playsInline
          preload="metadata"
          crossOrigin="anonymous"
          onError={() => setBroken(true)}
          className="tr-anim-panel-in aspect-[9/16] max-h-[420px] w-full bg-black object-contain"
          data-testid="safety-video-player"
        >
          {tracks.map((track) => (
            <track
              key={track.srclang}
              kind="subtitles"
              src={track.src}
              srcLang={track.srclang}
              label={track.label}
              default={track.srclang === defaultTrack}
              data-testid={`safety-track-${track.srclang}`}
            />
          ))}
        </video>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          className="relative block w-full"
          aria-label={label}
          data-testid="safety-video-poster"
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
              <ShieldCheck size={28} strokeWidth={1.75} aria-hidden />
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
