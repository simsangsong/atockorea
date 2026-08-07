/**
 * @jest-environment jsdom
 *
 * The practical-details accordion must not print raw `**` at guests.
 *
 * 🔴 Found on the live site, not in review. The copy is authored with markdown
 * emphasis but the accordion rendered `{item.preview}` and each content line as
 * plain React children, so the asterisks were literal characters on screen:
 *
 *   "This tour departs **on Mondays, Thursdays and Saturdays only**"
 *
 * 181 strings across 9 accordion types and the whole catalogue were affected —
 * pickup, inclusions, weather policy, seasonal, departure days. It is not a
 * Pocheon problem; the new departure-days copy just followed the house style.
 *
 * These mount the real `renderEmphasis` output — the production code path for
 * every accordion line AND every FAQ answer — and assert on rendered text, not
 * on source. `stripEmphasisMarkers` covers the JSON-LD copy of the same strings.
 */
import React from 'react';
import { render } from '@testing-library/react';
import {
  renderEmphasis,
  splitBoldRuns,
  stripEmphasisMarkers,
} from '@/components/product-tour-static/_shared/inlineEmphasis';
import { renderInline } from '@/components/product-tour-static/east-signature-nature-core/tour-detail-sections/TourPracticalDetails';

const show = (text: string) => render(<div data-testid="out">{renderEmphasis(text)}</div>);

const DEPARTURE =
  'This tour departs **on Mondays, Thursdays and Saturdays only** — please book one of those dates.';

describe('accordion copy rendering', () => {
  it('never leaves a balanced ** on screen', () => {
    const { container } = show(DEPARTURE);
    expect(container.textContent).toContain('on Mondays, Thursdays and Saturdays only');
    expect(container.textContent).not.toContain('**');
  });

  it('emphasises the phrase rather than printing the markers', () => {
    const { container } = show(DEPARTURE);
    const strongs = [...container.querySelectorAll('strong')].map((s) => s.textContent);
    expect(strongs).toContain('on Mondays, Thursdays and Saturdays only');
  });

  it('keeps the existing time highlighting inside a bold run', () => {
    // "**08:00**" must be bold from markdown AND still get the tabular-nums time
    // treatment that predates this change — bold must not swallow it.
    //
    // Asserts on the ACCORDION's composition (renderInline = emphasis wrapped
    // around the time/price highlighter), not on the shared helper, because
    // that pairing is the thing that could regress.
    const { container } = render(
      <div>{renderInline('Pickup is **08:00** at Hongdae.')}</div>,
    );
    expect(container.textContent).toBe('Pickup is 08:00 at Hongdae.');
    expect(container.querySelector('strong')).not.toBeNull();
    expect(container.querySelector('.tabular-nums')?.textContent).toBe('08:00');
  });

  it('leaves an unbalanced marker exactly as authored', () => {
    const { container } = show('A lone ** marker stays put.');
    expect(container.textContent).toBe('A lone ** marker stays put.');
  });

  it('leaves copy with no markers byte-identical', () => {
    const plain = 'Pickup points are Hongik Univ. Station Exit 8 and Myeongdong Station Exit 2.';
    const { container } = show(plain);
    expect(container.textContent).toBe(plain);
  });

  it('handles several bold runs in one line', () => {
    const { container } = show('**A** then **B** then plain.');
    expect(container.textContent).toBe('A then B then plain.');
    expect([...container.querySelectorAll('strong')].map((s) => s.textContent)).toEqual(['A', 'B']);
  });
});

describe('splitBoldRuns (the tokenizer)', () => {
  it('is non-vacuous on real catalogue copy', () => {
    const runs = splitBoldRuns(DEPARTURE);
    expect(runs.length).toBeGreaterThan(1);
    expect(runs.filter((r) => r.bold).map((r) => r.text)).toEqual([
      'on Mondays, Thursdays and Saturdays only',
    ]);
  });

  it('does not treat an empty **** as emphasis', () => {
    expect(splitBoldRuns('a ** ** b').every((r) => !r.bold)).toBe(true);
  });

  it('round-trips the visible text', () => {
    for (const s of [DEPARTURE, 'no markers', '**all bold**', 'a ** b', '**x** y **z**']) {
      expect(splitBoldRuns(s).map((r) => r.text).join('')).toBe(s.replace(/\*\*(?=\S)([\s\S]*?\S)\*\*/g, '$1'));
    }
  });
});

describe('stripEmphasisMarkers (JSON-LD / machine-read copy)', () => {
  it('removes markers without altering anything else', () => {
    expect(stripEmphasisMarkers(DEPARTURE)).toBe(
      'This tour departs on Mondays, Thursdays and Saturdays only — please book one of those dates.',
    );
  });

  it('leaves unbalanced markers alone, like the renderer does', () => {
    expect(stripEmphasisMarkers('a ** b')).toBe('a ** b');
  });

  it('is what the FAQ rich result actually receives', () => {
    // Google ingests this verbatim; an asterisk there is noise in the SERP.
    expect(stripEmphasisMarkers('It runs **on Mondays only**.')).not.toContain('*');
  });
});
