/**
 * B6 — the two retired products, and the thing that kept one of them selling.
 *
 * `isTourSlugHiddenFromPublicCatalog` decides what `/api/tours`, the
 * destinations feed and `/api/mypage/extras` return. It had no test at all,
 * which is how an exemption for `east-signature-nature-core` survived the
 * product being retired: the live DB has read `is_active = false` with zero
 * bookings for that row, and the catalogue never consults `is_active`.
 *
 * So two ways of saying "retired" existed, and only one of them was read.
 *
 * 🔴 And the deeper one: the slug was ALREADY on `CONSUMER_BLOCKED_TOUR_SLUGS`.
 * The exemption simply sat above the blocklist check inside the same function
 * and short-circuited it. Adding it to the blocklist again would have changed
 * nothing — the order was the bug — so the invariant this file holds is that
 * blocked and hidden-from-catalogue agree, for every slug, always.
 */
import {
  isTourSlugHiddenFromPublicCatalog,
  isTourRowHiddenFromPublicTourApi,
  consumerTourDetailHref,
  isTourSlugBlockedFromConsumerSurfaces,
  CONSUMER_BLOCKED_TOUR_SLUGS,
  CANONICAL_EAST_SIGNATURE_CATALOG_SLUG,
} from '@/lib/tour-consumer-visibility';

const RETIRED = [
  'east-signature-nature-core',
  'jeju-west-south-full-day-authentic-tour',
  // Retired 2026-08-07 by owner instruction (commit 1db9775a). Pocheon was on
  // the STILL_SELLING list below, so this suite went red on main the moment the
  // retirement landed — the blocklist and the list of what is selling are two
  // statements about the same fact, and only one of them moved.
  'seoul-private-nami-morning-calm-petite-france',
  'pocheon-sanjeong-lake-herb-island-art-valley',
];

const STILL_SELLING = [
  'jeju-grand-highlights-loop',
  'busan-top-attractions-day-tour',
  'jeju-island-private-car-charter-tour',
];

describe('public catalogue visibility', () => {
  it('hides both retired products', () => {
    for (const slug of RETIRED) {
      expect({ slug, hidden: isTourSlugHiddenFromPublicCatalog(slug) }).toEqual({ slug, hidden: true });
    }
  });

  it('hides the canonical East Signature row, not only its duplicates', () => {
    // This is the exemption B6 removed. Naming the constant rather than the
    // string means a rename cannot quietly restore the old behaviour.
    expect(isTourSlugHiddenFromPublicCatalog(CANONICAL_EAST_SIGNATURE_CATALOG_SLUG)).toBe(true);
    expect(isTourSlugHiddenFromPublicCatalog('east-signature-nature-core-v2')).toBe(true);
  });

  it('leaves every selling product alone', () => {
    // The blast radius question. A hide rule that also caught a live seller
    // would take the catalogue down quietly — everything still renders, just
    // with fewer rows.
    for (const slug of STILL_SELLING) {
      expect({ slug, hidden: isTourSlugHiddenFromPublicCatalog(slug) }).toEqual({ slug, hidden: false });
    }
  });

  it('reaches the API-row filter the same way', () => {
    for (const slug of RETIRED) {
      expect({ slug, hidden: isTourRowHiddenFromPublicTourApi({ id: 'x', slug }) }).toEqual({
        slug,
        hidden: true,
      });
    }
    expect(isTourRowHiddenFromPublicTourApi({ id: 'x', slug: 'jeju-grand-highlights-loop' })).toBe(false);
  });

  it('🔴 nothing on the blocklist can still appear in the catalogue', () => {
    // This is the invariant that was broken, and it is the one worth keeping.
    //
    // `east-signature-nature-core` was ALREADY in CONSUMER_BLOCKED_TOUR_SLUGS.
    // Someone had decided. But the exemption sat ABOVE the blocklist check in
    // this same function, so it short-circuited: `isTourSlugHiddenFromPublic-
    // Catalog` returned false while `isTourSlugBlockedFromConsumerSurfaces`
    // returned true, for the same slug, in the same file.
    //
    // The result a guest saw: the card appeared in the list, and tapping it
    // bounced them back to the list, because every OTHER surface honoured the
    // blocklist. Adding it to the blocklist a second time would not have fixed
    // it — the order was the bug.
    for (const slug of CONSUMER_BLOCKED_TOUR_SLUGS) {
      expect({
        slug,
        blocked: isTourSlugBlockedFromConsumerSurfaces(slug),
        hiddenFromCatalogue: isTourSlugHiddenFromPublicCatalog(slug),
      }).toEqual({ slug, blocked: true, hiddenFromCatalogue: true });
    }
  });

  it('sends its own links to the list rather than to a dead card', () => {
    // Unchanged by B6 — the blocklist already did this. Asserted so the two
    // halves cannot drift apart again in the other direction: a slug that is
    // hidden from the catalogue but whose links still resolve into a card the
    // catalogue will not show is the same inconsistency mirrored.
    for (const slug of RETIRED) {
      expect({ slug, href: consumerTourDetailHref('some-tour-id', slug) }).toEqual({
        slug,
        href: '/tours/list',
      });
    }
  });

  it('is not confused by casing or padding', () => {
    expect(isTourSlugHiddenFromPublicCatalog('  East-Signature-Nature-Core ')).toBe(true);
    expect(isTourSlugHiddenFromPublicCatalog('')).toBe(false);
    expect(isTourSlugHiddenFromPublicCatalog(null)).toBe(false);
    expect(isTourSlugHiddenFromPublicCatalog(undefined)).toBe(false);
    expect(isTourSlugHiddenFromPublicCatalog(42)).toBe(false);
  });
});
