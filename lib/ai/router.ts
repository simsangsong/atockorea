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
  return purpose === 'caption' ? 3_000 : 8_000;
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
    super(message);
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
      const res = await fetch(`${resolved.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resolved.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: resolved.model,
          messages,
          ...(options?.jsonResponse ? { response_format: { type: 'json_object' } } : {}),
          max_tokens: maxOutputTokens,
          ...(options?.temperature !== undefined ? { temperature: options.temperature } : {}),
        }),
        signal: controller.signal,
      });

      if (!res.ok) {
        attempts.push({ provider: resolved.provider, model: resolved.model, reason: `http_${res.status}` });
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
      { role: 'user', content: JSON.stringify({ text, target_locales: missing }) },
    ],
    { jsonResponse: true, usage: options?.usage },
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
      fresh[locale] = value;
      translations[locale] = value;
    }
  }

  if (db) {
    await writeCache(db, sourceHash, sourceLocale, fresh, completion.provider);
  }

  return { source_locale: sourceLocale, translations };
}
