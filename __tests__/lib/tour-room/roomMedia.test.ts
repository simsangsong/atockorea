/**
 * Room media privacy — the signing layer that replaced public object URLs.
 *
 * These tests exist because the failure mode of this feature is silence. An
 * unhydrated exit does not throw: it renders a broken image, or returns an
 * empty array, and both look exactly like "the guest didn't send a photo".
 */

import {
  ROOM_AUDIO_BUCKET,
  ROOM_PHOTOS_BUCKET,
  attachmentPath,
  collectMessageAudioPaths,
  collectMessagePhotoPaths,
  dispatchQrPath,
  ensureRoomPhotosBucket,
  hydrateMessageMedia,
  hydrateOneMessageMedia,
  resolveSpotAudioUrl,
  resolveStoragePath,
  signRoomMedia,
  signRoomMediaBatch,
  storagePathFromPublicUrl,
  visionPhotoPath,
  type RoomMediaStorageClient,
} from '@/lib/tour-room/roomMedia';

interface Fake {
  client: RoomMediaStorageClient;
  created: Array<{ name: string; options: Record<string, unknown> }>;
  batchCalls: Array<{ bucket: string; paths: string[]; ttl: number }>;
  singleCalls: Array<{ bucket: string; path: string; ttl: number }>;
}

function fake(
  options: {
    buckets?: string[];
    batch?: boolean;
    /** Paths that fail to sign (fail-soft path). */
    unsignable?: string[];
    throwOnSign?: boolean;
  } = {},
): Fake {
  const { buckets = [ROOM_PHOTOS_BUCKET, ROOM_AUDIO_BUCKET], batch = true, unsignable = [] } = options;
  const created: Fake['created'] = [];
  const batchCalls: Fake['batchCalls'] = [];
  const singleCalls: Fake['singleCalls'] = [];

  const client: RoomMediaStorageClient = {
    storage: {
      listBuckets: async () => ({ data: buckets.map((name) => ({ name })) }),
      createBucket: async (name, opts) => {
        created.push({ name, options: opts });
        return { error: null };
      },
      from: (bucket: string) => ({
        upload: async () => ({ error: null }),
        createSignedUrl: async (path: string, ttl: number) => {
          singleCalls.push({ bucket, path, ttl });
          if (options.throwOnSign) throw new Error('storage down');
          if (unsignable.includes(path)) return { data: null, error: { message: 'no' } };
          return { data: { signedUrl: `https://sig.test/${bucket}/${path}?exp=${ttl}` }, error: null };
        },
        ...(batch
          ? {
              createSignedUrls: async (paths: string[], ttl: number) => {
                batchCalls.push({ bucket, paths, ttl });
                return {
                  data: paths.map((path) =>
                    unsignable.includes(path)
                      ? { path, signedUrl: null, error: 'no' }
                      : { path, signedUrl: `https://sig.test/${bucket}/${path}?exp=${ttl}` },
                  ),
                  error: null,
                };
              },
            }
          : {}),
      }),
    },
  };
  return { client, created, batchCalls, singleCalls };
}

describe('bucket creation is private by contract', () => {
  it('creates a missing bucket with public:false', async () => {
    const f = fake({ buckets: [] });
    await ensureRoomPhotosBucket(f.client);
    expect(f.created).toEqual([
      { name: ROOM_PHOTOS_BUCKET, options: expect.objectContaining({ public: false }) },
    ]);
  });

  it('does not recreate an existing bucket', async () => {
    const f = fake();
    await ensureRoomPhotosBucket(f.client);
    expect(f.created).toHaveLength(0);
  });
});

describe('path resolution across three storage eras', () => {
  it('recovers the path from a legacy absolute public URL (so no backfill is needed)', () => {
    expect(
      storagePathFromPublicUrl(
        'https://x.supabase.co/storage/v1/object/public/tour-room-photos/att/r1/a.png',
        ROOM_PHOTOS_BUCKET,
      ),
    ).toBe('att/r1/a.png');
  });

  it('percent-decodes and drops the query string', () => {
    expect(
      storagePathFromPublicUrl(
        'https://x/storage/v1/object/public/tour-room-photos/att/r1/a%20b.png?t=1',
        ROOM_PHOTOS_BUCKET,
      ),
    ).toBe('att/r1/a b.png');
  });

  it('returns null for a URL that is not ours — signing it would 404 with a valid signature', () => {
    expect(storagePathFromPublicUrl('https://elsewhere.example/a.png', ROOM_PHOTOS_BUCKET)).toBeNull();
    expect(resolveStoragePath('https://elsewhere.example/a.png', ROOM_PHOTOS_BUCKET)).toBeNull();
  });

  it('accepts a bare relative path and strips leading slashes', () => {
    expect(resolveStoragePath('/att/r1/a.png', ROOM_PHOTOS_BUCKET)).toBe('att/r1/a.png');
    expect(resolveStoragePath('  ', ROOM_PHOTOS_BUCKET)).toBeNull();
    expect(resolveStoragePath(null, ROOM_PHOTOS_BUCKET)).toBeNull();
  });
});

