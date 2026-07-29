/**
 * N4 — the empty chat is a place, and it stays one.
 *
 * The empty feed is the only screen in the app that gets a whole viewport to
 * explain what this room can do, and every guest sees it exactly once — right
 * when they have arrived and know least. It is also, being empty, the screen
 * most likely to have a locale quietly fall out of it without anyone noticing:
 * nothing throws, nothing looks broken, a French guest just reads English.
 */

import { render, screen } from '@testing-library/react';
import ChatFeed from '@/components/tour-mode/ChatFeed';
import fs from 'node:fs';
import path from 'node:path';

const SOURCE = fs.readFileSync(
  path.resolve(__dirname, '..', '..', '..', 'components', 'tour-mode', 'ChatFeed.tsx'),
  'utf8',
);

/** The nine room locales plus en — the full ROOM_LOCALES set. */
const ROOM_LOCALES = ['en', 'ko', 'ja', 'es', 'zh', 'zh-TW', 'fr', 'de', 'ru', 'it'] as const;

function blockFor(name: string): string {
  const start = SOURCE.indexOf(`const ${name}`);
  expect(start).toBeGreaterThan(-1);
  // Walk braces so a nested object cannot truncate the slice (G1's
  // "no fixed-window guessing").
  let depth = 0;
  let i = SOURCE.indexOf('{', start);
  const from = i;
  for (; i < SOURCE.length; i += 1) {
    if (SOURCE[i] === '{') depth += 1;
    else if (SOURCE[i] === '}') {
      depth -= 1;
      if (depth === 0) break;
    }
  }
  return SOURCE.slice(from, i + 1);
}

describe('the scanner read the real component', () => {
  it('found both copy blocks', () => {
    expect(SOURCE.length).toBeGreaterThan(1000);
    expect(blockFor('EMPTY_HINTS').length).toBeGreaterThan(500);
    expect(blockFor('EMPTY_COPY').length).toBeGreaterThan(500);
  });
});

