import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

/**
 * POST /api/webhooks/resend
 * 接收 Resend 的邮件 webhook
 * 
 * Resend 会在收到邮件时发送 webhook 到这个端点
 */
export async function POST(req: NextRequest) {
  try {
    // 验证 webhook 签名（如果 Resend 提供了签名验证）
    const signature = req.headers.get('resend-signature');
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    
    if (webhookSecret && signature) {
      // 验证签名逻辑（根据 Resend 文档实现）
      // 这里先跳过，实际使用时需要根据 Resend 的签名算法实现
    }

    const body = await req.json();
    
    // Resend webhook 事件类型
    const eventType = body.type; // 'email.received', 'email.delivered', etc.
    
    // 只处理收到的邮件事件
    if (eventType === 'email.received' || body.event === 'email.received') {
      const emailData = body.data || body;
      
      // 提取邮件信息
      const messageId = emailData.id || emailData.message_id || crypto.randomUUID();
      const fromEmail = emailData.from?.email || emailData.from_email || emailData.from;
      const fromName = emailData.from?.name || emailData.from_name || null;
      const toEmail = emailData.to?.[0] || emailData.to_email || emailData.to;
      const subject = emailData.subject || '(No Subject)';
      const textContent = emailData.text || emailData.text_content || '';
      const htmlContent = emailData.html || emailData.html_content || '';
      const headers = emailData.headers || {};
      const attachments = emailData.attachments || [];
      
      // 只处理发送到 support@atockorea.com 的邮件
      if (!toEmail || !toEmail.includes('support@atockorea.com')) {
        return NextResponse.json({ 
          message: 'Email not for support@atockorea.com, ignoring' 
        }, { status: 200 });
      }
      
      // 保存到数据库
      const supabase = createServerClient();
      
      const { data, error } = await supabase
        .from('received_emails')
        .insert({
          message_id: messageId,
          from_email: fromEmail,
          from_name: fromName,
          to_email: toEmail,
          subject: subject,
          text_content: textContent,
          html_content: htmlContent,
          headers: headers,
          attachments: attachments.map((att: any) => ({
            filename: att.filename || att.name,
            content_type: att.content_type || att.type,
            size: att.size || 0,
          })),
          category: categorizeEmail(subject, textContent),
        })
        .select()
        .single();
      
      if (error) {
        console.error('Error saving email to database:', error);
        return NextResponse.json(
          { error: 'Failed to save email', details: error.message },
          { status: 500 }
        );
      }
      
      return NextResponse.json({ 
        success: true, 
        message: 'Email received and saved',
        email_id: data.id 
      }, { status: 200 });
    }
    
    // 其他事件类型，简单确认
    return NextResponse.json({ 
      message: 'Webhook received',
      event_type: eventType 
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

