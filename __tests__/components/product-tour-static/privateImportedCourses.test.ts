/**
 * Imported-course config gate — the charter pages' course pills and the
 * planner's injected templates both resolve through this map, so a broken
 * entry here would silently render an empty course tab on the product page
 * AND drop the course from the smart-app planner.
 */
import { getPrivateImportedCourses } from '@/components/product-tour-static/_shared/privateImportedCourses';
import { STATIC_TOUR_PRODUCT_BUNDLE_SLUGS } from '@/components/product-tour-static/_shared/tourProductBundleSlugs';
import { getStaticTourProductFullPageJson } from '@/components/product-tour-static/_shared/tourProductBundleRegistry';

const LOCALES = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'] as const;

const HOSTS: Record<string, string[]> = {
  'jeju-island-private-car-charter-tour': ['south', 'southwest', 'east'],
  'seoul-suburbs-private-chartered-car-10hr': ['gapyeong', 'dmz', 'suwon', 'pocheon'],
  // Owner 2026-08-07: offer the tours we already sell — "일일투어, 스몰그룹투어,
  // 기항지 투어 등등". The shore excursion and the small-group tour were the two
  // missing, and they are what a charter buyer is most likely comparing against.
  'busan-private-car-charter-cruise-shore': [
    'cruise-shore',
    'small-group',
    'busan-city',
    'gyeongju',
    'outskirts',
  ],
  // Same instruction for the Incheon charter: terminal pickup, Gwanghwamun,
  // Insa-dong, Gwangjang Market. That is our own Incheon shore excursion, so it
  // is imported. It used to fall through to `seoulConfig()` — "Hotel pickup
  // (default)" plus five "Stop to be added" slots, on a cruise-only product.
  'incheon-seoul-private-car-shore-excursion-cruise': ['seoul-classic'],
};

describe('privateImportedCourses', () => {
  it.each(Object.entries(HOSTS))('%s serves its configured course pills in order', (host, ids) => {
    const courses = getPrivateImportedCourses(host);
    expect(courses).not.toBeNull();
    expect(courses!.map((c) => c.id)).toEqual(ids);
  });

  it('every imported course slug is a registered static bundle', () => {
    for (const host of Object.keys(HOSTS)) {
      for (const course of getPrivateImportedCourses(host)!) {
        expect(STATIC_TOUR_PRODUCT_BUNDLE_SLUGS.has(course.slug)).toBe(true);
      }
    }
  });

  it('every course carries a non-empty chip label for all six content locales', () => {
    for (const host of Object.keys(HOSTS)) {
      for (const course of getPrivateImportedCourses(host)!) {
        for (const locale of LOCALES) {
          expect(course.chipLabel[locale]?.trim().length ?? 0).toBeGreaterThan(0);
        }
      }
    }
  });

  it('every imported course bundle has real place stops to render', async () => {
    for (const host of Object.keys(HOSTS)) {
      for (const course of getPrivateImportedCourses(host)!) {
        const json = await getStaticTourProductFullPageJson(course.slug, 'en');
        const stops = (json?.itineraryStops ?? []).filter(
          (s) => s != null && typeof s === 'object' && s._role !== 'pickup' && s._role !== 'dropoff',
        );
        expect(stops.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('returns null for non-charter products', () => {
    expect(getPrivateImportedCourses('east-signature-nature-core')).toBeNull();
    expect(getPrivateImportedCourses('busan-cruise-shore-excursion-bus-tour')).toBeNull();
  });
});
