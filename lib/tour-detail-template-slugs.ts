/**
 * Join/small-group tours that use `TourDetailTemplateView` on `/tour/[id]` instead of the default v2 shell.
 *
 * **Default for almost all small-group products:** `EastSmallGroupTourV2Page` + `buildSmallGroupDetailContent`
 * (+ optional `detail_page_v2` in Supabase). New catalog rows should use `tours.type` inference via
 * `tours.tag` containing “Small group …” (see `tours-adapter.inferTourType`) or known join slugs — no code change per product.
 */
/** Empty: former template-preview SKUs redirect to `/tour-product/east-signature-nature-core`. */
export const TOUR_DETAIL_TEMPLATE_SLUGS = new Set<string>([]);

export function tourUsesDetailTemplateView(slug: string | undefined | null): boolean {
  if (!slug || typeof slug !== 'string') return false;
  return TOUR_DETAIL_TEMPLATE_SLUGS.has(slug.trim());
}
