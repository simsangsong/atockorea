/**
 * Room media IO — the single place that knows tour room photos and audio live
 * in PRIVATE buckets and are read through short-lived signed URLs.
 *
 * Why this exists (OWNER-GATES-FOLLOWUP §④): `tour-room-photos` held guest
 * photos and expense receipts behind nothing but an unguessable UUID path, in
 * a `public=true` bucket with zero `storage.objects` policies. A capability URL
 * in a public bucket is forever — it survives leaving the room, revoking the
 * invite, and deleting the message. The moment real traffic runs, fixing it
 * stops being a code change and becomes an irreversible URL backfill.
 *
 * The contract this module establishes:
 *
 *   stored  →  `metadata.attachment.path`  (bucket-relative storage path)
 *   wire    →  `metadata.attachment.url`   (short-lived signed URL, minted on read)
 *
 * The client contract is UNCHANGED — every renderer still reads `url`. What
 * changes is that the URL now expires and is only ever handed to a caller who
 * passed `resolveRoomActor`. Legacy rows that stored an absolute public URL
 * keep working (`storagePathFromPublicUrl` recovers their path) so no backfill
 * is required.
 *
 * ⚠ Every read exit must hydrate. There are five for messages — GET /messages,
 * the POST response, the `broadcastToRoom` payload, GET /media (the drawer),
 * and `buildRoomSnapshot` — and missing one does not throw: it renders a broken
 * image, or (the drawer) returns an empty array silently. `hydrateMessageMedia`
 * is the one function all five call.
 *
 * Pattern copied from `lib/ops/seating/layoutPhoto.ts` (private bucket + signed
 * URL + fail-soft) rather than reinvented.
 */

/**
 * ⚠ Web Crypto, not `node:crypto`, and that is not a style choice.
 *
 * `buildRoomSnapshot` lives in `lib/tour-room/snapshot.ts`, which a dozen
 * `'use client'` components import for `ROOM_LOCALES` and `normalizeRoomLocale`.
 * Importing `node:crypto` here therefore pulls a node builtin into the guest
 * bundle through a chain nobody would think to look at — the exact trap
 * `lib/ops/seating/layoutPhoto.ts` documents (tsc and jest pass; only the
 * webpack production build breaks). `clientBoundary` caught it, which is the
 * whole reason that gate exists.
 *
 * `crypto.randomUUID()` is a global in Node and in browsers, and these path
 * builders only ever run on the server anyway.
 */
function randomUUID(): string {
  return globalThis.crypto.randomUUID();
}

/** Guest photos, chat attachments, expense receipts, and dispatch QR codes. */
export const ROOM_PHOTOS_BUCKET =
  process.env.SUPABASE_TOUR_ROOM_PHOTOS_BUCKET || 'tour-room-photos';

/** Room TTS mp3s (spoken guest/guide messages) and generated spot narration. */
export const ROOM_AUDIO_BUCKET = process.env.SUPABASE_TOUR_AUDIO_BUCKET || 'tour-audio';

/**
 * Signed-URL lifetime for chat media — 6 hours.
 *
 * Long enough that a guest who scrolls back through a whole day never sees a
 * dead thumbnail, short enough that a URL copied out of the app dies the same
 * day. The feed refetches on every resync, so an expired URL self-heals.
 */
export const ROOM_MEDIA_SIGNED_TTL_SEC = 6 * 60 * 60;

/**
 * Signed-URL lifetime for a dispatch QR — 120 days.
 *
 * ⚠ This one is deliberately different, and the difference is the whole reason
 * `qr/` is split by PATH instead of by bucket. A QR lands in an invite EMAIL,
 * and a mail client fetches that image with no session, possibly months later
 * when the guide reopens the thread. A 6-hour URL would render a broken image
 * in every archived invite. A dedicated public bucket would have worked too but
 * would put the guide's capability link back on the open internet — the exact
 * thing this module exists to stop. A long signed URL keeps the object private
 * and still renders in mail.
 */
