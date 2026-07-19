/**
 * Plan §G tab ① — mapping the booked tour's itinerary stops into wish-list
 * editor stops: duration parsing, poi_key snapping (coords for feasibility),
 * and the plain 'free' fallback for stops without a curated POI.
 */
import type { ItineraryStop } from '@/components/product-tour-static/_shared/tourProductDetailSectionTypes';
import { parseDurationMin, tourStopToEditorStop } from '@/lib/tour-room/planTourStops';

describe('parseDurationMin', () => {
  it.each([
    ['1h', 60],
    ['90 min', 90],
    ['1.5h', 90],
    ['1시간', 60],
    ['1시간 30분', 90],
    ['45', 45],
  ])('parses %s → %s', (raw, expected) => {
    expect(parseDurationMin(raw)).toBe(expected);
  });

  it('returns null for empty / unparseable input', () => {
    expect(parseDurationMin(undefined)).toBeNull();
    expect(parseDurationMin('')).toBeNull();
    expect(parseDurationMin('a while')).toBeNull();
  });
});

describe('tourStopToEditorStop', () => {
  const base: ItineraryStop = { number: 3, name: 'Gamcheon Culture Village' };

  it('snaps a poi_key stop to the curated POI coords + carries time/duration', () => {
    const stop: ItineraryStop = {
      ...base,
      time: '9:30',
      duration: '1h',
      _poi_meta: { poi_key: 'gamcheon' },
    };
    const poi = { default_stay_minutes: 45, lat: 35.1, lng: 129.0 };
    const editor = tourStopToEditorStop(stop, poi, 0);
    expect(editor.source).toBe('poi');
    expect(editor.poi_key).toBe('gamcheon');
    expect(editor.title).toBe('Gamcheon Culture Village');
    expect(editor.arrival_planned).toBe('09:30'); // zero-padded HH:MM
    expect(editor.duration_min).toBe(60); // stop duration wins over poi default
    expect(editor.lat).toBe(35.1);
    expect(editor.lng).toBe(129.0);
  });

  it('falls back to the POI default stay when the stop has no duration', () => {
    const stop: ItineraryStop = { ...base, _poi_meta: { poi_key: 'gamcheon' } };
    const editor = tourStopToEditorStop(stop, { default_stay_minutes: 50, lat: 1, lng: 2 }, 0);
    expect(editor.duration_min).toBe(50);
  });

  it('makes a plain free stop when there is no poi_key', () => {
    const stop: ItineraryStop = { ...base, time: 'around 10', duration: '2h' };
    const editor = tourStopToEditorStop(stop, undefined, 1);
    expect(editor.source).toBe('free');
    expect(editor.poi_key).toBeNull();
    expect(editor.arrival_planned).toBeNull(); // "around 10" isn't a clock
    expect(editor.duration_min).toBe(120);
    expect(editor.lat).toBeNull();
  });
});
