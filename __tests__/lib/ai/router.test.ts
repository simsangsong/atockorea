/**
 * T0.9 — multi-provider AI router: env switching across the 3 providers,
 * failure demotion, translation memory (cache hit = zero LLM calls), and the
 * §M-2 skip heuristics.
 */
import { createHash } from 'node:crypto';
import {
  chatCompletion,
  hashSource,
  resolveProviderChain,
  shouldSkipTranslation,
  translateTextViaRouter,
  AiRouterError,
  TRANSLATION_PROMPT_VERSION,
  type TranslationCacheDb,
} from '@/lib/ai/router';

function okCompletion(content: unknown) {
  return {
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: typeof content === 'string' ? content : JSON.stringify(content) } }] }),
  };
}

/** In-memory tour_translation_cache. */
function fakeCacheDb(seed?: Array<{ source_hash: string; locale: string; translated_text: string; source_locale?: string }>) {
  const rows = [...(seed ?? [])];
  const upserted: Array<Record<string, unknown>> = [];
  const db: TranslationCacheDb & { rows: typeof rows; upserted: typeof upserted } = {
    rows,
    upserted,
    from() {
      return {
        select: () => ({
          eq: (_c: string, hash: string) => ({
            in: async (_c2: string, locales: string[]) => ({
              data: rows.filter((r) => r.source_hash === hash && locales.includes(r.locale)),
              error: null,
            }),
          }),
        }),
        upsert: async (values: Array<Record<string, unknown>>) => {
          upserted.push(...values);
          return { data: null, error: null };
        },
      };
    },
  };
  return db;
}

