'use client';

/**
 * Hour/minute wheel dial for the cockpit's time pickers (집합시간 · 복귀시간).
 *
 * The fixed +N분 chips cover the common cases, but the field always has
 * variables — this dial makes ANY wall-clock time (1-minute steps) one
 * thumb-flick away. Two scroll-snap columns, 44px rows, no external deps.
 *
 * `value` is an HH:MM string; an empty/invalid value shows a neutral resting
 * position (`restAt`) WITHOUT committing it — the first scroll or tap commits.
 * That keeps the arrival sheet's "no default meeting time" rule intact
 * (a deliberate choice every stop, docs/smart-guide-ops-detail-audit §A0).
 */

import { useCallback, useEffect, useRef } from 'react';

const ITEM_H = 44; // px per row — also the tap-target floor
const VISIBLE = 5; // odd → one centered selection row

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 60 }, (_, i) => i);

function two(n: number): string {
  return String(n).padStart(2, '0');
}

function WheelColumn({
  values,
  position,
  committed,
  onPick,
}: {
  values: number[];
  /** The row the wheel rests on (committed value, or the neutral rest). */
  position: number;
  /** false → nothing chosen yet: rows stay dim and any settle commits. */
  committed: boolean;
  onPick: (v: number) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const settleTimer = useRef<number | null>(null);
  // Programmatic scrolls (prop sync / tap) must not re-fire onPick.
  const suppressUntil = useRef(0);

  const scrollToValue = useCallback(
    (v: number, smooth: boolean) => {
      const el = ref.current;
      if (!el) return;
      const idx = values.indexOf(v);
      if (idx < 0) return;
      const top = idx * ITEM_H;
      if (Math.abs(el.scrollTop - top) < 1) return;
      suppressUntil.current = Date.now() + 300;
      el.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    },
    [values],
  );

  const committedValueRef = useRef<number | null>(committed ? position : null);
  useEffect(() => {
    committedValueRef.current = committed ? position : null;
  }, [committed, position]);

  useEffect(() => {
    scrollToValue(position, false);
  }, [position, scrollToValue]);

  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (Date.now() < suppressUntil.current) return;
    if (settleTimer.current) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const idx = Math.max(0, Math.min(values.length - 1, Math.round(el.scrollTop / ITEM_H)));
      const next = values[idx];
      // An uncommitted wheel commits on ANY settle (even the resting row) —
      // the driver's scroll is the deliberate choice.
      if (next !== committedValueRef.current) onPick(next);
    }, 110);
  }, [values, onPick]);

  const pad = (ITEM_H * (VISIBLE - 1)) / 2;
  return (
    <div
      ref={ref}
      onScroll={onScroll}
      className="min-w-0 flex-1 snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={{ height: ITEM_H * VISIBLE }}
    >
      <div style={{ height: pad }} aria-hidden />
      {values.map((v) => (
        <button
          key={v}
          type="button"
          onClick={() => {
            onPick(v);
            scrollToValue(v, true);
          }}
          className={`flex w-full snap-center items-center justify-center tabular-nums transition-colors duration-[var(--tr-dur-fast)] ${
            committed && position === v
              ? 'text-2xl font-bold text-[var(--tr-ink)]'
              : 'text-xl font-semibold text-[var(--tr-ink-3)]'
          }`}
          style={{ height: ITEM_H }}
        >
          {two(v)}
        </button>
      ))}
      <div style={{ height: pad }} aria-hidden />
    </div>
  );
}

export default function TimeWheel({
  value,
  onChange,
  restAt,
  testId,
}: {
  /** Committed HH:MM, or '' when nothing is chosen yet. */
  value: string;
  onChange: (hhmm: string) => void;
  /** Neutral resting time (HH:MM) shown before anything is committed. */
  restAt: string;
  testId?: string;
}) {
  const committed = /^\d{2}:\d{2}$/.test(value);
  const rest = /^\d{2}:\d{2}$/.test(restAt) ? restAt : '12:00';
  const shown = committed ? value : rest;
  const hour = Number(shown.slice(0, 2));
  const minute = Number(shown.slice(3, 5));

  const pickHour = useCallback((h: number) => onChange(`${two(h)}:${two(minute)}`), [onChange, minute]);
  const pickMinute = useCallback((m: number) => onChange(`${two(hour)}:${two(m)}`), [onChange, hour]);

  return (
    <div className="relative rounded-2xl bg-[var(--tr-surface)]" data-testid={testId}>
      {/* center selection band */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-3 top-1/2 -translate-y-1/2 rounded-xl bg-[var(--tr-surface-2)]"
        style={{ height: ITEM_H }}
      />
      {/* fade masks so the wheel reads as a dial, not a list */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 h-10 rounded-t-2xl bg-gradient-to-b from-[var(--tr-surface)] to-transparent"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-10 rounded-b-2xl bg-gradient-to-t from-[var(--tr-surface)] to-transparent"
        aria-hidden
      />
      <div className="relative flex items-stretch px-3">
        <WheelColumn values={HOURS} position={hour} committed={committed} onPick={pickHour} />
        <div className="flex items-center text-2xl font-bold text-[var(--tr-ink-2)]" aria-hidden>
          :
        </div>
        <WheelColumn values={MINUTES} position={minute} committed={committed} onPick={pickMinute} />
      </div>
    </div>
  );
}
