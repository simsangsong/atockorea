import { GoogleGenerativeAI } from "@google/generative-ai";
import type { TourMatchingProfileRow, TravelerIntentV1 } from "@/lib/tour-product-match/types";

function stripJsonFence(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Second Gemini pass: explain why the **already-selected** product fits.
 * Must not choose or reorder products — explanation only.
 */
export async function generateMatchExplanationWithGemini(params: {
  rawText: string;
  locale: string;
  intent: TravelerIntentV1;
  winnerProductId: string;
  winnerTitle: string;
  profile: TourMatchingProfileRow;
}): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const intentJson = JSON.stringify(params.intent);
  const profileLite = {
    product_id: params.profile.product_id,
    region_type: params.profile.region_type,
    pace_level: params.profile.pace_level,
    walking_level: params.profile.walking_level,
    duration_band: params.profile.duration_band,
    min_recommended_age: params.profile.min_recommended_age,
    adult_family_fit: params.profile.adult_family_fit,
    young_kids_fit: params.profile.young_kids_fit,
    indoor_ratio: params.profile.indoor_ratio,
    mobility_friendly_fit: params.profile.mobility_friendly_fit,
    comfort_level: params.profile.comfort_level,
    price_band: params.profile.price_band,
    small_group_fit: params.profile.small_group_fit,
  };

  const prompt = `You write short UX copy for a travel site.

CRITICAL RULES:
- The winning tour is ALREADY FIXED. Do NOT recommend, compare, or suggest any other tour or region.
- Output ONLY valid JSON with a single key "explanation" (string).
- "explanation": 2–3 sentences, friendly and specific, in the language that matches locale "${params.locale}" (e.g. ko → Korean, es → Spanish, en → English).
- Ground the text in the customer's original message and the structured intent + product facts below.
- Do not invent discounts, prices, ratings, or guarantees.

locale: ${params.locale}
winner_product_id: ${params.winnerProductId}
winner_title: ${params.winnerTitle}

Original customer message:
"""${params.rawText.replace(/"""/g, "'")}"""

Structured intent (JSON):
${intentJson}

Product profile snapshot (JSON):
${JSON.stringify(profileLite)}`;

  const res = await model.generateContent(prompt);
  const raw = res.response.text();
  const cleaned = stripJsonFence(raw);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Explanation model returned non-JSON");
    parsed = JSON.parse(m[0]);
  }

  const o = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
  const explanation = typeof o.explanation === "string" ? o.explanation.trim() : "";
  if (!explanation) {
    throw new Error("Explanation JSON missing explanation string");
  }
  return explanation;
}
