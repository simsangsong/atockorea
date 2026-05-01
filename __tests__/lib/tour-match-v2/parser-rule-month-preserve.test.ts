/**
 * Regression: rule-based parser must preserve user-stated months even when
 * a season_lock keyword is also present. Bug #3 of the v1.9 hardening — old
 * behavior was to override months=[5] with [3,4] for "5월 벚꽃" via
 * `intersect.length ? intersect : [...info.months]`.
 */

import { ruleParse } from "@/lib/tour-match-v2/parser-rule";

describe("ruleParse — user month authority", () => {
  test("'5월 벚꽃' → months=[5], season_locks=['cherry_blossom']", () => {
    const out = ruleParse("5월 벚꽃 보고싶어요");
    expect(out.months).toEqual([5]);
    expect(out.season_locks).toContain("cherry_blossom");
  });

  test("'August camellia Jeju' → months=[8], camellia lock retained, no override", () => {
    // camellia naturally peaks Dec-Feb but the user said August. The parser
    // must keep months=[8] so the seasonal-gate can correctly reject the tour.
    const out = ruleParse("August camellia tour Jeju");
    expect(out.months).toEqual([8]);
    expect(out.season_locks).toContain("snow_camellia");
    expect(out.regions).toContain("jeju");
  });

  test("'벚꽃' alone (no month) → months stays null so seasonal-gate uses today fallback", () => {
    const out = ruleParse("벚꽃 보고싶어요");
    expect(out.months).toBeNull();
    expect(out.season_locks).toContain("cherry_blossom");
  });

  test("'4월 벚꽃' → months=[4] (intersection happens to align)", () => {
    const out = ruleParse("4월 벚꽃 제주 가족");
    expect(out.months).toEqual([4]);
    expect(out.season_locks).toContain("cherry_blossom");
    expect(out.regions).toContain("jeju");
    expect(out.personas).toContain("families");
  });

  test("'spring tour' (generic season, no lock) → months=[3,4,5], no season_lock", () => {
    const out = ruleParse("spring day tour Korea");
    expect(out.months).toEqual([3, 4, 5]);
    expect(out.season_locks).toEqual([]);
  });
});
