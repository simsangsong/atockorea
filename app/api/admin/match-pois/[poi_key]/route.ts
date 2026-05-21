import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { isOverridePinned } from '@/lib/admin/poi-override-pins';

export const dynamic = 'force-dynamic';

/**
 * All columns surfaced to the admin editor. Excludes `embedding` (vector — not
 * editable, heavy to ship) but includes the read-only display columns
 * (`is_operational`, `created_at`, `updated_at`) so the UI can show them.
 */
const SELECT_COLUMNS =
  'poi_key, name_en, name_ko, names_other_locales, content_locales, region, category, lat, lng, ' +
  'default_image_url, default_stay_minutes, stop_role, is_attraction, is_operational, ' +
  'description, highlights, images, why_on_route, visit_basics, convenience, smart_notes, ' +
  'matching_profile, poi_meta, builder_profile_source, builder_profile_version, kb_version, ' +
  'created_at, updated_at';

/**
 * Editable column whitelist for the auto-upsert. Deliberately EXCLUDES:
 *   - `is_operational` — GENERATED column (`poi_key LIKE 'OPS_%'`); writing errors.
 *   - `created_at` / `updated_at` — DB-managed.
 *   - `embedding` — pgvector, not edited here.
 *   - `poi_key` — the upsert conflict key, taken from the URL.
 */
const UPSERTABLE_COLUMNS = [
  'name_en',
  'name_ko',
  'names_other_locales',
  'content_locales',
  'region',
  'category',
  'lat',
  'lng',
  'default_image_url',
  'default_stay_minutes',
  'stop_role',
  'is_attraction',
  'description',
  'highlights',
  'images',
  'why_on_route',
  'visit_basics',
  'convenience',
  'smart_notes',
  'matching_profile',
  'poi_meta',
  'builder_profile_source',
  'builder_profile_version',
  'kb_version',
] as const;

const UPSERTABLE_SET = new Set<string>(UPSERTABLE_COLUMNS);

/** Text columns: empty / whitespace-only strings are normalised to null. */
const TEXT_COLUMNS = new Set([
  'name_en',
  'name_ko',
  'region',
  'category',
  'default_image_url',
  'stop_role',
  'description',
  'why_on_route',
  'builder_profile_source',
  'kb_version',
]);

/** jsonb object columns where an empty object `{}` is normalised to null (Empty-Object Rule). */
const EMPTY_OBJ_TO_NULL = new Set(['visit_basics', 'convenience', 'smart_notes', 'names_other_locales', 'content_locales', 'matching_profile']);

/** Validation bounds for Korea (planner §F Phase 2 acceptance). */
const LAT_MIN = 33.0;
const LAT_MAX = 38.7;
const LNG_MIN = 124.6;
const LNG_MAX = 131.0;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isValidPoiKey(key: string): boolean {
  // Real poi_keys are slugs. Reject `_`-prefixed catalog-junk keys outright so
  // the editor can't mint new junk rows (e.g. `_metadata`).
  return /^[A-Za-z][A-Za-z0-9_-]*$/.test(key);
}

type BuildResult =
  | { ok: true; updates: Record<string, unknown> }
  | { ok: false; error: string; code: string; field?: string };

/**
 * Validate the request body against the whitelist + per-column rules and build
 * the column→value patch. Rejects unknown columns. Pure (no I/O).
 */
