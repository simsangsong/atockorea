/**
 * Unified inbox (spec §E-4 / §8.3) — pure normalization + merge helpers.
 *
 * The inbox folds three sources into one stream: contact form submissions
 * (`contact_inquiries`), inbound email (`received_emails`), and escalated
 * chatbot support tickets (`support_tickets`). A DB view (§K-7.5) would be the
 * tidy way, but that is a DDL gate; instead the API route queries each source
 * with keyset pagination and merges here. Keeping the merge pure makes the
 * ordering/cursor logic unit-testable without a database.
 */

export type InboxSource = 'contact' | 'email' | 'ticket';

export type InboxItem = {
  source: InboxSource;
  id: string;
  /** Stable cross-source key (source disambiguates the bigint vs uuid ids). */
  ref: string;
  contactName: string | null;
  contactEmail: string | null;
  title: string;
  preview: string;
  body: string;
  category: string | null;
  status: string;
  unread: boolean;
  bookingRef: string | null;
  createdAt: string;
  /** Deep link to the source page where the item can be actioned/replied. */
  sourceHref: string;
};

export const INBOX_SOURCE_LABEL: Record<InboxSource, string> = {
  contact: '문의',
  email: '메일',
  ticket: '티켓',
};

function truncate(s: string | null | undefined, n: number): string {
  const v = (s ?? '').replace(/\s+/g, ' ').trim();
  return v.length > n ? `${v.slice(0, n)}…` : v;
}

export type ContactRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  subject: string | null;
  message: string | null;
  booking_reference: string | null;
  status: string | null;
  is_read: boolean | null;
  created_at: string;
};

export type EmailRow = {
  id: string;
  from_name: string | null;
  from_email: string | null;
  subject: string | null;
  text_content: string | null;
  category: string | null;
  is_read: boolean | null;
  is_archived: boolean | null;
  related_booking_id: string | null;
  received_at: string;
};

export type TicketRow = {
  id: number | string;
  initial_summary: string | null;
  initial_user_message: string | null;
  escalation_reason: string | null;
  tour_slug: string | null;
  status: string | null;
  unread_for_admin: boolean | null;
  created_at: string;
};

export function normalizeContact(r: ContactRow): InboxItem {
  return {
    source: 'contact',
    id: r.id,
    ref: `contact:${r.id}`,
    contactName: r.full_name ?? null,
    contactEmail: r.email ?? null,
    title: r.subject?.trim() || '(제목 없음)',
    preview: truncate(r.message, 140),
    body: r.message ?? '',
    category: null,
    status: r.status || 'new',
    unread: r.is_read === false,
    bookingRef: r.booking_reference ?? null,
    createdAt: r.created_at,
    sourceHref: '/admin/contacts',
  };
}

export function normalizeEmail(r: EmailRow): InboxItem {
  return {
    source: 'email',
    id: r.id,
    ref: `email:${r.id}`,
    contactName: r.from_name?.trim() || r.from_email || null,
    contactEmail: r.from_email ?? null,
    title: r.subject?.trim() || '(제목 없음)',
    preview: truncate(r.text_content, 140),
    body: r.text_content ?? '',
    category: r.category ?? null,
    status: r.is_archived ? 'archived' : 'open',
    unread: r.is_read === false,
    bookingRef: r.related_booking_id ?? null,
    createdAt: r.received_at,
    sourceHref: '/admin/emails',
  };
}

export function normalizeTicket(r: TicketRow): InboxItem {
  return {
    source: 'ticket',
    id: String(r.id),
    ref: `ticket:${r.id}`,
    contactName: null,
    contactEmail: null,
    title: r.initial_summary?.trim() || '지원 티켓',
    preview: truncate(r.initial_user_message, 140),
    body: r.initial_user_message ?? '',
    category: r.escalation_reason ?? null,
    status: r.status || 'open',
    unread: r.unread_for_admin === true,
    bookingRef: r.tour_slug ?? null,
    createdAt: r.created_at,
    sourceHref: '/admin/support',
  };
}

/**
 * Merge already-sorted per-source slices into one descending stream and apply a
 * keyset cursor. Each input group must hold at most `limit + 1` rows (the newest
 * for that source, optionally older than the cursor); taking the global newest
 * `limit` of the union is then correct. `nextCursor` is the createdAt of the
 * last returned row when more remain.
 */
export function mergeInbox(
  groups: InboxItem[][],
  limit: number,
): { items: InboxItem[]; nextCursor: string | null } {
  const flat = groups.flat().sort((a, b) => {
    const d = new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    return d !== 0 ? d : b.ref.localeCompare(a.ref);
  });
  const hasMore = flat.length > limit;
  const items = flat.slice(0, limit);
  const nextCursor = hasMore && items.length > 0 ? items[items.length - 1].createdAt : null;
  return { items, nextCursor };
}

/** Strip characters that would break a PostgREST `.or()` filter, then bound length. */
export function sanitizeSearch(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw.replace(/[,()%'"\\]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return cleaned.length > 0 ? cleaned : null;
}
