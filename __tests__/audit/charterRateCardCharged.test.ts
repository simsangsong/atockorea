/**
 * 상설 게이트 — 전세 상품의 **표시가와 청구가는 같은 표에서 나와야 한다.**
 *
 * 🔴 왜 있는가: 예약 카드는 처음부터 시간×인원 레이트 카드를 렌더했고, 코드 주석까지
 * "Tier-based pricing is authoritative" 라고 적어 놨다. 그런데 **아무도 그 표로 청구하지
 * 않았다.** `buildBookingPayload` 는 `tours.price` 를 보냈고, `/api/bookings` 도
 * `tours.price` 로 다시 계산해 다르면 거절했다 — 표 가격은 구조적으로 청구될 수 없었다.
 * 부산 크루즈 전세는 화면에 **US$169**(5시간)를 띄우고 **US$456.99** 로 예약됐다.
 *
 * 사장님 결정(2026-08-07): **레이트 카드가 정본.**
 *
 * 이 게이트는 세 가지를 고정한다:
 *   ① 해석기가 시간×인원 셀을 정확히 집는다 (클라이언트 카드와 같은 규칙)
 *   ② 클라이언트 페이로드가 **카드가 보여준 값**과 **선택한 시간**을 싣는다
 *   ③ 서버 라우트가 그 표를 읽는다 (`tours.price` 로만 계산하지 않는다)
 *
 * ②③ 는 소스로 강제한다. 이 종류의 결함은 "만드는 문제"가 아니라 **"연결하는 문제"**라
 * 단위 테스트가 전부 초록인 채로 살아 있었다.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  parseCharterRateCard,
  resolveCharterPriceUsd,
  lowestCharterPriceUsd,
} from '@/lib/tour-product/charterRateCard';

const ROOT = process.cwd();

const CARD = {
  currency: 'USD',
  unit: 'vehicle',
  durations: ['5h', '6h', '7h', '8h', '9h', '10h'],
  tiers: [
    { paxLabel: '1–6 pax', paxMin: 1, paxMax: 6, prices: { '5h': 169, '6h': 189, '7h': 209, '8h': 230, '9h': 250, '10h': 277 } },
    { paxLabel: '7–9 pax', paxMin: 7, paxMax: 9, prices: { '5h': 203, '6h': 223, '7h': 243, '8h': 264, '9h': 284, '10h': 311 } },
    { paxLabel: '10–13 pax', paxMin: 10, paxMax: 13, prices: { '5h': 270, '6h': 291, '7h': 311, '8h': 331, '9h': 351, '10h': 378 } },
  ],
};

describe('전세 레이트 카드 해석기', () => {
  const card = parseCharterRateCard(CARD)!;

  it('시간×인원 셀을 집는다', () => {
    expect(card).not.toBeNull();
    expect(resolveCharterPriceUsd(card, '8h', 2)).toBe(230);
    expect(resolveCharterPriceUsd(card, '8h', 8)).toBe(264);
    expect(resolveCharterPriceUsd(card, '10h', 12)).toBe(378);
  });

  it('시간을 안 주면 첫 칸으로 떨어진다 — 서버가 조용히 다른 값을 물지 않도록', () => {
    expect(resolveCharterPriceUsd(card, null, 2)).toBe(169);
    expect(resolveCharterPriceUsd(card, 'nonsense', 2)).toBe(169);
  });

  it('마지막 티어를 넘는 인원은 마지막 티어로 처리한다', () => {
    expect(resolveCharterPriceUsd(card, '8h', 40)).toBe(331);
  });

  it('카탈로그용 최저가는 표의 최솟값이다', () => {
    expect(lowestCharterPriceUsd(card)).toBe(169);
  });

  it('표가 아닌 것은 null 로 거른다 (그러면 호출부가 tours.price 로 폴백한다)', () => {
    expect(parseCharterRateCard(null)).toBeNull();
    expect(parseCharterRateCard({ durations: [], tiers: [] })).toBeNull();
    expect(parseCharterRateCard({ durations: ['8h'] })).toBeNull();
  });
});

describe('🔴 표시가와 청구가가 같은 표에서 나온다 (배선)', () => {
  const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

  it('예약 페이로드가 카드가 보여준 값과 선택한 시간을 싣는다', () => {
    const src = read('components/product-tour-static/_shared/bookingShared.tsx');
    expect(src).toMatch(/charterDuration/);
    // `ctx.unitPriceUsd` 만 쓰던 것이 이 결함의 본체였다.
    expect(src).toMatch(/charter\?\.unitPriceUsd/);
  });

  it('두 예약 표면 모두 그 값을 넘긴다', () => {
    for (const rel of [
      'components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourDesktopBookingCard.tsx',
      'components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourStickyBookingBar.tsx',
    ]) {
      const src = read(rel);
      expect(src).toMatch(/buildBookingPayload\([\s\S]{0,240}?unitPriceUsd:\s*tierPriceUsd/);
      expect(src).toMatch(/durationKey:\s*selectedDuration/);
    }
  });

  it('체크아웃이 그 시간을 API 까지 실어 나른다', () => {
    const src = read('app/(marketing)/tour/[id]/checkout/page.tsx');
    expect(src).toMatch(/charterDuration:\s*bookingData\.charterDuration/);
  });

  it('서버가 레이트 카드를 읽는다 — tours.price 로만 계산하지 않는다', () => {
    const src = read('app/api/bookings/route.ts');
    expect(src).toMatch(/resolveCharterPriceUsd/);
    expect(src).toMatch(/parseCharterRateCard/);
    // 표가 없을 때만 tours.price 로 떨어져야 한다.
    expect(src).toMatch(/let unitPrice = listUnitUsd/);
  });
});
