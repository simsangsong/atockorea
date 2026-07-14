import { transcribeAudioWithFallback, type SttResult } from './stt-router';
import { translateTextViaRouter } from './ai/router';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

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

/**
 * Translation now runs through the multi-provider router (lib/ai/router.ts,
 * T0.9 / §M-1): Gemini Flash-Lite first when configured, OpenAI as the final
 * fallback, with the tour_translation_cache memory consulted before any LLM
 * call. Same contract as before: resolves with { source_locale, translations },
 * throws when every provider failed.
 */
export async function translateTextForLocales(
  text: string,
  targetLocales: string[],
): Promise<TranslationResult> {
  return translateTextViaRouter(text, targetLocales);
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
