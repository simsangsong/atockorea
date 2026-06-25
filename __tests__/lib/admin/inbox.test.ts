import {
  mergeInbox,
  normalizeContact,
  normalizeEmail,
  normalizeTicket,
  sanitizeSearch,
  type InboxItem,
} from '@/lib/admin/inbox';

describe('inbox normalizers (§E-4)', () => {
  it('normalizes a contact inquiry, unread when is_read=false', () => {
    const item = normalizeContact({
      id: 'c1',
      full_name: '홍길동',
      email: 'h@x.com',
      subject: '환불 문의',
      message: 'a'.repeat(300),
      booking_reference: 'ATK-1',
      status: 'new',
      is_read: false,
      created_at: '2026-06-25T01:00:00Z',
    });
    expect(item).toMatchObject({
      source: 'contact',
      ref: 'contact:c1',
      title: '환불 문의',
      unread: true,
      bookingRef: 'ATK-1',
      sourceHref: '/admin/contacts',
    });
    expect(item.preview.endsWith('…')).toBe(true);
    expect(item.preview.length).toBeLessThanOrEqual(141);
  });

  it('email maps from_name/received_at and archived status; read when is_read=true', () => {
    const item = normalizeEmail({
      id: 'e1',
      from_name: 'Jane',
      from_email: 'jane@x.com',
      subject: 'Hi',
      text_content: 'hello',
      category: 'inquiry',
      is_read: true,
      is_archived: true,
      related_booking_id: 'b-9',
      received_at: '2026-06-25T02:00:00Z',
    });
    expect(item).toMatchObject({
      source: 'email',
      contactName: 'Jane',
      category: 'inquiry',
      status: 'archived',
      unread: false,
      bookingRef: 'b-9',
      createdAt: '2026-06-25T02:00:00Z',
    });
  });

  it('ticket stringifies bigint id and is unread when unread_for_admin=true', () => {
    const item = normalizeTicket({
      id: 42,
      initial_summary: null,
      initial_user_message: 'help me',
      escalation_reason: 'angry',
      tour_slug: 'busan-day',
      status: 'open',
      unread_for_admin: true,
      created_at: '2026-06-25T03:00:00Z',
    });
    expect(item).toMatchObject({
      source: 'ticket',
      id: '42',
      ref: 'ticket:42',
      title: '지원 티켓', // falls back when summary is null
      category: 'angry',
      unread: true,
    });
  });
});

describe('mergeInbox (keyset)', () => {
  const mk = (ref: string, createdAt: string): InboxItem => ({
    source: 'contact',
    id: ref,
    ref,
    contactName: null,
    contactEmail: null,
    title: ref,
    preview: '',
    body: '',
    category: null,
    status: 'new',
    unread: false,
    bookingRef: null,
    createdAt,
    sourceHref: '/admin/contacts',
  });

  it('interleaves sources by createdAt desc', () => {
    const contacts = [mk('c', '2026-06-25T05:00:00Z'), mk('c2', '2026-06-25T01:00:00Z')];
    const emails = [mk('e', '2026-06-25T04:00:00Z')];
    const tickets = [mk('t', '2026-06-25T03:00:00Z')];
    const { items, nextCursor } = mergeInbox([contacts, emails, tickets], 10);
    expect(items.map((i) => i.ref)).toEqual(['c', 'e', 't', 'c2']);
    expect(nextCursor).toBeNull(); // 4 ≤ limit 10
  });

  it('caps at limit and emits nextCursor of the last returned row', () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      mk(`r${i}`, `2026-06-25T0${5 - i}:00:00Z`),
    );
    const { items, nextCursor } = mergeInbox([rows], 3);
    expect(items.map((i) => i.ref)).toEqual(['r0', 'r1', 'r2']);
    expect(nextCursor).toBe('2026-06-25T03:00:00Z');
  });
});

describe('sanitizeSearch', () => {
  it('strips PostgREST-breaking chars and bounds length', () => {
    expect(sanitizeSearch("a,b(c)%d'e")).toBe('a b c  d e'.replace(/\s+/g, ' '));
    expect(sanitizeSearch('   ')).toBeNull();
    expect(sanitizeSearch(null)).toBeNull();
    expect((sanitizeSearch('x'.repeat(500)) ?? '').length).toBe(120);
  });
});
