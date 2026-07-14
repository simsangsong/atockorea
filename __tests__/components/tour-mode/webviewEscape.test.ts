/**
 * T1.11 ⑤ — in-app webview UA detection.
 */
import { isInAppWebview } from '@/components/tour-mode/WebviewEscapeBanner';

describe('isInAppWebview', () => {
  it.each([
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0) AppleWebKit/605.1.15 KAKAOTALK 10.4.5', true],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Instagram 320.0.0.0', true],
    ['Mozilla/5.0 (iPhone) AppleWebKit [FBAN/FBIOS;FBAV/450.0.0.0]', true],
    ['Mozilla/5.0 (iPhone) AppleWebKit Line/14.0.0', true],
    ['Mozilla/5.0 (Linux; Android 14; SM-S911N Build/UP1A; wv) AppleWebKit/537.36', true],
    ['Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1', false],
    ['Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36', false],
  ])('%s → %s', (ua, expected) => {
    expect(isInAppWebview(ua)).toBe(expected);
  });
});
