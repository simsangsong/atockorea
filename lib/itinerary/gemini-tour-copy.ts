/**
 * Optional Gemini pass: rewrites tourTitle + tourSummary only.
 * Fixed stops are passed as read-only context — the model must not add/remove POIs.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';
import type { GeminiDraft, ItineraryUserInput } from '@/lib/itinerary/types';

const copySchema = z.object({
  tourTitle: z.string(),
  tourSummary: z.string(),
});

const DEFAULT_MODEL = 'gemini-2.5-flash';

const SYSTEM = `You write marketing copy for a travel itinerary.

Hard rules:
- Output valid JSON only with keys tourTitle and tourSummary.
- Do NOT add, remove, rename, or reorder POIs. The stop list is final.
- Do not mention POIs not in the provided list.
- Keep tourSummary under ~400 characters.
- Language should match the traveler locale when obvious (Korean for ko).`;

export async function generateGeminiTourCopyOnly(
  draft: GeminiDraft,
  input: ItineraryUserInput,
): Promise<{ tourTitle: string; tourSummary: string; model: string; rawText: string }> {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY missing');
  }
  const modelName = (process.env.GEMINI_MODEL || DEFAULT_MODEL).trim();
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    systemInstruction: SYSTEM,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.35,
      maxOutputTokens: 1024,
    },
  });

  const payload = {
    traveler: {
      destination: input.destination,
      durationDays: input.durationDays,
      travelStyle: input.travelStyle,
      seniors: input.seniors,
      withChildren: input.withChildren,
      rainyDay: input.rainyDay,
      locale: input.locale,
    },
    fixedStops: draft.stops.map((s) => ({
      contentId: s.contentId,
      plannedDurationMin: s.plannedDurationMin,
      sortOrder: s.sortOrder,
    })),
    draftTitle: draft.tourTitle,
    draftSummary: draft.tourSummary,
  };

  const userMessage = `Rewrite tourTitle and tourSummary for this finalized itinerary.\n\n${JSON.stringify(payload)}`;

  const result = await model.generateContent(userMessage);
  const rawText = result.response.text();
  const parsed = JSON.parse(rawText.replace(/```json\s*|\s*```/g, '').trim());
  const out = copySchema.parse(parsed);
  return { tourTitle: out.tourTitle, tourSummary: out.tourSummary, model: modelName, rawText };
}
