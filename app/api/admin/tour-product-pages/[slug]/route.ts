import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
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
    const locale = normalizeTourProductPageLocale(url.searchParams.get('locale'));
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
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
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

function normalizeTourProductPageLocale(raw: unknown): string {
  const value = String(raw || 'en').trim();
  const lower = value.toLowerCase();
  if (lower === 'zh-cn') return 'zh';
  if (lower === 'zh-tw') return 'zh-TW';
  if (lower === 'en' || lower === 'ko' || lower === 'ja' || lower === 'zh' || lower === 'es') {
    return lower;
  }
  return value;
}

function cleanStringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}

type MediaPropagationPatch = {
  thumbnailUrl: string | null;
  heroUrl: string | null;
  heroImages?: string[];
  galleryItems?: unknown[];
};

function mediaPatchFromUpdatedRow(row: Record<string, unknown>): MediaPropagationPatch {
  const payload = isPlainObject(row.detail_payload) ? row.detail_payload : {};
  const hero = isPlainObject(payload.hero) ? payload.hero : {};
  return {
    thumbnailUrl: cleanStringOrNull(row.thumbnail_url),
    heroUrl: cleanStringOrNull(row.hero_image_url),
    heroImages: Array.isArray(hero.images)
      ? hero.images.filter((value): value is string => typeof value === 'string' && value.trim().length > 0)
      : undefined,
    galleryItems: Array.isArray(payload.galleryItems) ? payload.galleryItems : undefined,
  };
}

function payloadMediaSignature(raw: unknown): string {
  const payload = isPlainObject(raw) ? raw : {};
  const catalog = isPlainObject(payload.catalog_card) ? payload.catalog_card : {};
  const hero = isPlainObject(payload.hero) ? payload.hero : {};
  const heroImages = Array.isArray(hero.images)
    ? hero.images.map(cleanStringOrNull).filter((value): value is string => Boolean(value))
    : [];
  const galleryItems = Array.isArray(payload.galleryItems)
    ? payload.galleryItems
        .map((item) => (isPlainObject(item) ? cleanStringOrNull(item.src) : null))
        .filter((value): value is string => Boolean(value))
    : [];

  return JSON.stringify({
    catalogThumbnail: cleanStringOrNull(catalog.thumbnail),
    catalogHero: cleanStringOrNull(catalog.heroImage),
    heroImage: cleanStringOrNull(hero.imageUrl),
    heroImages,
    galleryItems,
  });
}

