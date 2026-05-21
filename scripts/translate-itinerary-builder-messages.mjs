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
import { GoogleGenerativeAI } from "@google/generative-ai";

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
    addCta: "Add to itinerary",
    addCtaTooltip: "Add this stop to your itinerary",
    removeFromItinerary: "Remove from itinerary",
    stayMinutesPattern: "~{minutes} min suggested",
    regionFallback: "{region}",
  },
  quote: {
    title: "Get a custom quote",
    intro: "{count} stops in {region}. We'll quote logistics + pricing.",
    nameLabel: "Your name",
    emailLabel: "Email",
    dateLabel: "Travel date",
    partyLabel: "Party size",
    notesLabel: "Anything else?",
    notesPlaceholder: "Hotel pickup, accessibility, food preferences…",
    submit: "Send request",
    submitting: "Sending…",
    close: "Close",
    responseHint: "We'll respond within 24 hours by email.",
    errorEmailRequired: "Please enter your email so we can reply.",
    errorGeneric: "Couldn't send the request — please try again or contact support.",
  },
  intake: {
    trackLegend: "How are you traveling?",
    trackPrivateLabel: "Private car / land trip",
    trackPrivateHint: "Hotel pickup, your own pace",
    trackCruiseLabel: "On a cruise",
    trackCruiseHint: "Back-to-ship before sail",
    regionLegend: "Which region?",
    cruiseHoursLegend: "How many hours ashore?",
    cruiseHoursHint: "Pick the window between your ship's arrival and last-call.",
    dateLabel: "Travel date",
    partyLabel: "Party size",
    shipLabel: "Ship name",
    optionalSuffix: "(optional)",
    submit: "Open the map",
    browsePackagesInstead: "Or browse fixed packages instead →",
    dateAndPartyDeferredHint: "We'll ask for travel date + party size when you submit your quote.",
    autoQuoteReassurance: "Eligible itineraries get an instant price — others reply within 24h.",
  },
  cart: {
    title: "Your itinerary",
    empty: "Tap pins on the map to add stops",
    poiCount: "{count} stops",
    openLabel: "Open your itinerary",
    closeLabel: "Close",
    stayTotal: "Total visit time",
    driveTotal: "Drive time",
    totalDuration: "Total day",
    cruiseBudget: "Cruise time window",
    cruiseOverBudget: "Over budget by {over} — trim a stop or shorten visits",
    remove: "Remove",
    getQuoteCta: "Get a custom quote",
    getQuoteHint: "We'll respond within 24 hours",
  },
  // R3 (2026-05-21): grid section for POICatalogGrid (previously hardcoded).
  // V5: amber dot bullet removed from highlights list; hints updated for
  // R1/R2 tap-to-drawer behaviour.
  grid: {
    title: "Curated stops",
    hint: "Tap any card to preview details or add to your itinerary.",
    inCartBadge: "In cart · #{number}",
    details: "Details",
    added: "Added",
    add: "Add",
  },
  // R2 (2026-05-21): ai section added to EN_NAMESPACE so all 6 locales are
  // auto-translated. previewHint updated: map focus → drawer details.
  ai: {
    eyebrow: "Let AI suggest your day",
    intro: "Tell us what you like — we'll sequence a route from the stops in this region.",
    presetsLabel: "Or start from a preset",
    presets: {
      firstTime: "First time in Korea",
      family: "Family with kids",
      unesco: "UNESCO + history",
      foodie: "Foodie day",
      beachesCafes: "Beaches + cafes",
    },
    intentLabel: "Your interests",
    intentPlaceholder: "e.g. first time, family, UNESCO + beaches, relaxed pace",
    hoursLabel: "Hours",
    submit: "Recommend",
    submitting: "Matching…",
    errorMin: "Tell us a little more about your trip.",
    resultsSummary: "{count} stops matched · ~{hours}h day",
    loadIntoCart: "Apply this day",
    previewHint: "Tap any stop to see details →",
    noMatchFallback: "Try broader interests or a different region.",
    getAnother: "Get another suggestion",
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

function buildPrompt(locale, direction) {
  const sourceJson = JSON.stringify(EN_NAMESPACE, null, 2);
  return `You are translating UI strings for a Korean tour-booking website's "custom itinerary builder" feature.

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
${sourceJson}`;
}

function stripJsonFence(text) {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```\s*$/i, "")
    .trim();
}

async function translateViaAnthropic(client, locale, direction) {
  const message = await client.messages.create({
    model: "claude-haiku-4-5",
    max_tokens: 2000,
    messages: [{ role: "user", content: buildPrompt(locale, direction) }],
  });
  const text = message.content?.[0]?.type === "text" ? message.content[0].text : "";
  return JSON.parse(stripJsonFence(text));
}

async function translateViaGemini(model, locale, direction) {
  const result = await model.generateContent(buildPrompt(locale, direction));
  const text = result.response.text();
  return JSON.parse(stripJsonFence(text));
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

  // 2. Translate to each target locale.
  // Prefers ANTHROPIC_API_KEY (Claude Haiku) — falls back to GEMINI_API_KEY
  // (Gemini 2.5 Flash) so we're not blocked on a single provider.
  const targetLocalesToRun = TARGET_LOCALES.filter((t) => !onlySet || onlySet.has(t.code));
  if (targetLocalesToRun.length === 0) {
    console.log("Done (EN-only run).");
    return;
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  const geminiKey = process.env.GEMINI_API_KEY;

  let provider;
  let runTranslate;
  if (anthropicKey) {
    provider = "anthropic (claude-haiku-4-5)";
    const client = new Anthropic({ apiKey: anthropicKey });
    runTranslate = (locale, direction) => translateViaAnthropic(client, locale, direction);
  } else if (geminiKey) {
    provider = "gemini (gemini-2.5-flash)";
    const genAI = new GoogleGenerativeAI(geminiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    runTranslate = (locale, direction) => translateViaGemini(model, locale, direction);
  } else {
    throw new Error("Missing ANTHROPIC_API_KEY or GEMINI_API_KEY (one is required for translation)");
  }

  console.log(`Using ${provider}`);

  for (const t of targetLocalesToRun) {
    process.stdout.write(`Translating to ${t.code}... `);
    try {
      const translated = await runTranslate(t.name, t.direction);
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
