import { transcribeAudioWithFallback, type SttResult } from './stt-router';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

const translationJsonFormat = {
  type: 'json_schema',
  name: 'translation_result',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      source_locale: { type: 'string' },
      translations: {
        type: 'object',
        additionalProperties: { type: 'string' },
      },
    },
    required: ['source_locale', 'translations'],
  },
  strict: false,
};

const courseJsonFormat = {
  type: 'json_schema',
  name: 'tour_course_result',
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      course: { type: 'object', additionalProperties: true },
      description_presets: { type: 'object', additionalProperties: true },
    },
    required: ['course', 'description_presets'],
  },
  strict: false,
};

function getOpenAIKey(): string {
  const key = process.env.OPENAI_API_KEY;
  if (!key) {
    throw new Error('OPENAI_API_KEY is not configured');
  }
  return key;
}

export type TranslationResult = {
  source_locale: string;
  translations: Record<string, string>;
};

export async function transcribeAudioFile(file: File, options?: { prompt?: string }): Promise<SttResult> {
  return transcribeAudioWithFallback(file, options);
}

export async function translateTextForLocales(
  text: string,
  targetLocales: string[],
): Promise<TranslationResult> {
  const uniqueTargets = [...new Set(targetLocales.filter(Boolean))];
  if (uniqueTargets.length === 0) {
    return { source_locale: 'und', translations: {} };
  }

  const res = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content:
            'Detect the source language. Translate the user text into each requested locale. Preserve names, times, pickup points, prices, and URLs. Return only valid JSON.',
        },
        {
          role: 'user',
          content: JSON.stringify({ text, target_locales: uniqueTargets }),
        },
      ],
      text: { format: translationJsonFormat },
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`OpenAI translation failed: ${message}`);
  }

  const data = (await res.json()) as { output_text?: string; output?: unknown };
  const raw = data.output_text || extractResponseText(data);
  const parsed = JSON.parse(raw) as Partial<TranslationResult>;
  return {
    source_locale: parsed.source_locale || 'und',
    translations: parsed.translations || {},
  };
}

export async function generateSpeechMp3(text: string, locale: string): Promise<ArrayBuffer> {
  const res = await fetch(`${OPENAI_API_BASE}/audio/speech`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts',
      voice: process.env.OPENAI_TTS_VOICE || 'alloy',
      input: text,
      response_format: 'mp3',
      instructions: `Speak naturally for a travel audio guide. Locale: ${locale}. Disclose in the app UI that this is AI-generated audio.`,
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`OpenAI speech generation failed: ${message}`);
  }

  return res.arrayBuffer();
}

export async function generateCoursePayload(locale: string, sourcePayload: unknown): Promise<{
  course: Record<string, unknown>;
  description_presets: Record<string, unknown>;
}> {
  const res = await fetch(`${OPENAI_API_BASE}/responses`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getOpenAIKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TEXT_MODEL || 'gpt-5-mini',
      input: [
        {
          role: 'system',
          content:
            'Create a tour course from a locale JSON payload. Return only JSON with keys course and description_presets. course.stops must be an array of concise stop objects with stable key, title, description, narration_text, duration_minutes, and sort_order.',
        },
        {
          role: 'user',
          content: JSON.stringify({ locale, source_payload: sourcePayload }),
        },
      ],
      text: { format: courseJsonFormat },
    }),
  });

  if (!res.ok) {
    const message = await res.text();
    throw new Error(`OpenAI course generation failed: ${message}`);
  }

  const data = (await res.json()) as { output_text?: string; output?: unknown };
  const parsed = JSON.parse(data.output_text || extractResponseText(data)) as {
    course?: Record<string, unknown>;
    description_presets?: Record<string, unknown>;
  };
  return {
    course: parsed.course || {},
    description_presets: parsed.description_presets || {},
  };
}

function extractResponseText(data: { output?: unknown }): string {
  const output = Array.isArray(data.output) ? data.output : [];
  for (const item of output as Array<{ content?: unknown }>) {
    const content = Array.isArray(item.content) ? item.content : [];
    for (const part of content as Array<{ type?: string; text?: string }>) {
      if (part.type === 'output_text' && part.text) return part.text;
    }
  }
  throw new Error('OpenAI response did not include output text');
}
