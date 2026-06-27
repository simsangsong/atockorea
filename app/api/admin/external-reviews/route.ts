import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { requireAdmin, AdminAuthFailure, adminAuthJsonResponse } from '@/lib/auth';
import { EXTERNAL_REVIEW_PLATFORMS } from '@/lib/tour-product/externalReviews';

export const dynamic = 'force-dynamic';

const PLATFORM_SET = new Set<string>(EXTERNAL_REVIEW_PLATFORMS);

const SELECT_COLUMNS =
  'id, tour_product_slug, platform, average_rating, review_count, source_url, ' +
  'external_id, is_visible, sort_order, last_checked_at, created_at, updated_at';

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * GET /api/admin/external-reviews
 *
 * Lists every third-party review aggregate row for the admin editor, ordered by
 * slug then sort_order. Optional `?slug=` narrows to one tour product.
 */
export async function GET(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const slug = req.nextUrl.searchParams.get('slug')?.trim();

    let query = supabase
      .from('tour_external_reviews')
      .select(SELECT_COLUMNS)
      .order('tour_product_slug', { ascending: true })
      .order('sort_order', { ascending: true });
    if (slug) query = query.eq('tour_product_slug', slug);

    const { data, error } = await query;
    if (error) {
      console.error('[GET /api/admin/external-reviews]', error);
      return NextResponse.json({ error: 'Failed to load', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data: data ?? [], count: (data ?? []).length });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[GET /api/admin/external-reviews]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

type BuildResult =
  | { ok: true; row: Record<string, unknown> }
  | { ok: false; error: string; field?: string };

/** Validate the body into an upsertable row. Pure (no I/O). */
function validateAndBuild(body: Record<string, unknown>): BuildResult {
  const slug = typeof body.tour_product_slug === 'string' ? body.tour_product_slug.trim() : '';
  if (!slug) return { ok: false, error: 'tour_product_slug is required', field: 'tour_product_slug' };
  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return { ok: false, error: 'tour_product_slug must be a lowercase slug', field: 'tour_product_slug' };
  }

  const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
  if (!PLATFORM_SET.has(platform)) {
    return { ok: false, error: `platform must be one of ${[...PLATFORM_SET].join(', ')}`, field: 'platform' };
  }

  // average_rating: null allowed (rating not published), else 0–5.
  let averageRating: number | null = null;
  if (body.average_rating !== null && body.average_rating !== undefined && body.average_rating !== '') {
    const n = typeof body.average_rating === 'number' ? body.average_rating : Number(body.average_rating);
    if (!Number.isFinite(n) || n < 0 || n > 5) {
      return { ok: false, error: 'average_rating must be 0–5 or empty', field: 'average_rating' };
    }
    averageRating = Math.round(n * 10) / 10;
  }

  const rawCount = body.review_count;
  const count = typeof rawCount === 'number' ? rawCount : Number(rawCount);
  if (!Number.isInteger(count) || count < 0) {
    return { ok: false, error: 'review_count must be a non-negative integer', field: 'review_count' };
  }

  const sourceUrl = typeof body.source_url === 'string' ? body.source_url.trim() : '';
  if (!sourceUrl) return { ok: false, error: 'source_url is required', field: 'source_url' };
  try {
    const u = new URL(sourceUrl);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('proto');
  } catch {
    return { ok: false, error: 'source_url must be a valid http(s) URL', field: 'source_url' };
  }

  const externalId =
    typeof body.external_id === 'string' && body.external_id.trim() ? body.external_id.trim() : null;

  const isVisible = body.is_visible === undefined ? true : Boolean(body.is_visible);

  let sortOrder = 0;
  if (body.sort_order !== null && body.sort_order !== undefined && body.sort_order !== '') {
    const n = typeof body.sort_order === 'number' ? body.sort_order : Number(body.sort_order);
    if (!Number.isInteger(n)) return { ok: false, error: 'sort_order must be an integer', field: 'sort_order' };
    sortOrder = n;
  }

  let lastCheckedAt: string | null = null;
  if (typeof body.last_checked_at === 'string' && body.last_checked_at.trim()) {
    const d = body.last_checked_at.trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) {
      return { ok: false, error: 'last_checked_at must be YYYY-MM-DD or empty', field: 'last_checked_at' };
    }
    lastCheckedAt = d;
  }

  return {
    ok: true,
    row: {
      tour_product_slug: slug,
      platform,
      average_rating: averageRating,
      review_count: count,
      source_url: sourceUrl,
      external_id: externalId,
      is_visible: isVisible,
      sort_order: sortOrder,
      last_checked_at: lastCheckedAt,
    },
  };
}

/**
 * POST /api/admin/external-reviews — upsert one aggregate row.
 *
 * Conflict key is (tour_product_slug, platform), so re-submitting the same
 * slug+platform UPDATEs in place; a new pair INSERTs.
 */
export async function POST(req: NextRequest) {
  try {
    await requireAdmin(req);
    const body = await req.json().catch(() => null);
    if (!isPlainObject(body)) {
      return NextResponse.json({ error: 'Request body must be a JSON object' }, { status: 400 });
    }
    const built = validateAndBuild(body);
    if (!built.ok) {
      return NextResponse.json({ error: built.error, field: built.field }, { status: 400 });
    }

    const supabase = createServerClient();
    const { data, error } = await supabase
      .from('tour_external_reviews')
      .upsert(built.row, { onConflict: 'tour_product_slug,platform' })
      .select(SELECT_COLUMNS)
      .single();

    if (error) {
      console.error('[POST /api/admin/external-reviews] upsert failed', error);
      return NextResponse.json({ error: 'Failed to save', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ data, message: 'Saved' });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[POST /api/admin/external-reviews]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/admin/external-reviews?slug=...&platform=...  — remove one row.
 */
export async function DELETE(req: NextRequest) {
  try {
    await requireAdmin(req);
    const slug = req.nextUrl.searchParams.get('slug')?.trim();
    const platform = req.nextUrl.searchParams.get('platform')?.trim();
    if (!slug || !platform) {
      return NextResponse.json({ error: 'slug and platform query params are required' }, { status: 400 });
    }
    if (!PLATFORM_SET.has(platform)) {
      return NextResponse.json({ error: 'Unknown platform' }, { status: 400 });
    }

    const supabase = createServerClient();
    const { error } = await supabase
      .from('tour_external_reviews')
      .delete()
      .eq('tour_product_slug', slug)
      .eq('platform', platform);

    if (error) {
      console.error('[DELETE /api/admin/external-reviews]', error);
      return NextResponse.json({ error: 'Failed to delete', details: error.message }, { status: 400 });
    }
    return NextResponse.json({ message: 'Deleted' });
  } catch (e) {
    if (e instanceof AdminAuthFailure) return adminAuthJsonResponse(e);
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[DELETE /api/admin/external-reviews]', msg);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
