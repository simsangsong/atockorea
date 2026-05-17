const OPENAI_API_BASE = 'https://api.openai.com/v1';
const GROQ_API_BASE = 'https://api.groq.com/openai/v1';

type SttProvider = 'groq' | 'openai';

type VerboseSegment = {
  avg_logprob?: number;
  compression_ratio?: number;
  no_speech_prob?: number;
};

type VerboseTranscription = {
  text?: string;
  language?: string;
  duration?: number;
  segments?: VerboseSegment[];
};

export type SttQuality = {
  avg_logprob: number | null;
  compression_ratio: number | null;
  no_speech_prob: number | null;
  duration: number | null;
  reason_codes: string[];
};

export type SttResult = {
  text: string;
  source_locale?: string;
  provider: SttProvider;
  model: string;
  fallback_used: boolean;
  fallback_reason_codes: string[];
  quality: SttQuality;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function qualityFromVerbose(data: VerboseTranscription): SttQuality {
  const segments = Array.isArray(data.segments) ? data.segments : [];
  return {
    avg_logprob: average(segments.map((s) => s.avg_logprob).filter((v): v is number => typeof v === 'number')),
    compression_ratio: average(
      segments.map((s) => s.compression_ratio).filter((v): v is number => typeof v === 'number'),
    ),
    no_speech_prob: average(
      segments.map((s) => s.no_speech_prob).filter((v): v is number => typeof v === 'number'),
    ),
    duration: typeof data.duration === 'number' ? data.duration : null,
    reason_codes: [],
  };
}

function fallbackReasons(data: VerboseTranscription, quality: SttQuality): string[] {
  const text = (data.text ?? '').trim();
  const reasons: string[] = [];
  const allowedLanguages = (process.env.STT_ALLOWED_LANGUAGES || 'ko,en,ja,zh,es')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
  const language = data.language?.trim();

  if (!text) reasons.push('empty_text');
  if (text.length > 0 && text.length < Number(process.env.STT_MIN_TEXT_LENGTH || 2)) {
    reasons.push('too_short');
  }
  if (quality.no_speech_prob !== null && quality.no_speech_prob > Number(process.env.STT_MAX_NO_SPEECH_PROB || 0.6)) {
    reasons.push('high_no_speech_prob');
  }
  if (quality.avg_logprob !== null && quality.avg_logprob < Number(process.env.STT_MIN_AVG_LOGPROB || -1.0)) {
    reasons.push('low_avg_logprob');
  }
  if (
    quality.compression_ratio !== null &&
    quality.compression_ratio > Number(process.env.STT_MAX_COMPRESSION_RATIO || 2.4)
  ) {
    reasons.push('high_compression_ratio');
  }
  if (language && allowedLanguages.length > 0 && !allowedLanguages.includes(language)) {
    reasons.push('unexpected_language');
  }
  if (
    quality.duration !== null &&
    quality.duration > Number(process.env.STT_LONG_AUDIO_SECONDS || 20) &&
    text.length < Number(process.env.STT_LONG_AUDIO_MIN_TEXT_LENGTH || 10)
  ) {
    reasons.push('long_audio_low_text');
  }

  return reasons;
}

async function transcribeWithProvider(file: File, provider: SttProvider, prompt?: string): Promise<{
  model: string;
  data: VerboseTranscription;
}> {
  const body = new FormData();
  const model =
    provider === 'groq'
      ? process.env.GROQ_STT_MODEL || 'whisper-large-v3-turbo'
      : process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe';
  body.append('model', model);
  body.append('file', file);
  body.append('response_format', 'verbose_json');
  if (prompt) body.append('prompt', prompt.slice(0, 900));

  const baseUrl = provider === 'groq' ? GROQ_API_BASE : OPENAI_API_BASE;
  const apiKey = provider === 'groq' ? requiredEnv('GROQ_API_KEY') : requiredEnv('OPENAI_API_KEY');

  const res = await fetch(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}` },
    body,
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`${provider} transcription failed: ${message}`);
  }

  return { model, data: (await res.json()) as VerboseTranscription };
}

export async function transcribeAudioWithFallback(file: File, options?: { prompt?: string }): Promise<SttResult> {
  const primary = (process.env.STT_PRIMARY_PROVIDER || 'groq') as SttProvider;
  const fallback = (process.env.STT_FALLBACK_PROVIDER || 'openai') as SttProvider;
  const providers: SttProvider[] = primary === fallback ? [primary] : [primary, fallback];
  let firstReasons: string[] = [];
  let firstError: string | null = null;

  for (const [index, provider] of providers.entries()) {
    try {
      const { data, model } = await transcribeWithProvider(file, provider, options?.prompt);
      const quality = qualityFromVerbose(data);
      const reasons = index === 0 ? fallbackReasons(data, quality) : [];

      if (index === 0 && reasons.length > 0 && providers.length > 1) {
        firstReasons = reasons;
        continue;
      }

      return {
        text: (data.text ?? '').trim(),
        source_locale: data.language,
        provider,
        model,
        fallback_used: index > 0,
        fallback_reason_codes: index > 0 ? firstReasons : [],
        quality: { ...quality, reason_codes: index > 0 ? firstReasons : reasons },
      };
    } catch (error) {
      if (index === 0 && providers.length > 1) {
        firstError = error instanceof Error ? error.message : String(error);
        firstReasons = ['primary_error'];
        continue;
      }
      if (firstError) {
        throw new Error(`${firstError}; fallback failed: ${error instanceof Error ? error.message : String(error)}`);
      }
      throw error;
    }
  }

  throw new Error('No STT provider returned a transcription');
}
