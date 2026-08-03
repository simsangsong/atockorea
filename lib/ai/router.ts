/**
 * Multi-provider AI router for Tour Mode (master plan §M-1, ticket T0.9).
 *
 * Gemini and DeepSeek both expose OpenAI-compatible chat-completions
 * endpoints, so a single code path switches providers by injecting
 * base_url / model / api key from env — no per-provider SDKs.
 *
 * Provider ladders per purpose (first available wins, §M-1):
 *   translate  gemini → openai            (customer chat may carry PII —
 *   caption    gemini → openai             DeepSeek is deliberately excluded
 *   vision     gemini → openai             from these paths; see §M-1 note)
 *   batch      deepseek → gemini → openai (non-PII generation only)
 *
 * A provider is "available" when its API key env is set; with only
 * OPENAI_API_KEY configured the router behaves like the pre-router code.
 * Demotion happens on HTTP failure, timeout, or an empty/refused completion
 * (§O-14). Timeouts default to 3s for the realtime caption path and 8s
 * elsewhere (TOUR_AI_TIMEOUT_MS overrides both).
 *
 * Token-zero measures implemented here (§M-2):
 *   ④ translation memory — tour_translation_cache keyed by sha256(text)+locale;
 *     a full cache hit answers with zero LLM calls;
 *   ⑤ skip heuristics — emoji/number-only or ≤2-char messages are never sent.
 *
 * Audit plan §L adds two more, both of which live here so no call site can
 * opt out of them:
 *   L0 metering — every completion (and every full cache hit) writes one
 *     ops_ai_usage row, fire-and-forget. §F's "under 30 LLM calls per tour"
 *     was an unverifiable number until this existed; it is now a query.
 *   L1 output caps — an omitted maxOutputTokens is a per-purpose default
 *     (usage.ts), not "unbounded". The seven existing call sites all pass an
 *     explicit value and keep it; the defaults exist for the eighth.
 */

import { createHash } from 'node:crypto';

import { buildUsageRow, resolveMaxOutputTokens, type AiUsageContext, type AiUsageOutcome, type ProviderUsage } from './usage';
import {
  collectUnknownProperNouns,
  maskGlossaryTerms,
  restoreGlossaryTerms,
  type GlossaryEntry,
} from './glossary';

export type AiProvider = 'gemini' | 'deepseek' | 'openai';
export type AiPurpose = 'translate' | 'caption' | 'batch' | 'vision' | 'concierge';

interface ProviderDef {
  baseUrl: string;
  keyEnv: string;
  defaultModel: string;
}

const PROVIDERS: Record<AiProvider, ProviderDef> = {
  gemini: {
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    keyEnv: 'GEMINI_API_KEY',
    defaultModel: 'gemini-2.5-flash-lite',
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    keyEnv: 'DEEPSEEK_API_KEY',
    // The legacy `deepseek-chat` alias is scheduled for removal (2026-07-24)
    // — pin the explicit model name (§M-1).
    defaultModel: 'deepseek-v4-flash',
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    keyEnv: 'OPENAI_API_KEY',
    defaultModel: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
  },
};

const DEFAULT_LADDERS: Record<AiPurpose, AiProvider[]> = {
  translate: ['gemini', 'openai'],
  caption: ['gemini', 'openai'],
  vision: ['gemini', 'openai'],
  batch: ['deepseek', 'gemini', 'openai'],
  // Customer free text (like translate/vision, may carry PII) — no DeepSeek.
  concierge: ['gemini', 'openai'],
};

export interface ResolvedProvider {
  provider: AiProvider;
  baseUrl: string;
  apiKey: string;
  model: string;
}

function envFor(purpose: AiPurpose, suffix: string): string | undefined {
  return process.env[`TOUR_AI_${purpose.toUpperCase()}_${suffix}`] || process.env[`TOUR_AI_${suffix}`];
}

/**
 * The provider chain for a purpose: env-configured ladder filtered down to
 * providers whose API key is actually present.
 */
