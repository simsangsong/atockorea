import Anthropic from '@anthropic-ai/sdk';
import {
  claudeReviewDraftSchema,
  geminiDraftSchema,
  type GeminiDraft,
  type ItineraryReviewSummary,
  type ItineraryUserInput,
} from './types';
import { interpolatePromptTemplate } from './prompt-interpolation';
import { buildPlanningConstraintsJson, buildTravelerRequestJson } from './prompt-payloads';
import {
  CLAUDE_ITINERARY_REVIEW_SYSTEM_PROMPT,
  CLAUDE_ITINERARY_REVIEW_USER_TEMPLATE,
} from './prompts/claude-itinerary.prompts';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export { CLAUDE_ITINERARY_REVIEW_USER_TEMPLATE } from './prompts/claude-itinerary.prompts';

export function buildClaudeReviewUserPrompt(
  input: ItineraryUserInput,
  candidatePoisJson: string,
  geminiDraftJson: string,
): string {
  return interpolatePromptTemplate(CLAUDE_ITINERARY_REVIEW_USER_TEMPLATE, {
    USER_REQUEST_JSON: buildTravelerRequestJson(input),
    PLANNING_CONSTRAINTS_JSON: buildPlanningConstraintsJson(input),
    CANDIDATE_POIS_JSON: candidatePoisJson,
    GEMINI_DRAFT_JSON: geminiDraftJson,
  });
}

function extractJson(text: string): string {
  const a = text.indexOf('{');
  const b = text.lastIndexOf('}');
  if (a >= 0 && b > a) return text.slice(a, b + 1);
  return text;
}

export async function reviewWithClaude(
  draft: GeminiDraft,
  candidatesJson: string,
  input: ItineraryUserInput,
): Promise<{
  draft: GeminiDraft;
  reviewSummary: ItineraryReviewSummary;
  model: string;
  rawText: string;
}> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY missing');
  }
  const model = (process.env.ANTHROPIC_MODEL || DEFAULT_MODEL).trim();
  const client = new Anthropic({ apiKey });

  const userMessage = buildClaudeReviewUserPrompt(input, candidatesJson, JSON.stringify(draft));

  const res = await client.messages.create({
    model,
    max_tokens: 4096,
    system: CLAUDE_ITINERARY_REVIEW_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userMessage }],
  });
  const block = res.content[0];
  const text =
    block && typeof block === 'object' && 'text' in block ? (block as { text: string }).text : '';
  const rawText = text;
  const jsonStr = extractJson(text);
  const parsed = JSON.parse(jsonStr);
  const next = claudeReviewDraftSchema.parse(parsed);
  const { reviewSummary, ...draftFields } = next;
  return { draft: geminiDraftSchema.parse(draftFields), reviewSummary, model, rawText };
}