describe('signing', () => {
  it('signs one path with the requested TTL', async () => {
    const f = fake();
    const url = await signRoomMedia(f.client, ROOM_PHOTOS_BUCKET, 'att/r1/a.png', 60);
    expect(url).toBe('https://sig.test/tour-room-photos/att/r1/a.png?exp=60');
    expect(f.singleCalls).toEqual([{ bucket: ROOM_PHOTOS_BUCKET, path: 'att/r1/a.png', ttl: 60 }]);
  });

  it('returns null rather than throwing when storage is down (fail-soft)', async () => {
    const f = fake({ throwOnSign: true });
    await expect(signRoomMedia(f.client, ROOM_PHOTOS_BUCKET, 'att/r1/a.png')).resolves.toBeNull();
  });

  it('batches a whole page into one round trip and de-duplicates', async () => {
    const f = fake();
    const map = await signRoomMediaBatch(f.client, ROOM_PHOTOS_BUCKET, [
      'att/r1/a.png',
      'att/r1/b.png',
      'att/r1/a.png',
    ]);
    expect(f.batchCalls).toHaveLength(1);
    expect(f.batchCalls[0].paths).toEqual(['att/r1/a.png', 'att/r1/b.png']);
    expect(map.size).toBe(2);
  });

  it('falls back to per-path signing when the client has no batch method', async () => {
    const f = fake({ batch: false });
    const map = await signRoomMediaBatch(f.client, ROOM_PHOTOS_BUCKET, ['att/r1/a.png', 'att/r1/b.png']);
    expect(f.singleCalls).toHaveLength(2);
    expect(map.size).toBe(2);
  });

  it('survives a client with no storage at all — a send must never fail on signing', async () => {
    const map = await signRoomMediaBatch({} as RoomMediaStorageClient, ROOM_PHOTOS_BUCKET, ['a']);
    expect(map.size).toBe(0);
  });
});

describe('hydrateMessageMedia — every metadata key that can carry media', () => {
  it('signs a chat attachment and leaves the stored path untouched', async () => {
    const f = fake();
    const stored: { id: string; metadata: Record<string, unknown> } = {
      id: 'm1',
      metadata: { attachment: { path: 'att/r1/a.png', mime: 'image/png', name: 'a.png', size: 3 } },
    };
    const [out] = await hydrateMessageMedia(f.client, [stored]);
    expect((out.metadata!.attachment as { url: string }).url).toContain('https://sig.test/');
    expect((out.metadata!.attachment as { path: string }).path).toBe('att/r1/a.png');
    // Never mutate: the same row object is handed to a broadcast AND a
    // response, and a mutation would leak one caller's URL into the other.
    expect((stored.metadata.attachment as { url?: string }).url).toBeUndefined();
  });

  it('signs a legacy absolute-URL attachment without a backfill', async () => {
    const f = fake();
    const [out] = await hydrateMessageMedia(f.client, [
      {
        metadata: {
          attachment: {
            url: 'https://x/storage/v1/object/public/tour-room-photos/att/r1/old.png',
            mime: 'image/png',
            name: 'old.png',
            size: 1,
          },
        },
      },
    ]);
    expect((out.metadata!.attachment as { url: string }).url).toContain('att/r1/old.png');
  });

  it('signs the vision photo into image_url — the Travel Timeline reads that key', async () => {
    const f = fake();
    const [out] = await hydrateMessageMedia(f.client, [
      { metadata: { kind: 'vision_answer', image_path: 'vision/r1/v.jpg' } as Record<string, unknown> },
    ]);
    expect(out.metadata!.image_url).toContain('vision/r1/v.jpg');
  });

  it('signs an expense receipt on a ledger capsule (guest financial data)', async () => {
    const f = fake();
    const [out] = await hydrateMessageMedia(f.client, [
      { metadata: { kind: 'extra_ledger', receipt_photo_url: 'att/r1/receipt.jpg' } },
    ]);
    expect(out.metadata!.receipt_photo_url).toContain('att/r1/receipt.jpg');
    expect(out.metadata!.receipt_photo_url).toContain('sig.test');
  });

  it('signs spot narration audio from the audio bucket, not the photo bucket', async () => {
    const f = fake();
    const [out] = await hydrateMessageMedia(f.client, [
      { metadata: { kind: 'spot_arrival', audio_url: 'tour-content/j1/ko/s1.mp3' } },
    ]);
    expect(out.metadata!.audio_url).toContain(`/${ROOM_AUDIO_BUCKET}/`);
  });

  it('leaves foreign audio URLs alone — signing them would 404', async () => {
    const f = fake();
    const [out] = await hydrateMessageMedia(f.client, [
      { metadata: { kind: 'spot_arrival', audio_url: 'https://elsewhere.example/x.mp3' } },
    ]);
    expect(out.metadata!.audio_url).toBe('https://elsewhere.example/x.mp3');
  });

  it('publishes an empty string, not a stale path, when signing fails', async () => {
    const f = fake({ unsignable: ['att/r1/a.png'] });
    const [out] = await hydrateMessageMedia(f.client, [
      {
        metadata: {
          attachment: { path: 'att/r1/a.png', mime: 'image/png', name: 'a', size: 1 },
        } as Record<string, unknown>,
      },
    ]);
    // Renderers test for a non-empty string, so this degrades to "no
    // attachment" rather than a broken <img> — and the path never leaks.
    expect((out.metadata!.attachment as { url: string }).url).toBe('');
  });

  it('signs photos and audio in a single pass over a mixed batch', async () => {
    const f = fake();
    const out = await hydrateMessageMedia(f.client, [
      { metadata: { attachment: { path: 'att/r1/a.png', mime: 'image/png', name: 'a', size: 1 } } },
      { metadata: { kind: 'spot_arrival', audio_url: 'tour-content/j1/ko/s1.mp3' } },
      { metadata: null },
      {},
    ]);
    expect(out).toHaveLength(4);
    expect(f.batchCalls.map((c) => c.bucket).sort()).toEqual([ROOM_AUDIO_BUCKET, ROOM_PHOTOS_BUCKET]);
  });

  it('is a no-op (and costs zero round trips) for a feed with no media', async () => {
    const f = fake();
    const out = await hydrateMessageMedia(f.client, [{ metadata: { kind: 'text' } }]);
    expect(f.batchCalls).toHaveLength(0);
    expect(f.singleCalls).toHaveLength(0);
    expect(out).toHaveLength(1);
  });

  it('hydrateOneMessageMedia passes null through', async () => {
    const f = fake();
    await expect(hydrateOneMessageMedia(f.client, null)).resolves.toBeNull();
  });
});

