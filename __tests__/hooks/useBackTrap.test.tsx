/**
 * R2 — the hardware back trap. One press must never close the installed PWA:
 * it arms a sentinel history entry, hands the press to the caller, and re-arms
 * unless the caller is deliberately navigating away.
 */
import { render } from '@testing-library/react';
import { act } from 'react';
import { useBackTrap, type BackTrapResult } from '@/hooks/useBackTrap';

function Harness({ onBack, enabled }: { onBack: () => BackTrapResult; enabled?: boolean }) {
  useBackTrap(onBack, enabled);
  return <div />;
}

const popstate = () => act(() => void window.dispatchEvent(new PopStateEvent('popstate')));

describe('useBackTrap', () => {
  let pushSpy: jest.SpyInstance;

  beforeEach(() => {
    pushSpy = jest.spyOn(window.history, 'pushState').mockImplementation(() => {});
  });
  afterEach(() => pushSpy.mockRestore());

  it('arms one sentinel entry on mount', () => {
    render(<Harness onBack={() => 'noop'} />);
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it("re-arms after a consumed press ('stayed') so the NEXT press is trapped too", () => {
    const onBack = jest.fn(() => 'stayed' as BackTrapResult);
    render(<Harness onBack={onBack} />);
    popstate();
    popstate();
    expect(onBack).toHaveBeenCalledTimes(2);
    // 1 mount + 2 re-arms
    expect(pushSpy).toHaveBeenCalledTimes(3);
  });

  it("re-arms on 'noop' too — a guest at the root stays in the app instead of quitting", () => {
    render(<Harness onBack={() => 'noop'} />);
    popstate();
    expect(pushSpy).toHaveBeenCalledTimes(2);
  });

  it("does NOT re-arm on 'exit' (the caller navigates)", () => {
    render(<Harness onBack={() => 'exit'} />);
    popstate();
    expect(pushSpy).toHaveBeenCalledTimes(1);
  });

  it('always calls the LATEST handler (fresh state, listener registered once)', () => {
    const first = jest.fn(() => 'stayed' as BackTrapResult);
    const second = jest.fn(() => 'stayed' as BackTrapResult);
    const { rerender } = render(<Harness onBack={first} />);
    rerender(<Harness onBack={second} />);
    popstate();
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('does nothing when disabled', () => {
    const onBack = jest.fn(() => 'stayed' as BackTrapResult);
    render(<Harness onBack={onBack} enabled={false} />);
    popstate();
    expect(pushSpy).not.toHaveBeenCalled();
    expect(onBack).not.toHaveBeenCalled();
  });
});
