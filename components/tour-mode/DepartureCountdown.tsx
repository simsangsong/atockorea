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
 * SLICE B (§11.D D5) — the [시간추가] button attaches at the placeholder below.
 * A guest picks whole extra HOURS, sees a client-side cost PREVIEW (display
 * only — the server is authoritative), self-confirms, and the extend route
 * records the cash overtime charge in the ledger. The amount shown here is a
 * preview; the server recomputes it from the tour's city × hours on POST.
 */

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import Sheet from '@/components/tour-mode/Sheet';
import { baseHoursForCity, overtimeAmount, parseHm, rateForCity } from '@/lib/tour-room/overtime';
import { formatKrw } from '@/lib/tour-room/ledger';
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
  /** Booking id — the extend POST target. */
  bookingId?: string;
  /** Customer room-session signature for the `x-tour-room-auth` header. */
  roomSession?: string | null;
  /** Show the [시간추가] add-time button (guest, live, not read-only). */
  canExtend?: boolean;
}

/** Whole-hour options a guest may add in one tap (server clamps 1..8). */
const ADD_HOUR_OPTIONS = [1, 2, 3] as const;

/** 5-locale copy for the add-time button + sheet + cash note. */
const ADD_COPY: Record<
  RoomLocale,
  {
    button: string;
    sheetTitle: string;
    option: (h: number) => string;
    cashNote: string;
    success: (h: number) => string;
    failure: string;
    cancel: string;
  }
> = {
  en: {
    button: '+ Add time',
    sheetTitle: 'Add extra time',
    option: (h) => (h === 1 ? '+1 hour' : `+${h} hours`),
    cashNote: 'Pay the driver in cash at the end of the tour.',
    success: (h) => `Added ${h} ${h === 1 ? 'hour' : 'hours'} ✓`,
    failure: 'Could not add time. Please try again.',
    cancel: 'Cancel',
  },
  ko: {
    button: '+ 시간추가',
    sheetTitle: '시간 추가',
    option: (h) => `+${h}시간`,
    cashNote: '투어 종료 시 기사에게 현금으로 지불해요.',
    success: (h) => `${h}시간 추가됐어요 ✓`,
    failure: '시간 추가에 실패했어요. 다시 시도해 주세요.',
    cancel: '취소',
  },
  ja: {
    button: '+ 時間追加',
    sheetTitle: '時間を追加',
    option: (h) => `+${h}時間`,
    cashNote: 'ツアー終了時にドライバーへ現金でお支払いください。',
    success: (h) => `${h}時間追加しました ✓`,
    failure: '時間の追加に失敗しました。もう一度お試しください。',
    cancel: 'キャンセル',
  },
  zh: {
    button: '+ 增加时间',
    sheetTitle: '增加时间',
    option: (h) => `+${h}小时`,
    cashNote: '行程结束时请以现金支付给司机。',
    success: (h) => `已增加${h}小时 ✓`,
    failure: '增加时间失败，请重试。',
    cancel: '取消',
  },
  es: {
    button: '+ Añadir tiempo',
    sheetTitle: 'Añadir tiempo extra',
    option: (h) => (h === 1 ? '+1 hora' : `+${h} horas`),
    cashNote: 'Paga al conductor en efectivo al final del tour.',
    success: (h) => `Añadidas ${h} ${h === 1 ? 'hora' : 'horas'} ✓`,
    failure: 'No se pudo añadir tiempo. Inténtalo de nuevo.',
    cancel: 'Cancelar',
  },
};

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

export default function DepartureCountdown({
  departureTime,
  tourDate,
  city,
  locale,
  bookingId,
  roomSession,
  canExtend = false,
}: DepartureCountdownProps) {
  const [now, setNow] = useState(() => Date.now());
  const [sheetOpen, setSheetOpen] = useState(false);
  const [submitting, setSubmitting] = useState<number | null>(null);

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
  const addCopy = ADD_COPY[locale] ?? ADD_COPY.en;
  const remainingMs = targetMs - now;
  const ended = remainingMs <= 0;
  const { h, m } = splitRemaining(remainingMs);

  // Client-side PREVIEW only — the server recomputes the authoritative amount
  // from the DB city × hours on POST (no client amount is ever sent/trusted).
  const previewRate = rateForCity(city);
  // §11.D D5 — the [시간추가] button shows only for a live guest with a session.
  const showAddTime = canExtend && Boolean(bookingId) && Boolean(roomSession);

  const addTime = async (hours: number) => {
    if (!bookingId || !roomSession || submitting !== null) return;
    setSubmitting(hours);
    try {
      const res = await fetch(`/api/tour-rooms/${encodeURIComponent(bookingId)}/extend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-tour-room-auth': roomSession },
        // Body carries HOURS only — the server owns the amount.
        body: JSON.stringify({ hours }),
      });
      if (res.ok) {
        setSheetOpen(false);
        toast.success(addCopy.success(hours));
      } else {
        toast.error(addCopy.failure);
      }
    } catch {
      toast.error(addCopy.failure);
    } finally {
      setSubmitting(null);
    }
  };

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
      {/* §11.D D5 — the [시간추가] add-time button + confirm sheet. */}
      {showAddTime && (
        <>
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="tr-label tr-press shrink-0 rounded-full bg-[var(--tr-accent-soft)] px-3 py-1.5 font-semibold text-[var(--tr-accent-deep)]"
            data-testid="add-time-button"
          >
            {addCopy.button}
          </button>
          <Sheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={addCopy.sheetTitle}
            closeLabel={addCopy.cancel}
          >
            <div className="flex flex-col gap-2 pb-1" data-testid="add-time-sheet">
              {ADD_HOUR_OPTIONS.map((hours) => (
                <button
                  key={hours}
                  type="button"
                  disabled={submitting !== null}
                  onClick={() => void addTime(hours)}
                  className="tr-btn-flat flex min-h-[52px] items-center justify-between gap-3 px-4 text-base font-bold disabled:opacity-50"
                  data-testid={`add-time-option-${hours}`}
                >
                  <span>{addCopy.option(hours)}</span>
                  <span className="text-[var(--tr-accent-deep)]">
                    {submitting === hours ? '…' : formatKrw(overtimeAmount(hours, previewRate))}
                  </span>
                </button>
              ))}
              <p className="tr-meta mt-1 text-[var(--tr-ink-3)]">{addCopy.cashNote}</p>
            </div>
          </Sheet>
        </>
      )}
    </div>
  );
}
