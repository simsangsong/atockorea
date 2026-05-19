#!/usr/bin/env node
/**
 * Tour card translation pipeline (사용자 요청 2026-05-19).
 *
 * Translates tour card display fields (title/description/badges/duration) from
 * English → Korean / Simplified Chinese / Traditional Chinese / Japanese / Spanish,
 * then writes to `tours.translations` jsonb column. Frontend (`/api/tours` route)
 * already reads `translations[locale]` and falls back to English when missing.
 *
 * Quality:
 *   - Claude Sonnet 4.6 (not Haiku) for marketing-copy fidelity.
 *   - One API call per tour (5 locales × 4 fields in a single JSON response).
 *   - Batch size capped at 15 per run (사용자 요청 — 품질 검수 위해).
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... node --env-file=.env.local scripts/translate-tour-cards.mjs
 *
 *   Options:
 *     --batch-size=15   (default 15, 사용자 요청 cap)
 *     --dry-run         (skip DB write, print SQL only)
 *     --only=ko,ja      (limit to specific locales, default: all 5)
 *
 * Idempotent: re-running on already-translated tours overwrites (so manual
 * admin edits will be clobbered — run in batches and review before next batch).
 *
 * Output: prints `UPDATE tours SET translations = ...` statements to stdout,
 * one per tour. Pipe to a file or paste into mcp__atockorea__execute_sql.
 */
import { createClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

const BATCH_SIZE = parseInt(
  process.argv.find((a) => a.startsWith("--batch-size="))?.split("=")[1] ?? "15",
  10,
);
const DRY_RUN = process.argv.includes("--dry-run");
const ONLY_LOCALES = process.argv
  .find((a) => a.startsWith("--only="))
  ?.split("=")[1]
  ?.split(",");

const ALL_LOCALES = ["ko", "zh", "zh-TW", "ja", "es"];
const TARGET_LOCALES = ONLY_LOCALES?.length
  ? ALL_LOCALES.filter((l) => ONLY_LOCALES.includes(l))
  : ALL_LOCALES;

const LOCALE_LABEL = {
  ko: "Korean (한국어, 자연스러운 마케팅 톤, '~투어' 종결어미 선호)",
  zh: "Simplified Chinese (简体中文, 大陆游客对话로 마케팅 톤)",
  "zh-TW": "Traditional Chinese (繁體中文, 台灣/香港 游客 마케팅 톤)",
  ja: "Japanese (日本語, 자연스러운 旅行マーケティング 톤, 「〜ツアー」종결 선호)",
  es: "Spanish (Español, neutral 라틴아메리카 + 스페인 양쪽 통용, 마케팅 톤)",
};

const SYSTEM_PROMPT = `You are a senior translator specializing in Korean tourism marketing copy. You translate English tour card display fields (title, description, badges, duration) into the requested target languages with these rules:

1. MAINTAIN MARKETING TONE — these are sales-facing tour cards on a global booking site (Klook/Airbnb caliber). Translations must feel native-marketing, not literal.
2. PRESERVE PROPER NOUNS — Korean place names (Busan, Jeju, Bulguksa, Haedong Yonggungsa, etc.) translate to the locale's standard transliteration (e.g., Busan → 부산 / 釜山 / プサン / Busan). UNESCO, BIFF, etc. stay or use the locale's standard rendering.
3. PRESERVE NUMBERS — durations, prices, distances stay exact (8 hours → 8시간 / 8小时 / 8小時 / 8時間 / 8 horas).
4. BADGES TRANSLATE INDIVIDUALLY — each badge is a short standalone tag. Keep them short and punchy in target language. "Small group" → 소규모 / 小团 / 小團 / 少人数 / Grupo reducido.
5. DURATION FIELD — short standalone phrase like "8 hours" or "9–9.5 hours". Translate concisely.
6. OUTPUT JSON ONLY — no preamble, no explanation. Return a single JSON object keyed by locale code.

Output format strictly:
{
  "ko": { "title": "...", "description": "...", "badges": ["...", "..."], "duration": "..." },
  "zh": { ... },
  "zh-TW": { ... },
  "ja": { ... },
  "es": { ... }
}`;

function buildUserPrompt(tour, locales) {
  const localeList = locales.map((l) => `- ${l}: ${LOCALE_LABEL[l]}`).join("\n");
  return `Translate the following English tour card to these target locales:

${localeList}

Source (English):
${JSON.stringify(
  {
    title: tour.title,
    description: tour.description,
    badges: tour.badges,
    duration: tour.duration,
  },
  null,
  2,
)}

Return JSON object with one key per target locale.`;
}

async function translateOne(anthropic, tour, locales) {
  const userPrompt = buildUserPrompt(tour, locales);
  const response = await anthropic.messages.create({
    model: "claude-sonnet-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  // Strip any markdown code fences if present
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

function escapeSqlString(s) {
  return String(s).replace(/'/g, "''");
}

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  if (!supabaseUrl || !serviceRoleKey || !anthropicKey) {
    console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / ANTHROPIC_API_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);
  const anthropic = new Anthropic({ apiKey: anthropicKey });

  // Fetch tours where any target locale is missing
  const { data: tours, error } = await supabase
    .from("tours")
    .select("id, slug, title, description, badges, duration, translations")
    .eq("is_active", true)
    .order("slug")
    .limit(100);

  if (error || !tours) {
    console.error("Supabase fetch error:", error);
    process.exit(1);
  }

  const needsTranslation = tours.filter((t) => {
    const tr = t.translations || {};
    return TARGET_LOCALES.some((l) => !tr[l] || !tr[l].title);
  });

  console.error(`[info] ${tours.length} active tours total, ${needsTranslation.length} need translation`);
  console.error(`[info] processing batch of ${BATCH_SIZE} (target locales: ${TARGET_LOCALES.join(", ")})`);
  console.error(`[info] dry-run: ${DRY_RUN}`);

  const batch = needsTranslation.slice(0, BATCH_SIZE);
  if (batch.length === 0) {
    console.error("[info] no tours need translation — exiting");
    return;
  }

  let i = 0;
  for (const tour of batch) {
    i++;
    console.error(`[${i}/${batch.length}] ${tour.slug} — translating...`);
    try {
      const translations = await translateOne(anthropic, tour, TARGET_LOCALES);

      // Merge with existing translations
      const merged = { ...(tour.translations || {}) };
      for (const locale of TARGET_LOCALES) {
        if (translations[locale]) {
          merged[locale] = translations[locale];
        }
      }

      // Emit SQL UPDATE to stdout
      const sql = `UPDATE tours SET translations = '${escapeSqlString(JSON.stringify(merged))}'::jsonb WHERE id = '${tour.id}'; -- ${tour.slug}`;
      console.log(sql);

      if (!DRY_RUN) {
        const { error: updateError } = await supabase
          .from("tours")
          .update({ translations: merged })
          .eq("id", tour.id);
        if (updateError) {
          console.error(`[${i}/${batch.length}] ${tour.slug} — DB UPDATE error:`, updateError);
        } else {
          console.error(`[${i}/${batch.length}] ${tour.slug} — ✓ wrote ${TARGET_LOCALES.length} locales`);
        }
      } else {
        console.error(`[${i}/${batch.length}] ${tour.slug} — ✓ translated (DRY RUN, no DB write)`);
      }
    } catch (err) {
      console.error(`[${i}/${batch.length}] ${tour.slug} — ERROR:`, err.message ?? err);
    }
  }

  const remaining = needsTranslation.length - batch.length;
  console.error(`\n[done] processed ${batch.length} tours. ${remaining} tours still need translation. Run again to process next batch.`);
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
