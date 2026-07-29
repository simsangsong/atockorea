/**
 * X17 — sharing the day.
 *
 * The interesting assertions here are not about formatting. They are the two
 * things that would be quietly wrong:
 *
 *   · a shared message must never carry a photo URL — those are short-lived
 *     SIGNED URLs into a private bucket now, so one pasted into a group chat is
 *     a capability leak that also 404s by tomorrow;
 *   · the link must follow the OTA inducement policy that already exists,
 *     rather than a second copy of that rule which will drift from the first.
 */

import { resolveReviewPolicy } from '@/lib/tour-room/reviewPolicy';
import {
  SHARE_MAX_STOPS,
  buildTimelineShareText,
  shareTimelineText,
  timelineShareHref,
  type ShareCopy,
} from '@/lib/tour-room/timelineShare';
import { TIMELINE_COPY } from '@/lib/tour-room/timeline';
import type { TravelTimelineData } from '@/lib/tour-room/timeline';

const copy: ShareCopy = TIMELINE_COPY.en;
const formatTime = (iso: string) => (iso ? iso.slice(11, 16) : '');

function data(over: Partial<TravelTimelineData> = {}): TravelTimelineData {
  const stops = over.stops ?? [
    { id: 's1', title: 'Seongsan Ilchulbong', at: '2026-07-29T00:20:00.000Z' },
    { id: 's2', title: 'Hyeopjae Beach', at: '2026-07-29T03:05:00.000Z' },
  ];
  const photos = over.photos ?? [
    { id: 'p1', url: 'https://sig.test/tour-room-photos/vision/r1/a.jpg?token=SECRET', caption: null, at: '' },
  ];
  return {
    stops,
    photos,
    stopCount: stops.length,
    photoCount: photos.length,
    complete: true,
    ...over,
  } as TravelTimelineData;
}

describe('🔴 the shared text never carries a photo URL', () => {
  it('omits signed photo URLs entirely', () => {
    const text = buildTimelineShareText({
      data: data(),
      copy,
      tourTitle: 'Jeju Grand Highlights',
      href: 'https://atockorea.com/tour-product/jeju-grand-highlights-loop',
      formatTime,
    });
    expect(text).not.toContain('sig.test');
    expect(text).not.toContain('token=');
    expect(text).not.toContain('tour-room-photos');
    // It still says there were photos — the count is safe, the URL is not.
    expect(text).toContain('1 photo along the way');
  });
});

describe('🔴 the link obeys the OTA inducement policy', () => {
  it('a direct booking shares our own tour page', () => {
    const policy = resolveReviewPolicy({ source: 'direct', tourSlug: 'jeju-grand-highlights-loop' });
    const href = timelineShareHref(policy, 'https://atockorea.com');
    expect(href).toBe('https://atockorea.com/tour-product/jeju-grand-highlights-loop');
    // The review anchor is stripped: a friend who has not travelled yet should
    // land on the tour, not on its review section.
    expect(href).not.toContain('#');
  });

  it('an OTA booking shares that OTA’s listing, not ours', () => {
    const policy = resolveReviewPolicy({
      source: 'klook',
      tourSlug: 'jeju-grand-highlights-loop',
      otaListingUrl: 'https://www.klook.com/activity/12345',
    });
    const href = timelineShareHref(policy, 'https://atockorea.com');
    expect(href).toBe('https://www.klook.com/activity/12345');
    expect(href).not.toContain('atockorea.com');
  });

  it('an OTA booking with no known listing shares NO link at all', () => {
    const policy = resolveReviewPolicy({ source: 'getyourguide', tourSlug: 'jeju-grand-highlights-loop' });
    expect(timelineShareHref(policy, 'https://atockorea.com')).toBeNull();
  });

  it('an unknown source is treated as OTA — the failure direction stays safe', () => {
    const policy = resolveReviewPolicy({ source: 'some-new-reseller', tourSlug: 'x' });
    const href = timelineShareHref(policy, 'https://atockorea.com');
    expect(href).toBeNull();
  });

  it('omits the link line entirely when there is no link', () => {
    const text = buildTimelineShareText({ data: data(), copy, tourTitle: 'X', href: null, formatTime });
    expect(text).not.toContain(copy.shareLinkLead);
    expect(text).not.toContain('http');
    // But the recap still works — an OTA guest can show a friend their day.
    expect(text).toContain('Seongsan Ilchulbong');
  });
});

