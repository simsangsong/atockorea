'use client';

/**
 * T6.3/T6.5 — traveller countdown banner for meeting notices and free-time
 * timers. Pinned above the tabs; ticks against the KST wall-clock target
 * (screen-return resync is inherent), pulses + vibrates at 10 and 5 minutes,
 * and speaks the warning when auto-read is on (device TTS only).
 */

import { useEffect, useRef, useState } from 'react';
import { activeNotice, formatRemaining, formatTargetTime, rallyStage } from '@/lib/tour-room/notices';
import { IconFreeTime, IconMeeting } from '@/components/tour-mode/icons';
import { speakWithDevice } from '@/lib/tour-room/tts';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  {
    meeting: string;
    freeTime: string;
    backBy: (t: string) => string;
    at: (p: string) => string;
    now: string;
    warn: (m: number) => string;
    waiting: string;
    contact: string;
    call: string;
    screenshot: string;
  }
> = {
  en: {
    meeting: 'Meeting time',
    freeTime: 'Free time',
    backBy: (t) => `Back by ${t}`,
    at: (p) => `at ${p}`,
    now: 'Please gather now',
    warn: (m) => `${m} minutes left — please head back to the meeting point.`,
    waiting: 'The party is waiting — please head to the meeting point.',
    contact: 'Can’t make it? Contact your guide now.',
    call: 'Call',
    screenshot: 'Tip: screenshot this — it works with no signal.',
  },
  ko: {
    meeting: '집합 시간',
    freeTime: '자유시간',
    backBy: (t) => `${t}까지 복귀`,
    at: (p) => `${p}에서`,
    now: '지금 모여주세요',
    warn: (m) => `${m}분 남았어요 — 집합 장소로 이동해 주세요.`,
    waiting: '일행이 기다리고 있어요 — 집합 장소로 와주세요.',
    contact: '어려우면 지금 가이드에게 연락해 주세요.',
    call: '전화',
    screenshot: '팁: 이 화면을 스크린샷해 두면 신호가 없어도 볼 수 있어요.',
  },
  ja: {
    meeting: '集合時間',
    freeTime: '自由時間',
    backBy: (t) => `${t}までに戻る`,
    at: (p) => `${p}にて`,
    now: '今すぐお集まりください',
    warn: (m) => `残り${m}分です — 集合場所へお戻りください。`,
    waiting: '皆さまお待ちです — 集合場所へお越しください。',
    contact: '難しい場合は今すぐガイドへご連絡ください。',
    call: '電話',
    screenshot: 'ヒント: この画面をスクショしておくと圏外でも確認できます。',
  },
  es: {
    meeting: 'Hora de reunión',
    freeTime: 'Tiempo libre',
    backBy: (t) => `Regreso a las ${t}`,
    at: (p) => `en ${p}`,
    now: 'Reúnanse ahora, por favor',
    warn: (m) => `Quedan ${m} minutos — vuelve al punto de encuentro.`,
    waiting: 'El grupo está esperando; ve al punto de encuentro.',
    contact: '¿No puedes llegar? Contacta a tu guía ahora.',
    call: 'Llamar',
    screenshot: 'Consejo: haz captura — funciona sin señal.',
  },
  zh: {
    meeting: '集合时间',
    freeTime: '自由活动',
    backBy: (t) => `${t}前返回`,
    at: (p) => `地点：${p}`,
    now: '请现在集合',
    warn: (m) => `还剩${m}分钟 — 请返回集合地点。`,
    waiting: '同行者正在等待——请前往集合地点。',
    contact: '赶不到?请立即联系导游。',
    call: '致电',
    screenshot: '提示: 截图保存此画面——无信号也能查看。',
  },
};

