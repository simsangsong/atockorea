import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { withAuth } from '@/lib/middleware';

/**
 * POST /api/admin/emails/[id]/reply
 * 发送邮件回复（仅管理员）
 */
async function sendReply(req: NextRequest, user: any) {
  try {
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Unauthorized. Admin access required.' },
        { status: 403 }
      );
    }

    const emailId = req.nextUrl.pathname.split('/').slice(0, -1).pop();
    
    if (!emailId) {
      return NextResponse.json(
        { error: 'Email ID is required' },
        { status: 400 }
      );
    }

    const { subject, content, reply_to_all = false } = await req.json();
    
    if (!subject || !content) {
      return NextResponse.json(
        { error: 'Subject and content are required' },
        { status: 400 }
      );
    }

    const supabase = createServerClient();
    
    // 获取原始邮件
    const { data: originalEmail, error: emailError } = await supabase
      .from('received_emails')
      .select('*')
      .eq('id', emailId)
      .single();
    
    if (emailError || !originalEmail) {
      return NextResponse.json(
        { error: 'Original email not found' },
        { status: 404 }
      );
    }

    // 检查 Resend API Key
    const resendApiKey = process.env.RESEND_API_KEY;
    if (!resendApiKey) {
      return NextResponse.json(
        { error: 'Resend API key not configured' },
        { status: 500 }
      );
    }

    // 导入 Resend
    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);

    // 构建回复邮件
    const replySubject = subject.startsWith('Re:') ? subject : `Re: ${subject}`;
    const replyTo = originalEmail.from_email;
    const replyToName = originalEmail.from_name || originalEmail.from_email;

    // 构建邮件内容（包含原始邮件引用）
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
          .original-email { margin-top: 20px; padding: 15px; background: #e9e9e9; border-left: 4px solid #667eea; border-radius: 4px; }
          .original-email-header { font-size: 12px; color: #666; margin-bottom: 10px; }
          .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>AtoCKorea</h1>
          </div>
          <div class="content">
            <div style="white-space: pre-wrap;">${content.replace(/\n/g, '<br>')}</div>
            <div class="original-email">
              <div class="original-email-header">
                <strong>Original Message:</strong><br>
                From: ${originalEmail.from_name || originalEmail.from_email}<br>
                Date: ${new Date(originalEmail.received_at).toLocaleString()}<br>
                Subject: ${originalEmail.subject || '(No Subject)'}
              </div>
              <div style="margin-top: 10px; font-size: 14px;">
                ${originalEmail.html_content || originalEmail.text_content?.replace(/\n/g, '<br>') || 'No content'}
              </div>
            </div>
          </div>
          <div class="footer">
            <p>© 2024 AtoCKorea. All rights reserved.</p>
            <p>This email was sent from support@atockorea.com</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const textContent = `${content}\n\n---\nOriginal Message:\nFrom: ${originalEmail.from_name || originalEmail.from_email}\nDate: ${new Date(originalEmail.received_at).toLocaleString()}\nSubject: ${originalEmail.subject || '(No Subject)'}\n\n${originalEmail.text_content || 'No content'}`;

    // 发送邮件
    const { data: emailData, error: sendError } = await resend.emails.send({
      from: 'AtoCKorea <support@atockorea.com>',
      to: replyTo,
      replyTo: 'support@atockorea.com',
      subject: replySubject,
      html: htmlContent,
      text: textContent,
    });

    if (sendError) {
      console.error('Error sending email reply:', sendError);
      return NextResponse.json(
        { error: 'Failed to send email reply', details: sendError.message },
        { status: 500 }
      );
    }

    // 保存回复记录到数据库
    const { data: replyRecord, error: replyError } = await supabase
      .from('email_replies')
      .insert({
        original_email_id: emailId,
        reply_message_id: emailData?.id || `reply-${Date.now()}`,
      })
      .select()
      .single();

    if (replyError) {
      console.error('Error saving reply record:', replyError);
      // 不返回错误，因为邮件已经发送成功
    }

    // 更新原始邮件状态（标记为已回复）
    await supabase
      .from('received_emails')
      .update({ 
        updated_at: new Date().toISOString(),
        // 可以添加一个 is_replied 字段来标记已回复
      })
      .eq('id', emailId);

    return NextResponse.json({
      success: true,
      message: 'Reply sent successfully',
      email_id: emailData?.id,
      reply_id: replyRecord?.id,
    });
  } catch (error: any) {
    console.error('Send reply error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

export const POST = withAuth(sendReply, ['admin']);

