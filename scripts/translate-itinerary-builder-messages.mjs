#!/usr/bin/env node
/**
 * Itinerary-builder i18n pipeline (D6 2026-05-16).
 *
 * Authors EN keys for the itinerary-builder feature under the top-level
 * `itineraryBuilder` namespace in messages/en.json, then auto-translates
 * to ko/ja/zh/zh-TW/es via Claude Haiku 4.5.
 *
 * Idempotent: re-running replaces the `itineraryBuilder` namespace in each
 * locale file without disturbing other top-level keys. To skip translation
 * for a locale that's already in the file, pass `--only=en,ko` etc.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=... node --env-file=.env.local scripts/translate-itinerary-builder-messages.mjs
 */
import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import Anthropic from "@anthropic-ai/sdk";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MESSAGES_DIR = join(ROOT, "messages");

// Top-level namespace authored here. Everything else in messages/<locale>.json
// stays untouched.
const EN_NAMESPACE = {
  home: {
    eyebrow: "Custom itinerary builder",
    title: "Or build your own Korea day",
    subtitle: "Pick the stops you actually want on the map. We'll quote it.",
    busanName: "Busan",
    busanTagline: "Sea temples + ancient capitals + market crawls",
    busanStops: "20 curated stops",
    jejuName: "Jeju Island",
    jejuTagline: "UNESCO Triple Crown — sunrise peaks, lava caves, coastal drives",
    jejuStops: "25 curated stops",
    browseTheMap: "Browse the map",
    open: "Open",
    comingSoonNote: "Seoul + DMZ rollout planned after MVP.",
  },
  map: {
    loadingLabel: "Loading map…",
    errorTitle: "Map couldn't load",
    errorBody: "Refresh the page or check your connection.",
    addCta: "Add to itinerary — coming soon",
    addCtaTooltip: "Coming in Phase 4 (cart + manual quote)",
    stayMinutesPattern: "~{minutes} min suggested",
    regionFallback: "{region}",
  },
};

const TARGET_LOCALES = [
  { code: "ko", name: "Korean", direction: "Translate to natural Korean. Keep proper nouns (Busan, Jeju, UNESCO, Seoul, DMZ, MVP) in English. Maintain marketing tone. Don't translate 'Phase 4' or placeholders like {minutes} / {region}." },
  { code: "ja", name: "Japanese", direction: "Translate to natural Japanese. Keep proper nouns in English (Busan, Jeju, UNESCO, Seoul, DMZ, MVP). Marketing/travel tone, polite (です/ます)." },
  { code: "zh", name: "Simplified Chinese (zh-CN)", direction: "Translate to natural Simplified Chinese. Keep place names in English (Busan, Jeju, Seoul, UNESCO, DMZ, MVP). Marketing/travel tone." },
  { code: "zh-TW", name: "Traditional Chinese (zh-TW)", direction: "Translate to natural Traditional Chinese for Taiwan audience. Keep place names in English (Busan, Jeju, Seoul, UNESCO, DMZ, MVP). Marketing/travel tone." },
  { code: "es", name: "Spanish", direction: "Translate to natural Spanish (neutral, broadly Latin-American friendly). Keep place names in English (Busan, Jeju, Seoul, UNESCO, DMZ, MVP). Marketing/travel tone." },
];

const onlyFlag = process.argv.find((a) => a.startsWith("--only="));
const onlySet = onlyFlag ? new Set(onlyFlag.slice("--only=".length).split(",")) : null;

function readLocale(code) {
  const path = join(MESSAGES_DIR, `${code}.json`);
  return JSON.parse(readFileSync(path, "utf8"));
}

function writeLocale(code, obj) {
  const path = join(MESSAGES_DIR, `${code}.json`);
  writeFileSync(path, JSON.stringify(obj, null, 2) + "\n", "utf8");
}

async function translate(client, locale, direction) {
  const sourceJson = JSON.stringify(EN_NAMESPACE, null, 2);

  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are translating UI strings for a Korean tour-booking website's "custom itinerary builder" feature.

Source language: English
Target language: ${locale}
Specific direction: ${direction}

Rules:
- Return ONLY a valid JSON object with the same structure as the source. No prose, no markdown fences.
- Preserve placeholder tokens like {minutes} and {region} EXACTLY.
- Preserve em dashes (—).
- Keep proper nouns (Busan, Jeju, Seoul, DMZ, UNESCO, MVP) in English.
- "Phase 4" stays in English.
- Tone: warm, premium travel marketing. Concise.

Source JSON:
${sourceJson}`,
      },
    ],
  });

  const text = message.content?.[0]?.type === "text" ? message.content[0].text : "";
  // Strip any accidental markdown fences
  const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  return JSON.parse(cleaned);
}

async function main() {
  // 1. Author EN: merge into messages/en.json (idempotent replace)
  // EN authoring doesn't require any API key.
  if (!onlySet || onlySet.has("en")) {
    const en = readLocale("en");
    en.itineraryBuilder = EN_NAMESPACE;
    writeLocale("en", en);
    console.log("EN updated.");
  }

  // 2. Translate to each target locale (requires ANTHROPIC_API_KEY)
  const targetLocalesToRun = TARGET_LOCALES.filter((t) => !onlySet || onlySet.has(t.code));
  if (targetLocalesToRun.length === 0) {
    console.log("Done (EN-only run).");
    return;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY (required for translation)");

  const client = new Anthropic({ apiKey });
  for (const t of targetLocalesToRun) {
    process.stdout.write(`Translating to ${t.code}... `);
    try {
      const translated = await translate(client, t.name, t.direction);
      const fullLocale = readLocale(t.code);
      fullLocale.itineraryBuilder = translated;
      writeLocale(t.code, fullLocale);
      console.log("✓");
    } catch (e) {
      console.log(`FAILED: ${e.message}`);
    }
    // gentle throttle
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log("\nDone. Spot-check via:");
  console.log("  node -e \"console.log(JSON.stringify(require('./messages/ko.json').itineraryBuilder, null, 2))\"");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
