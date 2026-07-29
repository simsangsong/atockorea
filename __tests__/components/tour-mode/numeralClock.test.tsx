/**
 * SG-0b — NumeralClock: the one ticking-time implementation.
 *
 * What is pinned here and why:
 * - formatNumeral idiom (MM:SS padded / H:MM:SS / +MM:SS / ceil-minutes):
 *   the digits are the hero row's entire content, so the format IS the API.
 * - Adaptive tick (SG-D3): fine seconds only inside the last ten minutes —
 *   NoticeBanner A1.2 already priced an always-on 1s tick and rejected it.
 * - SSR determinism: the first render must derive from initialNowMs alone.
 *   A Date.now() in the render path is the PR #335 hydration bug reborn.
 * - Visible-only: a hidden tab gets no interval at all, and the value
 *   resyncs the instant the tab returns.
 */
import { act, render } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import NumeralClock, {
  formatNumeral,
  numeralTickMs,
} from '@/components/tour-mode/NumeralClock';

const BASE = Date.UTC(2026, 6, 30, 1, 0, 0); // arbitrary fixed anchor
const MIN = 60_000;

const setVisibility = (state: 'visible' | 'hidden') => {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  act(() => {
    document.dispatchEvent(new Event('visibilitychange'));
  });
};

afterEach(() => {
  setVisibility('visible');
  jest.useRealTimers();
});

describe('formatNumeral', () => {
  it('renders MM:SS with padded minutes under an hour (the +04:12 idiom)', () => {
    expect(formatNumeral('down', 'clock', BASE + 4 * MIN + 12_000, BASE)).toBe('04:12');
    expect(formatNumeral('down', 'clock', BASE + 18 * MIN + 41_000, BASE)).toBe('18:41');
  });

  it('renders H:MM:SS above an hour, hours unpadded', () => {
    expect(formatNumeral('down', 'clock', BASE + 72 * MIN + 8_000, BASE)).toBe('1:12:08');
  });

  it('prefixes + in count-up mode', () => {
    expect(formatNumeral('up', 'clock', BASE, BASE + 4 * MIN + 12_000)).toBe('+04:12');
  });

  it('clamps at zero instead of going negative', () => {
    expect(formatNumeral('down', 'clock', BASE, BASE + 5_000)).toBe('00:00');
    expect(formatNumeral('up', 'clock', BASE + 5_000, BASE)).toBe('+00:00');
  });

  it('minutes format ceils and appends the unit label verbatim', () => {
    expect(formatNumeral('down', 'minutes', BASE + 6 * MIN + 1_000, BASE, '분')).toBe('7분');
    expect(formatNumeral('down', 'minutes', BASE + 7 * MIN, BASE, ' min')).toBe('7 min');
    expect(formatNumeral('down', 'minutes', BASE, BASE + MIN, '분')).toBe('0분');
  });
});

describe('numeralTickMs (SG-D3 adaptive tick)', () => {
  it('is coarse outside the ten-minute window, fine inside', () => {
    expect(numeralTickMs('down', 'clock', BASE + 20 * MIN, BASE)).toBe(30_000);
    expect(numeralTickMs('down', 'clock', BASE + 9 * MIN, BASE)).toBe(1_000);
  });

  it('count-up is always fine; minutes format is always coarse', () => {
    expect(numeralTickMs('up', 'clock', BASE, BASE + 20 * MIN)).toBe(1_000);
    expect(numeralTickMs('down', 'minutes', BASE + 5 * MIN, BASE)).toBe(30_000);
  });
});

describe('<NumeralClock />', () => {
  it('SSR renders from initialNowMs alone — never the device clock', () => {
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(BASE + 4 * MIN);
    try {
      const html = renderToString(
        <NumeralClock mode="down" format="clock" targetMs={BASE + 5 * MIN} initialNowMs={BASE} />,
      );
      // 05:00 (from initialNowMs), NOT 01:00 (from the mocked device clock).
      expect(html).toContain('05:00');
      expect(html).not.toContain('01:00');
    } finally {
      nowSpy.mockRestore();
    }
  });

  it('is aria-hidden and speaks the numeral rung classes', () => {
    const { getByTestId } = render(
      <NumeralClock
        mode="down"
        format="clock"
        targetMs={BASE + 5 * MIN}
        initialNowMs={BASE}
        nowMs={() => BASE}
        testId="clock"
      />,
    );
    const el = getByTestId('clock');
    expect(el).toHaveAttribute('aria-hidden', 'true');
    expect(el.className).toContain('tr-numeral');
    expect(el.className).toContain('tr-num');
  });

  it('ticks coarsely outside the fine window, finely inside it', () => {
    jest.useFakeTimers();
    let t = BASE;
    const clock = () => t;

    const far = render(
      <NumeralClock
        mode="down"
        format="clock"
        targetMs={BASE + 20 * MIN}
        initialNowMs={BASE}
        nowMs={clock}
        testId="far"
      />,
    );
    expect(far.getByTestId('far').textContent).toBe('20:00');
    t += 1_000;
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(far.getByTestId('far').textContent).toBe('20:00'); // no 1s tick out here
    t += 29_000;
    act(() => {
      jest.advanceTimersByTime(29_000);
    });
    expect(far.getByTestId('far').textContent).toBe('19:30');
    far.unmount();

    t = BASE;
    const near = render(
      <NumeralClock
        mode="down"
        format="clock"
        targetMs={BASE + 5 * MIN}
        initialNowMs={BASE}
        nowMs={clock}
        testId="near"
      />,
    );
    t += 1_000;
    act(() => {
      jest.advanceTimersByTime(1_000);
    });
    expect(near.getByTestId('near').textContent).toBe('04:59');
  });

  it('tears the interval down while hidden and resyncs on return', () => {
    jest.useFakeTimers();
    let t = BASE;
    const clock = () => t;
    const { getByTestId } = render(
      <NumeralClock
        mode="down"
        format="clock"
        targetMs={BASE + 5 * MIN}
        initialNowMs={BASE}
        nowMs={clock}
        testId="clock"
      />,
    );
    setVisibility('hidden');
    t += 60_000;
    act(() => {
      jest.advanceTimersByTime(60_000);
    });
    expect(getByTestId('clock').textContent).toBe('05:00'); // frozen while hidden
    setVisibility('visible');
    expect(getByTestId('clock').textContent).toBe('04:00'); // instant resync
  });
});
