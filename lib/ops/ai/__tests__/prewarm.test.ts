/**
 * §L L3 — 프리워밍 계획.
 *
 * 계약:
 *   1. 앞쪽 스팟만 데운다 — 일정 전체를 미리 부르는 것은 절감이 아니라
 *      예산을 앞당겨 태우는 것이다.
 *   2. 같은 스팟을 두 번 데우지 않는다.
 *   3. 데울 것이 없으면 아무 일도 하지 않는다.
 */

import { PREWARM_SPOT_LIMIT, hasWork, planPrewarm } from '../prewarm';

const stop = (title: string, poiKey?: string) => ({ title, poi_key: poiKey ?? null, place_id: null });

describe('planPrewarm', () => {
  it('일정에서 스팟을 뽑는다', () => {
    const plan = planPrewarm({
      bookingId: 'b1',
      schedule: [stop('성산일출봉', 'seongsan'), stop('우도', 'udo')],
      locales: ['ja'],
    });
    expect(plan?.spots.map((s) => s.title)).toEqual(['성산일출봉', '우도']);
  });

  it('🔴 앞쪽 N개만 — 20스팟 일정을 전부 미리 부르면 예산을 앞당겨 태우는 것이다', () => {
    const many = Array.from({ length: 20 }, (_, i) => stop(`스팟 ${i}`, `poi-${i}`));
    const plan = planPrewarm({ bookingId: 'b1', schedule: many, locales: ['en'] });
    expect(plan?.spots).toHaveLength(PREWARM_SPOT_LIMIT);
    expect(plan?.spots[0].title).toBe('스팟 0');
  });

  it('상한을 낮출 수 있다', () => {
    const many = Array.from({ length: 10 }, (_, i) => stop(`스팟 ${i}`, `poi-${i}`));
    expect(planPrewarm({ bookingId: 'b1', schedule: many, locales: ['en'] }, 2)?.spots).toHaveLength(2);
  });

  it('같은 스팟이 일정에 두 번 있어도 한 번만 데운다', () => {
    const plan = planPrewarm({
      bookingId: 'b1',
      schedule: [stop('성산일출봉', 'seongsan'), stop('성산일출봉', 'seongsan')],
      locales: ['en'],
    });
    expect(plan?.spots).toHaveLength(1);
  });

  it('제목이 없는 항목은 건너뛴다 — poi_key만 있는 자리표시자가 있다', () => {
    const plan = planPrewarm({
      bookingId: 'b1',
      schedule: [{ title: '', poi_key: 'x' }, stop('우도', 'udo')],
      locales: ['en'],
    });
    expect(plan?.spots.map((s) => s.title)).toEqual(['우도']);
  });

  it('title 대신 name을 쓰는 항목도 읽는다', () => {
    const plan = planPrewarm({ bookingId: 'b1', schedule: [{ name: '만장굴' }], locales: ['en'] });
    expect(plan?.spots[0].title).toBe('만장굴');
  });

  it("로케일에 'en'이 항상 들어가고 3개로 잘린다 — 생성기가 그 이상은 버린다", () => {
    const plan = planPrewarm({
      bookingId: 'b1',
      schedule: [stop('우도')],
      locales: ['ja', 'zh', 'es', 'ko'],
    });
    expect(plan?.locales[0]).toBe('en');
    expect(plan?.locales).toHaveLength(3);
  });

  it('일정이 비면 null — 아무 일도 하지 않는다', () => {
    expect(planPrewarm({ bookingId: 'b1', schedule: [], locales: ['en'] })).toBeNull();
  });

  it('bookingId가 없으면 null', () => {
    expect(planPrewarm({ bookingId: '', schedule: [stop('우도')], locales: ['en'] })).toBeNull();
  });
});

describe('hasWork', () => {
  it('null이면 할 일이 없다', () => {
    expect(hasWork(null)).toBe(false);
  });

  it('스팟이 있으면 할 일이 있다', () => {
    expect(hasWork(planPrewarm({ bookingId: 'b1', schedule: [stop('우도')], locales: ['en'] }))).toBe(true);
  });
});
