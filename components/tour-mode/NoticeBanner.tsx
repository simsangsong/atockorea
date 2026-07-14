'use client';

/**
 * T6.3/T6.5 — traveller countdown banner for meeting notices and free-time
 * timers. Pinned above the tabs; ticks against the KST wall-clock target
 * (screen-return resync is inherent), pulses + vibrates at 10 and 5 minutes,
 * and speaks the warning when auto-read is on (device TTS only).
 */

import { useEffect, useRef, useState } from 'react';
import { activeNotice, formatRemaining, formatTargetTime } from '@/lib/tour-room/notices';
import { speakWithDevice } from '@/lib/tour-room/tts';
import { useTourRoomSettings } from '@/hooks/useTourRoomSettings';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

const COPY: Record<
  RoomLocale,
  { meeting: string; freeTime: string; backBy: (t: string) => string; at: (p: string) => string; now: string; warn: (m: number) => string }
> = {
  en: {
    meeting: 'Meeting time',
    freeTime: 'Free time',
    backBy: (t) => `Back by ${t}`,
    at: (p) => `at ${p}`,
    now: 'Please gather now',
    warn: (m) => `${m} minutes left — please head back to the meeting point.`,
  },
  ko: {
    meeting: '집합 시간',
    freeTime: '자유시간',
    backBy: (t) => `${t}까지 복귀`,
    at: (p) => `${p}에서`,
    now: '지금 모여주세요',
    warn: (m) => `${m}분 남았어요 — 집합 장소로 이동해 주세요.`,
  },
  ja: {
    meeting: '集合時間',
    freeTime: '自由時間',
    backBy: (t) => `${t}までに戻る`,
    at: (p) => `${p}にて`,
    now: '今すぐお集まりください',
    warn: (m) => `残り${m}分です — 集合場所へお戻りください。`,
  },
  es: {
    meeting: 'Hora de reunión',
    freeTime: 'Tiempo libre',
    backBy: (t) => `Regreso a las ${t}`,
    at: (p) => `en ${p}`,
    now: 'Reúnanse ahora, por favor',
    warn: (m) => `Quedan ${m} minutos — vuelve al punto de encuentro.`,
  },
  zh: {
    meeting: '集合时间',
    freeTime: '自由活动',
    backBy: (t) => `${t}前返回`,
    at: (p) => `地点：${p}`,
    now: '请现在集合',
    warn: (m) => `还剩${m}分钟 — 请返回集合地点。`,
  },
};

export default function NoticeBanner({
  messages,
  tourDate,
  locale,
}: {
  messages: RoomMessage[];
  tourDate: string | null | undefined;
  locale: RoomLocale;
}) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const { settings } = useTourRoomSettings();
  const warnedRef = useRef<{ id: string | null; warned10: boolean; warned5: boolean }>({
    id: null,
    warned10: false,
    warned5: false,
  });

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, []);

  const notice = activeNotice(messages, tourDate, nowMs);
  const copy = COPY[locale];

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

  return (
    <div
      data-testid="notice-banner"
      className={`mb-2 flex items-center gap-3 rounded-2xl px-4 py-3 shadow-sm ring-1 ${
        urgent
          ? 'animate-pulse bg-red-50 ring-red-200 dark:bg-red-950 dark:ring-red-900'
          : 'bg-amber-50 ring-amber-200 dark:bg-amber-950 dark:ring-amber-900'
      }`}
    >
      <span className="text-[20px]" aria-hidden>
        {notice.kind === 'free_time_timer' ? '⏳' : '📣'}
      </span>
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] font-semibold ${urgent ? 'text-red-800 dark:text-red-200' : 'text-amber-900 dark:text-amber-100'}`}>
          {title}
          {notice.targetMs !== null && ` · ${copy.backBy(formatTargetTime(notice.targetMs, locale))}`}
        </p>
        {notice.point && (
          <p className="truncate text-[12px] text-gray-600 dark:text-gray-300">📍 {copy.at(notice.point)}</p>
        )}
      </div>
      {notice.remainingMs !== null && (
        <span
          data-testid="notice-countdown"
          className={`shrink-0 rounded-xl px-3 py-1.5 text-[16px] font-bold tabular-nums ${
            urgent ? 'bg-red-500 text-white' : 'bg-amber-500 text-white'
          }`}
        >
          {notice.remainingMs === 0 ? copy.now : formatRemaining(notice.remainingMs)}
        </span>
      )}
    </div>
  );
}