function validateAndBuild(body: Record<string, unknown>): BuildResult {
  // Reject unknown columns (poi_key in the body is ignored — the URL is authoritative).
  for (const key of Object.keys(body)) {
    if (key === 'poi_key') continue;
    if (!UPSERTABLE_SET.has(key)) {
      return { ok: false, error: `Unknown / non-editable column: "${key}"`, code: 'UNKNOWN_COLUMN', field: key };
    }
  }

  const updates: Record<string, unknown> = {};

  for (const col of UPSERTABLE_COLUMNS) {
    if (!Object.prototype.hasOwnProperty.call(body, col)) continue;
    const raw = body[col];

    // ---- numeric coordinate columns ----
    if (col === 'lat' || col === 'lng') {
      if (raw === null || raw === '') {
        updates[col] = null;
        continue;
      }
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isFinite(n)) {
        return { ok: false, error: `${col} must be a number or null`, code: 'INVALID_NUMBER', field: col };
      }
      if (col === 'lat' && (n < LAT_MIN || n > LAT_MAX)) {
        return { ok: false, error: `lat must be within Korea (${LAT_MIN}–${LAT_MAX})`, code: 'LAT_OUT_OF_RANGE', field: col };
      }
      if (col === 'lng' && (n < LNG_MIN || n > LNG_MAX)) {
        return { ok: false, error: `lng must be within Korea (${LNG_MIN}–${LNG_MAX})`, code: 'LNG_OUT_OF_RANGE', field: col };
      }
      updates[col] = n;
      continue;
    }

    // ---- integer columns ----
    if (col === 'default_stay_minutes' || col === 'builder_profile_version') {
      if (raw === null || raw === '') {
        updates[col] = null;
        continue;
      }
      const n = typeof raw === 'number' ? raw : Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        return { ok: false, error: `${col} must be a non-negative integer or null`, code: 'INVALID_INTEGER', field: col };
      }
      updates[col] = n;
      continue;
    }

    // ---- boolean column ----
    if (col === 'is_attraction') {
      if (raw === null) {
        updates[col] = null;
        continue;
      }
      if (typeof raw !== 'boolean') {
        return { ok: false, error: 'is_attraction must be a boolean or null', code: 'INVALID_BOOLEAN', field: col };
      }
      updates[col] = raw;
      continue;
    }

    // ---- string-array jsonb columns ----
    if (col === 'highlights' || col === 'images') {
      if (raw === null) {
        updates[col] = null;
        continue;
      }
      if (!Array.isArray(raw)) {
        return { ok: false, error: `${col} must be an array of strings or null`, code: 'INVALID_ARRAY', field: col };
      }
      const cleaned: string[] = [];
      for (const el of raw) {
        if (typeof el !== 'string') {
          return { ok: false, error: `${col} must contain only strings`, code: 'INVALID_ARRAY_ITEM', field: col };
        }
        const t = el.trim();
        if (t) cleaned.push(t); // drop blank entries
      }
      updates[col] = cleaned.length > 0 ? cleaned : null;
      continue;
    }

    // ---- poi_meta: jsonb object, NOT NULL ----
    if (col === 'poi_meta') {
      if (raw === null || raw === undefined) {
        // Don't write null into a NOT NULL column. Skip; insert path defaults to {}.
        continue;
      }
      if (!isPlainObject(raw)) {
        return { ok: false, error: 'poi_meta must be a JSON object', code: 'INVALID_OBJECT', field: col };
      }
      updates[col] = raw;
      continue;
    }

    // ---- jsonb object-or-null columns (Empty-Object Rule for the data-quality set) ----
    if (EMPTY_OBJ_TO_NULL.has(col)) {
      if (raw === null) {
        updates[col] = null;
        continue;
      }
      if (!isPlainObject(raw)) {
        return { ok: false, error: `${col} must be a JSON object or null`, code: 'INVALID_OBJECT', field: col };
      }
      updates[col] = Object.keys(raw).length === 0 ? null : raw; // {} -> null
      continue;
    }

    // ---- text columns (normalise '' -> null) ----
    if (TEXT_COLUMNS.has(col)) {
      if (raw === null) {
        updates[col] = null;
        continue;
      }
      if (typeof raw !== 'string') {
        return { ok: false, error: `${col} must be a string or null`, code: 'INVALID_STRING', field: col };
      }
      const t = raw.trim();
      updates[col] = t === '' ? null : t;
      continue;
    }

    // Fallthrough (shouldn't happen — every whitelisted column is handled above).
    updates[col] = raw;
  }

  return { ok: true, updates };
}

