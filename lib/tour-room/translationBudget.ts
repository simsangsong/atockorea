/**
 * K5 — the message must survive the translation, not depend on it.
 *
 * 🔴 The ticket's premise was wrong, and measuring it changed the work.
 *
 * "Translation concurrency" assumed one message fans out to one model call per
 * locale. It does not: `translateTextViaRouter` asks for every missing locale in
 * a single JSON request, so a ten-locale room costs the same ONE call as a
 * two-locale room. Locale count moves the output-token cap, not the call count.
 * Live `ops_ai_usage`, purpose='translate': 48 calls, avg 797ms, p95 1,542ms,
 * max 2,077ms. There is no concurrency problem to cap.
 *
 * The real exposure is the tail, and it is worse than slowness. The router
 * allows 8s PER PROVIDER and walks a fallback ladder, so one hung provider can
 * hold the request for 8s x chain length. The message route awaited that BEFORE
 * inserting, and declared no `maxDuration` — so the platform picked one. If the
 * platform's limit lands inside the ladder, the function is killed while still
 * translating and the row is never written.
 *
 * The guest's message is simply gone. Not delayed, not untranslated — gone,
 * with no error anyone sees. That is the same shape K1a found on the SSE route:
 * "no duration declared, so the platform decided", except here the cost is data
 * rather than load.
 *
 * So the fix is not a concurrency cap. It is a budget that guarantees the insert
 * is reached. On timeout the route takes the path it already had for a
 * translation THROW — publish the original, mark it pending — and
 * `/retranslate` repairs it later. A message that arrives in its original
 * language and gains its translation a minute later is a good day. A message
 * that never existed is not recoverable by anything.
 */

/**
 * How long the whole translation step may take before the route gives up and
 * writes the message anyway.
 *
 * 12s is ~5.8x the measured maximum and ~7.8x p95, so a healthy call is never
 * near it. It also sits well inside the route's 30s duration, leaving room for
 * the insert, the broadcast and the locale bookkeeping that follow.
 */
export const TRANSLATION_BUDGET_MS = 12_000;

/** Route duration. Must be written as a LITERAL at the route — see below. */
export const MESSAGE_ROUTE_MAX_DURATION_S = 30;

export class TranslationBudgetExceeded extends Error {
  constructor(ms: number) {
    super(`translation exceeded ${ms}ms budget`);
    this.name = 'TranslationBudgetExceeded';
  }
}

/**
 * Run `work`, but never longer than `budgetMs`.
 *
 * Rejects rather than resolving to a sentinel, so the caller's existing
 * translation-failure branch handles it without a second code path. The
 * underlying request is not cancelled — the router owns its own abort — and
 * letting it finish into nothing is cheaper than threading a signal through
 * three layers for a case measured at zero occurrences so far.
 */
export function withTranslationBudget<T>(
  work: Promise<T>,
  budgetMs: number = TRANSLATION_BUDGET_MS,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const ceiling = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new TranslationBudgetExceeded(budgetMs)), budgetMs);
  });
  return Promise.race([work, ceiling]).finally(() => {
    if (timer) clearTimeout(timer);
  }) as Promise<T>;
}
