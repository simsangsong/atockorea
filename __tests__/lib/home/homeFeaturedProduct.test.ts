/**
 * 🔴 상설 게이트 — 홈이 **죽은 상품을 팔고 있지 않은지**.
 *
 * 2026-07-29 실측: 홈의 flagship join 카드가 `east-signature-nature-core`를
 * "From US$59 per person (was $69, 14% off)"로 광고하고 있었다. 그 상품은
 * 라이브 DB에서 `is_active = false`, **예약 0건**, 소비자 차단 목록에 등재.
 * 즉 카드를 누르면 `consumerTourDetailHref`가 손님을 목록으로 되돌려보낸다.
 *
 * 원인은 이 파일이 **상품을 읽지 않기 때문**이다. 모든 필드가 손으로 베낀
 * 사본이고, 원본이 은퇴해도 사본은 아무것도 모른다.
 *
 * 상품 JSON을 import 하는 것이 답처럼 보이지만, 그건 홈 초기 렌더에 상세
 * JSON 전체를 끌어오는 것이고 이 파일이 존재하는 이유가 바로 그걸 피하는 것이다.
 * 그래서 **런타임 비용 0으로 드리프트만 막는다** — 테스트가 JSON을 읽는다.
 *
 * 잡는 것 세 가지:
 *   1. 홈이 가리키는 슬러그가 **살아 있고 숨겨져 있지 않은가**
 *   2. 카드의 모든 필드가 상품 자신의 `catalog_card`와 **같은가**
 *   3. 가격이 **아무도 제시하지 않은 할인**을 주장하지 않는가
 */
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { FEATURED_JOIN_TOUR_SLUG, HOME_CTA_FEATURED_JOIN_TOUR_HREF } from '@/lib/home/home-cta-routes';
import { getFeaturedJoinTourProduct, getFeaturedJoinTourHref } from '@/lib/home/featured-join-tour-offer';
import {
  isTourSlugHiddenFromPublicCatalog,
  isTourSlugBlockedFromConsumerSurfaces,
} from '@/lib/tour-consumer-visibility';

type CatalogCard = {
  slug?: string;
  title?: string;
  subtitle?: string;
  region?: string;
  duration?: string;
  stopsCount?: number;
  badges?: string[];
  heroImage?: string;
  thumbnail?: string;
};

function catalogCard(slug: string): CatalogCard {
  const file = path.join(
    process.cwd(),
    'components/product-tour-static',
    slug,
    `${slug}.en.json`,
  );
  expect({ file, exists: existsSync(file) }).toEqual({ file, exists: true });
  const json = JSON.parse(readFileSync(file, 'utf8')) as { catalog_card?: CatalogCard };
  expect(json.catalog_card).toBeDefined();
  return json.catalog_card!;
}

describe('the product the home page sells', () => {
  it('🔴 is not hidden and not blocked', () => {
    // The failure this catches is silent by construction: a retired product
    // still renders a beautiful card. Nothing throws; the guest just cannot buy.
    expect({
      slug: FEATURED_JOIN_TOUR_SLUG,
      hiddenFromCatalogue: isTourSlugHiddenFromPublicCatalog(FEATURED_JOIN_TOUR_SLUG),
      blocked: isTourSlugBlockedFromConsumerSurfaces(FEATURED_JOIN_TOUR_SLUG),
    }).toEqual({ slug: FEATURED_JOIN_TOUR_SLUG, hiddenFromCatalogue: false, blocked: false });
  });

  it('has a product page to land on', () => {
    expect(HOME_CTA_FEATURED_JOIN_TOUR_HREF).toBe(`/tour-product/${FEATURED_JOIN_TOUR_SLUG}`);
    expect(getFeaturedJoinTourHref()).toBe(HOME_CTA_FEATURED_JOIN_TOUR_HREF);
    expect(getFeaturedJoinTourProduct().slug).toBe(FEATURED_JOIN_TOUR_SLUG);
  });

  it('says what the product says about itself', () => {
    const card = catalogCard(FEATURED_JOIN_TOUR_SLUG);
    const home = getFeaturedJoinTourProduct();

    // Compared as one object so a failure prints every drifted field at once,
    // rather than stopping at the first and hiding the rest.
    expect({
      title: home.title,
      subtitle: home.subtitle,
      region: home.region,
      duration: home.duration,
      stopsCount: home.stopsCount,
      badges: home.badges,
      heroImage: home.heroImage,
      thumbnail: home.thumbnail,
    }).toEqual({
      title: card.title,
      subtitle: card.subtitle,
      region: card.region,
      duration: card.duration,
      stopsCount: card.stopsCount,
      badges: card.badges,
      heroImage: card.heroImage,
      thumbnail: card.thumbnail,
    });
  });

  it('does not claim a discount nobody is offering', () => {
    const home = getFeaturedJoinTourProduct();
    const file = path.join(
      process.cwd(),
      'components/product-tour-static',
      FEATURED_JOIN_TOUR_SLUG,
      `${FEATURED_JOIN_TOUR_SLUG}.en.json`,
    );
    const price = (JSON.parse(readFileSync(file, 'utf8')) as {
      price?: { salePriceUsd?: number; compareAtPriceUsd?: number };
    }).price;

    expect(home.listPriceUsd).toBe(price?.salePriceUsd);
    // A struck-through price nobody offered is worse than none. If the product
    // ever carries a real compare-at, this is where it has to come from.
    expect(home.compareAtPriceUsd).toBe(price?.compareAtPriceUsd);
    expect(home.priceLabel).toContain(String(home.listPriceUsd));
  });

  it('the price label and the number agree', () => {
    const home = getFeaturedJoinTourProduct();
    const claimed = home.priceLabel.match(/\$(\d+(?:\.\d+)?)/g)?.map((m) => Number(m.slice(1))) ?? [];
    expect(claimed).toContain(home.listPriceUsd);
    if (home.compareAtPriceUsd === undefined) {
      // No second number in the label either — that is how "(was $69)" outlived
      // the offer it described.
      expect(claimed).toHaveLength(1);
    }
  });
});
