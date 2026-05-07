import { redirect } from "next/navigation";

/**
 * Legacy `/jeju/<slug>` route — unified under `/tour-product/<slug>` so every
 * tour product detail page shares the v2 background + card system. The 308
 * redirect lives in next.config.js (middleware layer); this server-side
 * redirect is a defense-in-depth fallback in case the rewrite slips through.
 * If the slug isn't a registered tour-product the canonical page calls
 * `notFound()`, preserving 404 behavior for unknown slugs.
 */
export default async function LegacyJejuSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/tour-product/${slug}`);
}
