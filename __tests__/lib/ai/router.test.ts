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
      expect(bodyOf(1).max_tokens).toBeUndefined();
      // openai 는 추론 여유분이 더해진다 — 아래 테스트가 그 이유를 지킨다.
      expect(bodyOf(1).max_completion_tokens).toBeGreaterThan(400);
    });

    /**
     * 🔴 gpt-5 계열에서 `max_completion_tokens` 는 추론 토큰까지 포함한다.
     * 목적별 상한은 §L-D5 에서 **보이는 답의 길이**로 정해져 있으므로, 그 값을
     * 그대로 상한으로 주면 추론이 예산을 다 먹고 본문이 0자로 돌아온다
     * (`finish_reason:'length'`, `reasoning_tokens == cap`). 라우터는 그것을
     * `empty_completion` 으로 읽고 공급자를 강등시키므로 겉보기 증상은
     * "모델이 응답을 거부함"이 되고, **폴백 레그라 아무도 안 본다.**
     *
     * 실측(2026-08-03, gpt-5-mini, 질문 3개):
     *   cap 400 → 3/3 빈 응답 · cap 400+low → 1/3 · cap 1200+low → 3/3.
     *
     * 이 테스트가 지키는 것은 숫자가 아니라 **관계**다 — openai 로 나가는 상한은
     * 언제나 보이는 답의 상한보다 커야 하고, 다른 공급자는 그대로여야 한다.
     */
    it('gives openai reasoning headroom above the visible-answer cap, and leaves other providers alone', async () => {
      process.env.GEMINI_API_KEY = 'g-key';
      process.env.OPENAI_API_KEY = 'o-key';
      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 429, json: async () => ({}) })
        .mockResolvedValueOnce(okCompletion('hello'));

      await chatCompletion('concierge', [{ role: 'user', content: 'hi' }], { maxOutputTokens: 400 });

      expect(bodyOf(0).max_tokens).toBe(400); // gemini — 출력에만 쓰이므로 그대로
      expect(bodyOf(1).max_completion_tokens).toBeGreaterThanOrEqual(1200); // 실측상 3/3 통과 지점
      expect(bodyOf(1).reasoning_effort).toBe('low'); // 여유분을 실제로 작게 유지한다
      expect(bodyOf(0).reasoning_effort).toBeUndefined(); // openai 방언을 남에게 보내지 않는다
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
