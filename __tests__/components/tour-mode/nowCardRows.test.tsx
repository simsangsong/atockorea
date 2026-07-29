/**
 * SG-1b — the four-row grammar, rendered.
 *
 * The resolver suite already pins WHICH targets exist; this suite pins what
 * the card DOES with them: a numeral row exactly when a target came through,
 * the title dropping the time when the minutes carry it, the legacy format
 * surviving untouched when no target exists (the band's whole point), and
 * the announcer standing OUTSIDE the aria-atomic section.
 */
import { render, within } from '@testing-library/react';
import NowCard, { type NowCardHandlers } from '@/components/tour-mode/NowCard';
import { RoomClockProvider } from '@/components/tour-mode/roomClock';
import type { NowCardResult } from '@/lib/tour-room/nowCard';

const BASE = Date.UTC(2026, 6, 28, 3, 0, 0);
const MIN = 60_000;

const handlers: NowCardHandlers = {
  onCall: jest.fn(),
  onShareLocation: jest.fn(),
  onRouteBack: jest.fn(),
  onListen: jest.fn(),
  onMeetMeHere: jest.fn(),
  onOpenMap: jest.fn(),
  onOpenPlan: jest.fn(),
  onOpenTimeline: jest.fn(),
  onChip: jest.fn(),
};

const renderCard = (result: NowCardResult) =>
  render(
    <RoomClockProvider serverNowMs={BASE}>
      <NowCard result={result} locale="en" handlers={handlers} nowLabel="Now" />
    </RoomClockProvider>,
  );

let nowSpy: jest.SpyInstance<number, []>;
beforeEach(() => {
  nowSpy = jest.spyOn(Date, 'now').mockReturnValue(BASE);
});
afterEach(() => {
  nowSpy.mockRestore();
});

describe('NowCard four-row grammar (SG-1b)', () => {
  it('free time: eyebrow / ticking clock / place title / policy sub', () => {
    const { getByTestId, getByText } = renderCard({
      state: 'free_time',
      tone: 'warn',
      action: { kind: 'route_back' },
      chips: ['toilet', 'meeting_point'],
      data: {
        minutesLeft: 18,
        meetingPoint: 'Blue gate',
        freeTimeEndsAtMs: BASE + 18 * MIN + 41_000,
      },
    });
    const numeral = getByTestId('home-now-numeral');
    expect(numeral.textContent).toBe('18:41');
    expect(numeral).toHaveAttribute('aria-hidden', 'true');
    expect(getByText('Meet at Blue gate')).toBeInTheDocument();
    // E2 — the +15 policy line, pre-formatted time (12h in en).
    expect(getByText(/Waits until .*, then departs/)).toBeInTheDocument();
  });

  it('rally: overage counts up; sub carries the meeting point AND the wait-until', () => {
    const { getByTestId, getByText } = renderCard({
      state: 'rally_overdue',
      tone: 'danger',
      action: { kind: 'share_location' },
      chips: ['meeting_point'],
      data: { meetingPoint: 'Blue gate', rallyTargetMs: BASE - (4 * MIN + 12_000) },
    });
    expect(getByTestId('home-now-numeral').textContent).toBe('+04:12');
    expect(getByText(/Blue gate · Waits until/)).toBeInTheDocument();
  });

  it('moving with a target: minutes carry the time, the title is just the place', () => {
    const { container, getByTestId } = renderCard({
      state: 'moving',
      tone: 'base',
      action: { kind: 'open_map' },
      chips: ['next_stop'],
      data: {
        nextStopName: 'Seongsan Ilchulbong',
        nextStopTime: '12:07',
        nextStopTargetMs: BASE + 7 * MIN,
        currentStopName: 'Hamdeok beach',
      },
    });
    // Visible card only — the sr announcer DELIBERATELY keeps the legacy
    // "time · place" sentence for readers, so scope to the section.
    const card = within(container.querySelector('section[data-now-state]') as HTMLElement);
    expect(getByTestId('home-now-numeral').textContent).toBe('7 min');
    expect(card.getByText('Seongsan Ilchulbong')).toBeInTheDocument();
    expect(card.queryByText('12:07 · Seongsan Ilchulbong')).not.toBeInTheDocument();
    // The reassurance is a real state, and "now" survives the move to sub.
    expect(card.getByText(/Now · Hamdeok beach · Nothing to do — enjoy the ride/)).toBeInTheDocument();
  });

  it('moving WITHOUT a target keeps the legacy title format — the row vanishes, nothing else', () => {
    const { container, queryByTestId } = renderCard({
      state: 'moving',
      tone: 'base',
      action: { kind: 'open_map' },
      chips: ['next_stop'],
      data: { nextStopName: 'Seongsan Ilchulbong', nextStopTime: '≈ 12:00' },
    });
    const card = within(container.querySelector('section[data-now-state]') as HTMLElement);
    expect(queryByTestId('home-now-numeral')).not.toBeInTheDocument();
    expect(card.getByText('≈ 12:00 · Seongsan Ilchulbong')).toBeInTheDocument();
  });

  it('arrived with a notice target: minutes down + "yours until" sub', () => {
    const { getByTestId, getByText } = renderCard({
      state: 'arrived',
      tone: 'accent',
      action: { kind: 'listen' },
      chips: ['toilet', 'photo_spot'],
      data: { spotName: 'Seongsan Ilchulbong', meetingTargetMs: BASE + 40 * MIN },
    });
    expect(getByTestId('home-now-numeral').textContent).toBe('40 min');
    expect(getByText(/Yours until about/)).toBeInTheDocument();
  });

  it('the announcer is a SIBLING of the card, not inside its atomic region', () => {
    const { container, getByTestId } = renderCard({
      state: 'free_time',
      tone: 'warn',
      action: { kind: 'route_back' },
      chips: [],
      data: { minutesLeft: 18, freeTimeEndsAtMs: BASE + 18 * MIN },
    });
    const sr = getByTestId('home-now-sr');
    const section = container.querySelector('section[data-now-state]');
    expect(section).not.toBeNull();
    expect(section!.contains(sr)).toBe(false);
    // Entry announcement carries the minutes the numeral hid from the reader.
    expect(sr.textContent).toBe('18 min of free time left');
  });
});
