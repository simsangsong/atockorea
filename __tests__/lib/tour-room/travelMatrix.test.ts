/**
 * X18 — the leg builder, now that it is a function instead of a cron body.
 *
 * The interesting decision here is WHICH arrivals count, and until this module
 * existed that decision could only be exercised by running a weekly cron
 * against live data. These are the cases that decide whether the matrix learns
 * a real drive time or a fiction.
 */
import {
  buildLegSamples,
  daypartOf,
  mergeArrivals,
  nextRunningMean,
  DEFAULT_STAY_MIN,
  type ArrivalPoint,
} from '@/lib/tour-room/travelMatrix';

const at = (hhmmKst: string) => {
  const [h, m] = hhmmKst.split(':').map(Number);
  // KST is UTC+9; build the UTC instant that reads as this KST wall clock.
  return new Date(Date.UTC(2026, 6, 29, h - 9, m)).toISOString();
};

const point = (
  roomId: string,
  kst: string,
  poiKey: string,
  source: 'manual' | 'geofence' = 'manual',
): ArrivalPoint => ({ roomId, at: at(kst), poiKey, source });

describe('daypartOf (KST)', () => {
  it('splits the day the way traffic does', () => {
    expect(daypartOf(at('09:00'))).toBe('am');
    expect(daypartOf(at('12:30'))).toBe('midday');
    expect(daypartOf(at('16:00'))).toBe('pm');
    expect(daypartOf(at('19:30'))).toBe('evening');
  });
});

describe('mergeArrivals', () => {
  /**
   * 🔴 The point of X18. Two tables record arrivals — the guide's tap and the
   * geofence — and reading one of them is why the matrix stayed empty. A room
   * that produced some of each must still yield correct consecutive legs.
   */
  it('interleaves both sources into one per-room timeline', () => {
    const merged = mergeArrivals(
      [point('r1', '09:00', 'a', 'manual')],
      [point('r1', '10:30', 'b', 'geofence'), point('r1', '13:00', 'c', 'geofence')],
    );
    expect(merged.get('r1')!.map((p) => p.poiKey)).toEqual(['a', 'b', 'c']);
  });

  it('keeps rooms apart', () => {
    const merged = mergeArrivals([point('r1', '09:00', 'a')], [point('r2', '09:30', 'b', 'geofence')]);
    expect([...merged.keys()].sort()).toEqual(['r1', 'r2']);
  });

  it('drops points with no key, no room or no time', () => {
    const merged = mergeArrivals([
      { roomId: 'r1', at: at('09:00'), poiKey: '', source: 'manual' },
      { roomId: '', at: at('09:00'), poiKey: 'a', source: 'manual' },
      { roomId: 'r1', at: '', poiKey: 'a', source: 'manual' },
    ]);
    expect(merged.size).toBe(0);
  });
});

describe('buildLegSamples', () => {
  const stays = new Map<string, number>();

  it('turns a gap minus the planned stay into a drive time', () => {
    // 09:00 arrive A, 11:30 arrive B → 150 min gap, 60 min planned stay → 90.
    const legs = buildLegSamples(
      mergeArrivals([point('r1', '09:00', 'a'), point('r1', '11:30', 'b')]),
      new Map([['a', 60]]),
    );
    expect(legs).toEqual([{ from: 'a', to: 'b', daypart: 'am', minutes: 90 }]);
  });

  it('falls back to the default stay when the plan does not say', () => {
    const legs = buildLegSamples(
      mergeArrivals([point('r1', '09:00', 'a'), point('r1', '10:30', 'b')]),
      stays,
    );
    expect(legs[0].minutes).toBe(90 - DEFAULT_STAY_MIN);
  });

  /**
   * 🔴 The collapse that matters now that there are two sources: a geofence
   * fires on arrival and the guide taps 도착 for the SAME stop a few minutes
   * later. Without this the matrix would learn a zero-distance "drive".
   */
  it('collapses a geofence and a manual tap at the same stop', () => {
    const legs = buildLegSamples(
      mergeArrivals(
        [point('r1', '09:05', 'a', 'manual'), point('r1', '11:30', 'b', 'manual')],
        [point('r1', '09:00', 'a', 'geofence')],
      ),
      new Map([['a', 60]]),
    );
    expect(legs).toHaveLength(1);
    expect(legs[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  it('drops legs outside the believable band', () => {
    // 5 min gap − 60 min stay → negative; and a 10-hour gap is not a drive.
    const tooShort = buildLegSamples(
      mergeArrivals([point('r1', '09:00', 'a'), point('r1', '09:05', 'b')]),
      stays,
    );
    const tooLong = buildLegSamples(
      mergeArrivals([point('r1', '08:00', 'a'), point('r1', '18:00', 'b')]),
      stays,
    );
    expect(tooShort).toEqual([]);
    expect(tooLong).toEqual([]);
  });

  it('stamps the daypart of the DEPARTURE, not the arrival', () => {
    // Leaving A in the morning and reaching B after 14:00 is an `am` leg:
    // the traffic that shaped it is the traffic you left in.
    const legs = buildLegSamples(
      mergeArrivals([point('r1', '10:00', 'a'), point('r1', '14:30', 'b')]),
      new Map([['a', 180]]),
    );
    expect(legs[0].daypart).toBe('am');
  });

  it('never builds a leg across two different rooms', () => {
    const legs = buildLegSamples(
      mergeArrivals([point('r1', '09:00', 'a')], [point('r2', '11:00', 'b', 'geofence')]),
      stays,
    );
    expect(legs).toEqual([]);
  });
});

describe('nextRunningMean', () => {
  it('starts at the first sample', () => {
    expect(nextRunningMean(null, 42)).toEqual({ minutes_p50: 42, samples: 1 });
  });

  it('averages without needing the history', () => {
    // 2 samples averaging 40, plus a 70 → 50 over 3.
    expect(nextRunningMean({ minutes_p50: 40, samples: 2 }, 70)).toEqual({
      minutes_p50: 50,
      samples: 3,
    });
  });

  it('keeps one decimal so repeated runs do not drift', () => {
    expect(nextRunningMean({ minutes_p50: 10, samples: 3 }, 11).minutes_p50).toBe(10.3);
  });
});
