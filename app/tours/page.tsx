import { redirect } from 'next/navigation';

/**
 * `/tours` is the primary nav target; the real catalog lives at `/tours/list`.
 *
 * This route previously hosted a hardcoded demo detail page (legacy mockup with
 * fake timeline, gallery, and checkout form). It has been removed — any remaining
 * bookmarks, external links, or internal `href="/tours"` references now land on
 * the real tour list.
 */
export default function ToursIndexPage() {
  redirect('/tours/list');
}
