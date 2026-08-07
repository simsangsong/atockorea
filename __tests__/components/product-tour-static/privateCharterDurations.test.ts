/**
 * `pricingTiers.durations` — the charter duration grid.
 *
 * Three separate live defects met in this one field, so they are gated together:
 *
 *  1. The retired 4-hour tier was still on sale (owner, 2026-07-29: "네시간은
 *     없애줘, 다섯시간부터 선택할수 있도록"), and `durations[0]` is what the
 *     sticky booking bar defaults to — so it led the page rather than merely
 *     sitting in a list.
 *  2. 10h came off on 2026-08-07 (owner: 5~9시간만).
 *  3. 🔴 A translation pass translated the LABELS — ["4시간","10시간"],
 *     ["균일가"] — while `prices` stayed keyed "4h"/"10h"/"flat". Since prices
 *     are read as `tier.prices[duration]`, every lookup returned undefined and
 *     the rate card rendered "—" in every cell on ko/ja/zh/zh-TW.
 *     `seoul-suburbs-private-chartered-car-10hr` and
 *     `seoul-dmz-private-3rd-tunnel-suspension-bridge` both shipped that way.
 *     The label is now derived by `chargeDurationLabel.ts`, so the stored value
 *     stays a code and translating it is never the right move again.
 *
 * This goes through `getStaticTourProductFullPageJson` — the loader the product
 * page itself calls — rather than reading files, so a bundle that stops being
 * reachable fails here too.
 *
 * 🔴 Only half the picture lives in this repo. `pricingTiers` is overlaid from
 * the bundle ONLY when the `tour_product_pages` row does not already carry one
 * (`tourProductPageBody.tsx`: the overlay is skipped when the key is defined).
 * Jeju has no DB `pricingTiers` so its bundle serves it; Busan, Seoul-suburbs
 * and DMZ have one, so for those the DB is what renders and this file is the
 * fallback. Fixing here alone does not fix them — check the DB too.
 */
import { getStaticTourProductFullPageJson } from '@/components/product-tour-static/_shared/tourProductBundleRegistry';
import { STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST } from '@/components/product-tour-static/_shared/tourProductBundleSlugs';
import { formatChargeDuration } from '@/components/product-tour-static/_shared/chargeDurationLabel';

const HOUR_GRID_CHARTERS = [
  'jeju-island-private-car-charter-tour',
  'busan-private-car-charter-cruise-shore',
] as const;

const LOCALES = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'] as const;

/** A stored duration is a lookup key: "5h".."9h" or "flat". Never a label. */
const DURATION_CODE = /^(\d+h|flat)$/;

type Pricing = {
  durations?: string[];
  tiers?: Array<{ paxLabel?: string; prices?: Record<string, number> }>;
};

async function pricingOf(slug: string, locale: string): Promise<Pricing | null> {
  const doc = await getStaticTourProductFullPageJson(slug, locale as never);
  return (doc as { pricingTiers?: Pricing } | null)?.pricingTiers ?? null;
}

describe('duration codes stay codes', () => {
  it('no bundle stores a translated duration label', async () => {
    // Swept across every bundle, not just the charters: the damage arrived via
    // the translation pipeline, which does not care which product it is on.
    const offenders: string[] = [];
    for (const slug of STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST) {
      for (const locale of LOCALES) {
        const p = await pricingOf(slug, locale);
        for (const d of p?.durations ?? []) {
          if (!DURATION_CODE.test(d)) offenders.push(`${slug} ${locale}: ${JSON.stringify(d)}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('every offered duration has a price to look up', async () => {
    // `tier.prices[duration]` is the lookup in the booking card, the sticky bar
    // and the rate card. A duration with no matching key renders "—".
    const gaps: string[] = [];
    for (const slug of STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST) {
      for (const locale of LOCALES) {
        const p = await pricingOf(slug, locale);
        if (!p?.durations) continue;
        for (const tier of p.tiers ?? []) {
          for (const d of p.durations) {
            if (typeof tier.prices?.[d] !== 'number') {
              gaps.push(`${slug} ${locale} ${tier.paxLabel ?? '?'} ${d}`);
            }
          }
        }
      }
    }
    expect(gaps).toEqual([]);
  });
});

describe('the charter hour grid is 5h–9h', () => {
  it.each(HOUR_GRID_CHARTERS)('%s offers exactly 5h through 9h', async (slug) => {
    for (const locale of LOCALES) {
      const p = await pricingOf(slug, locale);
      expect(`${locale}:${JSON.stringify(p?.durations)}`).toBe(
        `${locale}:${JSON.stringify(['5h', '6h', '7h', '8h', '9h'])}`,
      );
    }
  });

  it.each(HOUR_GRID_CHARTERS)('%s prices every hour for every party size', async (slug) => {
    for (const locale of LOCALES) {
      const p = await pricingOf(slug, locale);
      expect(p?.tiers?.length ?? 0).toBeGreaterThan(0);
      for (const tier of p!.tiers!) {
        const priced = Object.keys(tier.prices ?? {}).sort();
        expect(`${locale} ${tier.paxLabel}: ${priced.join(',')}`).toBe(
          `${locale} ${tier.paxLabel}: ${['5h', '6h', '7h', '8h', '9h'].sort().join(',')}`,
        );
      }
    }
  });

  it.each(HOUR_GRID_CHARTERS)('%s no longer carries the retired 4h or 10h', async (slug) => {
    for (const locale of LOCALES) {
      const p = await pricingOf(slug, locale);
      const retired = [
        ...(p?.durations ?? []).filter((d) => d === '4h' || d === '10h'),
        ...(p?.tiers ?? []).flatMap((t) =>
          Object.keys(t.prices ?? {}).filter((k) => k === '4h' || k === '10h'),
        ),
      ];
      expect(`${locale}:${retired.join(',')}`).toBe(`${locale}:`);
    }
  });
});

describe('duration labels are localized in code, not in data', () => {
  it('renders hour codes in each locale', () => {
    expect(formatChargeDuration('5h', 'ko')).toBe('5시간');
    expect(formatChargeDuration('9h', 'ja')).toBe('9時間');
    expect(formatChargeDuration('7h', 'zh')).toBe('7小时');
    expect(formatChargeDuration('7h', 'zh-TW')).toBe('7小時');
    expect(formatChargeDuration('6h', 'es')).toBe('6 h');
    expect(formatChargeDuration('6h', 'en')).toBe('6h');
  });

  it('renders the flat-rate code, which is not an hour count', () => {
    expect(formatChargeDuration('flat', 'ko')).toBe('균일가');
    expect(formatChargeDuration('flat', 'zh-TW')).toBe('統一價');
    expect(formatChargeDuration('flat', 'en')).toBe('Flat rate');
  });

  it('falls back to English for an unknown locale and passes through an unknown code', () => {
    expect(formatChargeDuration('5h', 'pt')).toBe('5h');
    // A new tier shape should look odd on screen, not vanish from the picker.
    expect(formatChargeDuration('half-day', 'ko')).toBe('half-day');
  });
});
