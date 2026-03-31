/**
 * Injected JSON caller for parseRequest stage 4 (LLM slot filler).
 *
 * Prefers GEMINI_API_KEY, then ANTHROPIC_API_KEY. Returns undefined when neither
 * is set so the pipeline skips stage 4 without error.
 */
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';

function stripJsonFence(t: string): string {
  return t.replace(/```json\s*|\s*```/g, '').trim();
}

function extractJsonObject(text: string): string {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) return text.slice(a, b + 1);
  return text.trim();
}

/**
 * Returns a callJsonModel compatible with {@link parseRequest} when an API key exists.
 */
export function getParserSlotFillerCallJsonModel():
  | ((prompt: string, userInput: string) => Promise<unknown>)
  | undefined {
  const geminiKey = process.env.GEMINI_API_KEY?.trim();
  if (geminiKey) {
    return async (prompt: string, userInput: string) => {
      const modelName = (
        process.env.GEMINI_PARSER_SLOT_MODEL ??
        process.env.GEMINI_MODEL ??
        'gemini-2.5-flash'
      ).trim();
      const genAI = new GoogleGenerativeAI(geminiKey);
      const model = genAI.getGenerativeModel({
        model: modelName,
        generationConfig: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 2048,
        },
      });
      const full = `${prompt}\n\n---\n${userInput}`;
      const result = await model.generateContent(full);
      const rawText = result.response.text();
      const cleaned = stripJsonFence(rawText);
      return JSON.parse(cleaned) as unknown;
    };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (anthropicKey) {
    return async (prompt: string, userInput: string) => {
      const modelName = (
        process.env.ANTHROPIC_PARSER_SLOT_MODEL ?? 'claude-3-5-haiku-20241022'
      ).trim();
      const client = new Anthropic({ apiKey: anthropicKey });
      const res = await client.messages.create({
        model: modelName,
        max_tokens: 2048,
        system:
          'You are a strict JSON-only slot filler. Output a single JSON object. No markdown fences.',
        messages: [{ role: 'user', content: `${prompt}\n\n---\n${userInput}` }],
      });
      const block = res.content[0];
      const text =
        block && typeof block === 'object' && 'text' in block
          ? (block as { text: string }).text
          : '';
      const jsonStr = extractJsonObject(text);
      return JSON.parse(jsonStr) as unknown;
    };
  }

  return undefined;
}
