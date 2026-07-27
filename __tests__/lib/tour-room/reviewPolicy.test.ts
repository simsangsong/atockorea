/**
 * OTA 심사 대비 — 예약 채널이 리뷰 CTA 도착지와 자사 쿠폰 허용을 가르는 규칙.
 *
 * 이 스위트가 지키는 불변식은 하나다: **OTA로 들어온 손님에게는 자사
 * 마켓플레이스 링크도, 자사 쿠폰도 가지 않는다.** 링크 하나 되살아나는 회귀가
 * 곧 계약 리스크라서, "혹시 폴백으로 자사 페이지가 나오지 않는가"를 여러 각도로
 * 찌른다.
 */

import {
  DEFAULT_REVIEW_POLICY,
  externalReviewPlatformFor,
  isOtaChannel,
  isUsableListingUrl,
  normalizeBookingChannel,
  resolveReviewPolicy,
} from '@/lib/tour-room/reviewPolicy';

describe('normalizeBookingChannel', () => {
  it('maps the live direct sources to direct', () => {
    // 라이브 bookings.source 분포(2026-07-28): tour_product 14, test 1.
    for (const s of ['tour_product', 'direct', 'atoc', 'atockorea', 'test', 'TOUR_PRODUCT', ' direct ']) {
      expect(normalizeBookingChannel(s)).toBe('direct');
    }
  });

  it('treats a missing source as direct', () => {
    expect(normalizeBookingChannel(null)).toBe('direct');
    expect(normalizeBookingChannel(undefined)).toBe('direct');
    expect(normalizeBookingChannel('')).toBe('direct');
  });

  it('maps the live OTA sources', () => {
    expect(normalizeBookingChannel('klook')).toBe('klook');
    expect(normalizeBookingChannel('gyg')).toBe('getyourguide');
    expect(normalizeBookingChannel('getyourguide')).toBe('getyourguide');
    expect(normalizeBookingChannel('viator')).toBe('viator');
    expect(normalizeBookingChannel('kkday')).toBe('kkday');
  });

  it('routes TripAdvisor sales to viator (that is how the booking arrives)', () => {
    expect(normalizeBookingChannel('tripadvisor')).toBe('viator');
  });

  it('🔴 fails toward OTA for unknown sources, never toward direct', () => {
    // 실패 방향이 이 함수의 핵심이다. 모르는 채널을 direct로 넘기면 조용히
    // 계약 위반이 되고, OTA로 넘기면 UX가 조금 심심해질 뿐이다.
    expect(normalizeBookingChannel('some_new_reseller')).toBe('ota_other');
    expect(isOtaChannel(normalizeBookingChannel('some_new_reseller'))).toBe(true);
  });
});

describe('isUsableListingUrl', () => {
  it('rejects the bare platform homepages that are live in tour_external_reviews today', () => {
    // 라이브 4행이 전부 이 모양이다. 여기로 손님을 보내면 "리뷰 남기기"를
    // 눌렀는데 OTA 첫 화면이 뜬다.
    expect(isUsableListingUrl('https://www.klook.com/')).toBe(false);
    expect(isUsableListingUrl('https://www.getyourguide.com/')).toBe(false);
    expect(isUsableListingUrl('https://www.viator.com')).toBe(false);
  });

  it('accepts a real listing path or query', () => {
    expect(isUsableListingUrl('https://www.klook.com/activity/12345-jeju-tour/')).toBe(true);
    expect(isUsableListingUrl('https://www.getyourguide.com/jeju-l1234/tour-t5678/')).toBe(true);
    expect(isUsableListingUrl('https://www.viator.com/tours?d=123')).toBe(true);
  });

  it('rejects junk', () => {
    expect(isUsableListingUrl(null)).toBe(false);
    expect(isUsableListingUrl('')).toBe(false);
    expect(isUsableListingUrl('   ')).toBe(false);
    expect(isUsableListingUrl('not a url')).toBe(false);
    expect(isUsableListingUrl('javascript:alert(1)')).toBe(false);
  });
});

