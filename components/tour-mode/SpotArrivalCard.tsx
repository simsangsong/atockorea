'use client';

/**
 * T4.5 → U5.1 — rich arrival card: when the geofence fires, the room shows
 * the full spot briefing (image · highlights · visit basics · convenience ·
 * smart notes) resolved server-side into the message metadata (T4.3 3-tier),
 * plus the pre-recorded audio guide when the spot has one. Flat card recipe
 * (§H), lucide row icons (U-D3).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { isAudioPrimed, primeAudio, speakNarration, stopSpeaking } from '@/lib/tour-room/tts';
import { composeSpotNarration, splitEmphasis, stripMarkdown } from '@/lib/tour-room/spotContent';
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
  TR_ICON,
  TR_STROKE,
} from '@/components/tour-mode/icons';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { arrived: string; more: string; less: string; audio: string; audioUnavailable: string; aiBadge: string }
> = {
  en: { arrived: 'You’ve arrived', more: 'More details', less: 'Show less', audio: 'Play audio guide', aiBadge: 'AI-generated guide — verify details locally', audioUnavailable: 'Voice unavailable' },
  ko: { arrived: '도착했어요', more: '자세히 보기', less: '접기', audio: '오디오 가이드 듣기', aiBadge: 'AI 생성 안내 — 세부 정보는 현장에서 확인하세요', audioUnavailable: '음성을 재생할 수 없어요' },
  ja: { arrived: '到着しました', more: '詳しく見る', less: '閉じる', audio: '音声ガイドを再生', aiBadge: 'AI生成ガイド — 詳細は現地でご確認ください', audioUnavailable: '音声を再生できません' },
  es: { arrived: 'Has llegado', more: 'Ver más', less: 'Ver menos', audio: 'Reproducir audioguía', aiBadge: 'Guía generada por IA — verifica los detalles en el lugar', audioUnavailable: 'Voz no disponible' },
  zh: { arrived: '已到达', more: '查看详情', less: '收起', audio: '播放语音导览', aiBadge: 'AI生成指南 — 详情请以现场为准', audioUnavailable: '语音暂不可用' },
  'zh-TW': { arrived: '已抵達', more: '查看詳情', less: '收合', audio: '播放語音導覽', aiBadge: 'AI 生成導覽——詳情請以現場為準', audioUnavailable: '語音暫時無法播放' },
  fr: { arrived: 'Vous êtes arrivé', more: 'Plus de détails', less: 'Réduire', audio: 'Écouter l’audioguide', aiBadge: 'Guide généré par IA — vérifiez les détails sur place', audioUnavailable: 'Voix indisponible' },
  de: { arrived: 'Sie sind angekommen', more: 'Mehr Details', less: 'Weniger anzeigen', audio: 'Audioguide abspielen', aiBadge: 'KI-generierte Infos — Details bitte vor Ort prüfen', audioUnavailable: 'Stimme nicht verfügbar' },
  ru: { arrived: 'Вы на месте', more: 'Подробнее', less: 'Свернуть', audio: 'Включить аудиогид', aiBadge: 'Описание создано ИИ — детали уточняйте на месте', audioUnavailable: 'Голос недоступен' },
  it: { arrived: 'Sei arrivato', more: 'Più dettagli', less: 'Mostra meno', audio: 'Ascolta l’audioguida', aiBadge: 'Guida generata dall’IA — verifica i dettagli sul posto', audioUnavailable: 'Voce non disponibile' },
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
  contentTier,
  lang,
  auth,
  autoPlay = false,
}: {
  content: SpotArrivalContent;
  /** The translated template line ("You have arrived near …"). */
  messageText: string;
  audioUrl?: string | null;
  locale: RoomLocale;
  /** P-D16 — 'generated' shows the AI-provenance badge (honesty rule). */
  contentTier?: string | null;
  /**
   * A2 — the language `content`'s prose is actually written in. Defaults to the
   * viewer's locale; differs whenever the briefing fell back to English.
   */
  lang?: RoomLocale;
  /** Room auth for the server-TTS rung. Absent = device voice only. */
  auth?: { bookingId: string; messageId: string; roomSession: string } | null;
  /** A2 — speak on arrival without a tap (only once audio is already primed). */
  autoPlay?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  // SG-4a bugfix -- a dead image URL used to render a broken-image box with
  // no fallback at all; failure now falls to the text header branch below.
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(content.image) && !imageFailed;
  const [playing, setPlaying] = useState(false);
  const [voiceFailed, setVoiceFailed] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const copy = COPY[locale];
  const proseLang = lang ?? locale;

  const rows = BASIC_ROWS.map((row) => ({ Icon: row.Icon, text: row.pick(content) })).filter(
    (row): row is { Icon: typeof IconHours; text: string } => Boolean(row.text),
  );
  const visibleRows = expanded ? rows : rows.slice(0, 3);
  const highlights = (content.highlights ?? []).slice(0, expanded ? 6 : 2);

  // A2 — the words a guide would say out loud. A pre-recorded track always
  // wins; otherwise the TTS ladder speaks the same briefing the card shows.
  const narration = useMemo(() => composeSpotNarration(content), [content]);
  const canSpeak = Boolean(audioUrl) || Boolean(narration);

  const stop = () => {
    stopSpeaking();
    audioRef.current?.pause();
    setPlaying(false);
  };

  const play = () => {
    primeAudio();
    if (audioUrl) {
      if (!audioRef.current) {
        audioRef.current = new Audio(audioUrl);
        audioRef.current.addEventListener('ended', () => setPlaying(false));
      }
      setPlaying(true);
      void audioRef.current.play().catch(() => setPlaying(false));
      return;
    }
    if (!narration) return;
    setPlaying(true);
    void speakNarration(narration, {
      bookingId: auth?.bookingId ?? '',
      messageId: auth?.messageId ?? '',
      roomSession: auth?.roomSession ?? '',
      locale,
      lang: proseLang,
    })
      .then((tier) => {
        // 'none' means neither rung produced sound — say so instead of leaving
        // a button that looks like it worked (the P0-6 lesson).
        if (tier === 'none') setVoiceFailed(true);
      })
      .catch(() => setVoiceFailed(true))
      .finally(() => setPlaying(false));
  };

  const toggleAudio = () => (playing ? stop() : play());

  // Arrival should FEEL like a guide starting to talk: when the guest has
  // already unlocked audio this session, the briefing speaks itself. Never on
  // a cold session — an unprimed autoplay is silently rejected on mobile, and
  // blaring without a prior gesture would be hostile anyway.
  const autoPlayedRef = useRef(false);
  useEffect(() => {
    if (!autoPlay || autoPlayedRef.current || !canSpeak || !isAudioPrimed()) return;
    autoPlayedRef.current = true;
    play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoPlay, canSpeak]);

  // Leaving the feed (or a second arrival) must not leave a voice talking.
  useEffect(() => () => stopSpeaking(), []);

  return (
    <div className="tr-card mx-auto w-full max-w-[95%] overflow-hidden" data-testid="spot-arrival-card">
      {showImage ? (
        // W2.2 — hero cover: a bottom scrim carries the arrived badge + title on
        // the photo so it reads as a premium card the guest wants to screenshot.
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={content.image} alt={content.name ?? ''} className="h-36 w-full object-cover" loading="lazy" onError={() => setImageFailed(true)} />
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
            <p className="tr-meta flex items-center gap-1 font-semibold uppercase tracking-wide text-white/90">
              <IconArrived size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden />
              {copy.arrived}
            </p>
            <p className="tr-title mt-0.5 text-white">{content.name}</p>
          </div>
        </div>
      ) : null}
      <div className="px-4 py-3">
        {!showImage && (
          <>
            <p className="tr-meta flex items-center gap-1 font-semibold uppercase tracking-wide text-[var(--tr-accent-deep)]">
              <IconArrived size={TR_ICON.meta} strokeWidth={TR_STROKE.small} aria-hidden />
              {copy.arrived}
            </p>
            <p className="tr-title mt-0.5 text-[var(--tr-ink)]">{content.name}</p>
          </>
        )}
        <p className={`tr-label leading-relaxed text-[var(--tr-ink-2)] ${showImage ? '' : 'mt-1'}`}>{messageText}</p>
        {contentTier === 'generated' && (
          <p className="tr-meta mt-1 text-[var(--tr-ink-3)]" data-testid="spot-ai-badge">
            ✨ {copy.aiBadge}
          </p>
        )}

        {/* A2 — the story is the point of the card, so it is no longer folded
            behind "More details". A guide does not make you ask twice. */}
        {content.description && (
          <p className="tr-card-text text-cjk-body mt-2 text-[var(--tr-ink)]">
            {splitEmphasis(content.description).map((part, index) =>
              part.bold ? (
                <strong key={index} className="font-semibold">
                  {part.text}
                </strong>
              ) : (
                <span key={index}>{part.text}</span>
              ),
            )}
          </p>
        )}

        {highlights.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {highlights.map((highlight, index) => (
              <span
                key={index}
                className="tr-meta flex items-center gap-1 rounded-full bg-[var(--tr-accent-soft)] px-2.5 py-1 font-medium text-[var(--tr-accent-deep)]"
              >
                <IconHighlight size={TR_ICON.meta} aria-hidden />
                {stripMarkdown(highlight)}
              </span>
            ))}
          </div>
        )}

        {visibleRows.length > 0 && (
          <ul className="mt-2.5 space-y-1.5">
            {visibleRows.map((row, index) => (
              <li key={index} className="tr-label flex gap-2 leading-relaxed text-[var(--tr-ink-2)]">
                <row.Icon size={TR_ICON.chip} strokeWidth={TR_STROKE.default} className="mt-0.5 shrink-0 text-[var(--tr-ink-3)]" aria-hidden />
                <span>{stripMarkdown(row.text)}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-3 flex items-center gap-2">
          {canSpeak && (
            <button
              type="button"
              onClick={toggleAudio}
              // P0-6 — a failed attempt keeps the control TAPPABLE (audio often
              // unlocks a moment later); only the glyph goes honest.
              className={`tr-label flex min-h-[44px] items-center gap-1.5 rounded-full px-4 font-semibold ${
                voiceFailed
                  ? 'bg-[var(--tr-surface-2)] text-[var(--tr-ink-2)]'
                  : 'bg-[var(--tr-accent)] text-[var(--tr-bubble-me-ink)]'
              }`}
              data-testid={voiceFailed ? 'spot-audio-unavailable' : 'spot-audio-button'}
            >
              {playing ? (
                <IconPause size={TR_ICON.meta} aria-hidden />
              ) : (
                <IconPlay size={TR_ICON.meta} aria-hidden />
              )}
              {voiceFailed ? copy.audioUnavailable : copy.audio}
            </button>
          )}
          {(rows.length > 3 || (content.highlights ?? []).length > 2) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="tr-label min-h-[44px] rounded-full px-3 font-medium text-[var(--tr-ink-2)]"
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
