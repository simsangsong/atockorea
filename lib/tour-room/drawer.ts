/**
 * U4-D5 — the room drawer's "모아보기" (media roundup) plane.
 *
 * The drawer aggregates what already lives in tour_room_messages — image and
 * file attachments (input_kind, Phase-1 kakao foundation) and http(s) links
 * found in plain text — into browseable lists, the way KakaoTalk's room
 * drawer collects 사진/파일/링크. No new tables: the chat IS the source of
 * truth, this module just gives it a second read shape.
 */

export type DrawerKind = 'image' | 'file' | 'link';

export interface DrawerMessageRow {
  id: string;
  created_at: string;
  sender_role: string;
  input_kind: string;
  source_text: string | null;
  metadata: Record<string, unknown> | null;
}

export interface DrawerAttachmentItem {
  id: string;
  created_at: string;
  sender_role: string;
  /**
   * Signed, short-lived. Empty until the route signs it — this module is pure
   * and has no storage client, so it reports `storagePath` and the route mints
   * the URL. Never persist this value.
   */
  url: string;
  /** Bucket-relative path the route signs. Not sent to the client. */
  storagePath: string | null;
  name: string | null;
  mime: string | null;
  size: number | null;
  /** Translated-at-send caption (source_text) — shown under the thumbnail. */
  caption: string | null;
}

export interface DrawerLinkItem {
  id: string;
  created_at: string;
  sender_role: string;
  url: string;
  /** The message text the link appeared in, for context. */
  text: string;
}

/** Markdown-safe, punctuation-trimming URL extraction (first MAX_LINKS_PER_MESSAGE). */
const URL_RE = /https?:\/\/[^\s<>"'）)\]}]+/g;
const MAX_LINKS_PER_MESSAGE = 5;

/** Trailing punctuation that reads as prose, not as part of the URL. */
function trimUrl(raw: string): string {
  return raw.replace(/[.,;:!?…]+$/, '');
}

export function extractLinks(text: string | null | undefined): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const match of text.match(URL_RE) ?? []) {
    const url = trimUrl(match);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    out.push(url);
    if (out.length >= MAX_LINKS_PER_MESSAGE) break;
  }
  return out;
}

interface AttachmentMeta {
  path?: unknown;
  url?: unknown;
  name?: unknown;
  mime?: unknown;
  size?: unknown;
}

/**
 * 🔴 This function is why the drawer is one of the five exits.
 *
 * It used to require a non-empty `metadata.attachment.url` and the route
 * `.filter(Boolean)`s the result — so the day attachments started storing a
 * PATH instead of a URL, the drawer would have returned `[]` forever. No error,
 * no 400, no console warning, and no test would have caught it: an empty photo
 * roundup looks exactly like a room where nobody sent a photo.
 *
 * It now reads `path` first and falls back to the legacy `url`, and reports the
 * path up so the route can sign it.
 */
export function toAttachmentItem(row: DrawerMessageRow): DrawerAttachmentItem | null {
  const meta = (row.metadata?.attachment ?? null) as AttachmentMeta | null;
  if (!meta) return null;
  const path = typeof meta.path === 'string' && meta.path ? meta.path : null;
  const legacyUrl = typeof meta.url === 'string' && meta.url ? meta.url : null;
  if (!path && !legacyUrl) return null;
  return {
    id: row.id,
    created_at: row.created_at,
    sender_role: row.sender_role,
    url: '',
    storagePath: path ?? legacyUrl,
    name: typeof meta.name === 'string' ? meta.name : null,
    mime: typeof meta.mime === 'string' ? meta.mime : null,
    size: typeof meta.size === 'number' ? meta.size : null,
    caption: row.source_text || null,
  };
}

export function toLinkItems(row: DrawerMessageRow): DrawerLinkItem[] {
  return extractLinks(row.source_text).map((url) => ({
    id: row.id,
    created_at: row.created_at,
    sender_role: row.sender_role,
    url,
    text: row.source_text ?? '',
  }));
}
