'use client';

/**
 * T4.5 — rich arrival card: when the geofence fires, the room shows the full
 * spot briefing (image · highlights · visit basics · convenience · smart
 * notes) resolved server-side into the message metadata (T4.3 3-tier), plus
 * the pre-recorded audio guide when the spot has one. Visually consistent
 * with the tour-product stop drawer, compressed for a chat column.
 */

import { useRef, useState } from 'react';
import { primeAudio } from '@/lib/tour-room/tts';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<RoomLocale, { arrived: string; more: string; less: string; audio: string }> = {
  en: { arrived: 'You’ve arrived', more: 'More details', less: 'Show less', audio: 'Play audio guide' },
  ko: { arrived: '도착했어요', more: '자세히 보기', less: '접기', audio: '오디오 가이드 듣기' },
  ja: { arrived: '到着しました', more: '詳しく見る', less: '閉じる', audio: '音声ガイドを再生' },
  es: { arrived: 'Has llegado', more: 'Ver más', less: 'Ver menos', audio: 'Reproducir audioguía' },
  zh: { arrived: '已到达', more: '查看详情', less: '收起', audio: '播放语音导览' },
};

const BASIC_ROWS: Array<{ icon: string; pick: (c: SpotArrivalContent) => string | undefined }> = [
  { icon: '🕐', pick: (c) => c.visitBasics?.hours },
  { icon: '🚫', pick: (c) => c.visitBasics?.closed },
  { icon: '🎟️', pick: (c) => c.visitBasics?.admission },
  { icon: '🚶', pick: (c) => c.visitBasics?.walking },
  { icon: '🚻', pick: (c) => c.convenience?.restroom },
  { icon: '🅿️', pick: (c) => c.convenience?.parking },
  { icon: '📸', pick: (c) => c.smartNotes?.photo },
  { icon: '🏪', pick: (c) => c.smartNotes?.facilities },
  { icon: '💡', pick: (c) => c.smartNotes?.tip },
];

export default function SpotArrivalCard({
  content,
  messageText,
  audioUrl,
  locale,
}: {
  content: SpotArrivalContent;
  /** The translated template line ("You have arrived near …"). */
  messageText: string;
  audioUrl?: string | null;
  locale: RoomLocale;
}) {
  const [expanded, setExpanded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const copy = COPY[locale];

  const rows = BASIC_ROWS.map((row) => ({ icon: row.icon, text: row.pick(content) })).filter(
    (row): row is { icon: string; text: string } => Boolean(row.text),
  );
  const visibleRows = expanded ? rows : rows.slice(0, 3);
  const highlights = (content.highlights ?? []).slice(0, expanded ? 6 : 2);

  const toggleAudio = () => {
    primeAudio();
    if (!audioUrl) return;
    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.addEventListener('ended', () => setPlaying(false));
    }
    if (playing) {
      audioRef.current.pause();
      setPlaying(false);
    } else {
      void audioRef.current.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
    }
  };

  return (
    <div
      className="mx-auto w-full max-w-[95%] overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-amber-100 dark:bg-gray-900 dark:ring-amber-900"
      data-testid="spot-arrival-card"
    >
      {content.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={content.image} alt={content.name ?? ''} className="h-32 w-full object-cover" loading="lazy" />
      )}
      <div className="px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600 dark:text-amber-400">
          📍 {copy.arrived}
        </p>
        <p className="mt-0.5 text-[15px] font-semibold text-gray-900 dark:text-gray-50">{content.name}</p>
        <p className="mt-1 text-[12px] leading-relaxed text-gray-500 dark:text-gray-400">{messageText}</p>

        {content.description && expanded && (
          <p className="mt-2 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200">{content.description}</p>
        )}

        {highlights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {highlights.map((highlight, index) => (
              <span
                key={index}
                className="rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200"
              >
                ✨ {highlight}
              </span>
            ))}
          </div>
        )}

        {visibleRows.length > 0 && (
          <ul className="mt-2 space-y-1">
            {visibleRows.map((row, index) => (
              <li key={index} className="flex gap-2 text-[12px] leading-relaxed text-gray-600 dark:text-gray-300">
                <span className="shrink-0">{row.icon}</span>
                <span>{row.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-2.5 flex items-center gap-2">
          {audioUrl && (
            <button
              type="button"
              onClick={toggleAudio}
              className="rounded-xl bg-amber-500 px-3.5 py-2 text-[12px] font-semibold text-white"
              data-testid="spot-audio-button"
            >
              {playing ? '⏸' : '▶'} {copy.audio}
            </button>
          )}
          {(rows.length > 3 || content.description || (content.highlights ?? []).length > 2) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="rounded-xl px-3 py-2 text-[12px] font-medium text-gray-500 dark:text-gray-400"
              data-testid="spot-expand-toggle"
            >
              {expanded ? copy.less : copy.more}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