describe('collectors see the same keys the hydrator writes', () => {
  const messages = [
    { metadata: { attachment: { path: 'att/r1/a.png' } } },
    { metadata: { image_path: 'vision/r1/v.jpg' } },
    { metadata: { receipt_photo_url: 'att/r1/receipt.jpg' } },
    { metadata: { audio_url: 'tour-content/j1/ko/s1.mp3' } },
    { metadata: { audio_url: 'https://elsewhere.example/x.mp3' } },
  ];

  it('collects every photo key', () => {
    expect(collectMessagePhotoPaths(messages).sort()).toEqual([
      'att/r1/a.png',
      'att/r1/receipt.jpg',
      'vision/r1/v.jpg',
    ]);
  });

  it('collects only audio we own', () => {
    expect(collectMessageAudioPaths(messages)).toEqual(['tour-content/j1/ko/s1.mp3']);
  });
});

describe('resolveSpotAudioUrl — a polymorphic column', () => {
  it('signs a stored path', async () => {
    const f = fake();
    await expect(resolveSpotAudioUrl(f.client, 'tour-content/j1/ko/s1.mp3')).resolves.toContain(
      'sig.test',
    );
  });

  it('passes a foreign host through untouched', async () => {
    const f = fake();
    await expect(resolveSpotAudioUrl(f.client, 'https://cdn.example/x.mp3')).resolves.toBe(
      'https://cdn.example/x.mp3',
    );
  });

  it('signs a legacy public URL into our own bucket', async () => {
    const f = fake();
    await expect(
      resolveSpotAudioUrl(f.client, 'https://x/storage/v1/object/public/tour-audio/a/b.mp3'),
    ).resolves.toContain('a/b.mp3');
  });

  it('is null for empty input', async () => {
    const f = fake();
    await expect(resolveSpotAudioUrl(f.client, null)).resolves.toBeNull();
  });
});

describe('object paths are unguessable', () => {
  it('attachment and vision paths carry a UUID', () => {
    expect(attachmentPath('r1', 'png')).toMatch(/^att\/r1\/[0-9a-f-]{36}\.png$/);
    expect(visionPhotoPath('r1', 'jpg')).toMatch(/^vision\/r1\/[0-9a-f-]{36}\.jpg$/);
  });

  it('rejects a hostile extension instead of writing it into the path', () => {
    expect(attachmentPath('r1', '../../etc')).toMatch(/\.bin$/);
    expect(visionPhotoPath('r1', 'a/b')).toMatch(/\.jpg$/);
  });

  /**
   * The old QR path was `{tourId}-{tourDate}-{Date.now()}.png` — every part
   * either known or a millisecond inside a known day, on an object that encodes
   * a guide capability link.
   */
  it('QR paths carry a UUID rather than a timestamp', () => {
    const path = dispatchQrPath('tour-1', '2026-08-01');
    expect(path).toMatch(/^qr\/tour-1-2026-08-01-[0-9a-f-]{36}\.png$/);
    expect(path).not.toMatch(/\d{13}/);
  });
});