export const ROOM_QR_SIGNED_TTL_SEC = 120 * 24 * 60 * 60;

export const MAX_ROOM_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_ROOM_AUDIO_BYTES = 20 * 1024 * 1024;

export interface RoomMediaStorageClient {
  storage: {
    listBuckets(): Promise<{ data: Array<{ name: string }> | null }>;
    createBucket(name: string, options: Record<string, unknown>): Promise<{ error: unknown }>;
    from(bucket: string): {
      upload?(path: string, body: Buffer, options: Record<string, unknown>): Promise<{ error: unknown }>;
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: unknown }>;
      createSignedUrls?(
        paths: string[],
        expiresIn: number,
      ): Promise<{
        data: Array<{ path?: string | null; signedUrl?: string | null; error?: unknown }> | null;
        error: unknown;
      }>;
    };
  };
}

/**
 * Ensure a room bucket exists AND is private.
 *
 * 🔴 The `public` flag here is load-bearing, not cosmetic. Two call sites used
 * to hard-code `{ public: true }`; if the bucket were ever deleted and
 * recreated by whichever route ran first, the privacy setting would silently
 * revert and nothing in the app would notice. Both now route through here.
 *
 * Note this only governs CREATION — an already-public bucket is flipped by the
 * migration, not by app code (app code must never widen access on a hot path).
 */
export async function ensureRoomBucket(
  supabase: RoomMediaStorageClient,
  bucket: string,
  fileSizeLimit: number,
): Promise<string> {
  const { data: buckets } = await supabase.storage.listBuckets();
  if (!buckets?.some((b) => b.name === bucket)) {
    await supabase.storage.createBucket(bucket, { public: false, fileSizeLimit });
  }
  return bucket;
}

export function ensureRoomPhotosBucket(supabase: RoomMediaStorageClient): Promise<string> {
  return ensureRoomBucket(supabase, ROOM_PHOTOS_BUCKET, MAX_ROOM_PHOTO_BYTES);
}

export function ensureRoomAudioBucket(supabase: RoomMediaStorageClient): Promise<string> {
  return ensureRoomBucket(supabase, ROOM_AUDIO_BUCKET, MAX_ROOM_AUDIO_BYTES);
}

/**
 * Recover the bucket-relative path from a legacy absolute public URL.
 *
 * Rows written before this change stored `.../object/public/<bucket>/<path>`.
 * Reading that path back is one regex and removes the need for a backfill —
 * which matters because a backfill of capability URLs is the thing that becomes
 * impossible once real traffic exists.
 */
export function storagePathFromPublicUrl(value: string, bucket: string): string | null {
  if (!value || typeof value !== 'string') return null;
  const marker = `/object/public/${bucket}/`;
  const at = value.indexOf(marker);
  if (at === -1) return null;
  const raw = value.slice(at + marker.length).split('?')[0];
  return raw ? decodeURIComponent(raw) : null;
}

/**
 * The storage path for a stored media reference, whichever era wrote it.
 *
 * Accepts the new `path` form, the legacy absolute-URL form, and a bare
 * relative path (what `tour_guide_spots.audio_url` holds once the admin
 * generator stops storing URLs). Returns null for an external absolute URL —
 * those are somebody else's host and must be passed through untouched.
 */
export function resolveStoragePath(
  value: string | null | undefined,
  bucket: string,
): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return storagePathFromPublicUrl(trimmed, bucket);
  return trimmed.replace(/^\/+/, '');
}

/** Single signed URL. Fail-soft by contract: a dead slot beats a dead page. */
export async function signRoomMedia(
  supabase: RoomMediaStorageClient,
  bucket: string,
  path: string | null | undefined,
  expiresInSec: number = ROOM_MEDIA_SIGNED_TTL_SEC,
): Promise<string | null> {
  if (!path) return null;
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSec);
    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  } catch {
    return null;
  }
}

