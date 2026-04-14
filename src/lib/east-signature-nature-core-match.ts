/** Legacy flagship slug; still honored for redirects and coercion. */
const LEGACY_EAST_SIGNATURE_SLUG = "east-signature-nature-core";
/** Canonical live small-group v2 SKU (replaces static `/tour/east-signature-nature-core` → `/tour/...` redirect). */
const CANONICAL_SMALL_GROUP_V2_SLUG = "east-jeju-signature-small-group";

/** URL `/tour/[id]` segment or DB slug (ASCII kebab). */
export function matchesEastSignatureSlugSegment(segment: string | null | undefined): boolean {
  const s = (segment ?? "").trim().toLowerCase();
  const bases = [LEGACY_EAST_SIGNATURE_SLUG, CANONICAL_SMALL_GROUP_V2_SLUG] as const;
  for (const base of bases) {
    if (s === base || s.startsWith(`${base}-`)) return true;
  }
  return false;
}

export function matchesEastSignatureTitle(title: string | undefined): boolean {
  const raw = (title ?? "").trim();
  if (!raw) return false;
  const lower = raw.toLowerCase().replace(/\s+/g, " ");
  if (/east\s*jeju\s*signature/i.test(lower)) return true;
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

/** Locale segments used in `middleware` for `/xx/tour/...` */
const PATH_LOCALE_PREFIXES = new Set(["en", "ko", "zh-CN", "zh-TW", "ja", "es"]);

function decodePathSegment(seg: string): string {
  try {
    return decodeURIComponent(seg);
  } catch {
    return seg;
  }
}

/**
 * 사이트 전체 비공개(`home-private` rewrite) 중에도 **동부 소규모 투어 상세**만 통과.
 * - `east-signature-nature-core` / `east-jeju-signature-small-group` 및 각각 `-*` 접두 (`/tour/[slug]` 2세그먼트)
 * - `/tour-product/east-signature-nature-core` (및 locale 접두 동일)
 * - `/ko/tour/...` 등 locale 접두 동일 규칙
 * - 루트 단일 세그먼트 … (이후 미들웨어가 `/tour/…`로 리다이렉트)
 * 체크아웃·확인 등 하위 경로는 비공개 유지.
 */
export function isPublicEastSignatureTourDetailPathForSiteGate(pathname: string): boolean {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return false;

  if (parts.length === 1) {
    return matchesEastSignatureSlugSegment(decodePathSegment(parts[0]!));
  }

  if (parts[0] === "tour" && parts.length === 2) {
    return matchesEastSignatureSlugSegment(decodePathSegment(parts[1]!));
  }

  if (
    parts.length === 3 &&
    PATH_LOCALE_PREFIXES.has(parts[0]!) &&
    parts[1] === "tour"
  ) {
    return matchesEastSignatureSlugSegment(decodePathSegment(parts[2]!));
  }

  /** Static flagship product page (canonical consumer URL). */
  if (parts[0] === "tour-product" && parts.length === 2 && parts[1] === "east-signature-nature-core") {
    return true;
  }
  if (
    parts.length === 3 &&
    PATH_LOCALE_PREFIXES.has(parts[0]!) &&
    parts[1] === "tour-product" &&
    parts[2] === "east-signature-nature-core"
  ) {
    return true;
  }

  return false;
}
