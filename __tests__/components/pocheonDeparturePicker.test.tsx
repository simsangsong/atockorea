/**
 * @jest-environment jsdom
 *
 * Real render of the real picker — the source-level gate is not enough.
 *
 * `__tests__/audit/departureWeekdays.test.ts` greps the booking components for
 * the `filterDate` wiring. That proves the line EXISTS; it cannot prove the
 * calendar disables anything. Since the constraint's entire history is "the
 * fact was declared and nothing acted on it", the check that matters is the one
 * that mounts the component and reads which day cells came out disabled.
 *
 * This mounts react-datepicker with the same `filterDate` composition the
 * booking surfaces use, over a real month, and asserts by weekday.
 */
import React from 'react';
import { render } from '@testing-library/react';
import DatePicker from 'react-datepicker';
import { isDepartureWeekday } from '@/components/product-tour-static/_shared/bookingShared';

const MTS = ['monday', 'thursday', 'saturday'];

/** August 2026 — 1st is a Saturday, so the grid covers every weekday many times. */
const AUGUST_2026 = new Date(2026, 7, 1);

function renderPicker(departureWeekdays?: readonly string[]) {
  return render(
    <DatePicker
      selected={null}
      onChange={() => {}}
      openToDate={AUGUST_2026}
      minDate={AUGUST_2026}
      inline
      monthsShown={1}
      filterDate={(date: Date) => isDepartureWeekday(date, departureWeekdays)}
    />,
  );
}

const WEEKDAY = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/**
 * Group the month's own day cells by weekday → enabled / disabled counts.
 *
 * react-datepicker v8 labels a cell with its DAY OF MONTH (`--004`), not its
 * weekday — an earlier draft of this test matched `--tuesday`, found nothing,
 * and reported an empty tally as a pass-shaped zero. So derive the weekday from
 * the day number against the month actually being displayed.
 */
function tallyByWeekday(container: HTMLElement) {
  const cells = [...container.querySelectorAll('.react-datepicker__day')].filter(
    (d) => !d.className.includes('outside-month'),
  );
  const tally: Record<string, { enabled: number; disabled: number }> = {};
  for (const cell of cells) {
    const dom = /react-datepicker__day--(\d{3})\b/.exec(cell.className)?.[1];
    if (!dom) continue;
    const date = new Date(AUGUST_2026.getFullYear(), AUGUST_2026.getMonth(), Number(dom));
    const dow = WEEKDAY[date.getDay()];
    const disabled =
      cell.className.includes('--disabled') || cell.getAttribute('aria-disabled') === 'true';
    tally[dow] ??= { enabled: 0, disabled: 0 };
    tally[dow][disabled ? 'disabled' : 'enabled'] += 1;
  }
  return { tally, cellCount: cells.length };
}

describe('Pocheon booking calendar', () => {
  it('renders a real month (guards against a vacuous pass)', () => {
    const { container } = renderPicker(MTS);
    const { cellCount } = tallyByWeekday(container);
    // A month has 28–31 own-month cells. Zero would make every assertion below
    // trivially true — which is exactly the trap this whole ticket is about.
    expect(cellCount).toBeGreaterThanOrEqual(28);
  });

  it('leaves Mon/Thu/Sat bookable and disables every other weekday', () => {
    const { container } = renderPicker(MTS);
    const { tally } = tallyByWeekday(container);

    for (const open of ['monday', 'thursday', 'saturday']) {
      expect(tally[open]?.enabled ?? 0).toBeGreaterThan(0);
      expect(tally[open]?.disabled ?? 0).toBe(0);
    }
    for (const shut of ['sunday', 'tuesday', 'wednesday', 'friday']) {
      expect(tally[shut]?.disabled ?? 0).toBeGreaterThan(0);
      expect(tally[shut]?.enabled ?? 0).toBe(0);
    }
  });

  it('disables nothing when the tour declares no departure days', () => {
    const { container } = renderPicker(undefined);
    const { tally } = tallyByWeekday(container);
    for (const [, counts] of Object.entries(tally)) expect(counts.disabled).toBe(0);
  });

  it('a Tuesday is not clickable — the exact thing the copy promised', () => {
    // 2026-08-04 is a Tuesday. Before this change it was freely selectable.
    // Select by the day-of-month class: getByText('4') also matches 14 and 24.
    const { container } = renderPicker(MTS);
    const tuesday = container.querySelector('.react-datepicker__day--004');
    expect(tuesday).not.toBeNull();
    expect(tuesday!.getAttribute('aria-disabled')).toBe('true');

    // …and its neighbours behave the opposite way, so this is not just "all disabled".
    expect(container.querySelector('.react-datepicker__day--003')!.getAttribute('aria-disabled')).toBe('false'); // Mon
    expect(container.querySelector('.react-datepicker__day--006')!.getAttribute('aria-disabled')).toBe('false'); // Thu
  });
});
