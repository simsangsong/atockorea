/**
 * TIER 0 (real-world fit) — message-view helpers shared by the guest feed and
 * the operator cockpit: attachment parsing, translation-pending detection, and
 * the file-size label.
 */
import {
  readMessageAttachment,
  isTranslationPending,
  formatAttachmentBytes,
} from '@/lib/tour-room/messageView';

describe('readMessageAttachment', () => {
  it('returns an image attachment for an input_kind=image message', () => {
    const att = readMessageAttachment({
      input_kind: 'image',
      metadata: { attachment: { url: 'https://x/att/a.jpg', name: 'menu.jpg', size: 2048, mime: 'image/jpeg' } },
    });
    expect(att).toEqual({ kind: 'image', url: 'https://x/att/a.jpg', name: 'menu.jpg', size: 2048, mime: 'image/jpeg' });
  });

  it('returns a file attachment for an input_kind=file message', () => {
    const att = readMessageAttachment({
      input_kind: 'file',
      metadata: { attachment: { url: 'https://x/att/a.pdf', name: 'ticket.pdf', size: 99 } },
    });
    expect(att?.kind).toBe('file');
    expect(att?.name).toBe('ticket.pdf');
  });

  it('names a caption-less image so it never renders empty', () => {
    const att = readMessageAttachment({
      input_kind: 'image',
      metadata: { attachment: { url: 'https://x/att/a.jpg' } },
    });
    expect(att).toEqual({ kind: 'image', url: 'https://x/att/a.jpg', name: '', size: undefined, mime: undefined });
  });

  it('returns null for a plain text message or a missing/blank url', () => {
    expect(readMessageAttachment({ input_kind: 'text', source_text: 'hi', metadata: {} })).toBeNull();
    expect(readMessageAttachment({ input_kind: 'image', metadata: { attachment: { url: '' } } })).toBeNull();
    expect(readMessageAttachment({ input_kind: 'image', metadata: null })).toBeNull();
  });
});

describe('isTranslationPending', () => {
  it('is true only when the outage marker is set', () => {
    expect(isTranslationPending({ metadata: { translation_status: 'pending' } })).toBe(true);
    expect(isTranslationPending({ metadata: { translation_status: 'done' } })).toBe(false);
    expect(isTranslationPending({ metadata: {} })).toBe(false);
    expect(isTranslationPending({ metadata: null })).toBe(false);
  });
});

describe('formatAttachmentBytes', () => {
  it('formats KB and MB, and blanks unknown/zero', () => {
    expect(formatAttachmentBytes(2048)).toBe('2 KB');
    expect(formatAttachmentBytes(5 * 1024 * 1024)).toBe('5.0 MB');
    expect(formatAttachmentBytes(0)).toBe('');
    expect(formatAttachmentBytes(undefined)).toBe('');
  });
});