describe('externalReviewPlatformFor', () => {
  it('maps only the platforms tour_external_reviews actually stores', () => {
    expect(externalReviewPlatformFor('klook')).toBe('klook');
    expect(externalReviewPlatformFor('getyourguide')).toBe('getyourguide');
    expect(externalReviewPlatformFor('viator')).toBe('viator');
    // 이 테이블의 CHECK 제약에 kkday가 없다 — 조회 자체를 하지 않는다.
    expect(externalReviewPlatformFor('kkday')).toBeNull();
    expect(externalReviewPlatformFor('ota_other')).toBeNull();
    expect(externalReviewPlatformFor('direct')).toBeNull();
  });
});

describe('resolveReviewPolicy — direct bookings keep today’s behaviour', () => {
  it('sends the review CTA to the own product anchor and allows the coupon', () => {
    const p = resolveReviewPolicy({ source: 'tour_product', tourSlug: 'jeju-grand-highlights-loop' });
    expect(p).toEqual({
      channel: 'direct',
      reviewHref: '/tour-product/jeju-grand-highlights-loop#reviews',
      reviewExternal: false,
      reviewPlatformLabel: null,
      rewardAllowed: true,
    });
  });

  it('falls back to /mypage when the slug is unknown', () => {
    const p = resolveReviewPolicy({ source: 'direct', tourSlug: null });
    expect(p.reviewHref).toBe('/mypage');
    expect(p.rewardAllowed).toBe(true);
  });
});

describe('resolveReviewPolicy — OTA bookings', () => {
  it('never allows the own-site coupon, whatever else is true', () => {
    for (const source of ['klook', 'gyg', 'viator', 'kkday', 'tripadvisor', 'some_new_reseller']) {
      const withListing = resolveReviewPolicy({
        source,
        tourSlug: 'jeju-grand-highlights-loop',
        otaListingUrl: 'https://www.klook.com/activity/12345-jeju-tour/',
      });
      const withoutListing = resolveReviewPolicy({ source, tourSlug: 'jeju-grand-highlights-loop' });
      expect(withListing.rewardAllowed).toBe(false);
      expect(withoutListing.rewardAllowed).toBe(false);
    }
  });

  it('sends the review CTA to the OTA listing, as an external link', () => {
    const p = resolveReviewPolicy({
      source: 'klook',
      tourSlug: 'jeju-grand-highlights-loop',
      otaListingUrl: 'https://www.klook.com/activity/12345-jeju-tour/',
    });
    expect(p.channel).toBe('klook');
    expect(p.reviewHref).toBe('https://www.klook.com/activity/12345-jeju-tour/');
    expect(p.reviewExternal).toBe(true);
    expect(p.reviewPlatformLabel).toBe('Klook');
  });

  it('🔴 hides the CTA rather than falling back to our own product page', () => {
    // 이게 이 트랙 전체의 요점이다. 리스팅 URL이 없다고 자사 페이지로 보내면
    // 고친 것이 없다.
    for (const otaListingUrl of [null, undefined, '', 'https://www.klook.com/']) {
      const p = resolveReviewPolicy({
        source: 'gyg',
        tourSlug: 'jeju-grand-highlights-loop',
        otaListingUrl,
      });
      expect(p.reviewHref).toBeNull();
      expect(p.reviewExternal).toBe(false);
    }
  });

  it('never emits an own-origin path for any OTA input combination', () => {
    const sources = ['klook', 'gyg', 'viator', 'kkday', 'tripadvisor', 'mystery_channel'];
    const listings = [null, '', 'https://www.klook.com/', 'https://www.klook.com/activity/1/'];
    for (const source of sources) {
      for (const otaListingUrl of listings) {
        const p = resolveReviewPolicy({ source, tourSlug: 'some-slug', otaListingUrl });
        if (p.reviewHref !== null) {
          expect(p.reviewHref.startsWith('http')).toBe(true);
          expect(p.reviewHref).not.toContain('/tour-product/');
          expect(p.reviewHref).not.toContain('/mypage');
        }
      }
    }
  });
});

describe('DEFAULT_REVIEW_POLICY', () => {
  it('is the direct-booking shape (used when no booking row could be read)', () => {
    expect(DEFAULT_REVIEW_POLICY.channel).toBe('direct');
    expect(DEFAULT_REVIEW_POLICY.reviewExternal).toBe(false);
  });
});
