/**
 * W1.3 — feasibility engine v1 (§C-5, P-D9: warnings only, never blocks).
 */

import { assessDayPlanFeasibility } from '@/lib/tour-room/feasibility';
import { JEJU_EAST_MIX_SURCHARGE } from '@/lib/quote-engine/pricing-policy';
import type { DayPlanStop } from '@/lib/tour-room/dayPlan';

// A Monday in the future (KST) — Manjanggul is permanently closed either way;
// Seongsan Ilchulbong is Monday-closed per place-operating-rules.
const MONDAY = '2027-03-08';
const TUESDAY = '2027-03-09';

const jejuStop = (over: Partial<DayPlanStop> & Record<string, unknown>): DayPlanStop => ({
  id: 'stop-1',
  seq: 1,
  source: 'poi',
  stop_type: 'sight',
  duration_min: 60,
  status: 'pending',
  ...over,
});

describe('lib/tour-room/feasibility', () => {
  it('totals stay + drive and warns on overrun vs booked hours', () => {
    // Jeju city → Seongsan (~45km haversine → ~110min round-trip legs) with
    // long stays: 3 stops × 240min stay blows an 8h budget.
    const result = assessDayPlanFeasibility({
      stops: [
        jejuStop({ id: 'a', name_i18n: { en: 'Stop A' }, lat: 33.51, lng: 126.52, duration_min: 240 }),
        jejuStop({ id: 'b', name_i18n: { en: 'Stop B' }, lat: 33.46, lng: 126.94, duration_min: 240 }),
        jejuStop({ id: 'c', name_i18n: { en: 'Stop C' }, lat: 33.25, lng: 126.41, duration_min: 240 }),
      ],
      totalHours: 8,
      tourDate: TUESDAY,
      region: 'jeju',
    });
    expect(result.stay_min).toBe(720);
    expect(result.drive_min).toBeGreaterThan(60);
    expect(result.budget_min).toBe(480);
    expect(result.warnings.some((w) => w.code === 'overrun')).toBe(true);
    const overrun = result.warnings.find((w) => w.code === 'overrun')!;
    expect(overrun.detail.over_min).toBe(result.total_min - 480);
  });

  it('stays quiet for a comfortable plan', () => {
    const result = assessDayPlanFeasibility({
      stops: [
        jejuStop({ id: 'a', name_i18n: { en: 'Stop A' }, lat: 33.51, lng: 126.52, duration_min: 90 }),
        jejuStop({ id: 'b', name_i18n: { en: 'Stop B' }, lat: 33.48, lng: 126.6, duration_min: 90 }),
      ],
      totalHours: 8,
      tourDate: TUESDAY,
      region: 'jeju',
    });
    expect(result.warnings).toEqual([]);
  });

  it('skips the overrun check without booked hours', () => {
    const result = assessDayPlanFeasibility({
      stops: [jejuStop({ id: 'a', name_i18n: { en: 'A' }, duration_min: 600 })],
      totalHours: null,
    });
    expect(result.budget_min).toBeNull();
    expect(result.warnings).toEqual([]);
  });

  it('defaults missing durations to 60min and ignores skipped stops', () => {
    const result = assessDayPlanFeasibility({
      stops: [
        jejuStop({ id: 'a', name_i18n: { en: 'A' }, duration_min: null }),
        jejuStop({ id: 'b', name_i18n: { en: 'B' }, duration_min: 600, status: 'skipped' }),
      ],
    });
    expect(result.stay_min).toBe(60);
  });

  it('flags weekday closures via EN name keywords (A4)', () => {
    const result = assessDayPlanFeasibility({
      stops: [jejuStop({ id: 'a', name_i18n: { en: 'Seongsan Ilchulbong' } })],
      tourDate: MONDAY,
    });
    expect(result.warnings).toMatchObject([{ code: 'closed', stop_id: 'a' }]);

    const openDay = assessDayPlanFeasibility({
      stops: [jejuStop({ id: 'a', name_i18n: { en: 'Seongsan Ilchulbong' } })],
      tourDate: TUESDAY,
    });
    expect(openDay.warnings).toEqual([]);
  });

  it('flags closures via the humanized poi_key when names are absent (poi_key mapping layer)', () => {
    const result = assessDayPlanFeasibility({
      stops: [jejuStop({ id: 'a', name_i18n: null, poi_key: 'seongsan_ilchulbong' })],
      tourDate: MONDAY,
    });
    expect(result.warnings).toMatchObject([{ code: 'closed' }]);
  });

  it('flags permanently closed places on any date', () => {
    const result = assessDayPlanFeasibility({
      stops: [jejuStop({ id: 'a', name_i18n: { en: 'Manjanggul Cave' } })],
      tourDate: TUESDAY,
    });
    expect(result.warnings).toMatchObject([{ code: 'closed' }]);
  });

  it('flags stops outside the region service radius (A6)', () => {
    const result = assessDayPlanFeasibility({
      stops: [
        jejuStop({ id: 'a', name_i18n: { en: 'In Jeju' }, lat: 33.5, lng: 126.5 }),
        // Seoul coordinates on a Jeju plan — way outside the island radius.
        jejuStop({ id: 'b', name_i18n: { en: 'Gyeongbokgung' }, lat: 37.579, lng: 126.977 }),
      ],
      region: 'jeju',
      tourDate: TUESDAY,
    });
    const radius = result.warnings.filter((w) => w.code === 'out_of_region');
    expect(radius).toHaveLength(1);
    expect(radius[0]).toMatchObject({ stop_id: 'b' });
    expect(Number(radius[0].detail.distance_km)).toBeGreaterThan(60);
  });

  it('never throws on stops without coordinates or an unknown region', () => {
    const result = assessDayPlanFeasibility({
      stops: [jejuStop({ id: 'a', name_i18n: { en: 'Somewhere' } })],
      region: 'mars',
      tourDate: TUESDAY,
      totalHours: 9,
    });
    expect(result.warnings).toEqual([]);
    expect(result.drive_min).toBe(0);
  });

  describe('Jeju cross-island (동+서/남 same-day) — notice only, never blocks', () => {
    // Zone coords: east lng≥126.64, west lng≤126.42, south lat≤33.30 (middle),
    // city lat>33.30 (middle). All within the Jeju service radius.
    const east = { lat: 33.46, lng: 126.94 }; // Seongsan
    const west = { lat: 33.39, lng: 126.24 }; // Hyeopjae
    const south = { lat: 33.25, lng: 126.56 }; // Seogwipo
    const city = { lat: 33.51, lng: 126.52 }; // Jeju city

    it('warns once when East mixes with West on a jeju plan', () => {
      const result = assessDayPlanFeasibility({
        stops: [
          jejuStop({ id: 'a', name_i18n: { en: 'East' }, ...east }),
          jejuStop({ id: 'b', name_i18n: { en: 'West' }, ...west }),
        ],
        region: 'jeju',
      });
      const cross = result.warnings.filter((w) => w.code === 'cross_island');
      expect(cross).toHaveLength(1);
      expect(cross[0].stop_id).toBeUndefined(); // plan-wide, not per-stop
      expect(cross[0].detail.surcharge_krw).toBe(JEJU_EAST_MIX_SURCHARGE);
    });

    it('warns when East mixes with South', () => {
      const result = assessDayPlanFeasibility({
        stops: [
          jejuStop({ id: 'a', name_i18n: { en: 'East' }, ...east }),
          jejuStop({ id: 'b', name_i18n: { en: 'South' }, ...south }),
        ],
        region: 'jeju',
      });
      expect(result.warnings.filter((w) => w.code === 'cross_island')).toHaveLength(1);
    });

    it('stays quiet for East + City only (city is neutral)', () => {
      const result = assessDayPlanFeasibility({
        stops: [
          jejuStop({ id: 'a', name_i18n: { en: 'East' }, ...east }),
          jejuStop({ id: 'b', name_i18n: { en: 'City' }, ...city }),
        ],
        region: 'jeju',
      });
      expect(result.warnings.some((w) => w.code === 'cross_island')).toBe(false);
    });

    it('stays quiet for West + South only (no East)', () => {
      const result = assessDayPlanFeasibility({
        stops: [
          jejuStop({ id: 'a', name_i18n: { en: 'West' }, ...west }),
          jejuStop({ id: 'b', name_i18n: { en: 'South' }, ...south }),
        ],
        region: 'jeju',
      });
      expect(result.warnings.some((w) => w.code === 'cross_island')).toBe(false);
    });

    it('never fires outside the jeju builder region', () => {
      const result = assessDayPlanFeasibility({
        stops: [
          jejuStop({ id: 'a', name_i18n: { en: 'East' }, ...east }),
          jejuStop({ id: 'b', name_i18n: { en: 'West' }, ...west }),
        ],
        region: 'seoul',
      });
      expect(result.warnings.some((w) => w.code === 'cross_island')).toBe(false);
    });

    it('the surcharge is unified at ₩70,000', () => {
      expect(JEJU_EAST_MIX_SURCHARGE).toBe(70000);
    });
  });
});