export default function NoticeBanner({
  messages,
  tourDate,
  locale,
  bookingId,
  roomSession,
  canSignal = false,
}: {
  messages: RoomMessage[];
  tourDate: string | null | undefined;
  locale: RoomLocale;
  /** With a session, the banner fires the E2 overdue signal (W2.3, P-D6). */
  bookingId?: string;
  roomSession?: string | null;
  canSignal?: boolean;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { settings } = useTourRoomSettings();
  const warnedRef = useRef<{ id: string | null; warned10: boolean; warned5: boolean }>({
    id: null,
    warned10: false,
    warned5: false,
  });
  const overdueFiredRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const notice = activeNotice(messages, tourDate, nowMs);
  const copy = COPY[locale];
  const stage = rallyStage(notice, nowMs);

  // W2.3 / P-D6 — the T+5 crossing fires exactly one room-wide event: every
  // customer client attempts it, the server's UNIQUE(subject_key) dedupes.
  useEffect(() => {
    if (!canSignal || !bookingId || !roomSession || !notice || notice.cancelled) return;
    if (stage !== 'overdue' && stage !== 'contact') return;
    if (overdueFiredRef.current === notice.messageId) return;
    overdueFiredRef.current = notice.messageId;
    void fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/signals`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
      body: JSON.stringify({ type: 'rally_overdue', noticeId: notice.messageId }),
    }).catch(() => undefined);
  }, [canSignal, bookingId, roomSession, notice, stage]);

  // 10/5-minute warnings — once each per notice (T6.5).
  useEffect(() => {
    if (!notice || notice.cancelled || notice.remainingMs === null) return;
    if (warnedRef.current.id !== notice.messageId) {
      warnedRef.current = { id: notice.messageId, warned10: false, warned5: false };
    }
    const fire = (minutes: 10 | 5) => {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* unsupported */
      }
      if (settings.autoRead && document.visibilityState === 'visible') {
        void speakWithDevice(copy.warn(minutes), locale);
      }
    };
    if (notice.warn5 && !warnedRef.current.warned5) {
      warnedRef.current.warned5 = true;
      warnedRef.current.warned10 = true; // 5min implies 10min already passed
      fire(5);
    } else if (notice.warn10 && !warnedRef.current.warned10) {
      warnedRef.current.warned10 = true;
      fire(10);
    }
  }, [notice, settings.autoRead, locale, copy]);

  if (!notice || notice.cancelled) return null;

  const urgent = notice.warn5 || (notice.remainingMs !== null && notice.remainingMs === 0);
  const title = notice.kind === 'free_time_timer' ? copy.freeTime : copy.meeting;

  // U5.4 — a floating overlay pill (rendered in the shell's overlay zone):
  // flat surface + one accent; when urgent only the countdown capsule pulses,
  // not the whole banner.
  return (
    <div
      data-testid="notice-banner"
      className="mb-2 flex items-center gap-3 rounded-[var(--tr-radius-card)] bg-[var(--tr-surface)] px-4 py-2.5"
      style={{ boxShadow: 'var(--tr-shadow-overlay)' }}
    >
      <span
        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
          urgent ? 'bg-[var(--tr-danger-soft)] text-[var(--tr-danger)]' : 'bg-[var(--tr-accent-soft)] text-[var(--tr-accent-deep)]'
        }`}
        aria-hidden
      >
        {notice.kind === 'free_time_timer' ? <IconFreeTime size={17} /> : <IconMeeting size={17} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`tr-card-text font-semibold ${urgent ? 'text-[var(--tr-danger)]' : 'text-[var(--tr-ink)]'}`}>
          {title}
          {notice.targetMs !== null && ` · ${copy.backBy(formatTargetTime(notice.targetMs, locale))}`}
        </p>
        {notice.point && <p className="tr-label truncate text-[var(--tr-ink-2)]">{copy.at(notice.point)}</p>}
        {stage === 'set' && (
          // W4.2 / E5 — dead-battery / no-signal insurance while there's time.
          <p data-testid="screenshot-hint" className="tr-meta mt-0.5 text-[var(--tr-ink-3)]">
            {copy.screenshot}
          </p>
        )}
        {(stage === 'overdue' || stage === 'contact') && (
          <p data-testid="rally-stage-line" className="tr-label mt-0.5 font-semibold text-[var(--tr-danger)]">
            {stage === 'overdue' ? copy.waiting : copy.contact}
            {stage === 'contact' && process.env.NEXT_PUBLIC_TOUR_OPS_PHONE && (
              <a
                href={`tel:${process.env.NEXT_PUBLIC_TOUR_OPS_PHONE}`}
                className="ml-2 rounded-full bg-[var(--tr-danger)] px-2.5 py-0.5 font-bold text-white"
              >
                {copy.call}
              </a>
            )}
          </p>
        )}
      </div>
      {notice.remainingMs !== null && (
        <span
          data-testid="notice-countdown"
          className={`shrink-0 rounded-full px-3 py-1.5 text-[16px] font-bold tabular-nums text-white ${
            urgent ? 'animate-pulse bg-[var(--tr-danger)]' : 'bg-[var(--tr-accent)]'
          }`}
        >
          {notice.remainingMs === 0 ? copy.now : formatRemaining(notice.remainingMs)}
        </span>
      )}
    </div>
  );
}
