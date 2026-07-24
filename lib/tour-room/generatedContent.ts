/**
 * W1.5 (P-D16) — auto POI content for stops outside the poi_kb.
 *
 * "Facts from Places, narrative from the LLM":
 *   1. facts     — Google Places Details when a place_id exists (degrades to
 *                  null silently: referrer-locked keys, quota, free stops).
 *   2. generate  — one 'batch'-ladder call writes SpotArrivalContent JSON for
 *                  every requested locale at once, grounded ONLY on the facts;
 *                  with no facts it must make zero factual claims.
 *   3. critic    — a second call strips claims the facts can't support
 *                  (hours, prices, phone numbers, transit numbers).
 *   4. store     — generated_spot_content (booking-scoped, UNIQUE poi_ref);
 *                  served as the 'generated' tier with an AI badge, and the
 *                  weekly flywheel promotes repeated refs into the real KB.
 *
 * Budget: every LLM call rides the shared concierge daily counter and the
 * pipeline silently skips when it is exhausted — the honest tier-3 null
 * card is always an acceptable outcome (never block, never invent).
 */

import { incrWindowCounted } from '@/lib/durable-rate-limit';
import { chatCompletion } from '@/lib/ai/router';
import type { RoomDbClient } from '@/lib/tour-room/access';
import { ROOM_LOCALES, type RoomLocale } from '@/lib/tour-room/snapshot';
import type { SpotArrivalContent } from '@/lib/tour-room/spotContent';

export interface PlaceFacts {
  name?: string;
  address?: string;
  opening_hours?: string[];
  rating?: number;
  total_ratings?: number;
  lat?: number;
  lng?: number;
}

export interface GeneratedSpotRow {
  id: string;
  booking_id: string;
  poi_ref: string;
  title: string;
  facts: PlaceFacts | null;
  content_locales: Record<string, SpotArrivalContent>;
  status: 'ready' | 'failed';
}