function mergeMediaIntoPayload(raw: unknown, media: MediaPropagationPatch): Record<string, unknown> {
  const payload = isPlainObject(raw) ? { ...raw } : {};
  const catalog = isPlainObject(payload.catalog_card) ? { ...payload.catalog_card } : {};
  catalog.thumbnail = media.thumbnailUrl;
  catalog.heroImage = media.heroUrl;
  payload.catalog_card = catalog;

  const hero = isPlainObject(payload.hero) ? { ...payload.hero } : {};
  if (media.heroUrl) hero.imageUrl = media.heroUrl;
  else delete hero.imageUrl;
  if (media.heroImages) hero.images = media.heroImages;
  payload.hero = hero;

  if (media.galleryItems) {
    payload.galleryItems = media.galleryItems;
  }

  return payload;
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

    const locale = normalizeTourProductPageLocale(body.locale);
    const SUPPORTED_LOCALES = ['en', 'ko', 'ja', 'zh', 'zh-TW', 'es'];
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
      if (!Number.isFinite(sv) || sv < 1) {
        return NextResponse.json(
          {
            error: 'detail_payload.schema_version must be a positive integer',
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
      .select('id, slug, locale, thumbnail_url, hero_image_url, detail_payload')
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

    // Mirror image edits to the legacy `tours` table so the home page,
    // /tours/list, admin v1 list, catalog cards, etc. all pick up the same
    // images without a separate save. Skipped if neither image field was
    // touched in this PATCH. Title stays per-locale on `tour_product_pages`
    // only — we never overwrite tours.title from non-EN locales.
    const thumbnailTouched =
      Object.prototype.hasOwnProperty.call(updates, 'thumbnail_url') &&
      cleanStringOrNull(updates.thumbnail_url) !==
        cleanStringOrNull((existing as Record<string, unknown>).thumbnail_url);
    const heroTouched =
      Object.prototype.hasOwnProperty.call(updates, 'hero_image_url') &&
      cleanStringOrNull(updates.hero_image_url) !==
        cleanStringOrNull((existing as Record<string, unknown>).hero_image_url);
    const detailMediaTouched =
      Object.prototype.hasOwnProperty.call(updates, 'detail_payload') &&
      payloadMediaSignature(updates.detail_payload) !==
        payloadMediaSignature((existing as Record<string, unknown>).detail_payload);
    const mediaTouched = thumbnailTouched || heroTouched || detailMediaTouched;
    const mediaPatch = mediaPatchFromUpdatedRow(updated as Record<string, unknown>);

    const toursPatch: Record<string, unknown> = {};
    if (mediaTouched) {
      toursPatch.image_url = mediaPatch.thumbnailUrl ?? mediaPatch.heroUrl ?? null;
    }
    if (detailMediaTouched) {
      const payload = updates.detail_payload as Record<string, unknown> | undefined;
      if (payload && Array.isArray(payload.galleryItems)) {
        const urls = (payload.galleryItems as Array<Record<string, unknown>>)
          .map((g) => (typeof g?.src === 'string' ? (g.src as string) : ''))
          .filter((u) => u.length > 0);
        toursPatch.gallery_images = urls;
      }
    }
    if (Object.keys(toursPatch).length > 0) {
      toursPatch.updated_at = new Date().toISOString();
      const { error: toursErr } = await supabase
        .from('tours')
        .update(toursPatch)
        .eq('slug', slug);
      if (toursErr) {
        console.warn('[PATCH /api/admin/tour-product-pages] tours mirror failed', slug, toursErr.message);
      }
    }

    if (mediaTouched) {
      const { data: siblingRows, error: siblingFetchErr } = await supabase
        .from('tour_product_pages')
        .select('id, detail_payload')
        .eq('slug', slug)
        .neq('id', updated.id);

      if (siblingFetchErr) {
        console.warn(
          '[PATCH /api/admin/tour-product-pages] sibling media fetch failed',
          slug,
          siblingFetchErr.message,
        );
      } else {
        const siblingUpdatedAt = new Date().toISOString();
        const siblingUpdates = ((siblingRows ?? []) as Array<{ id: string; detail_payload: unknown }>).map((row) =>
          supabase
            .from('tour_product_pages')
            .update({
              thumbnail_url: mediaPatch.thumbnailUrl,
              hero_image_url: mediaPatch.heroUrl,
              detail_payload: mergeMediaIntoPayload(row.detail_payload, mediaPatch),
              updated_at: siblingUpdatedAt,
            })
            .eq('id', row.id),
        );
        const siblingResults = await Promise.all(siblingUpdates);
        for (const result of siblingResults) {
          if (result.error) {
            console.warn(
              '[PATCH /api/admin/tour-product-pages] sibling media update failed',
              slug,
              result.error.message,
            );
          }
        }
      }
    }

    // Invalidate cached customer-facing pages so changes surface on the next
    // visit. T1: the detail routes are ISR (revalidate=3600) — these calls are
    // what makes an admin save show up immediately instead of at TTL expiry,
    // so every locale variant of the slug must be covered.
    try {
      revalidatePath(`/tour-product/${slug}`);
      revalidatePath('/tour-product/[slug]', 'page');
      for (const urlLocale of ['ko', 'ja', 'es', 'zh-CN', 'zh-TW']) {
        revalidatePath(`/${urlLocale}/tour-product/${slug}`);
      }
      revalidatePath('/[locale]/tour-product/[slug]', 'page');
      revalidatePath('/api/tours');
      revalidatePath('/api/tour-product-card-media');
      revalidatePath('/');
      // Catalogue is ISR per locale too (bare = EN, /{locale}/tours/list for
      // the rest) — thumbnail saves must surface on every variant immediately.
      revalidatePath('/tours/list');
      for (const urlLocale of ['ko', 'ja', 'es', 'zh-CN', 'zh-TW']) {
        revalidatePath(`/${urlLocale}/tours/list`);
      }
      revalidatePath('/[locale]/tours/list', 'page');
    } catch (e) {
      console.warn('[PATCH /api/admin/tour-product-pages] revalidate hint failed', e);
    }

    return NextResponse.json({ data: updated, message: 'Page updated successfully' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'Unauthorized' || message.includes('Forbidden')) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    console.error('[PATCH /api/admin/tour-product-pages]', error);
    return NextResponse.json(
      { error: 'Internal server error', details: message },
      { status: 500 },
    );
  }
}
