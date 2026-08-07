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
  // Joined the same curve on 2026-08-07 (owner). Its slug still says "10hr" —
  // that is deliberate, the live OTA listing URLs point at it.
  'seoul-suburbs-private-chartered-car-10hr',
  // New 2026-08-07 — the hotel-pickup Busan charter, sold 5h–9h. It took over
  // the hour grid from the cruise SKU below on the same day.
  'busan-private-car-charter-city-tour',
] as const;

/**
 * Charters sold as ONE cell, where the guest picks no duration at all.
 *
 * `busan-private-car-charter-cruise-shore` was on the hour grid until
 * 2026-08-07, when the owner fixed it at 8 hours / ₩380,000 → US$265. Moving it
 * here rather than deleting the assertion matters: a flat charter has its own
 * way of going wrong (a second duration creeping back, or a tier priced under a
 * key nothing selects), and `durations.length === 1` is what makes the booking
 * card hide the duration picker and the rate sheet head its column "Price".
 *
 * ⚠ `incheon-seoul-private-car-shore-excursion-cruise` belongs here by the same
 * owner decision — its DB row is `["flat"]` at 419 — but its BUNDLE still holds
 * a 4h–10h grid, including the 4h and 10h tiers retired earlier. It is not
 * listed because it would fail, and it would fail because it is genuinely wrong,
 * not because the rule is. Reported separately; fixing the bundle is the fix.
 */
const FLAT_RATE_CHARTERS = ['busan-private-car-charter-cruise-shore'] as const;

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

describe('price is the same number in every language', () => {
  /**
   * 🔴 Found twice on 2026-08-07. `busan-private-car-charter-cruise-shore` had
   * de/fr/it/ru on a different pricing MODEL entirely — bands 1–6 / 7–12 / 13+
   * at $359 / $718 / $1077, one/two/three vehicles — while the six sold locales
   * ran a per-vehicle 5h–9h curve. And `seoul-suburbs` had a bundle grid that
   * disagreed with its own DB row.
   *
   * A price is a number, not copy. If two locales of one product disagree, one
   * of them is quoting a figure nobody decided.
   */
  it.each(STATIC_TOUR_PRODUCT_BUNDLE_SLUG_LIST)('%s quotes one price per tier', async (slug) => {
    const seen = new Map<string, string>();
    const clashes: string[] = [];
    for (const locale of LOCALES) {
      const p = await pricingOf(slug, locale);
      if (!p) continue;
      // paxLabel is copy and may legitimately differ; the bands and the money
      // may not. Key by the band so a reordered tier list still compares right.
      const shape = JSON.stringify({
        durations: p.durations,
        tiers: (p.tiers ?? [])
          .map((t) => [
            (t as { paxMin?: number }).paxMin,
            (t as { paxMax?: number }).paxMax,
            t.prices,
          ])
          .sort((a, b) => Number(a[0] ?? 0) - Number(b[0] ?? 0)),
      });
      const first = [...seen.entries()][0];
      if (first && first[1] !== shape) clashes.push(`${locale} differs from ${first[0]}`);
      seen.set(locale, shape);
    }
    expect(clashes).toEqual([]);
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

describe('a flat-rate charter offers exactly one cell', () => {
  it.each(FLAT_RATE_CHARTERS)('%s stores a single "flat" duration', async (slug) => {
    for (const locale of LOCALES) {
      const p = await pricingOf(slug, locale);
      expect(`${locale}:${JSON.stringify(p?.durations)}`).toBe(`${locale}:${JSON.stringify(['flat'])}`);
    }
  });

  it.each(FLAT_RATE_CHARTERS)('%s prices every party size under that one key', async (slug) => {
    for (const locale of LOCALES) {
      const p = await pricingOf(slug, locale);
      expect(p?.tiers?.length ?? 0).toBeGreaterThan(0);
      for (const tier of p!.tiers!) {
        expect(`${locale} ${tier.paxLabel}: ${Object.keys(tier.prices ?? {}).join(',')}`).toBe(
          `${locale} ${tier.paxLabel}: flat`,
        );
      }
    }
  });

  it.each(FLAT_RATE_CHARTERS)('%s carries no leftover hour tier', async (slug) => {
    for (const locale of LOCALES) {
      const p = await pricingOf(slug, locale);
      const hours = [
        ...(p?.durations ?? []).filter((d) => /^\d+h$/.test(d)),
        ...(p?.tiers ?? []).flatMap((t) => Object.keys(t.prices ?? {}).filter((k) => /^\d+h$/.test(k))),
      ];
      expect(`${locale}:${hours.join(',')}`).toBe(`${locale}:`);
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
