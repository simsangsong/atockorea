/**
 * privacy.* i18n parity across all 10 site locales, plus two rules that are
 * not about parity at all.
 *
 * The privacy policy lives in ONE page (`app/privacy/page.tsx`) with no locale
 * in the URL — every sentence is a `t('privacy.…')` lookup. So a locale that is
 * missing a bullet does not fail to build and does not throw: it renders the
 * key name, or an English sentence, in the middle of a legal document. tsc says
 * nothing, because these bundles are plain JSON.
 *
 * 🔴 The second rule is the section NUMBERING. The "15." in the Google API
 * heading is quoted in our Google OAuth verification submission. Renumbering
 * these sections would leave that filing pointing at the wrong text, so new
 * sections are appended and numbered, never inserted.
 */
import de from '@/messages/de.json';
import en from '@/messages/en.json';
import es from '@/messages/es.json';
import fr from '@/messages/fr.json';
// ⚠ Named `itIT`, not `it` — a default import called `it` shadows Jest's own
// `it` and the whole suite dies at collection time with a type error that
// points at the wrong line.
import itIT from '@/messages/it.json';
import ja from '@/messages/ja.json';
import ko from '@/messages/ko.json';
import ru from '@/messages/ru.json';
import zh from '@/messages/zh.json';
import zhTW from '@/messages/zh-TW.json';
import fs from 'node:fs';
import path from 'node:path';

const LOCALES: Record<string, Record<string, unknown>> = {
  de, en, es, fr, it: itIT, ja, ko, ru, zh, 'zh-TW': zhTW,
};

type Nested = Record<string, unknown>;

/** `privacy.s16.li1` style leaf paths, so a missing nested bullet is caught. */
function leafPaths(value: unknown, prefix = ''): string[] {
  if (typeof value === 'string') return [prefix];
  if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
  return Object.entries(value as Nested).flatMap(([key, child]) =>
    leafPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

const reference = leafPaths((en as { privacy: Nested }).privacy).sort();

describe('privacy i18n namespace', () => {
  it('covers all 10 site locales with a non-trivial reference key set', () => {
    expect(Object.keys(LOCALES)).toHaveLength(10);
    expect(reference.length).toBeGreaterThan(50);
  });

  it.each(Object.keys(LOCALES))('locale %s carries every privacy leaf, all non-empty', (locale) => {
    const bundle = LOCALES[locale].privacy as Nested | undefined;
    expect(bundle).toBeDefined();
    expect(leafPaths(bundle!).sort()).toEqual(reference);
  });

  it.each(Object.keys(LOCALES))('locale %s has no untranslated placeholder or empty string', (locale) => {
    const bundle = LOCALES[locale].privacy as Nested;
    const flat = leafPaths(bundle);
    for (const leaf of flat) {
      const value = leaf.split('.').reduce<unknown>((acc, k) => (acc as Nested)?.[k], bundle);
      expect(typeof value).toBe('string');
      expect(String(value).trim().length).toBeGreaterThan(0);
      expect(String(value)).not.toMatch(/^TODO|^TBD|^\{\{/);
    }
  });
});

describe('🔴 section numbering is append-only', () => {
  /**
   * A renumber shows up here as a changed prefix. The assertion is deliberately
   * about the two sections that are cited externally rather than all of them —
   * pinning every heading would turn a copy edit into a test failure.
   */
  it.each(Object.keys(LOCALES))('locale %s still numbers Google API as 15 and conversation data as 16', (locale) => {
    const p = LOCALES[locale].privacy as Nested;
    const googleTitle = String((p.googleApi as Nested).title);
    const s16Title = String((p.s16 as Nested).title);
    expect(googleTitle.trim().startsWith('15.')).toBe(true);
    expect(s16Title.trim().startsWith('16.')).toBe(true);
  });
});

describe('the page renders every s16 key it was given', () => {
  const source = fs.readFileSync(
    ['(marketing)/privacy', 'privacy']
      .map((rel) => path.resolve(__dirname, '..', '..', 'app', ...rel.split('/'), 'page.tsx'))
      .find((p) => fs.existsSync(p))!,
    'utf8',
  );

  it('reads the real page (a path typo would pass everything below)', () => {
    expect(source).toContain('privacy.googleApi.title');
  });

  /**
   * Keys are hardcoded in the JSX rather than mapped, so a bullet that exists
   * in all 10 bundles but is never rendered is invisible — the policy would
   * simply be missing a sentence. This checks the two lists agree.
   */
  it('renders exactly the s16 keys that exist in the bundle', () => {
    const inBundle = Object.keys((en as { privacy: Nested }).privacy.s16 as Nested).sort();
    const rendered = [
      ...new Set([...source.matchAll(/privacy\.s16\.([A-Za-z0-9_]+)/g)].map((m) => m[1])),
    ].sort();
    expect(rendered).toEqual(inBundle);
  });

  /**
   * The owner decided not to ship an opt-out sentence: the tool it would
   * promise does not exist yet (`/admin/qa-review` has no "find by guest").
   * Promising a right we cannot honour is worse than stating plainly that
   * nothing is used before a human approves it — which li5 does.
   */
  it('does not promise an opt-out we cannot yet honour', () => {
    const bundleText = JSON.stringify((en as { privacy: Nested }).privacy.s16);
    expect(bundleText).not.toMatch(/opt[- ]?out/i);
    expect(bundleText).not.toMatch(/ask us to (delete|remove)/i);
  });
});
