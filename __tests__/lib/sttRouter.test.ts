/**
 * STT router — provider ladder + response_format selection.
 *
 * Regression: the OpenAI transcribe path used to request `verbose_json` for
 * ALL models, but `gpt-4o(-mini)-transcribe` rejects it with a 400 ("Use
 * 'json' or 'text' instead"). When Groq (the default primary) had no working
 * key, every fallback transcription — and thus every voice message send —
 * failed. The fix: default the OpenAI model to whisper-1 and pick the format
 * per model (verbose_json only for whisper-family).
 */
import { transcribeAudioWithFallback } from '@/lib/stt-router';

const realFetch = global.fetch;

function okVerbose(text = 'hello') {
  return {
    ok: true,
    json: async () => ({ text, language: 'en', duration: 1, segments: [] }),
    text: async () => '',
  } as unknown as Response;
}
function okJson(text = 'hello') {
  return { ok: true, json: async () => ({ text }), text: async () => '' } as unknown as Response;
}
function httpErr(status: number, msg: string) {
  return { ok: false, status, json: async () => ({}), text: async () => msg } as unknown as Response;
}

interface Seen {
  url: string;
  model: string | null;
  fmt: string | null;
}
function captureFetch(reply: (url: string) => Response): Seen[] {
  const seen: Seen[] = [];
  global.fetch = jest.fn(async (url: string, init: { body: FormData }) => {
    seen.push({
      url: String(url),
      model: (init.body.get('model') as string | null) ?? null,
      fmt: (init.body.get('response_format') as string | null) ?? null,
    });
    return reply(String(url));
  }) as unknown as typeof fetch;
  return seen;
}

function file() {
  return new File([new Uint8Array(16)], 'clip.webm', { type: 'audio/webm' });
}

beforeEach(() => {
  jest.clearAllMocks();
  delete process.env.GROQ_API_KEY;
  delete process.env.STT_PRIMARY_PROVIDER;
  delete process.env.STT_FALLBACK_PROVIDER;
  delete process.env.GROQ_STT_MODEL;
  delete process.env.OPENAI_TRANSCRIBE_MODEL;
  process.env.OPENAI_API_KEY = 'sk-test';
});
afterAll(() => {
  global.fetch = realFetch;
});

describe('transcribeAudioWithFallback', () => {
  it('with no Groq key, falls back to OpenAI whisper-1 + verbose_json (the fix)', async () => {
    const seen = captureFetch(() => okVerbose('hi'));
    const res = await transcribeAudioWithFallback(file());
    // Groq threw at requiredEnv before any fetch → only OpenAI was called.
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('api.openai.com');
    expect(seen[0].model).toBe('whisper-1');
    expect(seen[0].fmt).toBe('verbose_json');
    expect(res.provider).toBe('openai');
    expect(res.fallback_used).toBe(true);
    expect(res.text).toBe('hi');
  });

  it('falls back to OpenAI when Groq errors (bad key/model) — the prod scenario', async () => {
    process.env.GROQ_API_KEY = 'gsk-bad';
    const seen = captureFetch((url) => (url.includes('groq.com') ? httpErr(401, 'invalid api key') : okVerbose('안녕')));
    const res = await transcribeAudioWithFallback(file());
    expect(res.provider).toBe('openai');
    expect(res.fallback_used).toBe(true);
    const openai = seen.find((s) => s.url.includes('api.openai.com'));
    expect(openai?.model).toBe('whisper-1');
    expect(openai?.fmt).toBe('verbose_json');
  });

  it('Groq primary (key present) uses verbose_json and short-circuits the fallback', async () => {
    process.env.GROQ_API_KEY = 'gsk-good';
    const seen = captureFetch(() => okVerbose('안녕하세요'));
    const res = await transcribeAudioWithFallback(file());
    expect(seen).toHaveLength(1);
    expect(seen[0].url).toContain('groq.com');
    expect(seen[0].fmt).toBe('verbose_json');
    expect(res.provider).toBe('groq');
    expect(res.fallback_used).toBe(false);
  });

  it('downgrades a gpt-4o transcribe model to response_format=json (never 400s)', async () => {
    process.env.OPENAI_TRANSCRIBE_MODEL = 'gpt-4o-mini-transcribe';
    const seen = captureFetch(() => okJson('hi'));
    const res = await transcribeAudioWithFallback(file());
    expect(seen[0].model).toBe('gpt-4o-mini-transcribe');
    expect(seen[0].fmt).toBe('json');
    expect(res.text).toBe('hi');
  });
});
