/**
 * Chat attachments (Kakao-grade chat, Phase 1).
 *
 * A traveller/guide/driver sends a photo or file as a first-class message
 * (input_kind 'image' | 'file') — distinct from the vision "what is this?" Q&A.
 * Uploads land in the same public `tour-room-photos` bucket under an
 * unguessable UUID path; the object URL is the deliverable (public buckets
 * don't need a signed URL for read, and the UUID path is the gate).
 *
 * Kept tiny and injectable so the messages route stays thin and this is
 * unit-testable without the real Supabase client.
 */

import { randomUUID } from 'node:crypto';

const BUCKET = process.env.SUPABASE_TOUR_ROOM_PHOTOS_BUCKET || 'tour-room-photos';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
export const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20MB

/** Extensions we accept as a generic file attachment (defence in depth: the
 *  UI restricts, the server enforces). Images go through the image path. */
const ALLOWED_FILE_EXTENSIONS = new Set([
  'pdf', 'txt', 'csv', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'hwp', 'zip',
]);

const IMAGE_MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/heic': 'heic',
};

export type AttachmentKind = 'image' | 'file';

export interface AttachmentMeta {
  url: string;
  mime: string;
  name: string;
  size: number;
}

export interface StorageClientLike {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: unknown }>;
    from(bucket: string): {
      upload(path: string, body: Buffer, options: Record<string, unknown>): Promise<{ error: unknown }>;
      getPublicUrl(path: string): { data: { publicUrl: string } };
    };
  };
}

function extensionForFile(name: string, mime: string): string | null {
  const fromName = name.includes('.') ? name.split('.').pop()!.toLowerCase() : '';
  if (fromName && ALLOWED_FILE_EXTENSIONS.has(fromName)) return fromName;
  // A handful of mimes map cleanly even when the name lacks an extension.
  if (mime === 'application/pdf') return 'pdf';
  if (mime === 'text/plain') return 'txt';
  if (mime === 'text/csv') return 'csv';
  return null;
}

/** Validate an incoming attachment. Returns the resolved kind or an error. */
export function classifyAttachment(
  file: { type: string; size: number; name: string },
): { kind: AttachmentKind; ext: string } | { error: string } {
  const mime = (file.type || '').toLowerCase();
  if (file.size === 0) return { error: 'empty file' };
  if (mime.startsWith('image/')) {
    if (file.size > MAX_IMAGE_BYTES) return { error: 'image too large (≤8MB)' };
    return { kind: 'image', ext: IMAGE_MIME_EXT[mime] ?? 'jpg' };
  }
  if (file.size > MAX_FILE_BYTES) return { error: 'file too large (≤20MB)' };
  const ext = extensionForFile(file.name || '', mime);
  if (!ext) return { error: 'unsupported file type' };
  return { kind: 'file', ext };
}

async function ensureBucket(supabase: StorageClientLike): Promise<void> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((bucket) => bucket.name === BUCKET)) {
    await supabase.storage.createBucket(BUCKET, { public: true, fileSizeLimit: MAX_FILE_BYTES });
  }
}

/**
 * Upload one attachment and return its message metadata. Throws only on a real
 * upload failure; callers translate that into a 502-ish response.
 */
export async function uploadAttachment(
  supabase: StorageClientLike,
  roomId: string,
  file: { bytes: Buffer; type: string; name: string; size: number },
  ext: string,
): Promise<AttachmentMeta> {
  await ensureBucket(supabase);
  const path = `att/${roomId}/${randomUUID()}.${ext}`;
  const mime = file.type || 'application/octet-stream';
  const { error } = await supabase.storage.from(BUCKET).upload(path, file.bytes, {
    contentType: mime,
    upsert: false,
  });
  if (error) throw error instanceof Error ? error : new Error('attachment upload failed');
  const url = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
  return { url, mime, name: file.name || `attachment.${ext}`, size: file.size };
}