describe('the message reads like something a person would send', () => {
  it('lists stops in order with their times', () => {
    const text = buildTimelineShareText({ data: data(), copy, tourTitle: null, href: null, formatTime });
    expect(text.indexOf('Seongsan Ilchulbong')).toBeLessThan(text.indexOf('Hyeopjae Beach'));
    expect(text).toContain('00:20  Seongsan Ilchulbong');
  });

  it('names the tour when the room knows it', () => {
    const text = buildTimelineShareText({
      data: data(),
      copy,
      tourTitle: 'Jeju Grand Highlights',
      href: null,
      formatTime,
    });
    expect(text.split('\n')[0]).toContain('Jeju Grand Highlights');
  });

  it('summarises rather than pasting a twenty-line list', () => {
    const many = Array.from({ length: SHARE_MAX_STOPS + 3 }, (_, i) => ({
      id: `s${i}`,
      title: `Stop ${i}`,
      at: '2026-07-29T00:00:00.000Z',
    }));
    const text = buildTimelineShareText({
      data: data({ stops: many, stopCount: many.length }),
      copy,
      tourTitle: null,
      href: null,
      formatTime,
    });
    expect(text).toContain('+3 more');
    expect(text).not.toContain(`Stop ${SHARE_MAX_STOPS}`);
  });

  it('is plain text — a chat app renders markdown as literal asterisks', () => {
    const text = buildTimelineShareText({ data: data(), copy, tourTitle: 'T', href: null, formatTime });
    expect(text).not.toMatch(/\*\*|^#|\[.+\]\(.+\)/m);
  });

  it('drops the photo line when there are none', () => {
    const text = buildTimelineShareText({
      data: data({ photos: [], photoCount: 0 }),
      copy,
      tourTitle: null,
      href: null,
      formatTime,
    });
    expect(text).not.toContain('along the way');
  });
});

describe('shareTimelineText falls back honestly', () => {
  const payload = { title: 'T', text: 'body' };

  it('uses the OS share sheet when there is one', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    await expect(shareTimelineText({ share }, payload)).resolves.toBe('shared');
    expect(share).toHaveBeenCalledWith({ title: 'T', text: 'body' });
  });

  /**
   * A cancelled share is the guest changing their mind, not a failure. Telling
   * them "copied" afterwards would be a lie about where their words went.
   */
  it('treats a cancelled share as shared, not as a failure', async () => {
    const abort = Object.assign(new Error('cancel'), { name: 'AbortError' });
    const writeText = jest.fn();
    const share = jest.fn().mockRejectedValue(abort);
    await expect(shareTimelineText({ share, clipboard: { writeText } }, payload)).resolves.toBe('shared');
    expect(writeText).not.toHaveBeenCalled();
  });

  it('falls back to the clipboard when share() rejects for another reason', async () => {
    const share = jest.fn().mockRejectedValue(new Error('not allowed'));
    const writeText = jest.fn().mockResolvedValue(undefined);
    await expect(shareTimelineText({ share, clipboard: { writeText } }, payload)).resolves.toBe('copied');
    expect(writeText).toHaveBeenCalledWith('body');
  });

  it('uses the clipboard when there is no share sheet at all (desktop)', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    await expect(shareTimelineText({ clipboard: { writeText } }, payload)).resolves.toBe('copied');
  });

  it('reports unavailable rather than pretending, when neither works', async () => {
    await expect(shareTimelineText({}, payload)).resolves.toBe('unavailable');
    await expect(shareTimelineText(undefined, payload)).resolves.toBe('unavailable');
  });
});

describe('every locale can share', () => {
  const LOCALES = ['en', 'ko', 'ja', 'es', 'zh', 'zh-TW', 'fr', 'de', 'ru', 'it'] as const;

  it.each(LOCALES)('locale %s has all share copy, non-empty and its own', (locale) => {
    const c = TIMELINE_COPY[locale];
    for (const key of ['shareCta', 'shareIntro', 'shareLinkLead', 'shareCopied', 'shareUnavailable'] as const) {
      expect(typeof c[key]).toBe('string');
      expect(String(c[key]).trim().length).toBeGreaterThan(0);
    }
    expect(typeof c.sharePhotos(2)).toBe('string');
    expect(c.sharePhotos(2)).toContain('2');
    expect(c.shareMoreStops(3)).toContain('3');
    if (locale !== 'en') {
      expect(c.shareCta).not.toBe(TIMELINE_COPY.en.shareCta);
    }
  });
});