/** Stable ref for one stop: place beats poi beats name-slug. */
export function poiRefFor(stop: { place_id?: string | null; poi_key?: string | null; title?: string | null }): string {
  if (stop.place_id) return `place:${stop.place_id}`;
  if (stop.poi_key) return `poi:${stop.poi_key}`;
  const slug = String(stop.title ?? '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-À-￿]/g, '')
    .slice(0, 80);
  return `name:${slug || 'unknown'}`;
}

/** All refs that could serve this stop, most specific first. */
export function refCandidatesFor(stop: {
  place_id?: string | null;
  poi_key?: string | null;
  title?: string | null;
}): string[] {
  const refs: string[] = [];
  if (stop.place_id) refs.push(`place:${stop.place_id}`);
  if (stop.poi_key) refs.push(`poi:${stop.poi_key}`);
  const nameRef = poiRefFor({ title: stop.title });
  if (nameRef !== 'name:unknown') refs.push(nameRef);
  return refs;
}

// ---------------------------------------------------------------------------
// Facts — Google Places Details (best-effort, never throws)
// ---------------------------------------------------------------------------

export async function fetchPlaceFacts(placeId: string): Promise<PlaceFacts | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  try {
    const url =
      `https://maps.googleapis.com/maps/api/place/details/json?place_id=${encodeURIComponent(placeId)}` +
      `&fields=name,formatted_address,opening_hours,rating,user_ratings_total,geometry&key=${key}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = (await res.json()) as {
      status?: string;
      result?: {
        name?: string;
        formatted_address?: string;
        opening_hours?: { weekday_text?: string[] };
        rating?: number;
        user_ratings_total?: number;
        geometry?: { location?: { lat?: number; lng?: number } };
      };
    };
    if (data.status !== 'OK' || !data.result) return null;
    const r = data.result;
    return {
      name: r.name,
      address: r.formatted_address,
      opening_hours: r.opening_hours?.weekday_text,
      rating: r.rating,
      total_ratings: r.user_ratings_total,
      lat: r.geometry?.location?.lat,
      lng: r.geometry?.location?.lng,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// LLM prompts + JSON hygiene (pure, exported for tests)
// ---------------------------------------------------------------------------

const CONTENT_KEYS: Array<keyof SpotArrivalContent> = [
  'description',
  'highlights',
  'visitBasics',
  'convenience',
  'smartNotes',
];

export function buildGenerationPrompt(input: {
  title: string;
  city?: string | null;
  facts: PlaceFacts | null;
  locales: RoomLocale[];
}): { system: string; user: string } {
  const system = [
    'You write short traveller mini-guides for a live Korea day-tour app. Output STRICT JSON only, no markdown fences, no commentary.',
    'Schema: { "<locale>": { "description": string (<=400 chars), "highlights": string[] (2-4, <=90 chars each), "visitBasics": { "hours"?: string, "admission"?: string, "walking"?: string }, "convenience": { "restroom"?: string, "parking"?: string }, "smartNotes": { "photo"?: string, "tip"?: string } } }',
    'HARD RULES: Every factual claim (opening hours, prices, phone numbers, exact distances, transport line numbers) must come from the FACTS block verbatim or be OMITTED — leave the field out entirely rather than guessing.',
    'With no FACTS, write atmosphere/history/what-to-look-for narrative only and omit visitBasics.hours and visitBasics.admission.',
    'Write each locale natively (not a translation of English). Tone: warm, concrete, guide-like, no marketing fluff.',
  ].join('\n');
  const user = [
    `Place: ${input.title}${input.city ? ` (${input.city}, Korea)` : ' (Korea)'}`,
    `Locales: ${input.locales.join(', ')}`,
    `FACTS (the only permitted source of factual claims): ${input.facts ? JSON.stringify(input.facts) : 'NONE'}`,
  ].join('\n');
  return { system, user };
}

export function buildCriticPrompt(input: {
  title: string;
  facts: PlaceFacts | null;
  draft: Record<string, SpotArrivalContent>;
}): { system: string; user: string } {
  const system = [
    'You are a fact-check filter for traveller mini-guides. Output STRICT JSON only, same schema as the input draft.',
    'Remove or blank any claim not supported by the FACTS block: opening hours, prices/fees, phone numbers, exact measurements, transport line numbers, superlatives stated as fact ("the largest", "the oldest") unless in FACTS.',
    'Keep atmosphere, history framed as general knowledge ("known for", "famous as"), viewing tips, and etiquette. Do not add anything new. Preserve every locale key.',
  ].join('\n');
  const user = [
    `Place: ${input.title}`,
    `FACTS: ${input.facts ? JSON.stringify(input.facts) : 'NONE'}`,
    `DRAFT: ${JSON.stringify(input.draft)}`,
  ].join('\n');
  return { system, user };
}

/** Strip code fences and parse; returns null on any shape violation. */
export function parseGeneratedJson(raw: string): Record<string, SpotArrivalContent> | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: Record<string, SpotArrivalContent> = {};
    for (const [locale, value] of Object.entries(parsed)) {
      if (!(ROOM_LOCALES as readonly string[]).includes(locale)) continue;
      if (!value || typeof value !== 'object') continue;
      const entry = value as Record<string, unknown>;
      const content: SpotArrivalContent = {};
      if (typeof entry.description === 'string' && entry.description.trim()) {
        content.description = entry.description.trim().slice(0, 600);
      }
      if (Array.isArray(entry.highlights)) {
        const highlights = entry.highlights
          .filter((h): h is string => typeof h === 'string' && h.trim() !== '')
          .map((h) => h.trim().slice(0, 140))
          .slice(0, 4);
        if (highlights.length > 0) content.highlights = highlights;
      }
      for (const key of ['visitBasics', 'convenience', 'smartNotes'] as const) {
        const section = entry[key];
        if (section && typeof section === 'object' && !Array.isArray(section)) {
          const clean: Record<string, string> = {};
          for (const [k, v] of Object.entries(section as Record<string, unknown>)) {
            if (typeof v === 'string' && v.trim()) clean[k] = v.trim().slice(0, 240);
          }
          if (Object.keys(clean).length > 0) (content as Record<string, unknown>)[key] = clean;
        }
      }
      if (Object.keys(content).length > 0) out[locale] = content;
    }
    return Object.keys(out).length > 0 ? out : null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Pipeline
// ---------------------------------------------------------------------------

async function generationBudgetExhausted(calls: number): Promise<boolean> {
  const cap = Number(process.env.TOUR_ROOM_CONCIERGE_DAILY_CAP ?? 300);
  if (!Number.isFinite(cap) || cap <= 0) return false;
  // `incrWindowCounted` never throws, and counts process-locally when Upstash
  // is absent. The previous `catch { return false }` meant this cap could not
  // fire at all in an unconfigured environment (measured 2026-07-25).
  let count = 0;
  for (let i = 0; i < calls; i += 1) {
    count = (await incrWindowCounted('tour_room_concierge:daily_llm', 24 * 60 * 60)).count;
  }
  return count > cap;
}

export interface GenerateSpotContentArgs {
  bookingId: string;
  title: string;
  poiKey?: string | null;
  placeId?: string | null;
  city?: string | null;
  /** Guest locales; capped at 3, always includes 'en'. */
  locales: string[];
}

/**
 * Generate + store the mini-guide for one stop. Returns the ready row or
 * null (budget exhausted / generation failed — callers fall back to the
 * honest tier-3 null card). Idempotent per (booking, poi_ref): an existing
 * ready row is returned without any LLM call.
 */
export async function generateSpotContent(
  supabase: RoomDbClient,
  args: GenerateSpotContentArgs,
): Promise<GeneratedSpotRow | null> {
  const poiRef = poiRefFor({ place_id: args.placeId, poi_key: args.poiKey, title: args.title });
  if (!args.title.trim() || poiRef === 'name:unknown') return null;

  try {
    const { data: existing } = await supabase
      .from('generated_spot_content')
      .select('*')
      .eq('booking_id', args.bookingId)
      .eq('poi_ref', poiRef)
      .maybeSingle();
    if (existing && (existing as GeneratedSpotRow).status === 'ready') {
      return existing as GeneratedSpotRow;
    }
  } catch {
    // fresh generation below
  }

  const locales = [...new Set(['en', ...args.locales])]
    .map((locale) => (ROOM_LOCALES as readonly string[]).includes(locale) ? (locale as RoomLocale) : null)
    .filter((locale): locale is RoomLocale => locale !== null)
    .slice(0, 3);

  if (await generationBudgetExhausted(2)) return null;

  const facts = args.placeId ? await fetchPlaceFacts(args.placeId) : null;

  let content: Record<string, SpotArrivalContent> | null = null;
  let provider = '';
  let model = '';
  try {
    const generation = buildGenerationPrompt({ title: args.title, city: args.city, facts, locales });
    const draftCompletion = await chatCompletion(
      'batch',
      [
        { role: 'system', content: generation.system },
        { role: 'user', content: generation.user },
      ],
      { maxOutputTokens: 1400, temperature: 0.4 },
    );
    provider = draftCompletion.provider;
    model = draftCompletion.model ?? '';
    const draft = parseGeneratedJson(draftCompletion.content);
    if (!draft) throw new Error('unparseable draft');

    const critic = buildCriticPrompt({ title: args.title, facts, draft });
    try {
      const criticCompletion = await chatCompletion(
        'batch',
        [
          { role: 'system', content: critic.system },
          { role: 'user', content: critic.user },
        ],
        { maxOutputTokens: 1400, temperature: 0 },
      );
      content = parseGeneratedJson(criticCompletion.content) ?? draft;
    } catch {
      // Critic outage: the draft's own hard rules still ban invented facts.
      content = draft;
    }
  } catch (error) {
    console.warn('generated-spot-content generation failed:', error);
    try {
      await supabase.from('generated_spot_content').upsert(
        { booking_id: args.bookingId, poi_ref: poiRef, title: args.title, facts, status: 'failed', updated_at: new Date().toISOString() },
        { onConflict: 'booking_id,poi_ref' },
      );
    } catch {
      // recording the failure is best-effort
    }
    return null;
  }

  const { data: saved, error } = await supabase
    .from('generated_spot_content')
    .upsert(
      {
        booking_id: args.bookingId,
        poi_ref: poiRef,
        title: args.title,
        facts,
        content_locales: content,
        status: 'ready',
        provider,
        model,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'booking_id,poi_ref' },
    )
    .select()
    .single();
  if (error) return null;
  return saved as GeneratedSpotRow;
}

/**
 * Serving-side lookup: the 'generated' tier between poi_kb and none.
 * Returns the locale-resolved content (en fallback) or null.
 */
export async function getGeneratedSpotContent(
  supabase: RoomDbClient,
  bookingId: string,
  refs: string[],
  locale: RoomLocale,
): Promise<{ content: SpotArrivalContent; title: string } | null> {
  if (refs.length === 0) return null;
  try {
    const { data } = await supabase
      .from('generated_spot_content')
      .select('poi_ref, title, content_locales, status')
      .eq('booking_id', bookingId)
      .in('poi_ref', refs)
      .eq('status', 'ready');
    const rows = (data ?? []) as Array<{ poi_ref: string; title: string; content_locales: Record<string, SpotArrivalContent> }>;
    for (const ref of refs) {
      const row = rows.find((r) => r.poi_ref === ref);
      if (!row) continue;
      const content = row.content_locales?.[locale] ?? row.content_locales?.en;
      if (content && Object.keys(content).length > 0) {
        return { content: { name: row.title, ...content }, title: row.title };
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Sanity export so serving code can advertise which keys may appear. */
export const GENERATED_CONTENT_KEYS = CONTENT_KEYS;
