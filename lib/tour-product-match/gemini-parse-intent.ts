import { GoogleGenerativeAI } from "@google/generative-ai";
import { normalizeTravelerIntent } from "@/lib/tour-product-match/normalize-intent";
import type { TravelerIntentV1 } from "@/lib/tour-product-match/types";

const INTENT_SCHEMA_HINT = `{
  "desired_product_type": "small_group"|"private"|"bus"|null,
  "product_type_intent_strength": "soft"|"hard"|null,
  "pace_preference": 1-5 or null,
  "walking_tolerance": 1-5 or null,
  "scenic_importance": 1-5 or null,
  "photo_importance": 1-5 or null,
  "culture_importance": 1-5 or null,
  "relax_importance": 1-5 or null,
  "first_time_jeju": boolean or null,
  "with_family": boolean or null,
  "with_seniors": boolean or null,
  "with_kids": boolean or null,
  "one_day_only": boolean or null,
  "same_day_flight": boolean or null,
  "rain_sensitive": boolean or null,
  "value_focus": 1-5 or null,
  "iconic_importance": 1-5 or null,
  "cafe_importance": 1-5 or null,
  "region_affinity": "east"|"southwest"|"full_island"|"any"|null,
  "confidence": 0-1,
  "summary_one_line": string,
  "mobility": "low"|"moderate"|"high"|null,
  "toddlers": boolean or null,
  "stroller_heavy": boolean or null
}`;

function stripJsonFence(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

export async function parseTravelerIntentWithGemini(params: {
  rawText: string;
  locale: string;
}): Promise<TravelerIntentV1> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new Error("GEMINI_API_KEY is not configured");
  }

  const genAI = new GoogleGenerativeAI(key);
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `You extract structured travel preferences for Jeju day-tour matching.
User locale for wording context: ${params.locale}.
Return ONLY valid JSON (no markdown). Schema:
${INTENT_SCHEMA_HINT}

Rules:
- desired_product_type / product_type_intent_strength: our catalog only offers small-group van tours (not chartered private buses). Map user language:
  - small_group: shared / join / group day tour / small-group / "not private" when they accept others.
  - private: only when they want a private vehicle / exclusive tour / no strangers / "our own van".
  - bus: large coach / big bus group tour (rare in our catalog).
  - product_type_intent_strength hard: must / only / no shared / no bus / no strangers / exclusively private; soft: prefer / ideally / would like.
  - Set both null if the user does not mention tour format.
- Use integers 1–5 where shown; null if unknown.
- region_affinity: east = East Jeju focus, southwest = Hallasan/Osulloc/Aewol area, full_island = one-day loop / all-around highlights, any = no strong region preference.
- confidence: your certainty 0–1.
- summary_one_line: English or the user's language (short).

User message:
"""${params.rawText.replace(/"""/g, "'")}"""`;

  const res = await model.generateContent(prompt);
  const rawText = res.response.text();
  const cleaned = stripJsonFence(rawText);
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    const m = cleaned.match(/\{[\s\S]*\}/);
    if (!m) throw new Error("Gemini returned non-JSON");
    parsed = JSON.parse(m[0]);
  }

  return normalizeTravelerIntent(parsed);
}
