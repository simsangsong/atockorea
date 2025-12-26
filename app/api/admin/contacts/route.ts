import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/admin/contacts
 * Get contact inquiries (admin only)
 */
async function getContacts(req: NextRequest, user: any) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    const { searchParams } = new URL(req.url);

    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const isRead = searchParams.get('is_read');
    const search = searchParams.get('search');

    let query = supabase
      .from('contact_inquiries')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (isRead && isRead !== 'all') {
      query = query.eq('is_read', isRead === 'true');
    }

    if (search) {
      query = query.or(`full_name.ilike.%${search}%,email.ilike.%${search}%,subject.ilike.%${search}%`);
    }

    // Apply pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;

    query = query
      .order('created_at', { ascending: false })
      .range(from, to);

    const { data: inquiries, error, count } = await query;

    if (error) {
      console.error('Error fetching contact inquiries:', error);
      return NextResponse.json(
        { error: 'Failed to fetch contact inquiries', details: error.message },
        { status: 500 }
      );
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / limit);

    return NextResponse.json({
      inquiries: inquiries || [],
      pagination: {
        page,
        limit,
        total,
        total_pages: totalPages,
      },
    });
  } catch (error: any) {
    console.error('Get contacts error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/contacts
 * Update contact inquiry (admin only)
 */
async function updateContact(req: NextRequest, user: any) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { inquiry_id, updates } = body;

    if (!inquiry_id || !updates) {
      return NextResponse.json(
        { error: 'inquiry_id and updates are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();

    const { data, error } = await supabase
      .from('contact_inquiries')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', inquiry_id)
      .select()
      .single();

    if (error) {
      console.error('Error updating contact inquiry:', error);
      return NextResponse.json(
        { error: 'Failed to update contact inquiry', details: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ inquiry: data });
  } catch (error: any) {
    console.error('Update contact error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getContacts);
export const PATCH = withAuth(updateContact);

