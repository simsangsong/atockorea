import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * GET /api/admin/emails/[id]
 * 获取单封邮件的详细信息
 */
async function getEmail(req: NextRequest, user: any) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const emailId = req.nextUrl.pathname.split('/').pop();
    
    if (!emailId) {
      return NextResponse.json(
        { error: 'Email ID is required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    
    const { data, error } = await supabase
      .from('received_emails')
      .select('*')
      .eq('id', emailId)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { error: 'Email not found' },
          { status: 404 }
        );
      }
      console.error('Error fetching email:', error);
      return NextResponse.json(
        { error: 'Failed to fetch email', details: error.message },
        { status: 500 }
      );
    }
    
    // 标记为已读
    if (!data.is_read) {
      await supabase
        .from('received_emails')
        .update({ is_read: true })
        .eq('id', emailId);
    }
    
    return NextResponse.json({ email: data });
  } catch (error: any) {
    console.error('Get email error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const GET = withAuth(getEmail, ['admin']);

