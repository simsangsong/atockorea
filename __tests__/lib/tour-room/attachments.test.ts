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
  function fakeStorage(): { client: StorageClientLike; uploads: Array<{ path: string; mime: string }> } {
    const uploads: Array<{ path: string; mime: string }> = [];
    const client: StorageClientLike = {
      storage: {
        listBuckets: async () => ({ data: [{ name: 'tour-room-photos' }] }),
        createBucket: async () => ({ error: null }),
        from: () => ({
          upload: async (path: string, _body: Buffer, options: Record<string, unknown>) => {
            uploads.push({ path, mime: String(options.contentType) });
            return { error: null };
          },
          getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.test/${path}` } }),
        }),
      },
    };
    return { client, uploads };
  }

  it('uploads under an att/{room}/uuid path and returns public metadata', async () => {
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
    expect(meta).toMatchObject({ url: expect.stringContaining('https://cdn.test/att/room-1/'), mime: 'image/png', name: 'photo.png', size: 2 });
  });

  it('throws when the storage upload errors', async () => {
    const client: StorageClientLike = {
      storage: {
        listBuckets: async () => ({ data: [{ name: 'tour-room-photos' }] }),
        createBucket: async () => ({ error: null }),
        from: () => ({
          upload: async () => ({ error: { message: 'boom' } }),
          getPublicUrl: () => ({ data: { publicUrl: '' } }),
        }),
      },
    };
    await expect(
      uploadAttachment(client, 'room-1', { bytes: Buffer.from('x'), type: 'image/png', name: 'x.png', size: 1 }, 'png'),
    ).rejects.toThrow();
  });
});
