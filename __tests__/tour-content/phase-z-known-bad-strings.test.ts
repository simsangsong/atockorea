/**
 * Phase Z — verification harness for the tour-content EN fix track.
 *
 * Master plan §6.7 Phase Z requires a smoke test that ALL fabricated /
 * leaked / stale / encoding-mojibake strings retired in phases 1a–7 are
 * permanently gone from every EN tour bundle. This test reads each EN
 * bundle's raw JSON text and asserts none of the known-bad patterns
 * survive — a sweep is easier to maintain than 33 individual snapshots,
 * and a CI failure here means a fabrication has crept back in.
 *
 * One context-aware split:
 *   - `Ocean Suites Jeju Hotel` is a real hotel-pickup option on the
 *     non-cruise Jeju tours' `pickup_dropoff.departure` list. It must
 *     NOT appear on the CRUISE tours (whose pickup is cruise terminals).
 *     The cruise-only assertion is split out so the non-cruise tours
 *     keep their hotel-pickup data.
 *
 * If a needle below ever re-appears in the catalog (e.g. a regenerated
 * description bundle re-introduces the stale Silla Gold Crowns sentence),
 * this test fails and prints the offending slug + line snippet so the
 * regression is fixable in a single PR.
 */

import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(
  process.cwd(),
  "components",
  "product-tour-static",
);

const ALL_SLUGS = readdirSync(ROOT).filter((s) =>
  existsSync(join(ROOT, s, `${s}.en.json`)),
);

const CRUISE_SLUGS = ALL_SLUGS.filter((s) => {
  // Cruise shore-excursion tours only — pickup must be cruise terminals,
  // not hotel addresses. Catalog tours that incidentally serve cruise
  // passengers but are sold as Seoul/Jeju day tours stay on hotel pickup.
  return (
    s.includes("cruise-shore-excursion") ||
    s.endsWith("-cruise-shore-excursion-bus-tour") ||
    s.endsWith("-cruise-shore-excursion-small-group-tour")
  );
});

function readBundle(slug: string): string {
  return readFileSync(join(ROOT, slug, `${slug}.en.json`), "utf8");
}

/**
 * Patterns that must NOT appear in ANY EN bundle. Each entry is
 * `[needle, description]`; `needle` is searched as a plain substring
 * unless its first char is `/` (regex literal w/ flags `gi`).
 */
const GLOBAL_FORBIDDEN: ReadonlyArray<[string, string]> = [
  ["similar local route", "Authoring stub from Phase 1a"],
  [" tour tour", "Duplicated word typo (Phase 7)"],
  ["A easy-to-follow", "Article typo (Phase 7) — should be 'An easy-to-follow'"],
  ["the our year-round", "Doubled-determiner typo (Phase 7)"],
  ["Love Korea Tours", "Third-party operator name leak (Phase 1a)"],
  ["4.9/5 across", "Fabricated review aggregate (Phase 1a)"],
  ["4.9/5 rating across", "Fabricated review aggregate (Phase 1a / Z residual)"],
  ["4.8/5 (", "Fabricated review aggregate (Phase 1a)"],
  ["4.8/5 rating across", "Fabricated review aggregate (Phase 1a / Z residual)"],
  ["world's largest seated bronze", "UNESCO over-claim (Phase 4a)"],
  ["world's oldest Seon", "Sinheungsa over-claim (Phase 4a)"],
  ["only UNESCO Biosphere", "Seoraksan over-claim (Phase 4a)"],
  ["Korea's only walled fortress,", "Hwaseong over-claim (Phase 5a, trailing comma form)"],
  ["? photo", "Encoding mojibake (Phase 7) — em-dash should be '— photo'"],
  ["220m Gamaksan", "DMZ bridge over-claim (Phase 7) — should be 150m"],
  [
    "Gamaksan Red Suspension Bridge — 220 meters",
    "DMZ bridge over-claim (Phase 7) — should be 150 meters",
  ],
  ["stretches 220 meters across", "DMZ bridge over-claim (loc-B residual) — should be 150"],
  ["at 220 meters", "DMZ bridge over-claim (loc-B residual) — should be 150"],
  ["50M viewers", "Jewel in the Palace over-claim (Phase 5b) — Korea pop. ~52M; actual was peak ~57% MBC rating"],
  ["Camellia Hill ₩10,000", "Camellia Hill stale adult fee (Phase 5b) — VisitKorea official ₩12,000"],
  ["Camellia Hill (10,000 KRW)", "Camellia Hill stale adult fee (Phase 5b) — should be 12,000 KRW"],
  ["22 themed gardens", "Garden of Morning Calm over-count (Phase 5b) — VisitKorea official = 20"],
  ["route route option", "duplicated-word typo (P1 audit) — should be 'route option'"],
  ["schedule schedule", "duplicated-word typo (P1 audit) — should be just one 'schedule'"],
  ["small-group group", "duplicated-word typo (P1 audit) — should be 'small-group'"],
  ["1100 Road road-closure", "duplicated-word typo (P1 audit) — should be '1100 Road closure'"],
  ["Visit Korea Korea Foundation", "org-name conflation (P1 audit) — should be 'Korea Foundation'"],
  ["once daily at 14:00", "Haenyeo timing stale (Phase 5b residual) — VisitKorea official is twice daily 13:30 + 15:00"],
  ["once daily at 14:00 (1 show/day)", "Haenyeo timing stale (Phase 5b residual) — should be 13:30 / 15:00 twice daily"],
  // Note: guide first-name leaks (Steven / Chloe / Jina / Hays) need word-boundary regex
  // because "Jina" overlaps with no current real word but "Hays" is rare. Use regex.
];

