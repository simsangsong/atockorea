/**
 * Chat attachments (Kakao-grade chat, Phase 1) — classification + upload.
 */
import {
  classifyAttachment,
  uploadAttachment,
  MAX_IMAGE_BYTES,
  MAX_FILE_BYTES,
  type StorageClientLike,
} from '@/lib/tour-room/attachments';

describe('classifyAttachment', () => {
  it('accepts common image mimes and maps the extension', () => {
    expect(classifyAttachment({ type: 'image/jpeg', size: 1000, name: 'a.jpg' })).toEqual({ kind: 'image', ext: 'jpg' });
    expect(classifyAttachment({ type: 'image/png', size: 1000, name: 'x' })).toEqual({ kind: 'image', ext: 'png' });
    expect(classifyAttachment({ type: 'image/webp', size: 1000, name: 'x' })).toEqual({ kind: 'image', ext: 'webp' });
  });

  it('rejects an oversized image', () => {
    expect(classifyAttachment({ type: 'image/jpeg', size: MAX_IMAGE_BYTES + 1, name: 'a.jpg' })).toEqual({
      error: expect.stringContaining('image too large'),
    });
  });

  it('rejects an empty file', () => {
    expect(classifyAttachment({ type: 'image/jpeg', size: 0, name: 'a.jpg' })).toEqual({
      error: expect.stringContaining('empty'),
    });
  });

  it('accepts a whitelisted document by extension', () => {
    expect(classifyAttachment({ type: 'application/pdf', size: 1000, name: 'itinerary.pdf' })).toEqual({
      kind: 'file',
      ext: 'pdf',
    });
    expect(classifyAttachment({ type: '', size: 1000, name: 'notes.docx' })).toEqual({ kind: 'file', ext: 'docx' });
  });

  it('accepts a pdf even when the name lacks an extension (mime fallback)', () => {
    expect(classifyAttachment({ type: 'application/pdf', size: 1000, name: 'download' })).toEqual({
      kind: 'file',
      ext: 'pdf',
    });
  });

  it('rejects an unsupported file type', () => {
    expect(classifyAttachment({ type: 'application/x-msdownload', size: 1000, name: 'virus.exe' })).toEqual({
      error: expect.stringContaining('unsupported'),
    });
  });

  it('rejects an oversized file', () => {
    expect(classifyAttachment({ type: 'application/pdf', size: MAX_FILE_BYTES + 1, name: 'big.pdf' })).toEqual({
      error: expect.stringContaining('file too large'),
    });
  });
});

describe('uploadAttachment', () => {
  function fakeStorage(existingBuckets: string[] = ['tour-room-photos']): {
    client: StorageClientLike;
    uploads: Array<{ path: string; mime: string }>;
    created: Array<{ name: string; options: Record<string, unknown> }>;
  } {
    const uploads: Array<{ path: string; mime: string }> = [];
    const created: Array<{ name: string; options: Record<string, unknown> }> = [];
    const client: StorageClientLike = {
      storage: {
        listBuckets: async () => ({ data: existingBuckets.map((name) => ({ name })) }),
        createBucket: async (name: string, options: Record<string, unknown>) => {
          created.push({ name, options });
          return { error: null };
        },
        from: () => ({
          upload: async (path: string, _body: Buffer, options: Record<string, unknown>) => {
            uploads.push({ path, mime: String(options.contentType) });
            return { error: null };
          },
          createSignedUrl: async () => ({ data: { signedUrl: 'unused' }, error: null }),
        }),
      },
    };
    return { client, uploads, created };
  }

  it('uploads under an att/{room}/uuid path and returns a PATH, never a URL', async () => {
    const { client, uploads } = fakeStorage();
    const meta = await uploadAttachment(
      client,
      'room-1',
      { bytes: Buffer.from('hi'), type: 'image/png', name: 'photo.png', size: 2 },
      'png',
    );
    expect(uploads).toHaveLength(1);
    expect(uploads[0].path).toMatch(/^att\/room-1\/[0-9a-f-]+\.png$/);
    expect(uploads[0].mime).toBe('image/png');
    expect(meta).toMatchObject({
      path: expect.stringMatching(/^att\/room-1\/[0-9a-f-]+\.png$/),
      mime: 'image/png',
      name: 'photo.png',
      size: 2,
    });
    // 🔴 The whole point: an attachment never leaves this function as a URL.
    // A URL here would be a public one, and a public URL to a guest photo
    // outlives the room, the invite, and the message.
    expect(meta).not.toHaveProperty('url');
  });

  it('creates the bucket PRIVATE when it is missing', async () => {
    // Two routes used to hard-code `public: true` here. If the bucket is ever
    // dropped, whichever route runs first decides the privacy setting — so
    // "private" has to be the value in the creation path, not just in the
    // migration that flipped the existing bucket.
    const { client, created } = fakeStorage([]);
    await uploadAttachment(
      client,
      'room-1',
      { bytes: Buffer.from('hi'), type: 'image/png', name: 'photo.png', size: 2 },
      'png',
    );
    expect(created).toHaveLength(1);
    expect(created[0].name).toBe('tour-room-photos');
    expect(created[0].options.public).toBe(false);
  });

  it('throws when the storage upload errors', async () => {
    const client: StorageClientLike = {
      storage: {
        listBuckets: async () => ({ data: [{ name: 'tour-room-photos' }] }),
        createBucket: async () => ({ error: null }),
        from: () => ({
          upload: async () => ({ error: { message: 'boom' } }),
          createSignedUrl: async () => ({ data: null, error: null }),
        }),
      },
    };
    await expect(
      uploadAttachment(client, 'room-1', { bytes: Buffer.from('x'), type: 'image/png', name: 'x.png', size: 1 }, 'png'),
    ).rejects.toThrow();
  });
});
