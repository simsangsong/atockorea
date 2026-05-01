/**
 * Whitelist for image URLs used in CSS background-image / direct <img src=...>.
 * Mirrors next.config.js `remotePatterns` so a malicious detail_payload row
 * cannot point the browser at internal hosts (SSRF-via-DOM) or
 * `javascript:` / `data:` URIs.
 *
 * <Image> components already enforce next.config.js, but raw CSS backgroundImage
 * does not — that's why this helper exists.
 */

const ALLOWED_HOST_SUFFIXES: ReadonlyArray<string> = [
  "images.unsplash.com",
  "plus.unsplash.com",
  "images.pexels.com",
  "videos.pexels.com",
  ".supabase.co",
  ".supabase.in",
  "cdn.visitjeju.net",
  "api.cdn.visitjeju.net",
  "tong.visitkorea.or.kr",
  "ktoimg.visitkorea.or.kr",
  "cdn.visitbusan.net",
  "lh3.googleusercontent.com",
  "maps.googleapis.com",
];

export function isSafeImageUrl(raw: string | null | undefined): boolean {
  if (!raw || typeof raw !== "string") return false;
  const trimmed = raw.trim();
  if (!trimmed) return false;

  // Allow same-origin relative URLs (e.g. "/images/foo.jpg") for static assets
  if (trimmed.startsWith("/") && !trimmed.startsWith("//")) return true;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;

  const host = parsed.hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((suffix) =>
    suffix.startsWith(".") ? host.endsWith(suffix) : host === suffix
  );
}

/**
 * Returns the URL if it's safe, otherwise undefined. Use this when feeding URLs
 * straight into `style={{ backgroundImage: \`url('${...}')\` }}`.
 */
export function safeImageUrl(raw: string | null | undefined): string | undefined {
  return isSafeImageUrl(raw) ? raw!.trim() : undefined;
}

/**
 * Returns a CSS `url('...')` value if safe, otherwise `none`.
 */
export function safeCssBackgroundUrl(raw: string | null | undefined): string {
  const ok = safeImageUrl(raw);
  if (!ok) return "none";
  // Escape any single quotes / closing parens that could break out of url('')
  const escaped = ok.replace(/['")\\]/g, (c) => "\\" + c);
  return `url('${escaped}')`;
}
