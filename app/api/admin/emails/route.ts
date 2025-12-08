import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * GET /api/admin/emails
 * 获取所有收到的邮件（仅管理员）
 */
async function getEmails(req: NextRequest, user: any) {
  try {
    // 检查是否为管理员
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const supabase = createServerClient();
    const searchParams = req.nextUrl.searchParams;
    
    // 查询参数
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const offset = (page - 1) * limit;
    const category = searchParams.get('category');
    const isRead = searchParams.get('is_read');
    const search = searchParams.get('search');
    const sortBy = searchParams.get('sort_by') || 'received_at';
    const sortOrder = searchParams.get('sort_order') || 'desc';
    
    // 构建查询
    let query = supabase
      .from('received_emails')
      .select('*', { count: 'exact' });
    
    // 过滤条件
    if (category && category !== 'all') {
      query = query.eq('category', category);
    }
    
    if (isRead !== null) {
      query = query.eq('is_read', isRead === 'true');
    }
    
    if (search) {
      query = query.or(`subject.ilike.%${search}%,from_email.ilike.%${search}%,text_content.ilike.%${search}%`);
    }
    
    // 排序
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    // 分页
    query = query.range(offset, offset + limit - 1);
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Error fetching emails:', error);
      return NextResponse.json(
        { error: 'Failed to fetch emails', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      emails: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        total_pages: Math.ceil((count || 0) / limit),
      },
    });
  } catch (error: any) {
    console.error('Get emails error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/admin/emails
 * 更新邮件状态（标记已读、归档等）
 */
async function updateEmail(req: NextRequest, user: any) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const { email_id, updates } = await req.json();
    
    if (!email_id) {
      return NextResponse.json(
        { error: 'email_id is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('received_emails')
      .update(updates)
      .eq('id', email_id)
      .select()
      .single();
    
    if (error) {
      console.error('Error updating email:', error);
      return NextResponse.json(
        { error: 'Failed to update email', details: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      success: true,
      email: data,
    });
  } catch (error: any) {
    console.error('Update email error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getEmails, ['admin']);
export const PATCH = withAuth(updateEmail, ['admin']);

