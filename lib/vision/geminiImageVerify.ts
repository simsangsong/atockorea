/**
 * Gemini Vision verifier for tour stop photos.
 *
 * Use case: stock-image curation candidates (Flickr/Unsplash/Pixabay/VisitJeju)
 * pass through fuzzy keyword search, so non-matching photos slip in
 * (food close-ups, generic clouds, highways, "anywhere" shots). This module
 * fetches each candidate and asks Gemini-2.5-flash two questions in one call:
 *
 *   1. Does this photo recognizably show {POI}?
 *   2. Is this photo aesthetically appealing — would a tour customer want to click?
 *
 * Output is a strict JSON object so the caller can apply thresholds.
 *
 * Robustness:
 *   - 15s fetch + Gemini timeout
 *   - up to 2 retries on transient errors
 *   - in-memory result cache keyed by URL
 *   - configurable concurrency (default 3) to avoid rate-limit
 *   - on terminal failure, returns matches=false (fail-safe — drop the photo)
 */

import { GoogleGenerativeAI } from "@google/generative-ai";

export type VisionVerifyResult = {
  matches: boolean;
  confidence: number;
  aestheticScore: number;
  reason: string;
  /** True only when the model actually answered. False = network/timeout/parse failure. */
  ok: boolean;
};

export type VerifyImageInput = {
  imageUrl: string;
  poiName: string;
  poiKoName?: string;
  /** Optional visual hint, e.g. "iconic green volcanic crater rising from the sea". */
  visualHint?: string;
};

const DEFAULT_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 2;
const cache = new Map<string, VisionVerifyResult>();

function cacheKey(url: string, poiName: string): string {
  return `${poiName}::${url}`;
}

function stripJsonFence(text: string): string {
  return text
    .replace(/^\s*```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

async function fetchImageBytes(url: string, timeoutMs: number): Promise<{ data: Uint8Array; mime: string } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { "User-Agent": "atockorea-vision-verify/1.0" },
    });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) return null;
    let mime = res.headers.get("content-type")?.split(";")[0]?.trim() || "";
    if (!mime || !mime.startsWith("image/")) {
      // Best-effort: infer from URL extension. Gemini accepts image/jpeg, png, webp.
      const ext = url.toLowerCase().split("?")[0].split(".").pop() ?? "";
      mime =
        ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
    }
    return { data: new Uint8Array(buf), mime };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function buildPrompt(input: VerifyImageInput): string {
  const koLine = input.poiKoName ? ` (${input.poiKoName})` : "";
  const hintLine = input.visualHint ? `\nExpected visual: ${input.visualHint}.` : "";
  return `You are evaluating a photo for a Jeju Island tour product page.

Target POI: ${input.poiName}${koLine} — located on Jeju Island, South Korea.${hintLine}

Answer two questions about the photo:

1) Does this photo recognizably show the target POI?
   - true ONLY if the location is identifiable as the target (signature features visible).
   - false for: food close-ups, generic clouds, highways/cars, indoor restaurants,
     food markets, generic flowers, generic seascapes that could be anywhere,
     receipts/menus/signs without the POI itself.
   - When unsure, default to false.

2) Aesthetic appeal (0–1 scale) — would a tourist click this photo on a tour page?
   Consider: composition, light, color, scale of subject, emotional draw, "wow" factor.
   - 0.9+ = magazine cover / Instagram-worthy
   - 0.7–0.9 = solidly attractive, marketing-grade
   - 0.5–0.7 = OK but flat/snapshot
   - <0.5 = ugly, blurry, washed out, cluttered, poorly composed

Reply with strict JSON ONLY (no markdown, no commentary):
{"matches": true|false, "confidence": 0-1, "aesthetic": 0-1, "reason": "<≤12 words>"}`;
}

async function callGemini(
  apiKey: string,
  bytes: Uint8Array,
  mime: string,
  prompt: string,
  timeoutMs: number
): Promise<VisionVerifyResult | null> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { temperature: 0, responseMimeType: "application/json" },
  });

  // base64 from Uint8Array — chunked to avoid stack overflow on large buffers
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  const base64 = Buffer.from(binary, "binary").toString("base64");

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            { inlineData: { mimeType: mime, data: base64 } },
            { text: prompt },
          ],
        },
      ],
    });
    const raw = res.response.text();
    const cleaned = stripJsonFence(raw);
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(cleaned) as Record<string, unknown>;
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (!m) return null;
      parsed = JSON.parse(m[0]) as Record<string, unknown>;
    }
    const matches = parsed.matches === true;
    const confidence = clamp01(toNum(parsed.confidence));
    const aesthetic = clamp01(toNum(parsed.aesthetic));
    const reason = typeof parsed.reason === "string" ? parsed.reason.slice(0, 200) : "";
    return { matches, confidence, aestheticScore: aesthetic, reason, ok: true };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function toNum(v: unknown): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function clamp01(n: number): number {
  if (!Number.isFinite(n)) return 0;
  if (n < 0) return 0;
  if (n > 1) return 1;
  return n;
}

const FAIL_RESULT: VisionVerifyResult = {
  matches: false,
  confidence: 0,
  aestheticScore: 0,
  reason: "verify-failed",
  ok: false,
};

/** Verify ONE image. Cached. Returns matches=false on any failure (fail-safe). */
export async function verifyImageMatchesPoi(
  input: VerifyImageInput,
  options: { apiKey?: string; timeoutMs?: number } = {}
): Promise<VisionVerifyResult> {
  const key = cacheKey(input.imageUrl, input.poiName);
  const hit = cache.get(key);
  if (hit) return hit;

  const apiKey = options.apiKey?.trim() || process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) {
    cache.set(key, FAIL_RESULT);
    return FAIL_RESULT;
  }

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const fetched = await fetchImageBytes(input.imageUrl, timeoutMs);
  if (!fetched) {
    const r: VisionVerifyResult = { ...FAIL_RESULT, reason: "image-fetch-failed" };
    cache.set(key, r);
    return r;
  }

  const prompt = buildPrompt(input);
  let lastErr: VisionVerifyResult = FAIL_RESULT;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const result = await callGemini(apiKey, fetched.data, fetched.mime, prompt, timeoutMs);
    if (result) {
      cache.set(key, result);
      return result;
    }
    lastErr = { ...FAIL_RESULT, reason: `gemini-attempt-${attempt + 1}-failed` };
    // Backoff: 400ms, 1200ms before next retry
    if (attempt < MAX_RETRIES) {
      await new Promise((r) => setTimeout(r, 400 * Math.pow(3, attempt)));
    }
  }
  cache.set(key, lastErr);
  return lastErr;
}

/**
 * Verify many images with bounded concurrency.
 * Returns results in input order.
 */
export async function verifyImagesMatchPoi(
  inputs: VerifyImageInput[],
  options: { apiKey?: string; timeoutMs?: number; concurrency?: number } = {}
): Promise<VisionVerifyResult[]> {
  const concurrency = Math.max(1, options.concurrency ?? 3);
  const results: VisionVerifyResult[] = new Array(inputs.length);
  let cursor = 0;

  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= inputs.length) return;
      results[i] = await verifyImageMatchesPoi(inputs[i], {
        apiKey: options.apiKey,
        timeoutMs: options.timeoutMs,
      });
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, inputs.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

/** Test hook — clear the in-memory cache. */
export function _clearVisionCache() {
  cache.clear();
}