/**
 * Batch signing — one round trip for a whole page of drawer thumbnails.
 *
 * The drawer asks for 30 attachments at a time; 30 sequential signing calls is
 * 30 round trips on a route that used to be free. `createSignedUrls` does it in
 * one. Falls back to per-path signing when the client shim lacks the batch
 * method (unit-test doubles, older SDKs).
 */
export async function signRoomMediaBatch(
  supabase: RoomMediaStorageClient,
  bucket: string,
  paths: string[],
  expiresInSec: number = ROOM_MEDIA_SIGNED_TTL_SEC,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  const unique = [...new Set(paths.filter(Boolean))];
  if (unique.length === 0) return out;

  /**
   * Fail-soft all the way up to a missing storage client.
   *
   * Hydration runs inside the message send path. A signing problem must never
   * turn into a failed send — a guest losing a message is unrecoverable, a
   * guest seeing an empty photo slot is not, and the feed re-signs on the next
   * refetch anyway.
   */
  const api = supabase?.storage?.from?.(bucket);
  if (!api) return out;
  if (typeof api.createSignedUrls === 'function') {
    try {
      const { data, error } = await api.createSignedUrls(unique, expiresInSec);
      if (!error && Array.isArray(data)) {
        for (const entry of data) {
          if (entry?.path && entry?.signedUrl) out.set(entry.path, entry.signedUrl);
        }
        // A partial batch (some paths errored) still returns rows for the rest;
        // anything missing simply stays unsigned and fails soft downstream.
        return out;
      }
    } catch {
      /* fall through to per-path signing */
    }
  }

  for (const path of unique) {
    const signed = await signRoomMedia(supabase, bucket, path, expiresInSec);
    if (signed) out.set(path, signed);
  }
  return out;
}

/** Chat attachment metadata as it is STORED (path, not URL). */
export interface StoredAttachmentMeta {
  /** Bucket-relative path. Absent only on legacy rows. */
  path?: string;
  /** Legacy absolute public URL, kept readable so no backfill is needed. */
  url?: string;
  mime: string;
  name: string;
  size: number;
}

/** A message row as far as media hydration cares. */
interface MediaMessageLike {
  metadata?: Record<string, unknown> | null;
}

/**
 * 🔴 Every message-metadata key that can carry room media, declared once.
 *
 * This is a LIST rather than a chain of `if`s on purpose. Chat attachments,
 * vision photos, expense receipts and spot narration arrived in four different
 * waves, and each wave added its own key — so the failure mode of this feature
 * is not "the signing is wrong", it is "somebody adds a fifth key and hydration
 * silently doesn't know about it". Adding a key here wires it into all five
 * read exits at once; `roomMediaPrivacy` asserts nothing outside this list
 * writes a media URL onto a message.
 *
 * `readKey` is where the value is STORED, `writeKey` is where the signed URL is
 * published. They differ only where an older wire contract has to be preserved
 * (vision's `image_url`).
 */
const MEDIA_META_KEYS: ReadonlyArray<{
  readKey: string;
  writeKey: string;
  bucket: 'photos' | 'audio';
  /** Legacy key holding an absolute URL from before paths were stored. */
  legacyKey?: string;
}> = [
  // Shared `vision_answer` photo — the Travel Timeline rebuilds the trip recap
  // from these, so it inherits whichever URL hydration published.
  { readKey: 'image_path', writeKey: 'image_url', bucket: 'photos', legacyKey: 'image_url' },
  // Expense receipt copied onto the ledger capsule (guest financial data).
  { readKey: 'receipt_photo_url', writeKey: 'receipt_photo_url', bucket: 'photos' },
  // Spot narration mp3 — may legitimately live on a foreign host, see below.
  { readKey: 'audio_url', writeKey: 'audio_url', bucket: 'audio' },
];

