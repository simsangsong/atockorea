const SLUG = "east-signature-nature-core";

/** URL `/tour/[id]` segment or DB slug (ASCII kebab). */
export function matchesEastSignatureSlugSegment(segment: string | null | undefined): boolean {
  const s = (segment ?? "").trim().toLowerCase();
  return s === SLUG || s.startsWith(`${SLUG}-`);
}

export function matchesEastSignatureTitle(title: string | undefined): boolean {
  const raw = (title ?? "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  if (/east signature nature core/i.test(lower)) return true;
  const compact = raw.replace(/\s+/g, "");
  if (compact === "동부시그니처네이처코어") return true;
  return /시그니처/.test(raw) && /네이처/.test(raw) && /동부/.test(raw);
}

/**
 * Force premium small-group (`join`) routing for East Signature SKU.
 * Lives in `src/lib` so `tours-adapter` does not import heavy `components/` modules (stable client bundle).
 */
export function shouldCoerceEastSignatureNatureCoreJoin(
  routeTourId: string | null | undefined,
  dbSlug: string | null | undefined,
  title: string | undefined
): boolean {
  if (matchesEastSignatureSlugSegment(routeTourId)) return true;
  if (matchesEastSignatureSlugSegment(dbSlug)) return true;
  return matchesEastSignatureTitle(title);
}

/** Client: read `/tour/[id]` segment from the visible URL (fallback if `useParams().id` mismatches). */
export function extractTourRouteSegmentFromPathname(pathname: string): string | null {
  const m = pathname.match(/\/tour\/([^/?#]+)/);
  const raw = m?.[1];
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}