const GLOBAL_FORBIDDEN_REGEX: ReadonlyArray<[RegExp, string]> = [
  [/\bSteven\b/, "Guide first-name leak (Phase 1a)"],
  [/\bChloe\b/, "Guide first-name leak (Phase 1a)"],
  [/\bJina\b/, "Guide first-name leak (Phase 1a)"],
  [/\bHays\b/, "Guide first-name leak (Phase 1a)"],
  [/\bSunny\b/, "Guide first-name leak (Phase 1a)"],
];

const CRUISE_ONLY_FORBIDDEN: ReadonlyArray<[string, string]> = [
  // Cruise pickup is at the port; the Phase 2a fix removed the old hotel
  // lobby list. Hotel pickup is fine on NON-cruise tours, so this is
  // checked only on the cruise bundles.
  ["Ocean Suites Jeju Hotel", "Hotel pickup on a cruise page (Phase 2a)"],
  ["LOTTE City Hotel Jeju", "Hotel pickup on a cruise page (Phase 2a)"],
  ["Shilla Duty Free", "Hotel pickup on a cruise page (Phase 2a)"],
];

function findContextLine(raw: string, idx: number): string {
  const start = raw.lastIndexOf("\n", idx) + 1;
  const end = raw.indexOf("\n", idx);
  return raw.slice(start, end === -1 ? raw.length : end).trim();
}

describe("Phase Z — catalog known-bad strings sweep", () => {
  it("loads the 33 EN bundles from disk", () => {
    expect(ALL_SLUGS.length).toBeGreaterThanOrEqual(33);
  });

  it("identifies the cruise bundles", () => {
    expect(CRUISE_SLUGS.length).toBeGreaterThanOrEqual(2);
    expect(CRUISE_SLUGS).toEqual(
      expect.arrayContaining([
        "jeju-cruise-shore-excursion-bus-tour",
        "jeju-cruise-shore-excursion-small-group-tour",
      ]),
    );
  });

  describe("global forbidden literal patterns (must be 0 in every bundle)", () => {
    const offenders: Array<{ slug: string; needle: string; reason: string; ctx: string }> = [];

    beforeAll(() => {
      for (const slug of ALL_SLUGS) {
        const raw = readBundle(slug);
        for (const [needle, reason] of GLOBAL_FORBIDDEN) {
          const idx = raw.indexOf(needle);
          if (idx !== -1) {
            offenders.push({ slug, needle, reason, ctx: findContextLine(raw, idx) });
          }
        }
      }
    });

    it("reports zero offenders across all bundles", () => {
      const report = offenders.map(
        (o) => `  ${o.slug}: "${o.needle}" (${o.reason})\n      ↳ ${o.ctx.slice(0, 140)}`,
      );
      expect(offenders).toEqual([]);
      // The above assertion is enough; the report below only renders on
      // failure to surface the offending slugs at a glance.
      void report;
    });
  });

  describe("global forbidden regex patterns (must be 0 in every bundle)", () => {
    const offenders: Array<{ slug: string; pattern: string; reason: string; ctx: string }> = [];

    beforeAll(() => {
      for (const slug of ALL_SLUGS) {
        const raw = readBundle(slug);
        for (const [re, reason] of GLOBAL_FORBIDDEN_REGEX) {
          const m = raw.match(re);
          if (m) {
            const idx = raw.indexOf(m[0]);
            offenders.push({ slug, pattern: String(re), reason, ctx: findContextLine(raw, idx) });
          }
        }
      }
    });

    it("reports zero regex offenders across all bundles", () => {
      expect(offenders).toEqual([]);
    });
  });

  describe("cruise-only forbidden patterns (must be 0 on cruise bundles)", () => {
    const offenders: Array<{ slug: string; needle: string; reason: string; ctx: string }> = [];

    beforeAll(() => {
      for (const slug of CRUISE_SLUGS) {
        const raw = readBundle(slug);
        for (const [needle, reason] of CRUISE_ONLY_FORBIDDEN) {
          const idx = raw.indexOf(needle);
          if (idx !== -1) {
            offenders.push({ slug, needle, reason, ctx: findContextLine(raw, idx) });
          }
        }
      }
    });

    it("reports zero cruise-page offenders", () => {
      expect(offenders).toEqual([]);
    });
  });

  describe("guarded sanity checks", () => {
    it("non-cruise Jeju tours DO list hotel-pickup options (Ocean Suites is allowed there)", () => {
      const oceanSuitesElsewhere = ALL_SLUGS.filter((slug) => {
        if (CRUISE_SLUGS.includes(slug)) return false;
        return readBundle(slug).includes("Ocean Suites Jeju Hotel");
      });
      // At least one non-cruise Jeju tour should still carry this hotel pickup option
      // — confirms the cruise-only assertion above isn't a false negative
      // (i.e. the catalog hasn't lost the data, just relocated it correctly).
      expect(oceanSuitesElsewhere.length).toBeGreaterThan(0);
    });
  });
});