function bucketOf(kind: 'photos' | 'audio'): string {
  return kind === 'photos' ? ROOM_PHOTOS_BUCKET : ROOM_AUDIO_BUCKET;
}

/**
 * Is this value ours to sign?
 *
 * A stored value may be a bucket path (new), an absolute public URL into our
 * bucket (legacy), or an absolute URL on somebody else's host — the last of
 * which must survive hydration untouched, because signing it would produce a
 * URL that looks valid and 404s. `tour_guide_spots.audio_url` is the column
 * where all three genuinely occur.
 */
function ourStoragePath(value: unknown, bucket: string): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) return storagePathFromPublicUrl(trimmed, bucket);
  return trimmed.replace(/^\/+/, '');
}

/** Paths one message references in one bucket, in declaration order. */
function mediaPathsIn(
  meta: Record<string, unknown>,
  kind: 'photos' | 'audio',
): Array<{ writeKey: string; path: string }> {
  const bucket = bucketOf(kind);
  const out: Array<{ writeKey: string; path: string }> = [];

  if (kind === 'photos') {
    const attachment = (meta as { attachment?: StoredAttachmentMeta }).attachment;
    if (attachment && typeof attachment === 'object') {
      const path =
        ourStoragePath(attachment.path, bucket) ?? ourStoragePath(attachment.url, bucket);
      if (path) out.push({ writeKey: 'attachment', path });
    }
  }

  for (const key of MEDIA_META_KEYS) {
    if (key.bucket !== kind) continue;
    const path =
      ourStoragePath(meta[key.readKey], bucket) ??
      (key.legacyKey ? ourStoragePath(meta[key.legacyKey], bucket) : null);
    if (path) out.push({ writeKey: key.writeKey, path });
  }
  return out;
}

/** Room-photo paths referenced by a batch of messages. */
export function collectMessagePhotoPaths(messages: readonly MediaMessageLike[]): string[] {
  return messages.flatMap((m) =>
    m?.metadata && typeof m.metadata === 'object'
      ? mediaPathsIn(m.metadata as Record<string, unknown>, 'photos').map((e) => e.path)
      : [],
  );
}

/** Room-audio paths referenced by a batch of messages (spot narration mp3s). */
export function collectMessageAudioPaths(messages: readonly MediaMessageLike[]): string[] {
  return messages.flatMap((m) =>
    m?.metadata && typeof m.metadata === 'object'
      ? mediaPathsIn(m.metadata as Record<string, unknown>, 'audio').map((e) => e.path)
      : [],
  );
}

/**
 * 🔴 The one function all five read exits call.
 *
 * Returns shallow copies with `metadata.attachment.url` and
 * `metadata.image_url` filled in with freshly signed URLs. Rows are never
 * mutated in place — the same row object can be handed to a broadcast and a
 * response, and a mutation would leak one caller's signed URL into the other.
 *
 * An unsignable path yields `url: ''` rather than a removed key: renderers
 * already test for a non-empty string, so an empty slot degrades to "no
 * attachment" instead of a broken `<img>`.
 */
