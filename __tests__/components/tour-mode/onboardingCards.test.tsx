/**
 * SG-7b — the D-1 onboarding. Pinned: once per booking, the three-step
 * walk, and the demo's whole contract — a REAL pre-translated driver
 * preset rendered locally with ZERO network (SG-D14: a real send at D-1
 * evening would page a driver at dinner).
 */
import { fireEvent, render } from '@testing-library/react';
import OnboardingCards from '@/components/tour-mode/OnboardingCards';

beforeEach(() => {
  window.localStorage.clear();
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('OnboardingCards', () => {
  it('walks three steps, demoes a LOCAL echo with zero network, then remembers', () => {
    const { getByTestId, getByText } = render(
      <OnboardingCards bookingId="b1" locale="en" driverName="김민수" />,
    );
    expect(getByText(/doesn’t speak English/)).toBeInTheDocument();
    expect(getByText(/like 김민수/)).toBeInTheDocument();

    fireEvent.click(getByTestId('onboard-next'));
    fireEvent.click(getByTestId('onboard-demo-chip'));
    // A real driver preset, in the guest's locale, no request behind it.
    expect(getByTestId('onboard-demo-echo').textContent?.length).toBeGreaterThan(4);
    expect(global.fetch).not.toHaveBeenCalled();

    fireEvent.click(getByTestId('onboard-next'));
    fireEvent.click(getByTestId('onboard-next')); // 'Got it' closes
    expect(window.localStorage.getItem('tr-onboard:b1')).toBe('1');
  });

  it('never re-opens once seen', () => {
    window.localStorage.setItem('tr-onboard:b1', '1');
    const { queryByTestId } = render(<OnboardingCards bookingId="b1" locale="ko" />);
    expect(queryByTestId('onboarding')).not.toBeInTheDocument();
  });
});
