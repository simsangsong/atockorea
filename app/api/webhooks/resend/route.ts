import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

/** Resend sends from/to as "Name <email@domain.com>" - parse to { name, email } */
function parseEmailAddress(value: string | undefined): { email: string; name: string | null } {
  if (!value || typeof value !== 'string') return { email: '', name: null };
  const match = value.trim().match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, '') || null;
    const email = match[2].trim().toLowerCase();
    return { email, name: name || null };
  }
  return { email: value.trim().toLowerCase(), name: null };
}

/**
 * POST /api/webhooks/resend
 * Resend Inbound 수신 메일 웹훅 (email.received)
 */
export async function POST(req: NextRequest) {
  try {
    const signature = req.headers.get('resend-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (webhookSecret && signature) {
      // TODO: Resend signing secret 검증 구현
    }

    const body = await req.json();
    const eventType = body.type ?? body.event;

    if (eventType !== 'email.received') {
      return NextResponse.json({ message: 'Webhook received', event_type: eventType }, { status: 200 });
    }

    const emailData = body.data || body;

    // Resend 문서: from = "Name <email@domain.com>", to = ["delivered@resend.dev"], email_id 사용
    const messageId = emailData.email_id || emailData.message_id || emailData.id || crypto.randomUUID();
    const fromParsed = parseEmailAddress(
      typeof emailData.from === 'string' ? emailData.from : (emailData.from?.email || emailData.from_email)
    );
    const fromEmail = fromParsed.email || (emailData.from?.email ?? emailData.from_email ?? '');
    const fromName = fromParsed.name ?? emailData.from?.name ?? emailData.from_name ?? null;

    const toRaw = emailData.to?.[0] ?? emailData.to_email ?? emailData.to;
    const toParsed = parseEmailAddress(typeof toRaw === 'string' ? toRaw : toRaw?.[0]);
    const toEmail = toParsed.email || (Array.isArray(emailData.to) ? emailData.to[0] : toRaw) || '';

    const subject = emailData.subject ?? '(No Subject)';
    const textContent = emailData.text ?? emailData.text_content ?? '';
    const htmlContent = emailData.html ?? emailData.html_content ?? '';
    const attachments = emailData.attachments ?? [];

    if (!toEmail || !toEmail.includes('support@atockorea.com')) {
      return NextResponse.json({ message: 'Email not for support@atockorea.com, ignoring' }, { status: 200 });
    }
    const supabase = createServerClient();

    const insertPayload = {
      message_id: String(messageId),
      from_email: fromEmail || 'unknown@unknown',
      from_name: fromName,
      to_email: toEmail,
      subject,
      text_content: textContent || null,
      html_content: htmlContent || null,
      attachments: attachments.map((att: any) => ({
        filename: att.filename ?? att.name,
        content_type: att.content_type ?? att.type,
        size: att.size ?? 0,
      })),
      category: categorizeEmail(subject, textContent),
    };

    const { data, error } = await supabase
      .from('received_emails')
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      const isDuplicate = error.code === '23505';
      if (isDuplicate) {
        return NextResponse.json({ success: true, message: 'Email already stored' }, { status: 200 });
      }
      console.error('Error saving email to database:', error);
      return NextResponse.json(
        { error: 'Failed to save email', details: error.message },
        { status: 500 }
      );
    }

    const messageForInquiry = (textContent || htmlContent || '').slice(0, 50000);
    await supabase.from('contact_inquiries').insert({
      full_name: fromName || fromEmail?.split('@')[0] || 'Unknown',
      email: fromEmail,
      subject,
      message: messageForInquiry,
      privacy_consent: true,
      status: 'new',
      is_read: false,
    }).then(({ error: inquiryErr }) => {
      if (inquiryErr) console.error('Error saving to contact_inquiries:', inquiryErr);
    });

    return NextResponse.json({
      success: true,
      message: 'Email received and saved',
      email_id: data.id,
    }, { status: 200 });
  } catch (error: any) {
    console.error('Resend webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * 根据邮件主题和内容自动分类
 */
function categorizeEmail(subject: string, content: string): string {
  const subjectLower = subject.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // 支持相关关键词
  if (subjectLower.includes('support') || contentLower.includes('help') || contentLower.includes('assistance')) {
    return 'support';
  }
  
  // 咨询相关
  if (subjectLower.includes('inquiry') || subjectLower.includes('question') || subjectLower.includes('ask')) {
    return 'inquiry';
  }
  
  // 投诉相关
  if (subjectLower.includes('complaint') || subjectLower.includes('refund') || subjectLower.includes('cancel')) {
    return 'complaint';
  }
  
  // 预订相关
  if (subjectLower.includes('booking') || subjectLower.includes('reservation') || subjectLower.includes('tour')) {
    return 'booking';
  }
  
  return 'other';
}

/**
 * GET /api/webhooks/resend
 * Webhook 验证（某些服务需要验证端点）
 */
export async function GET(req: NextRequest) {
  return NextResponse.json({ 
    message: 'Resend webhook endpoint is active',
    timestamp: new Date().toISOString()
  });
}

