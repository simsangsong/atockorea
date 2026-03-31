import { GoogleGenerativeAI } from '@google/generative-ai';
import { geminiDraftSchema, type GeminiDraft, type ItineraryUserInput } from './types';
import { interpolatePromptTemplate } from './prompt-interpolation';
import {
  buildPlanningConstraintsJson,
  buildTravelerRequestJson,
} from './prompt-payloads';
import { GEMINI_ITINERARY_SYSTEM_PROMPT, GEMINI_ITINERARY_USER_PROMPT_TEMPLATE } from './prompts/gemini-itinerary.prompts';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export { buildPlanningConstraintsJson, buildTravelerRequestJson } from './prompt-payloads';

export function buildGeminiUserPrompt(input: ItineraryUserInput, candidatePoisJson: string): string {
  return interpolatePromptTemplate(GEMINI_ITINERARY_USER_PROMPT_TEMPLATE, {
    USER_REQUEST_JSON: buildTravelerRequestJson(input),
    PLANNING_CONSTRAINTS_JSON: buildPlanningConstraintsJson(input),
    CANDIDATE_POIS_JSON: candidatePoisJson,
  });
}

function stripJsonFence(t: string): string {
  return t.replace(/```json\s*|\s*```/g, '').trim();
}

export async function generateGeminiDraft(
  candidatesJson: string,
  input: ItineraryUserInput,
): Promise<{ draft: GeminiDraft; model: string; rawText: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing');
  }
  const modelName = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: GEMINI_ITINERARY_SYSTEM_PROMPT,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.4,
      maxOutputTokens: 8192,
    },
  });

  const userMessage = buildGeminiUserPrompt(input, candidatesJson);

  const result = await model.generateContent(userMessage);
  const rawText = result.response.text();
  const cleaned = stripJsonFence(rawText);
  const parsed = JSON.parse(cleaned);
  const draft = geminiDraftSchema.parse(parsed);
  return { draft, model: modelName, rawText };
}
