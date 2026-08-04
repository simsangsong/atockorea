/**
 * §5-4 (2026-08-04) — link previews for room chat, the safe subset.
 *
 * The server fetches a guest-posted URL, so this is a textbook SSRF surface —
 * the same class the push-endpoint allowlist guards (a URL the server will
 * dereference must be constrained BEFORE it is touched). The guard here is
 * deny-by-class, not allow-by-list, because chat links are the open web:
 *   - https only, default port only
 *   - no IP-literal hosts (v4 or v6), no localhost / .local / .internal /
 *     .lan — the obvious rebinding-free classes
 * DNS-rebinding-grade pinning is documented as out of scope: the fetch runs
 * from serverless egress, and the response is parsed for three strings and
 * discarded — never proxied back raw.
 *
 * The preview is TEXT ONLY (title · description · host). og:image is
 * deliberately dropped: hotlinking third-party images into every guest's
 * feed is a tracking beacon we do not send (같은 이유로 §5-2 공유도 텍스트만).
 */

export interface LinkPreviewData {
  url: string;
  host: string;
  title: string | null;
  description: string | null;
}

export function isSafePreviewUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:') return false;
  if (url.port && url.port !== '443') return false;
  const host = url.hostname.toLowerCase();
  if (!host || host === 'localhost') return false;
  if (host.endsWith('.local') || host.endsWith('.internal') || host.endsWith('.lan')) return false;
  // IP literals, v4 and (bracketed) v6.
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return false;
  if (host.includes(':') || host.startsWith('[')) return false;
  if (!host.includes('.')) return false;
  return true;
}

const META_RE = /<meta[^>]+(?:property|name)=["'](og:title|og:description|twitter:title|twitter:description)["'][^>]*>/gi;
const CONTENT_RE = /content=["']([^"']*)["']/i;

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x?[0-9a-fA-F]+;/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .trim();
}

/** Parse the interesting strings out of (the first slice of) an HTML page. */
export function parsePreviewHtml(url: string, html: string): LinkPreviewData {
  const host = new URL(url).hostname.replace(/^www\./, '');
  let title: string | null = null;
  let description: string | null = null;
  for (const m of html.matchAll(META_RE)) {
    const key = m[1].toLowerCase();
    const content = m[0].match(CONTENT_RE)?.[1];
    if (!content) continue;
    if (!title && (key === 'og:title' || key === 'twitter:title')) title = decodeEntities(content);
    if (!description && (key === 'og:description' || key === 'twitter:description')) description = decodeEntities(content);
  }
  if (!title) {
    const t = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1];
    if (t) title = decodeEntities(t);
  }
  return {
    url,
    host,
    title: title ? title.slice(0, 120) : null,
    description: description ? description.slice(0, 200) : null,
  };
}

/** First http(s) URL inside a chat message, if any. */
export function firstUrlIn(text: string): string | null {
  const m = text.match(/https?:\/\/[^\s<>"')\]]+/);
  return m ? m[0] : null;
}
