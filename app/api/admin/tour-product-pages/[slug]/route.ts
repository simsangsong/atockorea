import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin } from '@/lib/auth';

/**
 * GET /api/admin/tour-product-pages/[slug]?locale=en
 *
 * Loads the master-template detail row for a given (slug, locale). Returns the
 * full row including `detail_payload` so the admin UI can render structured
 * fields + a JSON view side-by-side.
 *
 * Falls back to `?locale=en` if the requested locale row does not exist.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin(req);
    const { slug } = await params;
    const url = new URL(req.url);
    const locale = (url.searchParams.get('locale') || 'en').toLowerCase();
    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('tour_product_pages')
      .select('*')
      .eq('slug', slug)
      .eq('locale', locale)
      .maybeSingle();

    if (error) {
      console.error('[GET /api/admin/tour-product-pages]', slug, locale, error);
      return NextResponse.json({ error: 'Failed to load page', details: error.message }, { status: 500 });
    }

    if (!data && locale !== 'en') {
      const { data: enRow } = await supabase
        .from('tour_product_pages')
        .select('*')
        .eq('slug', slug)
        .eq('locale', 'en')
        .maybeSingle();
      return NextResponse.json({ data: enRow ?? null, locale, fallbackLocale: enRow ? 'en' : null });
    }

    return NextResponse.json({ data: data ?? null, locale });
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || String(error?.message ?? '').includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error', details: error?.message }, { status: 500 });
  }
}

const PATCHABLE_COLUMNS = [
  'is_published',
  'sort_order',
  'title',
  'subtitle',
  'region_label',
  'duration_label',
  'stops_count',
  'rating_avg',
  'review_count',
  'badges',
  'hero_image_url',
  'thumbnail_url',
  'card_short_description',
  'seo_title',
  'meta_description',
  'headline_line_1',
  'headline_line_2',
  'price_amount_label',
  'price_currency',
  'price_per',
  'detail_payload',
] as const;

type PatchableColumn = (typeof PATCHABLE_COLUMNS)[number];

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * PATCH /api/admin/tour-product-pages/[slug]
 *
 * Body (all fields optional, only provided fields are updated):
 *   {
 *     locale: 'en' | 'ko' | 'ja' | 'zh' | 'zh-TW' | 'es',
 *     ...patchable columns from PATCHABLE_COLUMNS
 *   }
 *
 * `slug` is fixed by the URL — it cannot be renamed here. `locale` selects
 * which (slug, locale) row to update; if the row does not exist yet, an UPSERT
 * creates it. `detail_payload` must be an object with `schema_version === 1`
 * if provided; the rest of the payload shape is trusted (admin-only).
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin(req);
    const { slug } = await params;
    const body = await req.json();

    const locale = String(body.locale || 'en').toLowerCase();
    const SUPPORTED_LOCALES = ['en', 'ko', 'ja', 'zh', 'zh-cn', 'zh-tw', 'es'];
    if (!SUPPORTED_LOCALES.includes(locale)) {
      return NextResponse.json(
        { error: `Unsupported locale "${locale}"`, code: 'INVALID_LOCALE' },
        { status: 400 },
      );
    }

    if (body.detail_payload !== undefined) {
      if (!isPlainObject(body.detail_payload)) {
        return NextResponse.json(
          { error: 'detail_payload must be an object', code: 'INVALID_PAYLOAD' },
          { status: 400 },
        );
      }
      const sv = Number((body.detail_payload as { schema_version?: unknown }).schema_version);
      if (!Number.isFinite(sv) || sv !== 1) {
        return NextResponse.json(
          {
            error: 'detail_payload.schema_version must equal 1',
            code: 'INVALID_PAYLOAD_SCHEMA',
          },
          { status: 400 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    for (const key of PATCHABLE_COLUMNS) {
      const k = key as PatchableColumn;
      if (Object.prototype.hasOwnProperty.call(body, k)) {
        updates[k] = body[k];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { error: 'No editable fields provided', code: 'EMPTY_PATCH' },
        { status: 400 },
      );
    }

    const supabase = createServerClient();

    const { data: existing, error: fetchError } = await supabase
      .from('tour_product_pages')
      .select('id, slug, locale')
      .eq('slug', slug)
      .eq('locale', locale)
      .maybeSingle();

    if (fetchError) {
      console.error('[PATCH /api/admin/tour-product-pages] fetch failed', slug, locale, fetchError);
      return NextResponse.json(
        { error: 'Failed to load existing row', details: fetchError.message },
        { status: 500 },
      );
    }

    if (!existing) {
      return NextResponse.json(
        {
          error: `No tour_product_pages row for slug=${slug}, locale=${locale}. Create the row via SQL/seed first.`,
          code: 'ROW_NOT_FOUND',
        },
        { status: 404 },
      );
    }

    const { data: updated, error: updateError } = await supabase
      .from('tour_product_pages')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();

    if (updateError) {
      console.error('[PATCH /api/admin/tour-product-pages] update failed', slug, locale, updateError);
      return NextResponse.json(
        { error: 'Failed to update page', details: updateError.message },
        { status: 400 },
      );
    }

    return NextResponse.json({ data: updated, message: 'Page updated successfully' });
  } catch (error: any) {
    if (error?.message === 'Unauthorized' || String(error?.message ?? '').includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('[PATCH /api/admin/tour-product-pages]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 },
    );
  }
}
