/**
 * Reply/quote snapshot (Kakao-grade chat, Phase 1).
 *
 * A reply stores `reply_to_message_id` (scroll/highlight anchor) AND a small
 * snapshot in `metadata.reply_to` so the quoted preview renders even when the
 * original is windowed out of the feed. The snapshot is built server-side from
 * the real original row (never trusted from the client) so it can't be forged.
 *
 * It stays translation-friendly: `input_kind` + `excerpt` only — the client
 * localizes the "Photo"/"File"/"Voice" label per viewer, and shows the caption/
 * transcript excerpt as-is (the feed can still translate the full original on tap).
 */

export interface ReplySnapshot {
  id: string;
  sender_role: string;
  input_kind: string; // text | audio | image | file
  excerpt: string; // caption / transcript preview (may be '')
  file_name?: string;
}

const EXCERPT_MAX = 90;

export interface RepliableMessage {
  id: string;
  sender_role: string;
  input_kind?: string | null;
  source_text?: string | null;
  metadata?: Record<string, unknown> | null;
}

export function buildReplySnapshot(original: RepliableMessage): ReplySnapshot {
  const inputKind = String(original.input_kind || 'text');
  const attachment = (original.metadata as { attachment?: { name?: string } } | null)?.attachment;
  const excerpt = (original.source_text || '').trim().slice(0, EXCERPT_MAX);
  const snapshot: ReplySnapshot = {
    id: original.id,
    sender_role: original.sender_role,
    input_kind: inputKind,
    excerpt,
  };
  if (inputKind === 'file' && attachment?.name) snapshot.file_name = attachment.name;
  return snapshot;
}
