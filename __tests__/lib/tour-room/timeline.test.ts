/**
 * V4 — travel timeline aggregation core: arrivals de-dupe by spot, photos
 * collect shared vision answers, and completion needs both a stop and a photo.
 */
import {
  buildTravelTimeline,
  hasTimelineContent,
  TIMELINE_MIN_PHOTOS,
  TIMELINE_MIN_STOPS,
} from '@/lib/tour-room/timeline';
import type { RoomMessage } from '@/hooks/useTourRoomChannel';

const arrival = (id: string, spot: string, at: string): RoomMessage => ({
  id,
  sender_role: 'system',
  source_text: `arrived at ${spot}`,
  created_at: at,
  metadata: { kind: 'spot_arrival', spot_title: spot },
});

const photo = (id: string, url: string, at: string, caption = 'nice'): RoomMessage => ({
  id,
  sender_role: 'system',
  source_text: caption,
  created_at: at,
  metadata: { kind: 'vision_answer', image_url: url },
});

const chat = (id: string, at: string): RoomMessage => ({
  id,
  sender_role: 'customer',
  source_text: 'hi',
  created_at: at,
});

describe('buildTravelTimeline (V4)', () => {
  it('orders stops chronologically and de-dupes re-entered geofences', () => {
    const data = buildTravelTimeline([
      arrival('a2', 'Osulloc', '2099-07-20T05:00:00Z'),
      arrival('a1', 'Jusangjeolli', '2099-07-20T03:00:00Z'),
      arrival('a3', 'Jusangjeolli', '2099-07-20T06:00:00Z'), // re-entry, ignored
    ]);
    expect(data.stops.map((s) => s.title)).toEqual(['Jusangjeolli', 'Osulloc']);
    expect(data.stopCount).toBe(2);
  });

  it('collects only shared vision answers that carried an image', () => {
    const data = buildTravelTimeline([
      photo('p1', 'https://cdn/x.jpg', '2099-07-20T04:00:00Z'),
      { id: 'p2', sender_role: 'system', source_text: 'no image', created_at: '2099-07-20T04:30:00Z', metadata: { kind: 'vision_answer' } },
      chat('c1', '2099-07-20T04:40:00Z'),
    ]);
    expect(data.photoCount).toBe(1);
    expect(data.photos[0].url).toBe('https://cdn/x.jpg');
  });

  it('is complete only with at least one stop AND one photo', () => {
    expect(buildTravelTimeline([arrival('a1', 'X', '2099-07-20T03:00:00Z')]).complete).toBe(false);
    expect(buildTravelTimeline([photo('p1', 'https://cdn/x.jpg', '2099-07-20T03:00:00Z')]).complete).toBe(false);
    expect(
      buildTravelTimeline([
        arrival('a1', 'X', '2099-07-20T03:00:00Z'),
        photo('p1', 'https://cdn/x.jpg', '2099-07-20T04:00:00Z'),
      ]).complete,
    ).toBe(true);
  });

  it('exposes the tunable thresholds', () => {
    expect(TIMELINE_MIN_STOPS).toBeGreaterThanOrEqual(1);
    expect(TIMELINE_MIN_PHOTOS).toBeGreaterThanOrEqual(1);
  });

  it('empty feed yields an empty, incomplete timeline', () => {
    const data = buildTravelTimeline([chat('c1', '2099-07-20T03:00:00Z')]);
    expect(data.stopCount).toBe(0);
    expect(data.photoCount).toBe(0);
    expect(data.complete).toBe(false);
  });
});

describe('hasTimelineContent', () => {
  it('detects arrivals or imaged vision answers', () => {
    expect(hasTimelineContent([chat('c1', '2099-07-20T03:00:00Z')])).toBe(false);
    expect(hasTimelineContent([arrival('a1', 'X', '2099-07-20T03:00:00Z')])).toBe(true);
    expect(hasTimelineContent([photo('p1', 'https://cdn/x.jpg', '2099-07-20T03:00:00Z')])).toBe(true);
  });
});