export function resolveProviderChain(purpose: AiPurpose): ResolvedProvider[] {
  const configured = envFor(purpose, 'PROVIDERS');
  const ladder = (configured
    ? configured.split(',').map((p) => p.trim().toLowerCase()).filter((p): p is AiProvider => p in PROVIDERS)
    : DEFAULT_LADDERS[purpose]) as AiProvider[];

  const chain: ResolvedProvider[] = [];
  for (const provider of ladder) {
    const def = PROVIDERS[provider];
    const apiKey = envFor(purpose, `${provider.toUpperCase()}_API_KEY`) || process.env[def.keyEnv];
    if (!apiKey) continue;
    chain.push({
      provider,
      baseUrl: envFor(purpose, `${provider.toUpperCase()}_BASE_URL`) || def.baseUrl,
      apiKey,
      model:
        envFor(purpose, `${provider.toUpperCase()}_MODEL`) ||
        (chain.length === 0 ? envFor(purpose, 'MODEL') : undefined) ||
        def.defaultModel,
    });
  }
  return chain;
}

function timeoutMsFor(purpose: AiPurpose): number {
  const configured = Number(envFor(purpose, 'TIMEOUT_MS'));
  if (Number.isFinite(configured) && configured > 0) return configured;
  /**
   * 🔴 Vision was sharing the text budget, and could not fit in it.
   *
   * Measured from `ops_ai_usage` (1,800 rows): the same model answering a
   * TEXT-only batch averages 5,794ms. A vision call adds several megabytes of
   * base64 upload and an image to read before the first token — so 8s was not a
   * safety margin, it was a coin flip, and losing it looked identical to an
   * outage because both legs then timed out and the ladder reported total
   * failure.
   *
   * 20s fits inside the route's own 30s duration with room for the second
   * provider to be attempted rather than pre-empted.
   */
  if (purpose === 'caption') return 3_000;
  if (purpose === 'vision') return 20_000;
  return 8_000;
}

export interface ChatMessageContentPart {
  type: 'text' | 'image_url' | 'input_audio';
  [key: string]: unknown;
}

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatMessageContentPart[];
}

export interface ChatCompletionOptions {
  /** Ask the provider for a JSON object response. */
  jsonResponse?: boolean;
  /**
   * Output cap. Omitting it no longer means "unbounded" — §L-D5 gives every
   * purpose a default in `usage.ts`, so a new call site cannot leak output
   * tokens by forgetting. An explicit value always wins.
   */
  maxOutputTokens?: number;
  temperature?: number;
  /**
   * §L L0 — which tour this call belongs to, so §F's "under 30 LLM calls per
   * tour" becomes a query instead of an aspiration. Offline batch work leaves
   * it undefined and drops out of per-tour aggregates, which is correct: it is
   * not on the guest path.
   */
  usage?: AiUsageContext;
}

export interface ChatCompletionResult {
  content: string;
  provider: AiProvider;
  model: string;
}

export class AiRouterError extends Error {
  attempts: Array<{ provider: AiProvider; model: string; reason: string }>;
  constructor(message: string, attempts: Array<{ provider: AiProvider; model: string; reason: string }>) {
    /**
     * The reasons go in the MESSAGE, not only in a property.
     *
     * "All AI providers failed for translate" is what most call sites log and
     * most alerts show, and it says nothing you can act on. The gpt-5
     * parameter rejection that broke the entire OpenAI leg looked exactly like
     * that line for months — the detail existed, on `.attempts`, where nobody
     * was reading.
     */
    const detail = attempts.map((a) => `${a.provider}/${a.model}: ${a.reason}`).join(' | ');
    super(detail ? `${message} — ${detail}` : message);
    this.name = 'AiRouterError';
    this.attempts = attempts;
  }
}

/**
 * Run one chat completion through the purpose's provider ladder, demoting on
 * transport failure, non-2xx, timeout, or an empty completion (§O-14 safety
 * refusals surface as empty/blocked content). Throws AiRouterError when every
 * configured provider failed.
 */
/**
 * The request body, adapted to the provider's dialect.
 *
 * All three providers speak "OpenAI-compatible", but OpenAI itself has moved:
 * its chat models take `max_completion_tokens`, and the gpt-5 family rejects
 * `max_tokens` outright. `max_completion_tokens` is accepted by the older
 * OpenAI models too, so this is safe across whatever OPENAI_TEXT_MODEL is set
 * to — while deepseek and the gemini compatibility endpoint keep `max_tokens`,
 * which is what they understand.
 */
