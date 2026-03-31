/**
 * Join/small-group tours that use the v0-style `TourDetailTemplateView` on `/tour/[id]`.
 * Add slugs here when a product should use this layout instead of `SmallGroupTourDetailTemplate`.
 */
export const TOUR_DETAIL_TEMPLATE_SLUGS = new Set<string>([
  /** Internal v0 preview only — live East SKU uses `SmallGroupTourDetailTemplate` + product merge. */
  'jeju-east-small-group-template-preview',
]);

export function tourUsesDetailTemplateView(slug: string | undefined | null): boolean {
  if (!slug || typeof slug !== 'string') return false;
  return TOUR_DETAIL_TEMPLATE_SLUGS.has(slug.trim());
}
