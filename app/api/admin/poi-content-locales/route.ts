import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * A4 — the review queue behind `match_pois.content_locale_status`.
 *
 *   GET  /api/admin/poi-content-locales[?status=pending][&locale=fr]
 *        → one row per (poi_key, locale) awaiting a decision, each carrying the
 *          English master beside the translation so the reviewer compares text
 *          rather than trusting a checkbox.
 *
 *   PATCH /api/admin/poi-content-locales  { poi_key, locale, status }
 *        → 'approved' publishes that locale; 'pending' or 'rejected' withholds
 *          it. Serving is fail-closed, so anything not 'approved' simply falls
 *          back to English (lib/tour-room/poiContent.server.ts).
 *
 * This exists because the gate without an operating surface is just a lock:
 * content_locales had no review state at all, and the arrival card now SPEAKS
 * whatever is in it.
 */

const REVIEWABLE = new Set(['approved', 'pending', 'rejected']);

interface PoiRow {
  poi_key: string;
  name_en: string | null;
  region: string | null;
  description: string | null;
  content_locales: Record<string, Record<string, unknown>> | null;
  content_locale_status: Record<string, string> | null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const wanted = req.nextUrl.searchParams.get('status') ?? 'pending';
    const localeFilter = req.nextUrl.searchParams.get('locale');

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('match_pois')
      .select('poi_key, name_en, region, description, content_locales, content_locale_status')
      .not('content_locales', 'is', null)
      .order('poi_key');
    if (error) {
      console.error('[GET /api/admin/poi-content-locales]', error);
      return NextResponse.json({ error: 'Failed to load queue', details: error.message }, { status: 500 });
    }

    const items: Array<Record<string, unknown>> = [];
    const counts: Record<string, number> = {};

    for (const row of (data ?? []) as PoiRow[]) {
      // `_metadata` bookkeeping rows are not POIs.
      if (row.poi_key.startsWith('_')) continue;
      const locales = row.content_locales ?? {};
      const status = row.content_locale_status ?? {};
      const englishMaster = text(locales.en?.description) ?? text(row.description);

      for (const locale of Object.keys(locales)) {
        // Unset counts as pending — the gate is fail-closed, so an unset locale
        // is withheld and therefore genuinely awaiting a decision.
        const state = status[locale] ?? 'pending';
        counts[state] = (counts[state] ?? 0) + 1;
        if (state !== wanted) continue;
        if (localeFilter && locale !== localeFilter) continue;

        const entry = locales[locale] ?? {};
        items.push({
          poi_key: row.poi_key,
          name_en: row.name_en,
          region: row.region,
          locale,
          status: state,
          name: text(entry.name),
          description: text(entry.description),
          highlights: Array.isArray(entry.highlights) ? entry.highlights.slice(0, 6) : [],
          insider_tip: text(entry.insider_tip),
          english_description: englishMaster,
        });
      }
    }

    return NextResponse.json({ items, counts, total: items.length });
  } catch (error) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[GET /api/admin/poi-content-locales]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = (await req.json().catch(() => null)) as {
      poi_key?: unknown;
      locale?: unknown;
      status?: unknown;
    } | null;

    const poiKey = typeof body?.poi_key === 'string' ? body.poi_key.trim() : '';
    const locale = typeof body?.locale === 'string' ? body.locale.trim() : '';
    const status = typeof body?.status === 'string' ? body.status : '';
    if (!poiKey || !locale) {
      return NextResponse.json({ error: 'poi_key and locale are required' }, { status: 400 });
    }
    if (!REVIEWABLE.has(status)) {
      return NextResponse.json({ error: 'status must be approved, pending, or rejected' }, { status: 400 });
    }

    const supabase = createServerClient();
    // Read-modify-write on the jsonb: a blind `||` merge would still be one
    // statement, but reading first lets us 404 an unknown POI instead of
    // silently creating a status for a row that does not exist.
    const { data: current, error: readError } = await supabase
      .from('match_pois')
      .select('poi_key, content_locales, content_locale_status')
      .eq('poi_key', poiKey)
      .maybeSingle();
    if (readError) throw readError;
    if (!current) return NextResponse.json({ error: 'POI not found' }, { status: 404 });

    const row = current as PoiRow;
    if (!row.content_locales?.[locale]) {
      return NextResponse.json({ error: `POI has no ${locale} content to review` }, { status: 400 });
    }

    const next = { ...(row.content_locale_status ?? {}), [locale]: status };
    const { error: writeError } = await supabase
      .from('match_pois')
      .update({ content_locale_status: next })
      .eq('poi_key', poiKey);
    if (writeError) throw writeError;

    return NextResponse.json({ poi_key: poiKey, locale, status, content_locale_status: next });
  } catch (error) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('[PATCH /api/admin/poi-content-locales]', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