/**
 * 🔴 gpt-5 계열에서 `max_completion_tokens` 는 **추론 토큰까지 포함**한다.
 *
 * `DEFAULT_MAX_OUTPUT_TOKENS` 는 §L-D5 에 따라 "보이는 답의 길이"로 정해져 있다
 * (concierge 400 = "길면 손님이 안 읽는다"). 그 값을 그대로 상한으로 주면 추론이
 * 예산을 전부 먹고 **본문이 0자로 돌아온다** — `finish_reason:'length'` 에
 * `reasoning_tokens == cap`. 라우터는 그걸 `empty_completion` 으로 보고 공급자를
 * 강등시키므로, 겉보기 증상은 "모델이 응답을 거부함"이 된다.
 *
 * 실측(2026-08-03, gpt-5-mini, 같은 질문 3개):
 *   cap 400          → 3/3 빈 응답 (reasoning 400/400), 4.4~6.2초 걸려서 실패
 *   cap 400 + low    → 1/3 만 성공 (나머지 둘도 reasoning 400)
 *   cap 400 + minimal→ 2/3 성공
 *   cap 1200 + low   → **3/3 성공** (reasoning 0·192·128), 1.9~7.3초
 *
 * 그래서 목적별 상한의 의미(= 보이는 답의 길이)는 건드리지 않고, **openai 에만**
 * 추론 여유분을 더한다. 다른 공급자는 `max_tokens` 를 출력에만 쓰므로 영향 없다.
 * `reasoning_effort` 는 여유분을 실제로 작게 유지해 준다. 지원하지 않는 모델이면
 * 400 + `unsupported_parameter` 로 돌아오고, 아래 재시도가 그 필드를 떨궈 준다.
 */
const OPENAI_REASONING_HEADROOM = 800;

function buildCompletionBody(
  resolved: { provider: AiProvider; model: string },
  messages: ChatMessage[],
  maxOutputTokens: number,
  options?: ChatCompletionOptions,
): Record<string, unknown> {
  const isOpenAi = resolved.provider === 'openai';
  const tokenField = isOpenAi ? 'max_completion_tokens' : 'max_tokens';
  return {
    model: resolved.model,
    messages,
    ...(options?.jsonResponse ? { response_format: { type: 'json_object' } } : {}),
    [tokenField]: isOpenAi ? maxOutputTokens + OPENAI_REASONING_HEADROOM : maxOutputTokens,
    ...(isOpenAi ? { reasoning_effort: 'low' } : {}),
    ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
  };
}

/**
 * The parameter an OpenAI-shaped 400 is complaining about, if it named one.
 *
 * Both `unsupported_parameter` ("max_tokens is not supported with this model")
 * and `unsupported_value` ("temperature does not support 0.2") put the field
 * name in `error.param`, which is what makes a targeted retry possible without
 * keeping a list of which model dislikes what.
 */
/**
 * Read an error body without consuming the response, and without assuming the
 * object is a real `Response` — the router's own tests hand it plain literals,
 * and a helper that explodes on those would be reporting the mock rather than
 * the provider.
 */
async function readErrorBody(res: Response): Promise<{ error?: { param?: string; code?: string; message?: string } } | null> {
  try {
    const source = typeof res.clone === 'function' ? res.clone() : res;
    return (await source.json()) as { error?: { param?: string; code?: string; message?: string } };
  } catch {
    return null;
  }
}

async function unsupportedParamFrom(res: Response): Promise<string | null> {
  const data = await readErrorBody(res);
  const param = data?.error?.param;
  const code = data?.error?.code;
  if (!param || typeof param !== 'string') return null;
  if (code !== 'unsupported_parameter' && code !== 'unsupported_value') return null;
  return param;
}

