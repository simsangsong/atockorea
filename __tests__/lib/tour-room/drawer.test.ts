import {
  extractLinks,
  toAttachmentItem,
  toLinkItems,
  type DrawerMessageRow,
} from '@/lib/tour-room/drawer';

function row(overrides: Partial<DrawerMessageRow> = {}): DrawerMessageRow {
  return {
    id: 'm1',
    created_at: '2026-07-26T09:00:00.000Z',
    sender_role: 'guide',
    input_kind: 'text',
    source_text: null,
    metadata: null,
    ...overrides,
  };
}

describe('extractLinks', () => {
  it('finds http and https URLs in prose', () => {
    expect(
      extractLinks('여기 보세요 https://map.kakao.com/link/to/성산일출봉 그리고 http://example.com'),
    ).toEqual(['https://map.kakao.com/link/to/성산일출봉', 'http://example.com']);
  });

  it('trims trailing prose punctuation but keeps URL innards', () => {
    expect(extractLinks('링크: https://example.com/a?b=1&c=2.')).toEqual([
      'https://example.com/a?b=1&c=2',
    ]);
  });

  it('dedupes repeated URLs and caps at five per message', () => {
    const many = Array.from({ length: 8 }, (_, i) => `https://e.com/${i}`).join(' ');
    expect(extractLinks(`${many} https://e.com/0`)).toHaveLength(5);
  });

  it('returns empty for null / linkless text', () => {
    expect(extractLinks(null)).toEqual([]);
    expect(extractLinks('그냥 문장입니다')).toEqual([]);
  });
});

describe('toAttachmentItem', () => {
  it('maps an image row with caption and reports the storage path to sign', () => {
    const item = toAttachmentItem(
      row({
        input_kind: 'image',
        source_text: '오늘 점심!',
        metadata: {
          attachment: {
            path: 'att/room-1/x.webp',
            name: 'lunch.webp',
            mime: 'image/webp',
            size: 1234,
          },
        },
      }),
    );
    expect(item).toMatchObject({
      // Empty until the route signs it — this module is pure and has no
      // storage client. The path is what it hands up.
      url: '',
      storagePath: 'att/room-1/x.webp',
      name: 'lunch.webp',
      mime: 'image/webp',
      size: 1234,
      caption: '오늘 점심!',
    });
  });

  /**
   * 🔴 The regression this test exists for.
   *
   * This function used to require a non-empty `attachment.url`, and the media
   * route `.filter(Boolean)`s its output. The day attachments started storing
   * a PATH, the drawer would have returned `[]` forever — no error, no 400, no
   * console warning. An empty photo roundup is indistinguishable from a room
   * where nobody sent a photo, so nothing would ever have reported it.
   */
  it('reads a path-only attachment (the drawer would silently empty otherwise)', () => {
    const item = toAttachmentItem(
      row({ input_kind: 'image', metadata: { attachment: { path: 'att/room-1/y.png' } } }),
    );
    expect(item).not.toBeNull();
    expect(item?.storagePath).toBe('att/room-1/y.png');
  });

  it('still reads a legacy absolute-URL attachment (no backfill required)', () => {
    const item = toAttachmentItem(
      row({ input_kind: 'image', metadata: { attachment: { url: 'https://cdn/x.webp' } } }),
    );
    expect(item?.storagePath).toBe('https://cdn/x.webp');
  });

  it('returns null when there is neither a path nor a url (never a broken tile)', () => {
    expect(toAttachmentItem(row({ input_kind: 'image', metadata: { attachment: {} } }))).toBeNull();
    expect(toAttachmentItem(row({ input_kind: 'image', metadata: null }))).toBeNull();
  });
});

describe('toLinkItems', () => {
  it('emits one item per URL, carrying the message context', () => {
    const items = toLinkItems(
      row({ source_text: 'A https://a.com and B https://b.com', id: 'm9' }),
    );
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({ id: 'm9', url: 'https://a.com' });
    expect(items[1]).toMatchObject({ url: 'https://b.com', text: 'A https://a.com and B https://b.com' });
  });
});
