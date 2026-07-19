/**
 * Live-caption tier detection — Web Speech only where it actually works.
 *
 * Regression: Samsung Internet exposes webkitSpeechRecognition but never yields
 * results, so the guide's "실시간 자막 방송" would spin silently and deliver
 * nothing. It must fall back to the chunked-audio (server STT) tier.
 */
jest.mock('@/lib/tour-room/recorder', () => ({
  pickRecorderMimeType: jest.fn(() => 'audio/webm'),
}));

import { detectCaptionTier } from '@/lib/tour-room/captionCapture';

const CHROME_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36';
const SAMSUNG_UA = 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 SamsungBrowser/25.0 Chrome/121 Mobile Safari/537.36';

const w = window as unknown as { webkitSpeechRecognition?: unknown; SpeechRecognition?: unknown };

function setUA(ua: string) {
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: ua });
}

beforeEach(() => {
  w.webkitSpeechRecognition = function () {};
  delete w.SpeechRecognition;
  (global as unknown as { MediaRecorder: unknown }).MediaRecorder = function () {};
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { getUserMedia: () => Promise.resolve({}) },
  });
});

describe('detectCaptionTier', () => {
  it('uses Web Speech on Chrome/Android where it works', () => {
    setUA(CHROME_UA);
    expect(detectCaptionTier()).toBe('web-speech');
  });

  it('falls back to chunked-audio on Samsung Internet (broken Web Speech)', () => {
    setUA(SAMSUNG_UA);
    expect(detectCaptionTier()).toBe('chunked-audio');
  });

  it('reports unsupported on Samsung when no recorder is available either', () => {
    setUA(SAMSUNG_UA);
    delete (global as unknown as { MediaRecorder?: unknown }).MediaRecorder;
    expect(detectCaptionTier()).toBe('unsupported');
  });
});
