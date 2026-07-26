/**
 * Enrichment batching — the wall clock a guest actually waits.
 *
 * The batches ran one after another, so the first person to ask for food at a
 * fresh cell paid for the entire corpus in series. Measured on production
 * (2026-07-26): POST /api/tour-rooms/[id]/dining took 46.4s on a cache miss —
 * a dense cell keeps 120 places, that is 10 batches of 12, and each batch is a
 * generation call plus a critic call. Twenty model calls, nose to tail, for a
 * card that shows five restaurants.
 *
 * These pin the overlap, and the two properties overlap must not break:
 * output order, and one bad batch not taking the others with it.
 */
import { translateAndEnrichPlaces, type TranslatablePlace } from '@/lib/ops/dining/translate.server';
import { chatCompletion } from '@/lib/ai/router';
import { incrWindowCounted } from '@/lib/durable-rate-limit';

jest.mock('@/lib/ai/router', () => ({ chatCompletion: jest.fn() }));
jest.mock('@/lib/durable-rate-limit', () => ({ incrWindowCounted: jest.fn() }));

const chatCompletionMock = chatCompletion as jest.Mock;
const incrWindowCountedMock = incrWindowCounted as jest.Mock;

/** N places, each with a review the K3 gate can verify a menu against. */
function places(count: number): TranslatablePlace[] {
  return Array.from({ length: count }, (_, i) => ({
    place_key: `kakao:${i}`,
    name: `가게${i}`,
    review_text: `여기 김밥 맛있어요 (${i})`,
    name_i18n: null,
    signature_menus: [],
  }));
}

function translationReply(keys: string[]) {
  const out: Record<string, unknown> = {};
  for (const key of keys) out[key] = { name_i18n: { en: `Shop ${key}` }, signature_menus: ['김밥'] };
  return { content: JSON.stringify(out) };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Budget available: the counter reports well under any cap.
  incrWindowCountedMock.mockResolvedValue({ count: 1, limited: false });
});

describe('translateAndEnrichPlaces — batch overlap', () => {
  it('overlaps batches instead of running them nose to tail', async () => {
    let inFlight = 0;
    let peak = 0;
    chatCompletionMock.mockImplementation(async (_ladder: string, messages: Array<{ content: string }>) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 5));
      inFlight -= 1;
      const keys = [...messages[1].content.matchAll(/kakao:\d+/g)].map((m) => m[0]);
      return translationReply([...new Set(keys)]);
    });

    // 48 places / batch 12 = 4 batches.
    const out = await translateAndEnrichPlaces(places(48), { batchSize: 12, concurrency: 4 });

    expect(out).toHaveLength(48);
    expect(peak).toBeGreaterThan(1);
  });

  it('never exceeds the concurrency it was given', async () => {
    let inFlight = 0;
    let peak = 0;
    chatCompletionMock.mockImplementation(async (_l: string, messages: Array<{ content: string }>) => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 3));
      inFlight -= 1;
      const keys = [...messages[1].content.matchAll(/kakao:\d+/g)].map((m) => m[0]);
      return translationReply([...new Set(keys)]);
    });

    await translateAndEnrichPlaces(places(120), { batchSize: 12, concurrency: 2 });
    // Generation and critic within one batch are still sequential, so the
    // ceiling is the batch concurrency itself.
    expect(peak).toBeLessThanOrEqual(2);
  });

  it('keeps input order and length regardless of which batch finishes first', async () => {
    let call = 0;
    chatCompletionMock.mockImplementation(async (_l: string, messages: Array<{ content: string }>) => {
      // Later batches answer sooner, so completion order != input order.
      const mine = call++;
      await new Promise((resolve) => setTimeout(resolve, Math.max(0, 20 - mine * 5)));
      const keys = [...messages[1].content.matchAll(/kakao:\d+/g)].map((m) => m[0]);
      return translationReply([...new Set(keys)]);
    });

    const input = places(36);
    const out = await translateAndEnrichPlaces(input, { batchSize: 12, concurrency: 3 });
    expect(out.map((row) => row.place_key)).toEqual(input.map((row) => row.place_key));
  });

  it('a failing batch loses only its own rows', async () => {
    chatCompletionMock.mockImplementation(async (_l: string, messages: Array<{ content: string }>) => {
      const keys = [...new Set([...messages[1].content.matchAll(/kakao:\d+/g)].map((m) => m[0]))];
      if (keys.includes('kakao:0')) throw new Error('provider outage');
      return translationReply(keys);
    });

    const out = await translateAndEnrichPlaces(places(24), { batchSize: 12, concurrency: 4 });
    expect(out).toHaveLength(24);
    // Batch 1 fell back to the Korean name alone — a fine card, just plainer.
    expect(out[0].name_i18n ?? null).toBeNull();
    // Batch 2 was untouched by its neighbour's failure.
    expect(out[12].name_i18n).toMatchObject({ en: expect.any(String) });
  });
});
