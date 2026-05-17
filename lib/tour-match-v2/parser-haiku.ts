/**
 * Haiku-mode parser. Calls Claude Haiku 4.5 with prompt caching.
 *
 * The system prompt is a large cacheable block (taxonomy + examples + rules);
 * the user message is the small dynamic query. First call → cache_create cost,
 * subsequent calls within the cache TTL window → cache_read (~90% cheaper).
 *
 * Output schema is identical to ruleParse() — the API route is parser-agnostic.
 */

import Anthropic from "@anthropic-ai/sdk";
import taxonomyJson from "./data/matching_dimensions_taxonomy.json";
import type { ParsedQueryV2 } from "./types";

const TAXONOMY = taxonomyJson as Record<string, any>;
const HAIKU_MODEL = "claude-haiku-4-5";

const PARSED_QUERY_SCHEMA_DESCRIPTION = `{
  "raw_query": "<verbatim user input>",
  "raw_query_locale": "ko" | "en" | "zh-TW" | "zh-CN" | "ja",
  "regions": ["<region_key>", ...],
  "sub_regions": ["<sub_region_key>", ...],
  "season": "spring" | "summer" | "autumn" | "winter" | null,
  "months": [<int 1-12>, ...] | null,
  "season_locks": ["<season_lock_key>", ...],
  "personas": ["<persona_key>", ...],
  "themes": ["<theme_key>", ...],
  "anchor_pois_mentioned": ["<poi_key>", ...],
  "pace": "relaxed" | "active" | "moderate" | null,
  "format": "private" | "small_group" | "bus_tour" | "charter" | null,
  "duration_constraint": "half_day" | "day_trip" | "extended" | null,
  "user_max_hours": <int> | null,
  "hard_constraints": ["<constraint_key>", ...],
  "wants_cruise": true | false,
  "wants_charter_customization": true | false,
  "is_multi_day_request": true | false,
  "boost_dimensions": {"<mp_dimension>": <weight 0.0-2.0>, ...},
  "negative_signals": ["<theme_or_persona to penalize>", ...],
  "confidence": 0.0-1.0,
  "parser_notes": "<brief explanation>"
}`;

const LANG_KEYS = new Set(["ko", "en", "zh", "zh-TW", "zh-CN", "ja"]);

function compactTaxonomyForHaiku(taxonomy: any): any {
  const strip = (node: any): any => {
    if (Array.isArray(node)) return node.map(strip);
    if (node && typeof node === "object") {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(node)) {
        if (LANG_KEYS.has(k)) continue;
        out[k] = strip(v);
      }
      return out;
    }
    return node;
  };
  const compact = strip(taxonomy);
  for (const block of ["regions", "sub_regions"]) {
    if (compact[block] && typeof compact[block] === "object") {
      compact[block] = Object.keys(compact[block]);
    }
  }
  return compact;
}

