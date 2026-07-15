'use client';

/**
 * T4.5 → U5.1 — rich arrival card: when the geofence fires, the room shows
 * the full spot briefing (image · highlights · visit basics · convenience ·
 * smart notes) resolved server-side into the message metadata (T4.3 3-tier),
 * plus the pre-recorded audio guide when the spot has one. Flat card recipe
 * (§H), lucide row icons (U-D3).
 */

import { useRef, useState } from 'react';
import { primeAudio } from '@/lib/tour-room/tts';
import {
  IconAdmission,
  IconArrived,
  IconClosedDay,
  IconFacility,
  IconHighlight,
  IconHours,
  IconParking,
  IconPause,
  IconPhotoNote,
  IconPlay,
  IconRestroom,
  IconTip,
  IconWalking,
} from '@/components/tour-mode/icons';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<RoomLocale, { arrived: string; more: string; less: string; audio: string }> = {
  en: { arrived: 'You’ve arrived', more: 'More details', less: 'Show less', audio: 'Play audio guide' },
  ko: { arrived: '도착했어요', more: '자세히 보기', less: '접기', audio: '오디오 가이드 듣기' },
  ja: { arrived: '到着しました', more: '詳しく見る', less: '閉じる', audio: '音声ガイドを再生' },
  es: { arrived: 'Has llegado', more: 'Ver más', less: 'Ver menos', audio: 'Reproducir audioguía' },
  zh: { arrived: '已到达', more: '查看详情', less: '收起', audio: '播放语音导览' },
};

const BASIC_ROWS: Array<{ Icon: typeof IconHours; pick: (c: SpotArrivalContent) => string | undefined }> = [
  { Icon: IconHours, pick: (c) => c.visitBasics?.hours },
  { Icon: IconClosedDay, pick: (c) => c.visitBasics?.closed },
  { Icon: IconAdmission, pick: (c) => c.visitBasics?.admission },
  { Icon: IconWalking, pick: (c) => c.visitBasics?.walking },
  { Icon: IconRestroom, pick: (c) => c.convenience?.restroom },
  { Icon: IconParking, pick: (c) => c.convenience?.parking },
  { Icon: IconPhotoNote, pick: (c) => c.smartNotes?.photo },
  { Icon: IconFacility, pick: (c) => c.smartNotes?.facilities },
  { Icon: IconTip, pick: (c) => c.smartNotes?.tip },
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

  const rows = BASIC_ROWS.map((row) => ({ Icon: row.Icon, text: row.pick(content) })).filter(
    (row): row is { Icon: typeof IconHours; text: string } => Boolean(row.text),
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
    <div className="tr-card mx-auto w-full max-w-[95%] overflow-hidden" data-testid="spot-arrival-card">
      {content.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={content.image} alt={content.name ?? ''} className="h-32 w-full object-cover" loading="lazy" />
      )}
      <div className="px-4 py-3">
        <p className="tr-meta flex items-center gap-1 font-semibold uppercase tracking-wide text-[var(--tr-accent-deep)]">
          <IconArrived size={12} strokeWidth={2.5} aria-hidden />
          {copy.arrived}
        </p>
        <p className="tr-title mt-0.5 text-[var(--tr-ink)]">{content.name}</p>
        <p className="tr-label mt-1 leading-relaxed text-[var(--tr-ink-2)]">{messageText}</p>

        {content.description && expanded && (
          <p className="tr-card-text mt-2 text-[var(--tr-ink)]">{content.description}</p>
        )}

        {highlights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {highlights.map((highlight, index) => (
              <span
                key={index}
                className="tr-meta flex items-center gap-1 rounded-full bg-[var(--tr-accent-soft)] px-2.5 py-1 font-medium text-[var(--tr-accent-deep)]"
              >
                <IconHighlight size={11} aria-hidden />
                {highlight}
              </span>
            ))}
          </div>
        )}

        {visibleRows.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {visibleRows.map((row, index) => (
              <li key={index} className="tr-label flex gap-2 leading-relaxed text-[var(--tr-ink-2)]">
                <row.Icon size={15} strokeWidth={2} className="mt-0.5 shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                <span>{row.text}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-2">
          {audioUrl && (
            <button
              type="button"
              onClick={toggleAudio}
              className="tr-label flex min-h-[40px] items-center gap-1.5 rounded-full bg-[var(--tr-accent)] px-4 font-semibold text-[var(--tr-bubble-me-ink)]"
              data-testid="spot-audio-button"
            >
              {playing ? <IconPause size={14} aria-hidden /> : <IconPlay size={14} aria-hidden />}
              {copy.audio}
            </button>
          )}
          {(rows.length > 3 || content.description || (content.highlights ?? []).length > 2) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="tr-label min-h-[40px] rounded-full px-3 font-medium text-[var(--tr-ink-2)]"
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
