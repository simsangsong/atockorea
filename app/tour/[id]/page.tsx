import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase';
import {
  canonicalProductPathForSlug,
  isTourBlockedFromConsumerSurfaces,
  isTourIdBlockedFromConsumerSurfaces,
} from '@/lib/tour-consumer-visibility';

export const dynamic = 'force-dynamic';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Legacy `/tour/[id]` — HTTP redirect to `/tour-product/<slug>` (or list).
 * Server-side avoids an extra round-trip fetch from the browser.
 */
export default async function LegacyTourIdRedirectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = await params;
  const tourId = typeof rawId === 'string' ? rawId.trim() : '';
  if (!tourId) redirect('/tours/list');

  const decoded = decodeURIComponent(tourId);
  const isUUID = UUID_RE.test(decoded);

  if (isUUID && isTourIdBlockedFromConsumerSurfaces(decoded)) {
    redirect('/tours/list');
  }

  let supabase;
  try {
    supabase = createServerClient();
  } catch {
    redirect('/tours/list');
  }

  let lookup = supabase
    .from('tours')
    .select('id, slug')
    .eq('is_active', true);
  lookup = isUUID ? lookup.eq('id', decoded) : lookup.eq('slug', decoded);

  const { data, error } = await lookup.maybeSingle();

  if (error || !data) redirect('/tours/list');

  if (isTourBlockedFromConsumerSurfaces(data.id, data.slug)) {
    redirect('/tours/list');
  }

  const canonical = canonicalProductPathForSlug(
    typeof data.slug === 'string' ? data.slug : null,
  );
  redirect(canonical ?? '/tours/list');
}
