import { NextRequest, NextResponse } from 'next/server';
import { AdminAuthFailure, adminAuthJsonResponse, requireAdmin } from '@/lib/auth';
import { createServerClient } from '@/lib/supabase';
import {
  mergeInbox,
  normalizeContact,
  normalizeEmail,
  normalizeTicket,
  sanitizeSearch,
  type InboxItem,
} from '@/lib/admin/inbox';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/inbox — unified inbox over contact_inquiries / received_emails /
 * support_tickets (§E-4 / §8.3). Each source is queried with a keyset cursor and
 * merged in lib/admin/inbox; no DB view (DDL gate) required.
 *
 * Query: source=all|contact|email|ticket · status=all|unread · q=<search> ·
 * cursor=<ISO createdAt> · limit (default 40, max 100). Unread counts are
 * returned only on the first page (no cursor).
 */
async function getInbox(req: NextRequest) {
  try {
    await requireAdmin(req);
    const supabase = createServerClient();
    const sp = req.nextUrl.searchParams;

    const source = sp.get('source') || 'all';
    const status = sp.get('status') || 'all';
    const q = sanitizeSearch(sp.get('q'));
    const cursor = sp.get('cursor');
    let limit = parseInt(sp.get('limit') || '40', 10);
    if (!Number.isFinite(limit)) limit = 40;
    limit = Math.min(Math.max(limit, 1), 100);
    const fetchN = limit + 1;
    const want = (s: string) => source === 'all' || source === s;

    const contactP: Promise<InboxItem[]> = want('contact')
      ? (async () => {
          let query = supabase
            .from('contact_inquiries')
            .select('id,full_name,email,subject,message,booking_reference,status,is_read,created_at')
            .order('created_at', { ascending: false })
            .limit(fetchN);
          if (cursor) query = query.lt('created_at', cursor);
          if (status === 'unread') query = query.eq('is_read', false);
          if (q)
            query = query.or(
              `full_name.ilike.%${q}%,email.ilike.%${q}%,subject.ilike.%${q}%,message.ilike.%${q}%`,
            );
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map(normalizeContact);
        })()
      : Promise.resolve([]);

    const emailP: Promise<InboxItem[]> = want('email')
      ? (async () => {
          let query = supabase
            .from('received_emails')
            .select(
              'id,from_name,from_email,subject,text_content,category,is_read,is_archived,related_booking_id,received_at',
            )
            .not('is_spam', 'is', true)
            .order('received_at', { ascending: false })
            .limit(fetchN);
          if (cursor) query = query.lt('received_at', cursor);
          if (status === 'unread') query = query.eq('is_read', false);
          if (q)
            query = query.or(
              `from_name.ilike.%${q}%,from_email.ilike.%${q}%,subject.ilike.%${q}%,text_content.ilike.%${q}%`,
            );
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map(normalizeEmail);
        })()
      : Promise.resolve([]);

    const ticketP: Promise<InboxItem[]> = want('ticket')
      ? (async () => {
          let query = supabase
            .from('support_tickets')
            .select(
              'id,initial_summary,initial_user_message,escalation_reason,tour_slug,status,unread_for_admin,created_at',
            )
            .order('created_at', { ascending: false })
            .limit(fetchN);
          if (cursor) query = query.lt('created_at', cursor);
          if (status === 'unread') query = query.eq('unread_for_admin', true);
          if (q)
            query = query.or(
              `initial_summary.ilike.%${q}%,initial_user_message.ilike.%${q}%`,
            );
          const { data, error } = await query;
          if (error) throw error;
          return (data ?? []).map(normalizeTicket);
        })()
      : Promise.resolve([]);

    const [contacts, emails, tickets] = await Promise.all([contactP, emailP, ticketP]);
    const { items, nextCursor } = mergeInbox([contacts, emails, tickets], limit);

    let counts: Record<string, number> | undefined;
    if (!cursor) {
      const [cc, ec, tc] = await Promise.all([
        supabase.from('contact_inquiries').select('id', { count: 'exact', head: true }).eq('is_read', false),
        supabase
          .from('received_emails')
          .select('id', { count: 'exact', head: true })
          .not('is_spam', 'is', true)
          .eq('is_read', false),
        supabase.from('support_tickets').select('id', { count: 'exact', head: true }).eq('unread_for_admin', true),
      ]);
      counts = {
        unread: (cc.count ?? 0) + (ec.count ?? 0) + (tc.count ?? 0),
        contact: cc.count ?? 0,
        email: ec.count ?? 0,
        ticket: tc.count ?? 0,
      };
    }

    return NextResponse.json({ items, nextCursor, counts });
  } catch (error: any) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('Inbox GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

/**
 * PATCH /api/admin/inbox — mark an item read/unread, dispatching to the right
 * source table. Body: { source, id, read }.
 */
async function patchInbox(req: NextRequest) {
  try {
    await requireAdmin(req);
    const { source, id, read } = await req.json();
    if (!source || id == null || typeof read !== 'boolean') {
      return NextResponse.json({ error: 'source, id, read are required' }, { status: 400 });
    }
    const supabase = createServerClient();

    if (source === 'contact') {
      const { error } = await supabase
        .from('contact_inquiries')
        .update({ is_read: read, updated_at: new Date().toISOString() })
        .eq('id', String(id));
      if (error) throw error;
    } else if (source === 'email') {
      const { error } = await supabase.from('received_emails').update({ is_read: read }).eq('id', String(id));
      if (error) throw error;
    } else if (source === 'ticket') {
      const { error } = await supabase
        .from('support_tickets')
        .update({ unread_for_admin: !read })
        .eq('id', Number(id));
      if (error) throw error;
    } else {
      return NextResponse.json({ error: 'invalid source' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    if (error instanceof AdminAuthFailure) return adminAuthJsonResponse(error);
    console.error('Inbox PATCH error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export const GET = getInbox;
export const PATCH = patchInbox;
