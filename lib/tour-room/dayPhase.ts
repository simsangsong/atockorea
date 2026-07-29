/**
 * N2 — the day's arc.
 *
 * §N-5's diagnosis: "아침·정오·해질녘·종료가 같은 화면" — the app looks
 * identical at 7am and at 7pm, so time is not visible on the screen at all. The
 * now card already answers WHAT is happening; this makes the surface answer
 * WHEN, without a word.
 *
 * 🔴 What this is not: a new palette. Every phase is a mix of tokens the skin
 * already defines, at percentages small enough that the skin still reads as
 * itself. Ten skins x light/dark stay intact because none of them is named
 * here — the mix resolves against whatever that skin set.
 *
 * Four phases, matching §N-6's wording exactly (아침 · 낮 · 해질녘 · 종료):
 *
 *   morning  a clear accent — the pickup hours, when a guest is anxious and
 *            looking for the meeting point
 *   day      neutral. Nothing added. The middle of a tour should not be tinted
 *            for its own sake, and "no phase" has to be a real option or the
 *            other three stop meaning anything
 *   dusk     warm. The tail of the day, and the hours a guest starts thinking
 *            about dinner and the drop-off
 *   ended    settled. The tour is over; the card is a record, not an instrument
 */
export type DayPhase = 'morning' | 'day' | 'dusk' | 'ended';

/** KST is UTC+9 with no DST, so the offset is a constant rather than a lookup. */
const KST_OFFSET_MIN = 9 * 60;

export function kstHour(nowMs: number): number {
  const shifted = new Date(nowMs + KST_OFFSET_MIN * 60_000);
  return shifted.getUTCHours();
}

/**
 * The phase for a moment.
 *
 * `ended` comes from the lifecycle, never from the clock: a tour that finished
 * early is over at 2pm, and a card that stayed bright until sunset would be
 * telling the guest the day is still running.
 *
 * The boundaries are the operating day, not astronomy. Pickups start at 07:00
 * and the earliest are 05:00-ish; drop-offs land between 17:00 and 19:00. So
 * morning ends when the last pickup is long past, and dusk begins when the
 * first drop-offs do.
 *
 * ⚠ Recorded edge, same one the meeting-time code carries: a night tour running
 * past midnight reads as `dusk` throughout, which is right visually, but the
 * boundary at 05:00 would flip it to `morning` mid-tour. No night product
 * exists today; revisit with the first one.
 */
export function dayPhase(opts: { lifecycle?: string | null; nowMs?: number }): DayPhase {
  if (opts.lifecycle === 'ended') return 'ended';
  const hour = kstHour(opts.nowMs ?? Date.now());
  if (hour >= 5 && hour < 10) return 'morning';
  if (hour >= 10 && hour < 16) return 'day';
  return 'dusk';
}
