/**
 * The 4-hour private charter is no longer sold (owner, 2026-07-29: "네시간은
 * 없애줘, 다섯시간부터 선택할수 있도록"). It survived for nine days because the
 * fix sat in an unmerged branch.
 *
 * This goes through `getStaticTourProductFullPageJson` — the loader the product
 * page itself calls — rather than reading the files, so a bundle that stops
 * being reachable fails here too.
 *
 * 🔴 Only half the picture lives in this repo. `pricingTiers` is overlaid from
 * the bundle ONLY when the `tour_product_pages` row does not already carry one
 * (`tourProductPageBody.tsx`: the overlay is skipped when the key is defined).
 * As of 2026-08-07 the Jeju row has no `pricingTiers`, so the bundle serves it;
 * the Busan row does, so the bundle is dead weight there and the DB is what
 * renders. Fixing this file alone does not fix Busan.
 */
import { getStaticTourProductFullPageJson } from '@/components/product-tour-static/_shared/tourProductBundleRegistry';

const CHARTERS = [
  'jeju-island-private-car-charter-tour',
  'busan-private-car-charter-cruise-shore',
] as const;

const LOCALES = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'] as const;

describe('private charter durations', () => {
  it.each(CHARTERS)('%s no longer offers the retired 4-hour tier', async (slug) => {
    const offenders: string[] = [];
    for (const locale of LOCALES) {
      const doc = await getStaticTourProductFullPageJson(slug, locale);
      const pricing = (doc as { pricingTiers?: {
        durations?: string[];
        tiers?: Array<{ prices?: Record<string, number> }>;
      } } | null)?.pricingTiers;
      if (!pricing) continue;

      if (pricing.durations?.includes('4h')) offenders.push(`${locale} durations`);
      for (const [i, tier] of (pricing.tiers ?? []).entries()) {
        if (tier.prices && '4h' in tier.prices) offenders.push(`${locale} tiers[${i}].prices`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it.each(CHARTERS)('%s leads with 5h, which is what the sticky bar defaults to', async (slug) => {
    for (const locale of LOCALES) {
      const doc = await getStaticTourProductFullPageJson(slug, locale);
      const durations = (doc as { pricingTiers?: { durations?: string[] } } | null)
        ?.pricingTiers?.durations;
      if (!durations?.length) continue;
      expect(`${locale}:${durations[0]}`).toBe(`${locale}:5h`);
    }
  });

  it.each(CHARTERS)('%s prices every duration it offers', async (slug) => {
    // `tier.prices[duration]` is the lookup in both the booking card and the
    // rates sheet, so a duration with no matching price key renders "—".
    const gaps: string[] = [];
    for (const locale of LOCALES) {
      const doc = await getStaticTourProductFullPageJson(slug, locale);
      const pricing = (doc as { pricingTiers?: {
        durations?: string[];
        tiers?: Array<{ paxLabel?: string; prices?: Record<string, number> }>;
      } } | null)?.pricingTiers;
      if (!pricing?.durations) continue;
      for (const tier of pricing.tiers ?? []) {
        for (const d of pricing.durations) {
          if (typeof tier.prices?.[d] !== 'number') {
            gaps.push(`${locale} ${tier.paxLabel ?? '?'} ${d}`);
          }
        }
      }
    }
    expect(gaps).toEqual([]);
  });
});