/**
 * GET /api/admin/match-pois/[poi_key]
 *
 * Fetches one full POI row (minus `embedding`). Returns 404 if no row exists.
 * Adds an `override_pinned` flag.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ poi_key: string }> }) {
  try {
    await requireAdmin(req);
    const { poi_key: rawKey } = await params;
    const poiKey = decodeURIComponent(rawKey);

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('match_pois')
      .select(SELECT_COLUMNS)
      .eq('poi_key', poiKey)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/admin/match-pois/[poi_key]]', poiKey, error);
      return NextResponse.json({ error: 'Failed to load POI', details: error.message }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ error: 'POI not found', code: 'ROW_NOT_FOUND' }, { status: 404 });
    }

    return NextResponse.json({
      data: { ...(data as unknown as Record<string, unknown>), override_pinned: isOverridePinned(poiKey) },
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/match-pois/[poi_key]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/match-pois/[poi_key]  — auto-upsert.
 *
 * Validates + whitelists the body, then `upsert(..., { onConflict: 'poi_key' })`
 * so a brand-new poi_key INSERTs and an existing one UPDATEs. Unlike the
 * product-pages PATCH (update-only), this creates rows on demand. `poi_meta`
 * (jsonb NOT NULL, no default) is defaulted to `{}` on a fresh INSERT.
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ poi_key: string }> }) {
  try {
    await requireAdmin(req);
    const { poi_key: rawKey } = await params;
    const poiKey = decodeURIComponent(rawKey);

    if (!isValidPoiKey(poiKey)) {
      return NextResponse.json(
        { error: 'Invalid poi_key (must be a slug; `_`-prefixed catalog-junk keys are not editable)', code: 'INVALID_POI_KEY' },
        { status: 400 },
      );
    }

    const body = await req.json().catch(() => null);
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object', code: 'INVALID_BODY' }, { status: 400 });
    }

    const built = validateAndBuild(body);
    if (!built.ok) {
      return NextResponse.json({ error: built.error, code: built.code, field: built.field }, { status: 400 });
    }
    if (Object.keys(built.updates).length === 0) {
      return NextResponse.json({ error: 'No editable fields provided', code: 'EMPTY_PATCH' }, { status: 400 });
    }

    const supabase = createServerClient();

    // Determine insert-vs-update so we can (a) default the NOT NULL poi_meta on
    // a fresh row and (b) return an accurate message.
    const { data: existing, error: fetchErr } = await supabase
      .from('match_pois')
      .select('poi_key')
      .eq('poi_key', poiKey)
      .maybeSingle();

    if (fetchErr) {
      console.error('[PATCH /api/admin/match-pois] existence check failed', poiKey, fetchErr);
      return NextResponse.json({ error: 'Failed to check existing row', details: fetchErr.message }, { status: 500 });
    }

    const isInsert = !existing;
    const payload: Record<string, unknown> = { ...built.updates, poi_key: poiKey };
    if (isInsert && payload.poi_meta === undefined) {
      payload.poi_meta = {}; // NOT NULL column has no default
    }

    const { data: saved, error: upsertErr } = await supabase
      .from('match_pois')
      .upsert(payload, { onConflict: 'poi_key' })
      .select(SELECT_COLUMNS)
      .single();

    if (upsertErr) {
      console.error('[PATCH /api/admin/match-pois] upsert failed', poiKey, upsertErr);
      return NextResponse.json({ error: 'Failed to save POI', details: upsertErr.message }, { status: 400 });
    }

    return NextResponse.json({
      data: { ...(saved as unknown as Record<string, unknown>), override_pinned: isOverridePinned(poiKey) },
      message: isInsert ? 'POI created' : 'POI updated',
      created: isInsert,
    });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[PATCH /api/admin/match-pois/[poi_key]]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
