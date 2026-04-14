/**
 * Homepage main-body rollback. `NEXT_PUBLIC_*` is inlined at build time — change env, then rebuild/redeploy.
 *
 * Set `NEXT_PUBLIC_USE_LEGACY_HOMEPAGE=true` to serve `LegacyHomePage` on `/` and `/[locale]`.
 */
export function shouldUseLegacyHomepage(): boolean {
  const v = process.env.NEXT_PUBLIC_USE_LEGACY_HOMEPAGE?.trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}