describe('lib/ai/router', () => {
  const OLD_ENV = process.env;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.GEMINI_API_KEY;
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.TOUR_AI_TRANSLATE_PROVIDERS;
    fetchMock = jest.fn();
    global.fetch = fetchMock as unknown as typeof fetch;
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = OLD_ENV;
    jest.restoreAllMocks();
  });

  describe('resolveProviderChain — env switching (AC: 3-provider switch)', () => {
    it('selects gemini with its OpenAI-compatible endpoint when its key is set', () => {
      process.env.GEMINI_API_KEY = 'g-key';
      const chain = resolveProviderChain('translate');
      expect(chain[0]).toMatchObject({
        provider: 'gemini',
        baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
        model: 'gemini-2.5-flash-lite',
      });
    });

    it('falls back to openai when only OPENAI_API_KEY is configured (pre-router parity)', () => {
      process.env.OPENAI_API_KEY = 'o-key';
      const chain = resolveProviderChain('translate');
      expect(chain).toHaveLength(1);
      expect(chain[0]).toMatchObject({ provider: 'openai', baseUrl: 'https://api.openai.com/v1' });
    });

    it('selects deepseek (pinned non-legacy model) for batch, and NEVER for translate by default (PII boundary)', () => {
      process.env.DEEPSEEK_API_KEY = 'd-key';
      process.env.GEMINI_API_KEY = 'g-key';
      const batch = resolveProviderChain('batch');
      expect(batch[0]).toMatchObject({ provider: 'deepseek', model: 'deepseek-v4-flash' });
      const translate = resolveProviderChain('translate');
      expect(translate.map((c) => c.provider)).toEqual(['gemini']);
    });

    it('honours per-purpose env overrides for ladder, model, and base URL', () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.OPENAI_API_KEY = 'o-key';
      process.env.TOUR_AI_TRANSLATE_PROVIDERS = 'openai,gemini';
      process.env.TOUR_AI_TRANSLATE_MODEL = 'gpt-custom';
      process.env.TOUR_AI_TRANSLATE_OPENAI_BASE_URL = 'https://proxy.example/v1';
      const chain = resolveProviderChain('translate');
      expect(chain[0]).toMatchObject({ provider: 'openai', model: 'gpt-custom', baseUrl: 'https://proxy.example/v1' });
      expect(chain[1]).toMatchObject({ provider: 'gemini' });
    });
  });

  describe('chatCompletion — demotion ladder', () => {
    it('demotes to the next provider on 429 and succeeds', async () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce(okCompletion('hello'));

      const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
      expect(result).toMatchObject({ content: 'hello', provider: 'openai' });
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(fetchMock.mock.calls[0][0]).toContain('generativelanguage.googleapis.com');
      expect(fetchMock.mock.calls[1][0]).toContain('api.openai.com');
    });

    it('treats an empty completion as a failure (§O-14 safety refusal path)', async () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock
        .mockResolvedValueOnce(okCompletion(''))
        .mockResolvedValueOnce(okCompletion('recovered'));
      const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
      expect(result.provider).toBe('openai');
    });

    it('throws AiRouterError with per-provider reasons when everything fails', async () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
      await expect(chatCompletion('translate', [{ role: 'user', content: 'hi' }])).rejects.toThrow(AiRouterError);
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('throws immediately when no provider key is configured', async () => {
      await expect(chatCompletion('translate', [{ role: 'user', content: 'hi' }])).rejects.toThrow(/No AI provider/);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  /**
   * The OpenAI leg of the ladder had never once worked. Production logs showed
   * `{provider:'openai', model:'gpt-5-mini', reason:'http_400'}` on every
   * attempt, because the gpt-5 family rejects `max_tokens` (it wants
   * `max_completion_tokens`) and rejects any `temperature` but the default.
   * Nobody noticed, because the last leg is only reached when the ones in
   * front of it fail — exactly when no one is looking.
   */
  describe('chatCompletion — provider dialects (openai fallback)', () => {
    const bodyOf = (call: number) => JSON.parse((fetchMock.mock.calls[call][1] as RequestInit).body as string);

    it('sends max_completion_tokens to openai and max_tokens to the others', async () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce(okCompletion('hello'));

      await chatCompletion('translate', [{ role: 'user', content: 'hi' }], { maxOutputTokens: 400 });

      expect(bodyOf(0)).toMatchObject({ max_tokens: 400 });
      expect(bodyOf(0).max_completion_tokens).toBeUndefined();
      expect(bodyOf(1)).toMatchObject({ max_completion_tokens: 400 });
      expect(bodyOf(1).max_tokens).toBeUndefined();
    });

    it('drops the parameter a 400 names, and retries the same provider once', async () => {
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock
        .mockResolvedValueOnce({
          ok: false,
          status: 400,
          json: async () => ({
            error: {
              message: "Unsupported value: 'temperature' does not support 0.2 with this model.",
              param: 'temperature',
              code: 'unsupported_value',
            },
          }),
        })
        .mockResolvedValueOnce(okCompletion('OK'));

      const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }], { temperature: 0.2 });

      expect(result).toMatchObject({ content: 'OK', provider: 'openai' });
      // Same provider, twice — a fixable request is not a provider being down.
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(bodyOf(0).temperature).toBe(0.2);
      expect(bodyOf(1).temperature).toBeUndefined();
    });

    it('does not retry a 400 that names nothing we sent', async () => {
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'quota exceeded', code: 'insufficient_quota' } }),
      });

      await expect(chatCompletion('translate', [{ role: 'user', content: 'hi' }])).rejects.toThrow(AiRouterError);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('carries WHY into the error — http_400 alone is what hid this for months', async () => {
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock.mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'the specific reason', code: 'insufficient_quota' } }),
      });

      await expect(chatCompletion('translate', [{ role: 'user', content: 'hi' }])).rejects.toThrow(
        /the specific reason/,
      );
    });
  });

  describe('translateTextViaRouter — translation memory (AC: cache hit = 0 LLM calls)', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'g-key';
    });

    it('answers entirely from cache without any fetch', async () => {
      const hash = hashSource('Good morning everyone');
      const db = fakeCacheDb([
        { source_hash: hash, locale: 'ko', translated_text: '좋은 아침입니다', source_locale: 'en' },
        { source_hash: hash, locale: 'ja', translated_text: 'おはようございます', source_locale: 'en' },
      ]);
      const result = await translateTextViaRouter('Good morning everyone', ['ko', 'ja'], { db });
      expect(result).toEqual({
        source_locale: 'en',
        translations: { ko: '좋은 아침입니다', ja: 'おはようございます' },
      });
      expect(fetchMock).not.toHaveBeenCalled();
    });

    it('requests only the missing locales and stores them back into the memory', async () => {
      const hash = hashSource('Good morning everyone');
      const db = fakeCacheDb([
        { source_hash: hash, locale: 'ko', translated_text: '좋은 아침입니다', source_locale: 'en' },
      ]);
      fetchMock.mockResolvedValue(okCompletion({ source_locale: 'en', translations: { ja: 'おはようございます' } }));

      const result = await translateTextViaRouter('Good morning everyone', ['ko', 'ja'], { db });
      expect(result.translations).toEqual({ ko: '좋은 아침입니다', ja: 'おはようございます' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      expect(JSON.parse(body.messages[1].content).target_locales).toEqual(['ja']);
      expect(db.upserted).toEqual([
        expect.objectContaining({ source_hash: hash, locale: 'ja', translated_text: 'おはようございます', provider: 'gemini' }),
      ]);
    });

    it('works with the cache disabled (db: null) and dedupes target locales', async () => {
      fetchMock.mockResolvedValue(okCompletion({ source_locale: 'en', translations: { ko: '안녕' } }));
      const result = await translateTextViaRouter('hello there', ['ko', 'ko', ''], { db: null });
      expect(result.translations).toEqual({ ko: '안녕' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('propagates total provider failure (caller owns graceful degradation, T1.3)', async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 500, json: async () => ({}) });
      await expect(translateTextViaRouter('hello there', ['ko'], { db: null })).rejects.toThrow(AiRouterError);
    });

    // P0-2/P0-3 regression: commit e9a999a0 (§L L1) forced max_tokens onto this
    // call, which had always been unbounded. The per-purpose default (1200)
    // truncated a large multi-locale JSON fan-out → invalid JSON → the whole
    // translation was dropped and callers showed the untranslated source. The
    // cap must scale with locale count and source length.
    it('P0-2/P0-3: scales max_tokens above the 1200 default for a large fan-out', async () => {
      fetchMock.mockResolvedValue(
        okCompletion({
          source_locale: 'ko',
          translations: { en: 'x', ja: 'x', zh: 'x', es: 'x', fr: 'x', de: 'x', it: 'x', ru: 'x' },
        }),
      );
      const longText = '오늘 일정은 감천문화마을에서 시작해 자갈치시장을 거쳐 태종대까지 이동합니다. '.repeat(4);
      await translateTextViaRouter(longText, ['en', 'ja', 'zh', 'es', 'fr', 'de', 'it', 'ru'], { db: null });
      const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
      expect(body.max_tokens).toBeGreaterThan(1200);
    });

    it('P0-2/P0-3: a tiny single-locale translation stays capped at the 1200 floor', async () => {
      fetchMock.mockResolvedValue(okCompletion({ source_locale: 'en', translations: { ko: '지금 버스에 탑승해 주세요' } }));
      await translateTextViaRouter('Please board the bus now.', ['ko'], { db: null });
      const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
      expect(body.max_tokens).toBe(1200);
    });
  });

  describe('A3 honorific filter + prompt-version cache salt (plan §11.A / §12 Q1)', () => {
    beforeEach(() => {
      process.env.GEMINI_API_KEY = 'g-key';
    });

    it('system prompt demands the polite/formal register without changing content', async () => {
      fetchMock.mockResolvedValue(okCompletion({ source_locale: 'ko', translations: { ja: 'すぐ出発します' } }));
      await translateTextViaRouter('곧 출발한다', ['ja'], { db: null });
      const body = JSON.parse(fetchMock.mock.calls[0][1].body);
      const system = body.messages[0].content as string;
      expect(system).toContain('polite, formal register');
      expect(system).toContain('존댓말');
      expect(system).toContain('敬語');
      expect(system).toContain('vous');
      expect(system).toContain('Sie');
      expect(system).toContain('never change, add, or omit any meaning, information, or content');
      // Still a single call on the existing endpoint — no extra pass.
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('cache key is salted with the prompt version so pre-honorific rows can never be served', async () => {
      const text = 'Good morning everyone';
      // A v1-era row was stored under the UNSALTED sha256 of the text.
      const legacyHash = createHash('sha256').update(text.trim()).digest('hex');
      expect(hashSource(text)).not.toBe(legacyHash);
      expect(TRANSLATION_PROMPT_VERSION).toBeGreaterThanOrEqual(3);

      const db = fakeCacheDb([
        { source_hash: legacyHash, locale: 'ko', translated_text: '좋은 아침 (반말 캐시)', source_locale: 'en' },
      ]);
      fetchMock.mockResolvedValue(okCompletion({ source_locale: 'en', translations: { ko: '좋은 아침입니다' } }));

      const result = await translateTextViaRouter(text, ['ko'], { db });
      // The stale row is invisible: the router re-translates and stores under the salted key.
      expect(result.translations.ko).toBe('좋은 아침입니다');
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(db.upserted).toEqual([
        expect.objectContaining({ source_hash: hashSource(text), locale: 'ko', translated_text: '좋은 아침입니다' }),
      ]);
    });

    it('instructs BOTH the honorific register and native phrasing (A3 + v3)', async () => {
      // The guest-facing promise is a courteous NATIVE-sounding guide. v2 fixed
      // register only, which still produced word-order-preserving
      // translationese — every word right, obviously machine. Both rules must
      // survive future prompt edits, so assert on what is actually sent.
      const db = fakeCacheDb([]);
      fetchMock.mockResolvedValue(
        okCompletion({ source_locale: 'ko', translations: { en: 'Please board.' } }),
      );
      await translateTextViaRouter('빨리 타', ['en'], { db });

      const body = JSON.parse(String(fetchMock.mock.calls[0][1].body));
      const system = String(
        body.messages.find((m: { role: string }) => m.role === 'system').content,
      );

      // Register — named for the languages where getting it wrong reads rudest.
      expect(system).toContain('존댓말');
      expect(system).toContain('敬語');
      expect(system).toContain('vous');
      expect(system).toContain('Sie');
      // Native phrasing + the explicit ban on mirroring source structure.
      expect(system).toMatch(/native/i);
      expect(system).toMatch(/idiomatic/i);
      expect(system).toMatch(/not mirror the source sentence structure/i);
      // Register and phrasing may move; facts may not.
      expect(system).toMatch(/never change, add, or omit any meaning/i);
    });
  });

  describe('shouldSkipTranslation — §M-2 ⑤ heuristics', () => {
    it.each([
      ['', true],
      ['ok', true],
      ['👍', true],
      ['👍👍🎉', true],
      ['123', true],
      ['!!', true],
      ['10:30', true],
      ['Good morning', false],
      ['안녕하세요', false],
      ['3시에 만나요', false],
    ])('%j → skip=%s', (text, expected) => {
      expect(shouldSkipTranslation(text)).toBe(expected);
    });

    it('short-circuits the full translate call for skippable text', async () => {
      process.env.GEMINI_API_KEY = 'g-key';
      const result = await translateTextViaRouter('👍', ['ko', 'ja'], { db: null });
      expect(result).toEqual({ source_locale: 'und', translations: {} });
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});

/**
 * §V0.6 — 헤지. 실측(2026-07-27)에서 translate p50 이 1.0~1.4초인데 꼬리가 2.3초+
 * 였고 gemini 가 18회 중 3회 503 을 뱉었다. 조인 타임아웃은 정당하게 느린 팬아웃을
 * 죽이므로, 1순위를 살려둔 채 2순위를 나란히 띄워 꼬리만 자른다.
 */
describe('provider hedging (V0.6)', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
    delete process.env.DEEPSEEK_API_KEY;
    process.env.GEMINI_API_KEY = 'g-key';
    process.env.OPENAI_API_KEY = 'o-key';
  });
  afterEach(() => {
    process.env = OLD_ENV;
  });

  /** `delayMs` 뒤에 응답하는 프로바이더. url 로 누가 불렸는지 가른다. */
  function slowFetch(plan: Record<string, { delayMs: number; content?: string; status?: number }>) {
    return jest.fn(async (url: string) => {
      const key = String(url).includes('generativelanguage') ? 'gemini' : 'openai';
      const step = plan[key];
      if (!step) throw new Error(`unexpected provider call: ${url}`);
      await new Promise((r) => setTimeout(r, step.delayMs));
      if (step.status && step.status >= 400) {
        return { ok: false, status: step.status, json: async () => ({ error: { message: 'boom' } }) };
      }
      return okCompletion(step.content ?? 'hedged');
    });
  }

  it('1순위가 임계값 전에 답하면 2순위를 아예 부르지 않는다', async () => {
    process.env.TOUR_AI_TRANSLATE_HEDGE_AFTER_MS = '200';
    const fetchMock = slowFetch({ gemini: { delayMs: 10, content: 'fast' } });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('fast');
    expect(result.provider).toBe('gemini');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('1순위가 느리면 2순위를 병렬로 띄우고 먼저 온 쪽을 쓴다', async () => {
    process.env.TOUR_AI_TRANSLATE_HEDGE_AFTER_MS = '50';
    const fetchMock = slowFetch({
      gemini: { delayMs: 5_000, content: 'slow-gemini' },
      openai: { delayMs: 20, content: 'hedge-won' },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const started = Date.now();
    const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
    // 느린 1순위를 기다리지 않았다.
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(result.content).toBe('hedge-won');
    expect(result.provider).toBe('openai');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('헤지를 띄웠어도 1순위가 먼저 끝나면 1순위를 쓴다 (버리지 않는다)', async () => {
    process.env.TOUR_AI_TRANSLATE_HEDGE_AFTER_MS = '20';
    const fetchMock = slowFetch({
      gemini: { delayMs: 60, content: 'primary-still-won' },
      openai: { delayMs: 5_000, content: 'hedge-too-slow' },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('primary-still-won');
    expect(result.provider).toBe('gemini');
  });

  it('임계값 전에 실패하면 헤지 없이 그냥 다음 단으로 (중복 호출 없음)', async () => {
    process.env.TOUR_AI_TRANSLATE_HEDGE_AFTER_MS = '500';
    const fetchMock = slowFetch({
      gemini: { delayMs: 5, status: 503 },
      openai: { delayMs: 5, content: 'fallback' },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('fallback');
    expect(result.provider).toBe('openai');
    expect(fetchMock).toHaveBeenCalledTimes(2); // 1순위 1 + 2순위 1, 헤지 중복 없음
  });

  it('둘 다 실패하면 두 실패가 모두 보고된다 (로그가 반쪽이면 안 된다)', async () => {
    process.env.TOUR_AI_TRANSLATE_HEDGE_AFTER_MS = '20';
    const fetchMock = slowFetch({
      gemini: { delayMs: 60, status: 503 },
      openai: { delayMs: 30, status: 500 },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    await expect(chatCompletion('translate', [{ role: 'user', content: 'hi' }])).rejects.toThrow(AiRouterError);
    try {
      await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
    } catch (error) {
      const reasons = (error as AiRouterError & { attempts?: Array<{ provider: string }> }).attempts ?? [];
      expect(reasons.map((a) => a.provider).sort()).toEqual(['gemini', 'openai']);
    }
  });

  it('배치 경로는 헤지하지 않는다 — 사람이 기다리는 호출이 아니다', async () => {
    process.env.DEEPSEEK_API_KEY = 'd-key';
    const fetchMock = jest.fn(async (url: string) => {
      if (String(url).includes('deepseek')) {
        await new Promise((r) => setTimeout(r, 300));
        return okCompletion('batch');
      }
      throw new Error(`batch must not hedge; called ${url}`);
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await chatCompletion('batch', [{ role: 'user', content: 'hi' }]);
    expect(result.provider).toBe('deepseek');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('HEDGE_AFTER_MS=0 이면 예전 순차 동작 그대로', async () => {
    process.env.TOUR_AI_TRANSLATE_HEDGE_AFTER_MS = '0';
    const fetchMock = slowFetch({
      gemini: { delayMs: 200, content: 'sequential' },
      openai: { delayMs: 1, content: 'must-not-be-called' },
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const result = await chatCompletion('translate', [{ role: 'user', content: 'hi' }]);
    expect(result.content).toBe('sequential');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
