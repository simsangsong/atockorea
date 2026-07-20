/**
 * Small pure helpers for rendering a room message on any surface (guest feed,
 * operator cockpit). Kept dependency-free so both the client bubbles and tests
 * can read attachment/translation state without duplicating the metadata shape.
 */

/** Minimal shape a message needs for these reads (client `RoomMessage` satisfies it). */
interface MessageLike {
  input_kind?: string;
  source_text?: string;
  metadata?: Record<string, unknown> | null;
}

export interface ViewAttachment {
  kind: 'image' | 'file';
  url: string;
  name: string;
  size?: number;
  mime?: string;
}

/**
 * The image/file attachment on a message, or null. Mirrors the shape the
 * messages route writes (`metadata.attachment` + `input_kind` image|file).
 */
export function readMessageAttachment(message: MessageLike): ViewAttachment | null {
  const att = (message.metadata as { attachment?: { url?: string; name?: string; size?: number; mime?: string } } | null)
    ?.attachment;
  if (!att || typeof att.url !== 'string' || !att.url) return null;
  if (message.input_kind === 'image') {
    return { kind: 'image', url: att.url, name: att.name ?? '', size: att.size, mime: att.mime };
  }
  if (message.input_kind === 'file') {
    return { kind: 'file', url: att.url, name: att.name ?? 'file', size: att.size, mime: att.mime };
  }
  return null;
}

/**
 * True when the message was published during a translation-provider outage
 * (R-6): the original shipped immediately with `translation_status='pending'`
 * and empty translations. A viewer with connectivity asks the server to
 * re-translate it; the repaired row rebroadcasts to everyone.
 */
export function isTranslationPending(message: MessageLike): boolean {
  return (message.metadata as { translation_status?: string } | null)?.translation_status === 'pending';
}

/** Human byte size for a file chip (e.g. "2.4 MB"). Empty for unknown/zero. */
export function formatAttachmentBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.max(1, Math.round(kb))} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}