export async function hydrateMessageMedia<T extends MediaMessageLike>(
  supabase: RoomMediaStorageClient,
  messages: readonly T[],
  expiresInSec: number = ROOM_MEDIA_SIGNED_TTL_SEC,
): Promise<T[]> {
  const list = (messages ?? []) as readonly T[];
  if (list.length === 0) return [];

  const photoPaths = collectMessagePhotoPaths(list);
  const audioPaths = collectMessageAudioPaths(list);
  if (photoPaths.length === 0 && audioPaths.length === 0) return [...list];

  const [signed, signedAudio] = await Promise.all([
    photoPaths.length
      ? signRoomMediaBatch(supabase, ROOM_PHOTOS_BUCKET, photoPaths, expiresInSec)
      : Promise.resolve(new Map<string, string>()),
    audioPaths.length
      ? signRoomMediaBatch(supabase, ROOM_AUDIO_BUCKET, audioPaths, expiresInSec)
      : Promise.resolve(new Map<string, string>()),
  ]);

  return list.map((message) => {
    const raw = message?.metadata;
    if (!raw || typeof raw !== 'object') return message;
    const meta = raw as Record<string, unknown>;

    let nextMeta: Record<string, unknown> | null = null;
    const touch = (): Record<string, unknown> => {
      if (!nextMeta) nextMeta = { ...meta };
      return nextMeta;
    };

    for (const [kind, table] of [
      ['photos', signed],
      ['audio', signedAudio],
    ] as const) {
      for (const { writeKey, path } of mediaPathsIn(meta, kind)) {
        const url = table.get(path) ?? '';
        if (writeKey === 'attachment') {
          const attachment = meta.attachment as StoredAttachmentMeta;
          touch().attachment = { ...attachment, url };
        } else {
          touch()[writeKey] = url;
        }
      }
    }

    if (!nextMeta) return message;
    return { ...message, metadata: nextMeta };
  });
}

/** Hydrate exactly one message (POST response + broadcast payload). */
export async function hydrateOneMessageMedia<T extends MediaMessageLike>(
  supabase: RoomMediaStorageClient,
  message: T | null | undefined,
  expiresInSec: number = ROOM_MEDIA_SIGNED_TTL_SEC,
): Promise<T | null> {
  if (!message) return null;
  const [hydrated] = await hydrateMessageMedia(supabase, [message], expiresInSec);
  return hydrated ?? message;
}

/**
 * Playable URL for a `tour_guide_spots.audio_url` value.
 *
 * That column is polymorphic by history: the admin generator now writes a
 * bucket-relative PATH, older rows could hold an absolute public URL into
 * `tour-audio`, and an operator may paste a URL on somebody else's host. Only
 * the first two are ours to sign; a foreign URL is passed through untouched
 * because signing it would produce a 404 with a valid-looking signature.
 *
 * (Live count today: 11 spots, 0 with audio — so this resolver is defining the
 * contract before there is data to migrate, which is the cheap moment.)
 */
export async function resolveSpotAudioUrl(
  supabase: RoomMediaStorageClient,
  value: string | null | undefined,
  expiresInSec: number = ROOM_MEDIA_SIGNED_TTL_SEC,
): Promise<string | null> {
  if (typeof value !== 'string' || !value.trim()) return null;
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) && !storagePathFromPublicUrl(trimmed, ROOM_AUDIO_BUCKET)) {
    return trimmed;
  }
  const path = resolveStoragePath(trimmed, ROOM_AUDIO_BUCKET);
  return signRoomMedia(supabase, ROOM_AUDIO_BUCKET, path, expiresInSec);
}

/** Unguessable object path for a chat attachment. */
export function attachmentPath(roomId: string, ext: string, id: string = randomUUID()): string {
  const safeExt = /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : 'bin';
  return `att/${roomId}/${id}.${safeExt}`;
}

/** Unguessable object path for a shared vision photo. */
export function visionPhotoPath(roomId: string, ext: string, id: string = randomUUID()): string {
  const safeExt = /^[a-z0-9]{1,5}$/i.test(ext) ? ext.toLowerCase() : 'jpg';
  return `vision/${roomId}/${id}.${safeExt}`;
}

/**
 * Unguessable object path for a dispatch QR.
 *
 * ⚠ The old path was `qr/{tourId}-{tourDate}-{Date.now()}.png`. Every component
 * of that is either known or a millisecond within a known day — an attacker who
 * knows a tour ran on a date can enumerate it, and the object encodes a guide
 * capability link. A UUID removes that entirely, independently of the bucket
 * being private now.
 */
export function dispatchQrPath(
  tourId: string,
  tourDate: string,
  id: string = randomUUID(),
): string {
  return `qr/${tourId}-${tourDate}-${id}.png`;
}
