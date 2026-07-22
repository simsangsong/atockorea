/**
 * @jest-environment node
 *
 * Server-only approved-video fetch — the VP-D10 approval gate. Only
 * status='approved' rows serve, folded to the newest version per language.
 */
import { fetchArrivalVideoCard } from '@/lib/tour-room/poiVideos.server';

type EqCall = [string, unknown];

function fakeClient(rows: unknown[], opts: { rejects?: boolean } = {}) {
  const eqCalls: EqCall[] = [];
  const chain = {
    select: () => chain,
    eq: (col: string, val: unknown) => {
      eqCalls.push([col, val]);
      return chain;
    },
    order: () => chain,
    then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) =>
      (opts.rejects
        ? Promise.reject(new Error('boom'))
        : Promise.resolve({ data: rows, error: null })
      ).then(res, rej),
  };
  return { eqCalls, from: () => chain };
}

describe('fetchArrivalVideoCard — approval gate', () => {
  it('returns null for a missing poi_key without querying', async () => {
    const client = fakeClient([]);
    expect(await fetchArrivalVideoCard(client, null)).toBeNull();
    expect(await fetchArrivalVideoCard(client, '')).toBeNull();
    expect(client.eqCalls).toHaveLength(0);
  });

  it("filters to status='approved' (pending/rejected renders never serve)", async () => {
    const client = fakeClient([]);
    await fetchArrivalVideoCard(client, 'jagalchi_market');
    expect(client.eqCalls).toEqual(
      expect.arrayContaining([
        ['poi_key', 'jagalchi_market'],
        ['status', 'approved'],
      ]),
    );
  });

  it('folds rows into one card keyed by ROOM locale (zh-Hant → zh)', async () => {
    const client = fakeClient([
      { language: 'en', version: 2, video_url: 'https://cdn/en-v2.mp4', poster_url: 'https://cdn/p.png', duration_seconds: 64 },
      { language: 'zh-Hant', version: 2, video_url: 'https://cdn/zh-v2.mp4', poster_url: null, duration_seconds: '64.5' },
      { language: 'ja', version: 2, video_url: 'https://cdn/ja-v2.mp4', poster_url: null, duration_seconds: null },
    ]);
    const card = await fetchArrivalVideoCard(client, 'jagalchi_market');
    expect(card).toEqual({
      poster_url: 'https://cdn/p.png',
      duration_seconds: 64,
      urls: { en: 'https://cdn/en-v2.mp4', zh: 'https://cdn/zh-v2.mp4', ja: 'https://cdn/ja-v2.mp4' },
    });
  });

  it('keeps only the newest version per language (rows arrive newest-first)', async () => {
    const client = fakeClient([
      { language: 'en', version: 3, video_url: 'https://cdn/en-v3.mp4' },
      { language: 'en', version: 1, video_url: 'https://cdn/en-v1.mp4' },
    ]);
    const card = await fetchArrivalVideoCard(client, 'x');
    expect(card?.urls.en).toBe('https://cdn/en-v3.mp4');
  });

  it('ignores unknown languages and returns null when nothing usable remains', async () => {
    const client = fakeClient([{ language: 'fr', version: 1, video_url: 'https://cdn/fr.mp4' }]);
    expect(await fetchArrivalVideoCard(client, 'x')).toBeNull();
  });

  it('never throws — returns null when the query fails', async () => {
    const client = fakeClient([], { rejects: true });
    await expect(fetchArrivalVideoCard(client, 'x')).resolves.toBeNull();
  });
});
