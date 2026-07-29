'use client';

/**
 * SG-0b — the one clock every numeral row rents. There is exactly one
 * ticking-time implementation on the guest surface on purpose: the repo's
 * recurring failure is the second copy (DepartureCountdown and NoticeBanner
 * each already own a coarse clock; this component exists so the hero's
 * numeral does not become a third dialect).
 *
 * Discipline it inherits, in one place:
 * - Adaptive tick (SG-D3, NoticeBanner A1.2's pricing): a second-hand is
 *   only worth its renders inside the last ten minutes. Coarse 30s outside,
 *   1s inside; count-up mode (overage) is always fine — overage is short.
 * - Visible-only (DepartureCountdown's visibilitychange resync, extended):
 *   the interval is torn down entirely while the tab is hidden and the value
 *   resyncs the moment it returns. A hidden screen needs no seconds.
 * - SSR determinism (the PR #335 lesson): the FIRST render derives from
 *   `initialNowMs` — a number stamped by the server snapshot — so server and
 *   client paint identical text. The live clock takes over only in an
 *   effect. Rendering from Date.now() here would be the hydration mismatch
 *   this repo has already shipped once.
 * - aria-hidden (SG-D18): a ticking region must never reach a screen
 *   reader; the milestone announcements live with NowCard, outside the
 *   card's aria-atomic live region.
 */
import { useEffect, useState } from 'react';

export type NumeralClockMode = 'down' | 'up';
export type NumeralClockFormat = 'clock' | 'minutes';

const FINE_TICK_MS = 1_000;
const COARSE_TICK_MS = 30_000;
/** Fine ticking only inside the last ten minutes (SG-D3). */
const FINE_WINDOW_MS = 10 * 60 * 1000;

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * Pure formatter, exported for the resolver-side tests. `clock` renders
 * `MM:SS` under an hour (minutes padded, mirroring the +04:12 idiom),
 * `H:MM:SS` above it, with a `+` prefix in count-up mode. `minutes` renders
 * ceil-minutes plus the locale's unit label verbatim (the label carries its
 * own spacing — ko "분" is flush, en " min" leads with one).
 */
export function formatNumeral(
  mode: NumeralClockMode,
  format: NumeralClockFormat,
  targetMs: number,
  nowMs: number,
  unitLabel = '',
): string {
  const delta = mode === 'down' ? targetMs - nowMs : nowMs - targetMs;
  const clamped = Math.max(0, delta);
  if (format === 'minutes') {
    return `${Math.ceil(clamped / 60_000)}${unitLabel}`;
  }
  const totalSeconds = Math.floor(clamped / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const core =
    hours > 0
      ? `${hours}:${pad2(minutes)}:${pad2(seconds)}`
      : `${pad2(minutes)}:${pad2(seconds)}`;
  return mode === 'up' ? `+${core}` : core;
}

/** The tick period the current distance-to-target deserves. */
export function numeralTickMs(
  mode: NumeralClockMode,
  format: NumeralClockFormat,
  targetMs: number,
  nowMs: number,
): number {
  if (format === 'minutes') return COARSE_TICK_MS;
  if (mode === 'up') return FINE_TICK_MS;
  return targetMs - nowMs <= FINE_WINDOW_MS ? FINE_TICK_MS : COARSE_TICK_MS;
}

export default function NumeralClock({
  mode,
  targetMs,
  format,
  unitLabel,
  initialNowMs,
  nowMs,
  testId,
}: {
  mode: NumeralClockMode;
  targetMs: number;
  format: NumeralClockFormat;
  /** minutes-format suffix from NOW_CARD_COPY.minuteUnitLabel. */
  unitLabel?: string;
  /** Server-stamped anchor — the ONLY value the first render may use. */
  initialNowMs: number;
  /** Live clock (server-offset corrected); defaults to the device clock. */
  nowMs?: () => number;
  testId?: string;
}) {
  const [now, setNow] = useState(initialNowMs);
  const [visible, setVisible] = useState(true);

  // Live clock takes over after mount; SSR/hydration both painted from
  // initialNowMs above, so this is the first moment the device clock may
  // differ from what is on screen.
  useEffect(() => {
    const clock = nowMs ?? Date.now;
    setNow(clock());
    const onVisibility = () => {
      const isVisible = document.visibilityState === 'visible';
      setVisible(isVisible);
      if (isVisible) setNow(clock());
    };
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nowMs]);

  const period = numeralTickMs(mode, format, targetMs, now);

  useEffect(() => {
    if (!visible) return undefined;
    const clock = nowMs ?? Date.now;
    const timer = setInterval(() => setNow(clock()), period);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, period, nowMs]);

  return (
    <span
      data-testid={testId}
      aria-hidden="true"
      className="tr-numeral tr-num block text-[var(--tr-ink)]"
    >
      {formatNumeral(mode, format, targetMs, now, unitLabel)}
    </span>
  );
}
