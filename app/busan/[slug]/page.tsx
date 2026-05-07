import { redirect } from "next/navigation";

/**
 * Legacy `/busan/<slug>` route — unified under `/tour-product/<slug>` so every
 * tour product detail page shares the v2 background + card system. The 308
 * redirect lives in next.config.js (middleware layer); this server-side
 * redirect is a defense-in-depth fallback in case the rewrite slips through.
 */
export default async function LegacyBusanSlugRedirect({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/tour-product/${slug}`);
}
