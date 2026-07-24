'use client';

/**
 * §11.D D4 — the PRIVATE-tour departure countdown (owner-confirmed 2026-07-24).
 *
 * A private-tour guest sets a daily departure time in the plan editor; this
 * banner counts down to the END of the day's INCLUDED hours:
 *
 *     target = departure_time + baseHoursForCity(city)   (Jeju 9h / Busan 8h)
 *
 * The countdown is CLIENT-DERIVED from that wall-clock target (no server timer,
 * no `free_time_timer` message, no cron) — mirroring the notices grain where a
 * locked screen "resyncs for free" from the target. It ticks calmly (recompute
 * on a 30s interval + on visibility regain), and hides itself off the tour day.
 *
 * SLICE B (NOT built here): the [시간추가] / charging button will attach at the
 * clearly-marked placeholder below — this slice is display-only, NO money.
 */

import { useEffect, useState } from 'react';
import { baseHoursForCity, parseHm } from '@/lib/tour-room/overtime';
import { formatTargetTime } from '@/lib/tour-room/notices';
import { kstStartOfDayMs, kstToday } from '@/lib/tour-room/time';
import type { RoomLocale } from '@/lib/tour-room/snapshot';

interface DepartureCountdownProps {
  /** "HH:MM" (KST) — the guest-set departure time. */
  departureTime: string | null | undefined;
  /** Booking tour date "YYYY-MM-DD". */
  tourDate: string | null | undefined;
  /** tours.city — picks the base included hours (Jeju 9h / Busan 8h / else 8h). */
  city: string | null | undefined;
  locale: RoomLocale;
}

const COPY: Record<
  RoomLocale,
  { endsAt: string; remaining: string; ended: string; hm: (h: number, m: number) => string }
> = {
  en: {
    endsAt: 'Ends around',
    remaining: 'left',
    ended: 'Included time is up',
    hm: (h, m) => (h > 0 ? `${h}h ${m}m` : `${m}m`),
  },
  ko: {
    endsAt: '종료 예정',
    remaining: '남은',
    ended: '포함 시간 종료',
    hm: (h, m) => (h > 0 ? `${h}시간 ${m}분` : `${m}분`),
  },
  ja: {
    endsAt: '終了予定',
    remaining: '残り',
    ended: '含まれる時間が終了しました',
    hm: (h, m) => (h > 0 ? `${h}時間${m}分` : `${m}分`),
  },
  zh: {
    endsAt: '预计结束',
    remaining: '剩余',
    ended: '包含时间已结束',
    hm: (h, m) => (h > 0 ? `${h}小时${m}分` : `${m}分`),
  },
  es: {
    endsAt: 'Termina hacia',
    remaining: 'restante',
    ended: 'El tiempo incluido terminó',
    hm: (h, m) => (h > 0 ? `${h} h ${m} min` : `${m} min`),
  },
};

/** ms → whole hours + minutes remaining (rounded up to the next minute). */
function splitRemaining(remainingMs: number): { h: number; m: number } {
  const totalMin = Math.max(0, Math.ceil(remainingMs / 60000));
  return { h: Math.floor(totalMin / 60), m: totalMin % 60 };
}

export default function DepartureCountdown({ departureTime, tourDate, city, locale }: DepartureCountdownProps) {
  const [now, setNow] = useState(() => Date.now());

  // Calm, no-drift ticking: recompute every 30s and whenever the tab regains
  // focus (the value is fully derived from `now`, so a resync is free).
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 30_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') tick();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  const startMinutes = parseHm(departureTime);
  if (startMinutes === null || !tourDate) return null;
  // Only on the tour day itself (pre-day lobby / post-day have nothing to count).
  if (kstToday(now) !== tourDate) return null;

  const endMinutes = startMinutes + baseHoursForCity(city) * 60;
  let targetMs: number;
  try {
    targetMs = kstStartOfDayMs(tourDate) + endMinutes * 60_000;
  } catch {
    return null;
  }

  const copy = COPY[locale] ?? COPY.en;
  const remainingMs = targetMs - now;
  const ended = remainingMs <= 0;
  const { h, m } = splitRemaining(remainingMs);

  return (
    <div
      className="tr-card flex items-center justify-between gap-3 px-4 py-3"
      role="status"
      aria-live="polite"
    >
      <div className="min-w-0">
        <p className="tr-meta font-semibold uppercase tracking-wide text-[var(--tr-ink-3)]">
          {copy.endsAt} {formatTargetTime(targetMs, locale)}
        </p>
        <p className="tr-body mt-0.5 font-bold text-[var(--tr-ink)]">
          {ended ? copy.ended : `${copy.remaining} ${copy.hm(h, m)}`}
        </p>
      </div>
      {/* SLICE B PLACEHOLDER — the [시간추가] / overtime-charging button attaches
          here. Intentionally NOT built in this slice (additive, no money). */}
    </div>
  );
}
