/**
 * §5.3b 차량 배치도 5종 시드 정의 검증 — 좌석수·번호 연속성·설비 비충돌.
 * 기대값은 웹 검증 확정판(atoc-seatmap-demo.html / 플랜 §5.3b 표) 그대로.
 */
import {
  VEHICLE_LAYOUT_SEEDS,
  VEHICLE_MODELS,
  seatCount,
  seatByNumber,
  type VehicleModel,
} from '@/lib/ops/seating/layouts';

const EXPECTED_SEATS: Record<VehicleModel, number> = {
  county_20: 20, // (2+2)×4열 + 최후열 4석
  solati_16: 13, // 조수석1 + 좌2 + (2+1)×2 + 최후열 4석 (고정 판매석)
  limo_27: 27, // 좌2 + (2+1)×7 + 최후열 4석
  bus_35: 35, // 좌2 + (2+2)×7 + 최후열 5석
  bus_45: 45, // (2+2)×10 + 최후열 5석
};

describe('VEHICLE_LAYOUT_SEEDS (§5.3b 확정 5종)', () => {
  it('defines exactly the 5 confirmed models', () => {
    expect(VEHICLE_MODELS).toEqual(['county_20', 'solati_16', 'limo_27', 'bus_35', 'bus_45']);
    expect(Object.keys(VEHICLE_LAYOUT_SEEDS).sort()).toEqual([...VEHICLE_MODELS].sort());
  });

  describe.each(VEHICLE_MODELS)('%s', (model) => {
    const seed = VEHICLE_LAYOUT_SEEDS[model];

    it(`has ${EXPECTED_SEATS[model]} seats and a matching totalSeats`, () => {
      expect(seatCount(seed.layout)).toBe(EXPECTED_SEATS[model]);
      expect(seed.totalSeats).toBe(EXPECTED_SEATS[model]);
    });

    it('numbers seats contiguously 1..N with no duplicates', () => {
      const numbers = seed.layout.seats.map((s) => s.n).sort((a, b) => a - b);
      expect(numbers).toEqual(Array.from({ length: numbers.length }, (_, i) => i + 1));
      expect(seatByNumber(seed.layout).size).toBe(numbers.length);
    });

    it('numbers seats front→rear, left→right (앞→뒤·좌→우)', () => {
      const ordered = [...seed.layout.seats].sort((a, b) => a.r - b.r || a.c - b.c);
      expect(ordered.map((s) => s.n)).toEqual(
        Array.from({ length: ordered.length }, (_, i) => i + 1),
      );
    });

    it('keeps seats within the grid and off fixture cells', () => {
      const fixtureCells = new Set<string>();
      for (const f of seed.layout.fixtures) {
        for (let dc = 0; dc < (f.w ?? 1); dc++) fixtureCells.add(`${f.r}:${f.c + dc}`);
      }
      const seen = new Set<string>();
      for (const s of seed.layout.seats) {
        expect(s.c).toBeGreaterThanOrEqual(0);
        expect(s.c).toBeLessThan(seed.layout.cols);
        expect(fixtureCells.has(`${s.r}:${s.c}`)).toBe(false);
        expect(seen.has(`${s.r}:${s.c}`)).toBe(false); // 좌석끼리 겹침 금지
        seen.add(`${s.r}:${s.c}`);
      }
    });

    it('places the driver front-left', () => {
      const driver = seed.layout.fixtures.find((f) => f.type === 'driver');
      expect(driver).toEqual(expect.objectContaining({ r: 0, c: 0 }));
    });

    it('carries the locale display-name keys (content_locales 체계)', () => {
      for (const key of ['en', 'ko', 'zh', 'zh-TW', 'es', 'ja']) {
        expect(seed.displayName[key]).toBeTruthy();
      }
    });
  });

  it('county_20: rear row is 4 seats with no center-aisle seat', () => {
    const rear = VEHICLE_LAYOUT_SEEDS.county_20.layout.seats.filter((s) => s.r === 5);
    expect(rear.map((s) => s.c).sort((a, b) => a - b)).toEqual([0, 1, 3, 4]);
    expect(rear.map((s) => s.n).sort((a, b) => a - b)).toEqual([17, 18, 19, 20]);
  });

  it('solati_16: seat 1 is the front passenger seat (조수석, r0/c3)', () => {
    const s1 = seatByNumber(VEHICLE_LAYOUT_SEEDS.solati_16.layout).get(1);
    expect(s1).toEqual({ n: 1, r: 0, c: 3 });
  });

  it('limo_27: mid rows are (2+1) — three seats each on rows 2..8', () => {
    const layout = VEHICLE_LAYOUT_SEEDS.limo_27.layout;
    for (let r = 2; r <= 8; r++) {
      const row = layout.seats.filter((s) => s.r === r);
      expect(row.map((s) => s.c).sort((a, b) => a - b)).toEqual([0, 1, 4]);
    }
    // 최후열 4석 (엔진룸 위)
    expect(layout.seats.filter((s) => s.r === 9)).toHaveLength(4);
  });

  it('bus_35 / bus_45: rear bench is 5 seats including the center seat', () => {
    for (const model of ['bus_35', 'bus_45'] as const) {
      const layout = VEHICLE_LAYOUT_SEEDS[model].layout;
      const rearR = Math.max(...layout.seats.map((s) => s.r));
      const rear = layout.seats.filter((s) => s.r === rearR);
      expect(rear.map((s) => s.c).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4]);
    }
  });
});
