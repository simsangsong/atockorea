import { haptic } from '@/lib/admin/haptics';

describe('haptic (W1.6)', () => {
  const original = (navigator as Navigator & { vibrate?: unknown }).vibrate;

  afterEach(() => {
    Object.defineProperty(navigator, 'vibrate', {
      value: original,
      configurable: true,
      writable: true,
    });
  });

  function setVibrate(fn: unknown) {
    Object.defineProperty(navigator, 'vibrate', { value: fn, configurable: true, writable: true });
  }

  it('calls navigator.vibrate with the level pattern', () => {
    const spy = jest.fn();
    setVibrate(spy);
    haptic('light');
    expect(spy).toHaveBeenCalledWith(10);
    haptic('medium');
    expect(spy).toHaveBeenCalledWith(20);
    haptic('heavy');
    expect(spy).toHaveBeenCalledWith([28, 18, 28]);
  });

  it('defaults to light', () => {
    const spy = jest.fn();
    setVibrate(spy);
    haptic();
    expect(spy).toHaveBeenCalledWith(10);
  });

  it('is a no-op (no throw) when vibrate is unavailable', () => {
    setVibrate(undefined);
    expect(() => haptic('heavy')).not.toThrow();
  });

  it('never throws even if vibrate throws (iOS-style refusal)', () => {
    setVibrate(() => {
      throw new Error('blocked');
    });
    expect(() => haptic('light')).not.toThrow();
  });
});
