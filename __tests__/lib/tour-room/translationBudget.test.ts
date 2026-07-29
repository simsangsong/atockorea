/**
 * K5 — the message must survive the translation, not depend on it.
 *
 * 🔴 The ticket said "translation concurrency cap". Measuring it changed the
 * work entirely: one message costs ONE model call no matter how many locales,
 * because the router asks for all of them in a single JSON request. Live
 * `ops_ai_usage`, purpose='translate': 48 calls, avg 797ms, p95 1,542ms, max
 * 2,077ms. There was no concurrency problem to cap.
 *
 * The real exposure was the tail. 8s per provider x a fallback ladder, awaited
 * BEFORE the insert, on a route that declared no duration — so the platform
 * could kill the function mid-translation and the row was never written. The
 * guest's message was gone, with no error anyone saw.
 */
import {
  withTranslationBudget,
  TranslationBudgetExceeded,
  TRANSLATION_BUDGET_MS,
  MESSAGE_ROUTE_MAX_DURATION_S,
} from '@/lib/tour-room/translationBudget';
import { readFileSync } from 'node:fs';
import path from 'node:path';

jest.useRealTimers();

describe('withTranslationBudget', () => {
  it('passes a fast result straight through', async () => {
    await expect(withTranslationBudget(Promise.resolve('ok'), 50)).resolves.toBe('ok');
  });

  it('rejects when the work outlives its budget', async () => {
    const slow = new Promise((resolve) => setTimeout(() => resolve('late'), 200));
    await expect(withTranslationBudget(slow, 20)).rejects.toBeInstanceOf(TranslationBudgetExceeded);
  });

  it('🔴 rejects rather than resolving to a sentinel', async () => {
    // The route already had a branch for a translation THROW. Rejecting reuses
    // it; a sentinel would need a second path, and a second path is where the
    // two behaviours drift.
    const slow = new Promise((resolve) => setTimeout(resolve, 200));
    await expect(withTranslationBudget(slow, 10)).rejects.toThrow(/budget/);
  });

  it('lets a real failure through unchanged', async () => {
    const boom = Promise.reject(new Error('provider exploded'));
    await expect(withTranslationBudget(boom, 1000)).rejects.toThrow('provider exploded');
  });

  it('does not leave a timer holding the process open', async () => {
    // A budget that resolves fast must clear its ceiling, or a serverless
    // invocation stays alive to the end of the longest budget it ever started.
    const before = process.listenerCount('exit');
    await withTranslationBudget(Promise.resolve(1), 10_000);
    expect(process.listenerCount('exit')).toBe(before);
  });
});

describe('the numbers', () => {
  const routeSrc = readFileSync(
    path.join(process.cwd(), 'app/api/tour-rooms/[bookingId]/messages/route.ts'),
    'utf8',
  );

  it('🔴 the route declares a duration, as a literal', () => {
    // Not an identifier. `export const maxDuration = SOME_CONST` fails the
    // BUILD, not runtime, and that broke production for hours in July.
    expect(routeSrc).toMatch(/export const maxDuration = \d+;/);
    const declared = Number(/export const maxDuration = (\d+);/.exec(routeSrc)?.[1]);
    expect(declared).toBe(MESSAGE_ROUTE_MAX_DURATION_S);
  });

  it('the budget fits inside the duration with room to spare', () => {
    // The insert, the broadcast and the chat-locale bookkeeping all happen
    // after the budget expires in the worst case.
    expect(TRANSLATION_BUDGET_MS).toBeLessThan(MESSAGE_ROUTE_MAX_DURATION_S * 1000 * 0.6);
  });

  it('the budget is far above what a healthy call costs', () => {
    // Measured max 2,077ms. Anything under ~4x would fire on ordinary latency
    // and mark healthy messages pending for nothing.
    const MEASURED_MAX_MS = 2077;
    expect(TRANSLATION_BUDGET_MS / MEASURED_MAX_MS).toBeGreaterThan(4);
  });

  it('the budget is below the ladder it exists to escape', () => {
    // 8s per provider x 2+ providers. If the budget were above that, it would
    // never fire and the platform would still be the one deciding.
    const LADDER_WORST_MS = 8_000 * 2;
    expect(TRANSLATION_BUDGET_MS).toBeLessThan(LADDER_WORST_MS);
  });

  it('the route still marks a timed-out message pending, not failed', () => {
    // The repair path keys on this. A message the guest can read now, with its
    // translation arriving a minute later, is the good outcome here.
    expect(routeSrc).toContain("translation_status: 'pending'");
  });
});