export async function chatCompletion(
  purpose: AiPurpose,
  messages: ChatMessage[],
  options?: ChatCompletionOptions,
): Promise<ChatCompletionResult> {
  const chain = resolveProviderChain(purpose);
  if (chain.length === 0) {
    throw new AiRouterError(`No AI provider configured for ${purpose} (set GEMINI_API_KEY / OPENAI_API_KEY)`, []);
  }

  const attempts: Array<{ provider: AiProvider; model: string; reason: string }> = [];
  const timeoutMs = timeoutMsFor(purpose);
  // §L-D5 — an omitted cap is a default, not "unbounded".
  const maxOutputTokens = resolveMaxOutputTokens(purpose, options?.maxOutputTokens);

  for (const resolved of chain) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const startedAt = Date.now();
    try {
      let body = buildCompletionBody(resolved, messages, maxOutputTokens, options);
      let res = await fetch(`${resolved.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolved.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      /**
       * 🔴 A 400 naming a parameter is a request we can fix, not a provider
       * that is down. Drop the parameter it named and ask once more.
       *
       * This is not hypothetical: production logs showed
       * `{provider:'openai', model:'gpt-5-mini', reason:'http_400'}` on every
       * single attempt, because the gpt-5 family rejects `max_tokens` (wants
       * `max_completion_tokens`) and rejects any `temperature` but the
       * default. The last leg of the fallback chain had therefore never once
       * worked — and nobody noticed, because it is only ever reached when the
       * legs in front of it fail, which is exactly when no one is looking.
       *
       * Read from the error body rather than a hardcoded model list, so the
       * next time a provider renames something the router adapts instead of
       * quietly losing its fallback again.
       */
      if (res.status === 400) {
        const offending = await unsupportedParamFrom(res);
        if (offending && offending in body) {
          const { [offending]: _dropped, ...retryBody } = body as Record<string, unknown>;
          void _dropped;
          body = retryBody as typeof body;
          console.warn(
            `[ai-router] ${resolved.provider}/${resolved.model} rejected "${offending}" — retrying without it`,
          );
          res = await fetch(`${resolved.baseUrl.replace(/\/$/, '')}/chat/completions`, {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${resolved.apiKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        }
      }

      if (!res.ok) {
        // Carry WHY. `http_400` alone is what let a permanently broken
        // fallback read like a transient blip for months.
        const detail = (await readErrorBody(res))?.error?.message ?? '';
        attempts.push({
          provider: resolved.provider,
          model: resolved.model,
          reason: detail ? `http_${res.status}: ${detail.slice(0, 160)}` : `http_${res.status}`,
        });
        continue;
      }

      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string | null } }>;
        usage?: ProviderUsage | null;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (!content) {
        attempts.push({ provider: resolved.provider, model: resolved.model, reason: 'empty_completion' });
        continue;
      }

      if (attempts.length > 0) {
        console.warn(`[ai-router] ${purpose} demoted to ${resolved.provider} after:`, attempts);
      }
      // §L L0 — one metering point for every call site, present and future.
      // Deliberately not awaited: telemetry may not add a round trip to a
      // guest-facing answer (§L-D1).
      meter({
        purpose,
        provider: resolved.provider,
        model: resolved.model,
        usage: data.usage,
        latencyMs: Date.now() - startedAt,
        outcome: 'ok',
        context: options?.usage,
      });
      return { content, provider: resolved.provider, model: resolved.model };
    } catch (error) {
      const aborted = error instanceof Error && error.name === 'AbortError';
      attempts.push({
        provider: resolved.provider,
        model: resolved.model,
        reason: aborted ? `timeout_${timeoutMs}ms` : error instanceof Error ? error.message : String(error),
      });
    } finally {
      clearTimeout(timer);
    }
  }

  // A total ladder failure is still a cost event worth seeing: it is the shape
  // of an outage, and without a row it looks identical to "nobody asked".
  meter({
    purpose,
    provider: chain[chain.length - 1]?.provider ?? 'openai',
    model: chain[chain.length - 1]?.model ?? 'unknown',
    usage: null,
    latencyMs: null,
    outcome: 'failed',
    context: options?.usage,
  });
  throw new AiRouterError(`All AI providers failed for ${purpose}`, attempts);
}

/**
 * §L L0 — fire-and-forget metering. The recorder lives in `usage.server.ts`
 * and is pulled in dynamically for the same reason `defaultCacheDb` is: this
 * module is imported by server code that must not drag the Supabase client
 * into a bundle that does not need it.
 */
function meter(input: {
  purpose: AiPurpose;
  provider: AiProvider;
  model: string;
  usage?: ProviderUsage | null;
  latencyMs: number | null;
  outcome: AiUsageOutcome;
  context?: AiUsageContext;
}): void {
  try {
    const row = buildUsageRow(input);
    void import('./usage.server')
      .then((mod) => mod.recordAiUsage(row))
      .catch(() => undefined);
  } catch {
    /* metering never breaks a completion */
  }
}

/** A saved call. Recorded so §L's effect is a number, not a claim. */
function meterCacheHit(purpose: AiPurpose, context: AiUsageContext | undefined, latencyMs: number): void {
  try {
    void import('./usage.server')
      .then((mod) =>
        mod.recordCacheHit({ purpose, bookingId: context?.bookingId ?? null, latencyMs }),
      )
      .catch(() => undefined);
  } catch {
    /* metering never breaks a completion */
  }
}

// ---------------------------------------------------------------------------
// Translation with memory (§M-2 ④) and skip heuristics (§M-2 ⑤).
// ---------------------------------------------------------------------------

export interface TranslationResult {
  source_locale: string;
  translations: Record<string, string>;
}

/** Minimal DB shape for the translation cache (tests inject a fake). */
export interface TranslationCacheDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

interface CacheRow {
  locale: string;
  translated_text: string;
  source_locale: string | null;
}

/**
 * A3 / plan §12 Q1 — cache-key salt tied to the translation prompt version.
 * The translation memory stores outputs of a specific system prompt; when the
 * prompt changes semantically (v2 added the honorific-register rule, v3 added
 * the native-phrasing rule), bump this so old rows (written under the previous
 * prompt) can never be served again. Old rows simply stop matching — no
 * migration needed.
 */
export const TRANSLATION_PROMPT_VERSION = 3;

export function hashSource(text: string): string {
  return createHash('sha256')
    .update(`v${TRANSLATION_PROMPT_VERSION}:${text.trim()}`)
    .digest('hex');
}

/**
 * §M-2 ⑤ — messages that carry no translatable language: whitespace, digits,
 * punctuation, emoji / symbols. ≤2 chars is treated as untranslatable too.
 */
export function shouldSkipTranslation(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length <= 2) return true;
  const withoutSymbols = trimmed.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}\p{N}\p{P}\p{S}\p{Z}\s‍️]/gu, '');
  return withoutSymbols.length === 0;
}

async function defaultCacheDb(): Promise<TranslationCacheDb | null> {
  try {
    const { createServerClient } = await import('@/lib/supabase');
    return createServerClient();
  } catch {
    return null; // cache is best-effort; translation still works without it
  }
}

async function readCache(
  db: TranslationCacheDb,
  sourceHash: string,
  locales: string[],
): Promise<CacheRow[]> {
  try {
    const { data } = await db
      .from('tour_translation_cache')
      .select('locale, translated_text, source_locale')
      .eq('source_hash', sourceHash)
      .in('locale', locales);
    return (data as CacheRow[] | null) ?? [];
  } catch {
    return [];
  }
}

async function writeCache(
  db: TranslationCacheDb,
  sourceHash: string,
  sourceLocale: string,
  translations: Record<string, string>,
  provider: string,
): Promise<void> {
  const rows = Object.entries(translations).map(([locale, translated_text]) => ({
    source_hash: sourceHash,
    locale,
    source_locale: sourceLocale,
    translated_text,
    provider,
  }));
  if (rows.length === 0) return;
  try {
    await db.from('tour_translation_cache').upsert(rows, { onConflict: 'source_hash,locale' });
  } catch {
    // best-effort — never fail a message because the memory write failed
  }
}

export interface TranslateOptions {
  /** Injectable cache DB (tests); null disables the cache entirely. */
  db?: TranslationCacheDb | null;
  /** §L L0 — which tour this translation belongs to (per-tour budget). */
  usage?: AiUsageContext;
  /**
   * P1-8 — confirmed proper nouns. Omitted: loaded from the POI knowledge base.
   * Pass [] to disable masking (tests, or text known to carry no place names).
   */
  glossary?: GlossaryEntry[];
}

/** Server-only glossary load, mirrored on the cache-db pattern below. */
async function defaultGlossary(): Promise<GlossaryEntry[]> {
  if (typeof window !== 'undefined') return [];
  try {
    const mod = await import('./glossary.server');
    return await mod.loadGlossary();
  } catch {
    return [];
  }
}

async function reportUnknownProperNouns(terms: string[], context?: string): Promise<void> {
  if (typeof window !== 'undefined') return;
  try {
    const mod = await import('./glossary.server');
    mod.logUnknownProperNouns(terms, context);
  } catch {
    /* logging must never break a translation */
  }
}

/**
 * Translate `text` into `targetLocales` through the provider ladder, with the
 * translation memory consulted first. Contract matches the legacy
 * translateTextForLocales: resolves with { source_locale, translations },
 * throws when every provider failed (callers own graceful degradation, T1.3).
 */
export async function translateTextViaRouter(
  text: string,
  targetLocales: string[],
  options?: TranslateOptions,
): Promise<TranslationResult> {
  const uniqueTargets = [...new Set(targetLocales.filter(Boolean))];
  if (uniqueTargets.length === 0 || shouldSkipTranslation(text)) {
    return { source_locale: 'und', translations: {} };
  }

  const sourceHash = hashSource(text);
  const startedAt = Date.now();
  const db = options?.db === undefined ? await defaultCacheDb() : options.db;

  const translations: Record<string, string> = {};
  let sourceLocale = 'und';

  if (db) {
    const cached = await readCache(db, sourceHash, uniqueTargets);
    for (const row of cached) {
      translations[row.locale] = row.translated_text;
      if (row.source_locale) sourceLocale = row.source_locale;
    }
  }

  const missing = uniqueTargets.filter((locale) => !(locale in translations));
  if (missing.length === 0) {
    // Full memory hit — zero LLM calls. Metered as a hit so the saving shows up
    // as a numerator instead of an absence (§L L0).
    meterCacheHit('translate', options?.usage, Date.now() - startedAt);
    return { source_locale: sourceLocale, translations };
  }

  // P0-2/P0-3 — the fan-out returns ONE JSON object holding all N locales.
  // Commit e9a999a0 (§L L1) began forcing max_tokens on this call, which had
  // never passed a cap and was effectively unbounded; the per-purpose default
  // (1200) truncated multi-language responses → invalid JSON (parsed below) →
  // the whole translation was dropped and callers fell back to the untranslated
  // source. Scale the cap to locale count and source length so a fan-out is
  // never truncated. Output tokens bill only as generated, so short messages
  // stay cheap (measured ~40 tok) — this preserves §L cost control for the
  // common case while restoring correctness for large fan-outs.
  const perLocaleBudget = 64 + Math.ceil(text.length * 1.5);
  const translateOutputCap = Math.min(8000, Math.max(1200, 160 + missing.length * perLocaleBudget));

  // P1-8 — mask confirmed proper nouns before the model sees them, so a place
  // name is rendered from the knowledge base instead of being "corrected" into
  // a plausible neighbour (감천문화마을 → 甘泉文化村 instead of 甘川文化村).
  const glossary = options?.glossary ?? (await defaultGlossary());
  const masked = maskGlossaryTerms(text, glossary);
  const promptText = masked.text;
  if (glossary.length > 0) {
    const unknown = collectUnknownProperNouns(text, glossary);
    if (unknown.length > 0) void reportUnknownProperNouns(unknown, options?.usage?.label ?? undefined);
  }
  const completion = await chatCompletion(
    'translate',
    [
      {
        role: 'system',
        // A3 honorific filter (plan §11.A): drivers/guides often type blunt or
        // casual Korean; guests must still receive a courteous translation.
        // v3 adds the native-phrasing rule — register alone still produced
        // word-order-preserving translationese, which reads as machine output
        // and undercuts the "Smart Guide" the guest is supposed to be talking
        // to. Register and phrasing may change; meaning may not.
        // Bump TRANSLATION_PROMPT_VERSION whenever this prompt changes.
        content:
          'Detect the source language. Translate the user text into each requested locale. ' +
          'Always write each translation in the polite, formal register of the target language ' +
          '(Korean 존댓말, Japanese 敬語/です・ます体, French vous, German Sie, Spanish usted, and the equivalent elsewhere), ' +
          'even when the source text is casual, blunt, or impolite — but never change, add, or omit any meaning, information, or content. ' +
          'Write it the way a courteous NATIVE SPEAKER would actually say it to a traveller: idiomatic, natural word order, ' +
          'natural particles and connectives. Do not mirror the source sentence structure, and do not translate word by word. ' +
          'A stiff literal rendering is a failure even when every word is correct. ' +
          'Preserve names, times, pickup points, prices, and URLs. ' +
          'Respond with only a JSON object of the form {"source_locale": string, "translations": {locale: string}}.',
      },
      { role: 'user', content: JSON.stringify({ text: promptText, target_locales: missing }) },
    ],
    { jsonResponse: true, usage: options?.usage, maxOutputTokens: translateOutputCap },
  );

  let parsed: Partial<TranslationResult> = {};
  try {
    parsed = JSON.parse(completion.content) as Partial<TranslationResult>;
  } catch {
    throw new AiRouterError('Translation response was not valid JSON', [
      { provider: completion.provider, model: completion.model, reason: 'invalid_json' },
    ]);
  }

  sourceLocale = parsed.source_locale || sourceLocale;
  const fresh: Record<string, string> = {};
  for (const locale of missing) {
    const value = parsed.translations?.[locale];
    if (typeof value === 'string' && value) {
      // P1-8 — swap the tokens for the CONFIRMED name in this locale. Cache the
      // restored string so a later hit serves the corrected name too.
      const restored = restoreGlossaryTerms(value, masked.terms, locale);
      fresh[locale] = restored;
      translations[locale] = restored;
    }
  }

  if (db) {
    await writeCache(db, sourceHash, sourceLocale, fresh, completion.provider);
  }

  return { source_locale: sourceLocale, translations };
}
