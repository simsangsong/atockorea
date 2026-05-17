/**
 * Top-1 winner explanation generator — second Haiku pass.
 *
 * Given the parsed query + the winning tour's signature fields, produces a
 * 2-3 sentence natural-language explanation in the user's locale (Korean by
 * default; English / Chinese / Japanese fall back to user-locale-matching).
 *
 * Caching: separate prompt-cache entry from the parser. ~1500 tokens cached
 * after first call; per-query ~$0.0015 (≈₩2) once warm.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { MatchTourRow, ParsedQueryV2, ScoredMatchV2 } from "./types";

const HAIKU_MODEL = "claude-haiku-4-5";

const EXPLAINER_SYSTEM_PROMPT = `You are a helpful tour-recommendation assistant for atockorea.com (Korea inbound day-tour marketplace). Your job: write a SHORT, friendly explanation (2-3 sentences) of why the recommended tour is the best match for the user's query.

═══════════════════════════════════════════════════════════════════════════
INPUT (from user message)
═══════════════════════════════════════════════════════════════════════════

You will receive a JSON payload:
{
  "user_query":   "<verbatim user input>",
  "user_locale":  "ko" | "en" | "zh" | "zh-TW" | "ja" | "es",
  "user_intent": {
    "regions": [...],
    "season_locks": [...],
    "personas": [...],
    "themes": [...],
    "anchor_pois": [...],
    "wants_cruise": bool,
    "wants_charter_customization": bool,
    "is_multi_day_request": bool
  },
  "winner": {
    "slug": "...",
    "title": "...",
    "destination_region": "...",
    "primary_themes": [...],
    "anchor_poi_keys": [...],
    "best_for": [...],
    "available_months": [...],
    "match_reasons": [...]
  },
  "score_components": {
    "anchor_poi_match": <number>,
    "boost_dimension_sum": <number>,
    "season_lock_match": <number>,
    "persona_alignment": <number>,
    ...
  }
}

═══════════════════════════════════════════════════════════════════════════
OUTPUT (return ONLY a JSON object, no markdown fences, no preamble)
═══════════════════════════════════════════════════════════════════════════

{
  "explanation": "<2-3 sentences in user_locale language>"
}

═══════════════════════════════════════════════════════════════════════════
WRITING RULES
═══════════════════════════════════════════════════════════════════════════

1. **Language**: Write in the user_locale's language. Default to Korean (ko) if locale is missing.
   **STRICT locale → script mapping (NEVER mix these — readers reject mixed script as low-quality):**
   - "ko"     → Korean Hangul (한국어, 한글 only — no Hanja unless brand/POI name).
   - "en"     → English (Latin script).
   - "ja"     → Japanese (Hiragana + Katakana + Kanji as natural for native readers).
   - "zh"     → **Simplified Chinese (简体中文)** — use 这/个/选择/历史/经验/园区/这条 forms.
                MUST NOT output Traditional characters like 這/個/選擇/歷史/這條.
   - "zh-TW"  → **Traditional Chinese (繁體中文)** — use 這/個/選擇/歷史/經驗/園區 forms.
                MUST NOT output Simplified characters like 这/个/选择.
   - "es"     → Spanish (Latin script with Spanish diacritics ñ á é í ó ú ¿ ¡).
2. **Length**: 2-3 sentences. Hard cap: 350 characters.
3. **Tone**: Friendly, direct, second-person ("당신의 / 손님의" 자연스럽게). Do NOT use "Hi" or
   greeting fillers. Do NOT repeat the user's query verbatim.
4. **Substance — focus on WHY this tour wins**:
   - The strongest scoring signals (anchor POI matches, season alignment, persona fit, region fit)
   - Concrete tour highlights (use anchor_poi_keys + primary_themes — translate slug-style keys to
     human names: "seongsan_ilchulbong" → "성산일출봉", "hallasan_1100_wetland" → "한라산 1100고지",
     "osulloc_tea_museum" → "오설록 차박물관" 등)
   - Match the user's expressed needs (cherry blossom season, family-friendly, cruise timing, etc.)
5. **Do NOT mention**:
   - Numerical scores or score components
   - Internal slug names, snake_case keys, or technical terms (poi_key, fit_dim, etc.)
   - Generic boilerplate ("이 투어는 좋은 투어입니다")
   - "고객님" — too formal; prefer natural pronouns or no pronoun at all
6. **For special intents**, include policy notes inline naturally:
   - is_multi_day_request=true → mention: "1박2일 패키지는 운영하지 않으며, 추천 day-trip 2-3개 조합 가능"
   - wants_cruise=true → emphasize port pickup + reboarding 안전 buffer
   - wants_charter_customization=true → emphasize 일정 자유 조정
7. **Locale-specific examples** (note the simplified vs traditional Chinese distinction):
   - ko: "벚꽃 시즌 가족여행에 가장 잘 맞는 코스입니다. 제주 동부의 전농로 벚꽃 거리와 녹산로 가시리 코스를 묶어 무리 없는 1일 동선으로 구성됐고, 가족 단위 진행에도 최적화돼 있습니다."
   - en: "This is the best fit for your spring family trip. The route stitches together Jeonnong-ro Cherry Blossom Street and the Noksanro–Gasiri blossom road on Jeju's east coast, with pacing that's comfortable for a family day-out."
   - ja: "桜のシーズンの家族旅行にぴったりのコースです。済州島東部の田農路桜並木と緑山路加時里の菜の花ロードを巡る無理のない日帰り行程で、家族連れでも快適に楽しめます。"
   - zh (Simplified): "这是最适合您春季家庭旅行的行程。路线串联济州岛东部的田农路樱花街与绿山路加时里油菜花道，以悠闲的步调适合一日家庭出游。"
   - zh-TW (Traditional): "這是最適合您春季家庭旅行的行程。路線串連濟州島東部的田農路櫻花街與綠山路加時里油菜花道，以悠閒的步調適合一日家庭出遊。"
   - es: "Este es el itinerario perfecto para tu viaje familiar de primavera. La ruta conecta la calle de los cerezos de Jeonnong-ro con el camino de las flores de canola de Noksanro–Gasiri en el este de Jeju, con un ritmo cómodo para un día en familia."
8. Return JSON ONLY.`;

const POI_KEY_TO_HUMAN_KO: Record<string, string> = {
  seongsan_ilchulbong: "성산일출봉",
  hallasan_1100_wetland: "한라산 1100고지",
  hallasan_eoseungsaengak: "한라산 어승생악",
  manjanggul_cave: "만장굴",
  udo_island: "우도",
  osulloc_tea_museum: "오설록",
  hyeopjae_beach: "협재해변",
  daepo_jusangjeolli_cliff: "대포 주상절리",
  haedong_yonggungsa: "해동용궁사",
  gamcheon_culture_village: "감천문화마을",
  bulguksa_temple: "불국사",
  cheomseongdae: "첨성대",
  hwaseong_fortress: "수원 화성",
  starfield_library_suwon: "스타필드 도서관",
  nami_island: "남이섬",
  garden_of_morning_calm: "아침고요수목원",
  petite_france: "쁘띠프랑스",
  seoraksan_national_park: "설악산",
  sokcho_fishery_market: "속초수산시장",
  jeonnong_ro_cherry_blossom_street: "전농로 벚꽃거리",
  noksan_ro_gasiri_blossom_road: "녹산로 가시리",
  third_infiltration_tunnel: "제3땅굴",
  dora_observatory: "도라전망대",
  imjingak_peace_gondola: "임진각",
  korean_folk_village: "한국민속촌",
  waujeongsa_temple: "와우정사",
  gwangmyeong_cave: "광명동굴",
  sanjeong_lake: "산정호수",
  herb_island_pocheon: "허브아일랜드",
  pocheon_art_valley: "포천 아트밸리",
  jagalchi_market: "자갈치시장",
  un_memorial_cemetery: "UN 기념공원",
  taejongdae: "태종대",
  yongdusan_park: "용두산공원",
  bukchon_hanok_village: "북촌한옥마을",
  gyeongbokgung_palace: "경복궁",
  insadong: "인사동",
  myeongdong: "명동",
  n_seoul_tower: "N서울타워",
  gwangjang_market: "광장시장",
  bomun_lake: "보문호수",
  tongdosa_temple: "통도사",
  ahopsan_bamboo_forest: "아홉산 대나무숲",
  gyeongju_national_museum: "경주 국립박물관",
  gyochon_hanok_village: "교촌한옥마을",
  woljeonggyo_bridge: "월정교",
  cheongsapo_blue_line_park: "청사포 블루라인파크",
  ilchulland_micheon_cave: "일출랜드 미천굴",
  ilchulland_themed_gardens: "일출랜드 테마정원",
  hwaseong_haenggung: "수원 화성행궁",
  suwon_nammun_market: "수원 남문시장",
};

function humanizeAnchorKeys(keys: readonly string[]): string[] {
  return keys.map((k) => POI_KEY_TO_HUMAN_KO[k] ?? k.replace(/_/g, " "));
}

export type ExplainInput = {
  query: string;
  locale: string;
  parsed: ParsedQueryV2;
  winner: ScoredMatchV2;
  winnerRow: MatchTourRow;
};

export type ExplainResult = {
  explanation: string;
  cost_usd: number;
  elapsed_ms: number;
  telemetry: {
    input_tokens: number;
    cache_create_input_tokens: number;
    cache_read_input_tokens: number;
    output_tokens: number;
  };
};

function pickWinnerTitle(row: MatchTourRow): string {
  const mm = row.matching_metadata as any;
  const cc = mm?.catalog_card ?? {};
  return cc.title ?? row.slug.replace(/-/g, " ");
}

const HAIKU_PRICING = { input: 1.0, cache_create: 1.25, cache_read: 0.1, output: 5.0 };
function costOf(usage: any): number {
  return (
    ((usage?.input_tokens ?? 0) * HAIKU_PRICING.input) / 1_000_000 +
    ((usage?.cache_creation_input_tokens ?? 0) * HAIKU_PRICING.cache_create) / 1_000_000 +
    ((usage?.cache_read_input_tokens ?? 0) * HAIKU_PRICING.cache_read) / 1_000_000 +
    ((usage?.output_tokens ?? 0) * HAIKU_PRICING.output) / 1_000_000
  );
}

export async function explainTopMatch(input: ExplainInput): Promise<ExplainResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY required for explainer");
  const client = new Anthropic({ apiKey });

  const userPayload = {
    user_query: input.query,
    user_locale: input.locale || "ko",
    user_intent: {
      regions: input.parsed.regions,
      sub_regions: input.parsed.sub_regions,
      season_locks: input.parsed.season_locks,
      months: input.parsed.months,
      personas: input.parsed.personas,
      themes: input.parsed.themes,
      anchor_pois: input.parsed.anchor_pois_mentioned,
      wants_cruise: input.parsed.wants_cruise,
      wants_charter_customization: input.parsed.wants_charter_customization,
      is_multi_day_request: input.parsed.is_multi_day_request,
    },
    winner: {
      slug: input.winner.slug,
      title: pickWinnerTitle(input.winnerRow),
      destination_region: input.winner.destination_region,
      primary_themes: input.winner.primary_themes,
      anchor_poi_keys: input.winner.anchor_poi_keys,
      anchor_poi_names_ko: humanizeAnchorKeys(input.winner.anchor_poi_keys),
      best_for: input.winner.best_for,
      available_months: input.winner.available_months,
      match_reasons: input.winner.match_reasons,
    },
    score_components: input.winner.score_components,
  };

  const t0 = Date.now();
  const resp = await client.messages.create({
    model: HAIKU_MODEL,
    max_tokens: 400,
    system: [
      {
        type: "text",
        text: EXPLAINER_SYSTEM_PROMPT,
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: JSON.stringify(userPayload) }],
  });
  const elapsed_ms = Date.now() - t0;

  let raw = "";
  for (const block of resp.content) {
    if (block.type === "text") raw += block.text;
  }
  raw = raw.replace(/^```(?:json)?\s*|\s*```$/gm, "").trim();

  let explanation = "";
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed.explanation === "string") explanation = parsed.explanation.trim();
  } catch {
    explanation = raw.slice(0, 350);
  }

  const usage = resp.usage as any;
  return {
    explanation,
    cost_usd: costOf(usage),
    elapsed_ms,
    telemetry: {
      input_tokens: usage?.input_tokens ?? 0,
      cache_create_input_tokens: usage?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: usage?.cache_read_input_tokens ?? 0,
      output_tokens: usage?.output_tokens ?? 0,
    },
  };
}