function buildSystemPrompt(): string {
  const compact = compactTaxonomyForHaiku(TAXONOMY);
  const examples = `\
EXAMPLE 1 (Korean → English structured output):
USER: "벚꽃 시즌에 가족이랑 제주 동부 1일투어"
OUTPUT: {"raw_query":"벚꽃 시즌에 가족이랑 제주 동부 1일투어","raw_query_locale":"ko","regions":["jeju"],"sub_regions":["jeju_east"],"season":"spring","months":[3,4],"season_locks":["cherry_blossom"],"personas":["families"],"themes":[],"anchor_pois_mentioned":[],"pace":null,"format":null,"duration_constraint":"day_trip","user_max_hours":null,"hard_constraints":[],"wants_cruise":false,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"cherry_blossom_fit":1.5,"cherry_bloom_window_fit":1.5,"family_fit":1.0,"jeju_cherry_blossom_east_route_fit":1.2},"negative_signals":[],"confidence":0.88,"parser_notes":"Strong cherry+family+Jeju-east signal; day-trip implied; no cruise intent"}

EXAMPLE 2 (Korean hydrangea + month + couple):
USER: "5월 수국축제 보러 제주 서남부 커플"
OUTPUT: {"raw_query":"5월 수국축제 보러 제주 서남부 커플","raw_query_locale":"ko","regions":["jeju"],"sub_regions":["jeju_southwest"],"season":null,"months":[5],"season_locks":["hydrangea"],"personas":["couples"],"themes":[],"anchor_pois_mentioned":[],"pace":null,"format":null,"duration_constraint":null,"user_max_hours":null,"hard_constraints":[],"wants_cruise":false,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"hydrangea_fit":1.5,"hydrangea_festival_fit":1.5,"summer_flowers_hydrangea_fit":1.5,"couple_fit":1.0},"negative_signals":[],"confidence":0.85,"parser_notes":"Hydrangea peak Jun-Jul; user said May (pre-peak); months=[5] retained; no cruise intent"}

EXAMPLE 3 (English cruise + half-day) — wants_cruise=true:
USER: "we have 5 hours from Busan cruise port, need a private car tour"
OUTPUT: {"raw_query":"we have 5 hours from Busan cruise port, need a private car tour","raw_query_locale":"en","regions":["busan_city"],"sub_regions":[],"season":null,"months":null,"season_locks":[],"personas":["cruise_passengers"],"themes":[],"anchor_pois_mentioned":[],"pace":null,"format":"private","duration_constraint":"half_day","user_max_hours":5,"hard_constraints":["cruise_reboard_5pm"],"wants_cruise":true,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"cruise_shore_excursion_fit":1.5,"private_fit":1.0,"cruise_reboarding_safety_fit":1.0},"negative_signals":[],"confidence":0.92,"parser_notes":"Cruise-shore + private + half-day strongly signaled; wants_cruise=TRUE due to explicit 'cruise port'"}

EXAMPLE 4 (general Busan family — NO cruise intent):
USER: "부산 호텔에서 픽업해서 가족 1일투어"
OUTPUT: {"raw_query":"부산 호텔에서 픽업해서 가족 1일투어","raw_query_locale":"ko","regions":["busan_city"],"sub_regions":[],"season":null,"months":null,"season_locks":[],"personas":["families"],"themes":[],"anchor_pois_mentioned":[],"pace":null,"format":null,"duration_constraint":"day_trip","user_max_hours":null,"hard_constraints":[],"wants_cruise":false,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"family_fit":1.0},"negative_signals":[],"confidence":0.72,"parser_notes":"Hotel pickup means general traveler, NOT cruise"}

EXAMPLE 5 (Traditional Chinese):
USER: "5月份去濟州島看繡球花,情侶旅行"
OUTPUT: {"raw_query":"5月份去濟州島看繡球花,情侶旅行","raw_query_locale":"zh-TW","regions":["jeju"],"sub_regions":[],"season":null,"months":[5],"season_locks":["hydrangea"],"personas":["couples"],"themes":[],"anchor_pois_mentioned":[],"pace":null,"format":null,"duration_constraint":null,"user_max_hours":null,"hard_constraints":[],"wants_cruise":false,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"hydrangea_fit":1.5,"hydrangea_festival_fit":1.5,"couple_fit":1.0},"negative_signals":[],"confidence":0.85,"parser_notes":"Traditional Chinese: 繡球花=hydrangea, 情侶=couples, 5月=May"}

EXAMPLE 6 (Japanese):
USER: "12月に済州島でみかん狩りと雪景色を家族で"
OUTPUT: {"raw_query":"12月に済州島でみかん狩りと雪景色を家族で","raw_query_locale":"ja","regions":["jeju"],"sub_regions":[],"season":"winter","months":[12],"season_locks":["tangerine","snow_camellia"],"personas":["families"],"themes":[],"anchor_pois_mentioned":[],"pace":null,"format":null,"duration_constraint":null,"user_max_hours":null,"hard_constraints":[],"wants_cruise":false,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"tangerine_picking_winter_fit":1.5,"hallabong_peak_window_fit":1.5,"first_snow_experience_fit":1.5,"family_fit":1.0},"negative_signals":[],"confidence":0.85,"parser_notes":"Japanese: みかん狩り=tangerine picking, 雪景色=snow scenery, 家族=family"}

EXAMPLE 7 (weak / generic English query — no month, no season_lock, no region):
USER: "I want a scenic nature cafe day in Korea"
OUTPUT: {"raw_query":"I want a scenic nature cafe day in Korea","raw_query_locale":"en","regions":[],"sub_regions":[],"season":null,"months":null,"season_locks":[],"personas":[],"themes":["scenic","cafe","nature"],"anchor_pois_mentioned":[],"pace":null,"format":null,"duration_constraint":"day_trip","user_max_hours":null,"hard_constraints":[],"wants_cruise":false,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"scenic_level":1.0,"cafe_fit":1.2,"nature_fit":1.0},"negative_signals":[],"confidence":0.52,"parser_notes":"Generic theme words only; no month/season/region — downstream gate restricts to evergreen products"}

EXAMPLE 8 (CONTRADICTION — user month vs seasonal phenomenon, must be preserved):
USER: "5월에 한국 벚꽃 보고 싶어요"
OUTPUT: {"raw_query":"5월에 한국 벚꽃 보고 싶어요","raw_query_locale":"ko","regions":[],"sub_regions":[],"season":null,"months":[5],"season_locks":["cherry_blossom"],"personas":[],"themes":[],"anchor_pois_mentioned":[],"pace":null,"format":null,"duration_constraint":null,"user_max_hours":null,"hard_constraints":[],"wants_cruise":false,"wants_charter_customization":false,"is_multi_day_request":false,"boost_dimensions":{"cherry_blossom_fit":1.5,"cherry_bloom_window_fit":1.5},"negative_signals":[],"confidence":0.7,"parser_notes":"User said May (5월) but cherry blooms Mar-Apr; months=[5] retained — downstream seasonal-gate will correctly reject cherry tours and surface NO_MATCH"}`;

  return `You are a tour query parser for atockorea.com (Korea inbound day-tour marketplace).
Convert natural-language tour queries (Korean, English, Chinese, Japanese) into a strictly structured JSON matching profile.

═══════════════════════════════════════════════════════════════════════════
LANGUAGE POLICY (CRITICAL)
═══════════════════════════════════════════════════════════════════════════
The matching layer is monolingual English. raw_query field preserves user's
language verbatim; ALL OTHER FIELDS output ONLY canonical English snake_case
keys from the vocabulary below.

═══════════════════════════════════════════════════════════════════════════
OUTPUT SCHEMA (return ONLY this JSON — no markdown fences, no preamble)
═══════════════════════════════════════════════════════════════════════════

${PARSED_QUERY_SCHEMA_DESCRIPTION}

═══════════════════════════════════════════════════════════════════════════
VOCABULARY (use ONLY these English canonical keys)
═══════════════════════════════════════════════════════════════════════════

${JSON.stringify(compact)}

═══════════════════════════════════════════════════════════════════════════
PARSING RULES
═══════════════════════════════════════════════════════════════════════════

1. regions = HARD filter. Only set if explicitly stated.
2. months = HARD filter. User-stated months are AUTHORITATIVE — NEVER override based on seasonal context.
   - "spring" / "봄" alone → [3,4,5]
   - "May" / "5월" / "5月" → [5]
   - "5월 벚꽃" → months=[5], season_locks=["cherry_blossom"] (do NOT widen to [3,4]; downstream gate will reject cherry tours since cherry blooms only Mar-Apr — that is the correct outcome)
   - "벚꽃" with no month mentioned → months=null, season_locks=["cherry_blossom"]; downstream uses today's date as fallback
3. season_locks fire ONLY on EXPLICIT seasonal phenomenon names: cherry_blossom (벚꽃/cherry/사쿠라/桜), plum_blossom (매화), hydrangea (수국/紫陽花/繡球花), tangerine (감귤/みかん), snow / snow_camellia (눈/雪), camellia (동백/椿), autumn_foliage (단풍/紅葉). Do NOT infer a season_lock from generic "spring tour" / "winter day" alone — those go into season+months only.
4. boost_dimensions = soft scoring weights. Combine signals from personas + themes + season_locks + pace. Cap at 2.0.
5. anchor_pois_mentioned = English snake_case poi_keys when user names landmarks.
6. wants_cruise=TRUE ONLY when user EXPLICITLY signals cruise/shore-excursion intent.
7. wants_charter_customization=TRUE for "차량 대절 / 맞춤 / custom route / private car charter" patterns.
8. is_multi_day_request=TRUE for "1박2일 / overnight / multi-day / 패키지 호텔".
9. confidence (0.4-1.0); raise with more matched signals. Generic / weak queries (no region, no month, no season, only soft theme words) → keep confidence ≤ 0.55 so the downstream gate restricts results to evergreen products.
10. parser_notes = ONE concise English sentence including cruise intent reasoning.
11. NEVER invent keys outside the vocabulary.
12. Return valid JSON. All schema fields must be present (use null/[]/{} for absent values).

═══════════════════════════════════════════════════════════════════════════
EXAMPLES
═══════════════════════════════════════════════════════════════════════════

${examples}

Now parse the user's query.`;
}

let _systemPromptCache: string | null = null;
function getSystemPrompt(): string {
  if (_systemPromptCache === null) _systemPromptCache = buildSystemPrompt();
  return _systemPromptCache;
}

export async function haikuParse(query: string): Promise<ParsedQueryV2> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY env var required for Haiku parser");
  }
  const client = new Anthropic({ apiKey });

  const t0 = Date.now();
  const resp = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 800,
    system: [
      {
        type: "text",
        text: getSystemPrompt(),
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: `PARSE THIS QUERY:\n${query}` }],
  });
  const elapsed_ms = Date.now() - t0;

  let raw = "";
  for (const block of resp.content) {
    if (block.type === "text") raw += block.text;
  }
  raw = raw.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();

  let parsed: ParsedQueryV2;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new Error(`Haiku returned non-JSON: ${raw.slice(0, 300)}`);
  }

  const usage = resp.usage as any;
  parsed._telemetry = {
    model: HAIKU_MODEL,
    input_tokens: usage?.input_tokens ?? 0,
    cache_create_input_tokens: usage?.cache_creation_input_tokens ?? 0,
    cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
    output_tokens: usage?.output_tokens ?? 0,
    elapsed_ms,
  };
  return parsed;
}
