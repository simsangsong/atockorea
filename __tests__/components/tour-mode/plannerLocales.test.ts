/**
 * P7.9 — the planner speaks ten languages, proved without a browser.
 *
 * 🔴 Lesson from the N4 round: a browser walk that reports "three locales
 * passed" can be the same locale three times. The room's viewer language is not
 * the device language — it is chosen per booking at join — so a walk proves one
 * locale per run at best, and proves it silently. Ten-locale coverage is a
 * DATA property, so it is checked as one.
 *
 * P7 touched copy twice (P7.4 rewrote every `emptyStops` when a section moved),
 * and copy edits are exactly where a locale quietly falls back to English:
 * nothing throws, nothing looks broken, a French guest just reads English.
 */
import { COPY, PLAN_STATUS_COPY, ROOM_LOCALE_VALUES } from '@/components/tour-mode/plan/planCopy';
import { ROOM_LOCALES } from '@/lib/tour-room/snapshot';

/** Keys whose value is legitimately identical across locales (proper nouns, symbols). */
const SHARED_BY_DESIGN = new Set<string>(['kstNote']);

function stringEntries(table: Record<string, unknown>): Array<[string, string]> {
  return Object.entries(table).filter((e): e is [string, string] => typeof e[1] === 'string');
}

describe('planner locales (P7.9)', () => {
  it('the locale list is the shared one, not a second copy', () => {
    expect(ROOM_LOCALE_VALUES).toBe(ROOM_LOCALES);
    expect(ROOM_LOCALES.length).toBeGreaterThanOrEqual(10);
  });

  it.each([
    ['COPY', COPY],
    ['PLAN_STATUS_COPY', PLAN_STATUS_COPY],
  ])('%s has an entry for every room locale', (_name, table) => {
    for (const locale of ROOM_LOCALES) {
      expect(Object.keys(table as unknown as Record<string, unknown>)).toContain(locale);
    }
  });

  it.each([
    ['COPY', COPY],
    ['PLAN_STATUS_COPY', PLAN_STATUS_COPY],
  ])('%s: every locale carries every key the English one does', (name, table) => {
    const t = table as unknown as Record<string, Record<string, unknown>>;
    const reference = Object.keys(t.en).sort();
    const missing: string[] = [];
    for (const locale of ROOM_LOCALES) {
      const keys = Object.keys(t[locale]).sort();
      for (const key of reference) if (!keys.includes(key)) missing.push(`${name}/${locale}: ${key}`);
    }
    expect(missing).toEqual([]);
  });

  /**
   * 🔴 The one that actually catches a regression. A key copied from `en` into
   * `fr` during an edit reads as translated to anyone not reading French.
   * Every non-English locale must differ from English on the great majority of
   * its strings; a locale that matches English everywhere is not translated.
   */
  it('no locale is a silent English fallback', () => {
    for (const [name, table] of [
      ['COPY', COPY],
      ['PLAN_STATUS_COPY', PLAN_STATUS_COPY],
    ] as const) {
      const t = table as unknown as Record<string, Record<string, unknown>>;
      const en = new Map(stringEntries(t.en));
      for (const locale of ROOM_LOCALES) {
        if (locale === 'en') continue;
        const entries = stringEntries(t[locale]).filter(([k]) => !SHARED_BY_DESIGN.has(k));
        const identical = entries.filter(([k, v]) => en.get(k) === v);
        const ratio = identical.length / entries.length;
        // Reported as a string so a failure names the locale and the offending
        // keys instead of just printing two numbers.
        const report = `${name}/${locale}: ${(ratio * 100).toFixed(0)}% identical to en (${identical
          .map(([k]) => k)
          .slice(0, 6)
          .join(', ')})`;
        expect(ratio < 0.25 ? 'translated' : report).toBe('translated');
      }
    }
  });

  /** The string P7.4 rewrote in all ten locales — pinned so it cannot half-revert. */
  it('the empty state is translated in every locale and points nowhere', () => {
    const UPWARD = ['above', 'ci-dessus', 'oben', 'qui sopra', 'arriba', '위에서', '上方', '上で', 'выше'];
    const seen = new Set<string>();
    for (const locale of ROOM_LOCALES) {
      const value = (COPY as unknown as Record<string, Record<string, string>>)[locale].emptyStops;
      expect(typeof value).toBe('string');
      expect(value.length).toBeGreaterThan(10);
      for (const word of UPWARD) expect(value).not.toContain(word);
      seen.add(value);
    }
    // Ten distinct strings — not one string ten times.
    expect(seen.size).toBe(ROOM_LOCALES.length);
  });
});
