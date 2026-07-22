/**
 * @jest-environment node
 *
 * POI arrival videos — client-safe locale pick + meta guard (video W3 / J4).
 */
import {
  formatVideoDuration,
  isVideoCardMeta,
  pickVideoUrl,
  VIDEO_LANGUAGE_TO_ROOM_LOCALE,
  type ArrivalVideoCardMeta,
} from '@/lib/tour-room/poiVideos';

const CARD: ArrivalVideoCardMeta = {
  poster_url: 'https://cdn/poster.png',
  duration_seconds: 64.2,
  urls: { en: 'https://cdn/en.mp4', ja: 'https://cdn/ja.mp4', zh: 'https://cdn/zh.mp4', es: 'https://cdn/es.mp4' },
};

describe('pickVideoUrl', () => {
  it('serves the viewer locale when available', () => {
    expect(pickVideoUrl(CARD, 'ja')).toBe('https://cdn/ja.mp4');
    expect(pickVideoUrl(CARD, 'zh')).toBe('https://cdn/zh.mp4');
  });

  it('Korean viewers fall back to English (no ko renders exist, VP-D3)', () => {
    expect(pickVideoUrl(CARD, 'ko')).toBe('https://cdn/en.mp4');
  });

  it('falls back to any language when English is missing too', () => {
    expect(pickVideoUrl({ ...CARD, urls: { ja: 'https://cdn/ja.mp4' } }, 'ko')).toBe('https://cdn/ja.mp4');
  });

  it('returns null for an empty card', () => {
    expect(pickVideoUrl({ poster_url: null, duration_seconds: null, urls: {} }, 'en')).toBeNull();
  });
});

describe('isVideoCardMeta', () => {
  it('accepts a card with at least one URL and rejects junk', () => {
    expect(isVideoCardMeta(CARD)).toBe(true);
    expect(isVideoCardMeta(null)).toBe(false);
    expect(isVideoCardMeta({})).toBe(false);
    expect(isVideoCardMeta({ urls: {} })).toBe(false);
    expect(isVideoCardMeta('https://cdn/en.mp4')).toBe(false);
  });
});

describe('formatVideoDuration', () => {
  it('renders mm:ss and rejects junk', () => {
    expect(formatVideoDuration(64.2)).toBe('1:04');
    expect(formatVideoDuration(59)).toBe('0:59');
    expect(formatVideoDuration(0)).toBeNull();
    expect(formatVideoDuration(null)).toBeNull();
    expect(formatVideoDuration(Number.NaN)).toBeNull();
  });
});

describe('VIDEO_LANGUAGE_TO_ROOM_LOCALE', () => {
  it('maps every pipeline language to a room locale (zh-Hant → zh)', () => {
    expect(VIDEO_LANGUAGE_TO_ROOM_LOCALE['zh-Hant']).toBe('zh');
    expect(VIDEO_LANGUAGE_TO_ROOM_LOCALE.en).toBe('en');
    expect(VIDEO_LANGUAGE_TO_ROOM_LOCALE.ja).toBe('ja');
    expect(VIDEO_LANGUAGE_TO_ROOM_LOCALE.es).toBe('es');
  });
});
