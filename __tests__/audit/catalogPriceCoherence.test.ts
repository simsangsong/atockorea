/**
 * Standing gate — one product, one price.
 *
 * 🔴 Why this file exists. On 2026-08-07 `jeju-grand-highlights-loop` was
 * quoting three different numbers at once:
 *
 *     catalogRegistrationBuilder.ts   listPriceUsd 93   ← the live copy: feeds
 *                                                        /api/tours, /match,
 *                                                        the chatbot, the
 *                                                        recommendations rail
 *                                                        and /tours/list
 *     staticTourProductRegistry.ts    listPriceUsd 79   ← a second copy of the
 *                                                        same map, in a module
 *                                                        with no importers
 *     bundle price.amountLabel        80                ← and tours.price, the
 *                                                        default offer and
 *                                                        detail_payload.price
 *
 * Measured on a real render: the catalogue card said "$93" and the product page
 * said ₩113,863, which is $80 at that day's rate. A guest was quoted 16% above
 * what checkout would charge. The two copies had drifted on THIRTEEN slugs in
 * total — the dead one was free to rot because no screen contradicted it.
 *
 * The duplication is gone: the registry now imports the map. These assertions
 * keep it gone, and pin the invariant rather than today's numbers so they
 * survive repricing. Measured over all 32 overrides when written: zero false
 * positives, one real defect.
 */
import { readFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { SLUG_OVERRIDES } from '@/components/product-tour-static/catalog/catalogRegistrationBuilder';
import { PAGES } from '@/components/product-tour-static/catalog/catalogCards.en.generated';

const ROOT = process.cwd();
const STATIC_ROOT = path.join(ROOT, 'components/product-tour-static');
const CATALOG_DIR = path.join(STATIC_ROOT, 'catalog');

/** The bundle's own authored price — what the DB row is seeded from. */
function bundlePrice(slug: string): number | null {
  const p = path.join(STATIC_ROOT, slug, `${slug}.en.json`);
  if (!existsSync(p)) return null;
  const label = JSON.parse(readFileSync(p, 'utf8'))?.price?.amountLabel ?? '';
  if (!label) return null;
  const n = Number(String(label).replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) && n > 0 ? n : null;
}

describe('there is exactly one price-override map', () => {
  // 🔴 The whole defect above was two maps plus a comment claiming one. A
  // second `const SLUG_OVERRIDES = {` anywhere means the drift can start again.
  const declaring = readdirSync(CATALOG_DIR)
    .filter((f) => f.endsWith('.ts'))
    .filter((f) => /(?:const|let|var)\s+SLUG_OVERRIDES\s*[:=]/.test(readFileSync(path.join(CATALOG_DIR, f), 'utf8')));

  it('only catalogRegistrationBuilder.ts declares SLUG_OVERRIDES', () => {
    expect(declaring).toEqual(['catalogRegistrationBuilder.ts']);
  });

  it('and it is a non-trivial map', () => {
    expect(Object.keys(SLUG_OVERRIDES).length).toBeGreaterThan(10);
  });
});

describe('an override must not contradict the bundle it overrides', () => {
  const cases = Object.entries(SLUG_OVERRIDES)
    .map(([slug, o]) => [slug, o.listPriceUsd, bundlePrice(slug)] as const)
    .filter(([, ov, bp]) => ov != null && bp != null);

  it('has bundles to compare against (absence would make this file vacuous)', () => {
    expect(cases.length).toBeGreaterThan(10);
  });

  it.each(cases)('%s override %s matches bundle %s', (_slug, ov, bp) => {
    // Same number, not "close enough" — a cent of drift is still two prices.
    expect(ov as number).toBeCloseTo(bp as number, 2);
  });
});

/**
 * 🔴 The third copy. `catalogCards*.generated.ts` is built from the bundles by
 * `scripts/build-catalog-cards.mjs` and committed — so a session holding an
 * older tree can regenerate, commit, and silently roll a price back on every
 * surface that reads the generated data, with the override/bundle assertions
 * above still green.
 *
 * Found live on 2026-08-07: a parallel worktree was sitting on uncommitted
 * generated cards quoting the Busan private charter at $364 and the Incheon
 * charter at $424, two and one repricings behind respectively. Nothing would
 * have caught that at merge time.
 *
 * Fix on failure: `node scripts/build-catalog-cards.mjs`, then commit the output.
 */
describe('the generated catalogue cards must match the bundles they were built from', () => {
  const stale: string[] = [];
  for (const [slug, page] of Object.entries(PAGES)) {
    const generated = Number(String(page?.price?.amountLabel ?? '').replace(/[^0-9.]/g, ''));
    const authored = bundlePrice(slug);
    if (authored == null || !Number.isFinite(generated) || generated <= 0) continue;
    if (Math.abs(generated - authored) > 0.005) {
      stale.push(`${slug}: generated ${generated} vs bundle ${authored}`);
    }
  }

  it('compared a meaningful number of cards (absence would make this vacuous)', () => {
    const comparable = Object.keys(PAGES).filter(
      (s) => bundlePrice(s) != null && Number(String(PAGES[s]?.price?.amountLabel ?? '').replace(/[^0-9.]/g, '')) > 0,
    );
    expect(comparable.length).toBeGreaterThan(10);
  });

  it('no generated card quotes a price its bundle does not', () => {
    expect(stale).toEqual([]);
  });
});

describe('a compare-at price must actually be a discount', () => {
  const withCompare = Object.entries(SLUG_OVERRIDES).filter(([, o]) => o.compareAtPriceUsd != null);

  it.each(withCompare)('%s compare-at is above its list price', (_slug, o) => {
    expect(o.listPriceUsd).toBeDefined();
    expect(o.compareAtPriceUsd as number).toBeGreaterThan(o.listPriceUsd as number);
  });
});
