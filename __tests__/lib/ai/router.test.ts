/**
 * T0.9 — multi-provider AI router: env switching across the 3 providers,
 * failure demotion, translation memory (cache hit = zero LLM calls), and the
 * §M-2 skip heuristics.
 */
import {
  chatCompletion,
  hashSource,
  resolveProviderChain,
  shouldSkipTranslation,
  translateTextViaRouter,
  AiRouterError,
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
