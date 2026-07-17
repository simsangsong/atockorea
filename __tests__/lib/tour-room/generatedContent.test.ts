/**
 * W1.5 (P-D16) — auto POI content: refs, prompt contracts, JSON hygiene.
 * The hard rule under test: facts come from Places or get OMITTED — the
 * parser and prompts must never let invented specifics through unmarked.
 */
import {
  buildCriticPrompt,
  buildGenerationPrompt,
  parseGeneratedJson,
  poiRefFor,
  refCandidatesFor,
} from '@/lib/tour-room/generatedContent';
import { hasPoiKbEntry } from '@/lib/tour-room/spotContent';

describe('poiRefFor / refCandidatesFor', () => {
  it('prefers place over poi over name-slug', () => {
    expect(poiRefFor({ place_id: 'ChIJx', poi_key: 'abc', title: 'X' })).toBe('place:ChIJx');
    expect(poiRefFor({ poi_key: 'abc', title: 'X' })).toBe('poi:abc');
    expect(poiRefFor({ title: 'Some Hidden Cafe' })).toBe('name:some-hidden-cafe');
  });

  it('returns all candidates most-specific first', () => {
    expect(refCandidatesFor({ place_id: 'P', poi_key: 'k', title: 'T' })).toEqual(['place:P', 'poi:k', 'name:t']);
    expect(refCandidatesFor({ title: '' })).toEqual([]);
  });
});

describe('generation/critic prompts', () => {
  it('generation prompt carries the no-facts hard rule and the facts block', () => {
    const { system, user } = buildGenerationPrompt({
      title: 'Dongmun Market',
      city: 'Jeju',
      facts: { name: 'Dongmun Market', opening_hours: ['Mon: 8AM–9PM'] },
      locales: ['en', 'ja'],
    });
    expect(system).toContain('OMITTED');
    expect(user).toContain('Dongmun Market');
    expect(user).toContain('Mon: 8AM–9PM');
    expect(user).toContain('en, ja');
  });

  it('generation prompt with no facts says NONE and bans hours/admission', () => {
    const { system, user } = buildGenerationPrompt({ title: 'Hidden Beach', facts: null, locales: ['en'] });
    expect(user).toContain('FACTS (the only permitted source of factual claims): NONE');
    expect(system).toContain('omit visitBasics.hours');
  });

  it('critic prompt embeds facts and draft for stripping', () => {
    const { system, user } = buildCriticPrompt({
      title: 'X',
      facts: null,
      draft: { en: { description: 'Opens at 9am daily.' } },
    });
    expect(system).toContain('Remove or blank');
    expect(user).toContain('Opens at 9am daily.');
  });
});

describe('parseGeneratedJson', () => {
  it('parses clean JSON and clamps shapes', () => {
    const parsed = parseGeneratedJson(
      JSON.stringify({
        en: {
          description: 'A quiet cliffside walk.',
          highlights: ['Sunset view', '', 42, 'Sea breeze'],
          visitBasics: { hours: 'Daily 9–18', junk: 7 },
          smartNotes: { tip: 'Go early.' },
        },
        ja: { description: '静かな崖沿いの散歩道。' },
        xx: { description: 'not a room locale' },
      }),
    );
    expect(parsed).not.toBeNull();
    expect(parsed!.en.highlights).toEqual(['Sunset view', 'Sea breeze']);
    expect(parsed!.en.visitBasics).toEqual({ hours: 'Daily 9–18' });
    expect(parsed!.ja.description).toContain('崖沿い');
    expect(parsed!.xx).toBeUndefined();
  });

  it('handles code fences and prose around the JSON', () => {
    const parsed = parseGeneratedJson('Here you go:\n```json\n{"en":{"description":"Nice place."}}\n```');
    expect(parsed!.en.description).toBe('Nice place.');
  });

  it('rejects garbage, arrays, and empty content', () => {
    expect(parseGeneratedJson('not json at all')).toBeNull();
    expect(parseGeneratedJson('[1,2,3]')).toBeNull();
    expect(parseGeneratedJson('{"en": {}}')).toBeNull();
    expect(parseGeneratedJson('{"en": "string not object"}')).toBeNull();
  });

  it('truncates oversized fields', () => {
    const parsed = parseGeneratedJson(JSON.stringify({ en: { description: 'x'.repeat(2000) } }));
    expect(parsed!.en.description!.length).toBeLessThanOrEqual(600);
  });
});

describe('hasPoiKbEntry (generation skip filter)', () => {
  it('true for a known KB key, false for unknown/null', () => {
    expect(hasPoiKbEntry('haedong_yonggungsa')).toBe(true);
    expect(hasPoiKbEntry('definitely_not_a_kb_key_xyz')).toBe(false);
    expect(hasPoiKbEntry(null)).toBe(false);
  });
});