describe('🔴 EMPTY_HINTS covers every locale for both roles', () => {
  const block = blockFor('EMPTY_HINTS');

  it('has a customer and an operator branch', () => {
    expect(block).toMatch(/customer:\s*\{/);
    expect(block).toMatch(/operator:\s*\{/);
  });

  it.each(ROOM_LOCALES)('locale %s appears in both roles', (locale) => {
    const key = locale.includes('-') ? `'${locale}'` : locale;
    // Two roles → the key must appear at least twice.
    const occurrences = block.split(`${key}: [`).length - 1;
    expect(occurrences).toBe(2);
  });

  /**
   * The tuple type already makes tsc reject a wrong count, but tsc is only run
   * by people who run tsc. This keeps the invariant visible in the test output
   * that CI prints.
   */
  it('gives exactly three lines to every locale in every role', () => {
    const tuples = block.match(/\[\s*\n(?:\s*'(?:[^'\\]|\\.)*',?\s*\n)+\s*\]/g) ?? [];
    expect(tuples.length).toBe(ROOM_LOCALES.length * 2);
    for (const tuple of tuples) {
      const lines = tuple.split('\n').filter((l) => /^\s*'/.test(l));
      expect(lines).toHaveLength(3);
    }
  });

  it('leaves no line untranslated (no duplicate English across locales)', () => {
    // A copy-paste that forgot to translate shows up as the same sentence in
    // two locales. English is the source, so any repeat beyond it is a miss.
    const strings = (block.match(/'(?:[^'\\]|\\.){12,}'/g) ?? []).map((s) => s.slice(1, -1));
    const seen = new Map<string, number>();
    for (const s of strings) seen.set(s, (seen.get(s) ?? 0) + 1);
    const repeated = [...seen.entries()].filter(([, n]) => n > 1).map(([s]) => s);
    // zh and zh-TW legitimately share lines where simplified and traditional
    // forms are identical, so allow a small, explicit number rather than zero.
    expect(repeated.length).toBeLessThanOrEqual(6);
  });
});

describe('N4 does not become a second chip row (U-D20v2)', () => {
  it('renders the hints as list items, not buttons', () => {
    const render = SOURCE.slice(SOURCE.indexOf('chat-empty-hints'));
    const block = render.slice(0, 800);
    expect(block).toMatch(/<li\b/);
    expect(block).not.toMatch(/<button\b/);
    expect(block).not.toMatch(/tr-chip-tap/);
  });

  it('hides the bullet markers from assistive tech', () => {
    const render = SOURCE.slice(SOURCE.indexOf('chat-empty-hints'), SOURCE.indexOf('chat-empty-hints') + 800);
    expect(render).toMatch(/aria-hidden="true"/);
  });

  /** CJK has no spaces, so an unguarded line breaks mid-word (CLAUDE.md P1-5). */
  it('marks the hint text as CJK-safe body copy', () => {
    const render = SOURCE.slice(SOURCE.indexOf('chat-empty-hints'), SOURCE.indexOf('chat-empty-hints') + 800);
    expect(render).toMatch(/text-cjk-body/);
  });
});

/**
 * Rendered, not just scanned.
 *
 * The Playwright walk could only ever show the room's OWN language (the viewer
 * locale is a per-booking choice made at join, not the device language), so a
 * browser run proves one locale at a time and quietly proves English three
 * times. Rendering the component directly is what actually demonstrates that a
 * French guest reads French.
 */
describe('every locale renders its own words', () => {
  const FIRST_LINE: Record<string, string> = {
    en: 'Write in your own language',
    ko: '편한 언어로 쓰세요',
    ja: 'お好きな言語でどうぞ',
    es: 'Escribe en tu idioma',
    zh: '用你习惯的语言写就行',
    'zh-TW': '用你習慣的語言寫就行',
    fr: 'Écrivez dans votre langue',
    de: 'Schreiben Sie in Ihrer Sprache',
    ru: 'Пишите на своём языке',
    it: 'Scriva nella Sua lingua',
  };

  it.each(ROOM_LOCALES)('guest locale %s sees three hints in that language', (locale) => {
    render(<ChatFeed messages={[]} viewerLocale={locale} viewerRole="customer" />);
    const items = screen.getByTestId('chat-empty-hints').querySelectorAll('li');
    expect(items).toHaveLength(3);
    expect(items[0].textContent).toContain(FIRST_LINE[locale]);
  });

  it('a guide is not told to wait for their guide (P1-4)', () => {
    const { unmount } = render(<ChatFeed messages={[]} viewerLocale="ko" viewerRole="guide" />);
    const text = screen.getByTestId('chat-empty-state').textContent ?? '';
    expect(text).toContain('한 번만 쓰면');
    expect(text).not.toContain('가이드의 안내가 여기에 도착해요');
    unmount();
  });

  it('a driver gets the operator copy too', () => {
    render(<ChatFeed messages={[]} viewerLocale="en" viewerRole="driver" />);
    expect(screen.getByTestId('chat-empty-state').textContent).toContain('Write once');
  });

  it('disappears the moment there is a message — it is a placeholder, not a header', () => {
    render(
      <ChatFeed
        messages={[
          {
            id: 'm1',
            sender_role: 'guide',
            input_kind: 'text',
            source_text: 'hello',
            translations: {},
            metadata: {},
            created_at: '2026-07-29T01:00:00.000Z',
          },
        ]}
        viewerLocale="en"
        viewerRole="customer"
      />,
    );
    expect(screen.queryByTestId('chat-empty-state')).not.toBeInTheDocument();
  });
});

describe('the role split from P1-4 is preserved', () => {
  it('picks the branch by viewer role, not a fixed key', () => {
    // The original bug: a guide was told to wait for their guide. This block is
    // three times the size, so the same mistake would be three times as loud.
    expect(SOURCE).toMatch(/isOperatorViewer\(viewerRole\)\s*\?\s*'operator'\s*:\s*'customer'/);
    expect(SOURCE).toMatch(/EMPTY_HINTS\[role\]\[viewerLocale\]/);
  });
});
