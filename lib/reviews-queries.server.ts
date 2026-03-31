/**
 * Server-only review queries using the service-role client.
 * Public reads MUST apply {@link applyPublicReviewServerFilters} — do not rely on RLS alone.
 */

import { createServerClient } from '@/lib/supabase';
import type { Database } from '@/lib/supabase';

export type ReviewRow = Database['public']['Tables']['reviews']['Row'];

const REVIEW_SELECT_WITH_TOUR = `
  *,
  tours (
    id,
    title
  )
`;

/**
 * Explicit public filter for service-role queries (RLS is bypassed).
 * Every public review read must use both conditions — never `is_visible` alone.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase builder chain
export function applyPublicReviewServerFilters(query: any): any {
  return query.eq('is_visible', true).eq('is_shadow', false);
}

function normalizeImagesField(row: Record<string, unknown>): void {
  if (Array.isArray(row.images)) return;
  if (row.images == null) {
    row.images = [];
    return;
  }
  try {
    const parsed = typeof row.images === 'string' ? JSON.parse(row.images) : row.images;
    row.images = Array.isArray(parsed) ? parsed : [];
  } catch {
    row.images = [];
  }
}

export async function attachReviewProfiles(
  list: Array<Record<string, unknown>>,
): Promise<Array<Record<string, unknown>>> {
  if (list.length === 0) return list;

  const supabase = createServerClient();
  const userIds = [...new Set(list.map((r) => r.user_id).filter(Boolean))] as string[];
  let profilesMap: Record<string, { id: string; full_name: string | null; avatar_url: string | null }> =
    {};

  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, full_name, avatar_url')
      .in('id', userIds);
    if (profiles) {
      profilesMap = Object.fromEntries(profiles.map((p) => [p.id, p]));
    }
  }

  return list.map((r) => {
    normalizeImagesField(r);
    const userProfile = r.user_id ? profilesMap[String(r.user_id)] : null;
    const isAnonymous = Boolean(r.is_anonymous);
    const attach = {
      user_profiles: isAnonymous
        ? { id: null, full_name: 'Anonymous', avatar_url: null }
        : (userProfile || { id: r.user_id, full_name: null, avatar_url: null }),
    };
    return { ...r, ...attach };
  });
}

export async function fetchPublicReviewsForApi(options: {
  tourId?: string | null;
  limit: number;
  offset: number;
  homePreview?: boolean;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = createServerClient();
  let query = applyPublicReviewServerFilters(supabase.from('reviews').select(REVIEW_SELECT_WITH_TOUR));

  if (options.tourId) {
    query = query.eq('tour_id', options.tourId);
  }

  if (options.homePreview) {
    query = query
      .order('rating', { ascending: false })
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);
  } else {
    query = query
      .order('created_at', { ascending: false })
      .range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[fetchPublicReviewsForApi]', error);
    throw error;
  }
  return (data as Array<Record<string, unknown>>) || [];
}

/** Current user’s reviews, including shadow (is_shadow true). No public filter. */
export async function fetchMyReviewsForApi(options: {
  userId: string;
  limit: number;
  offset: number;
}): Promise<Array<Record<string, unknown>>> {
  const supabase = createServerClient();
  const { data, error } = await supabase
    .from('reviews')
    .select(REVIEW_SELECT_WITH_TOUR)
    .eq('user_id', options.userId)
    .order('created_at', { ascending: false })
    .range(options.offset, options.offset + options.limit - 1);

  if (error) {
    console.error('[fetchMyReviewsForApi]', error);
    throw error;
  }
  return (data as Array<Record<string, unknown>>) || [];
}

/** Homepage: top 2 public reviews — higher rating first, then newest. Includes display names (non-anonymous). */
export async function getHomepagePreviewReviews(): Promise<Array<Record<string, unknown>>> {
  const rows = await fetchPublicReviewsForApi({
    limit: 2,
    offset: 0,
    homePreview: true,
  });
  const slice = rows.slice(0, 2);
  return attachReviewProfiles(slice);
}
