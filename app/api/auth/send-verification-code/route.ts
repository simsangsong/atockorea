import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';

/**
 * POST /api/auth/send-verification-code
 * 发送自定义验证码邮件
 */
export async function POST(req: NextRequest) {
  try {
    const { email } = await req.json();

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // 生成 6 位数字验证码
    const verificationCode = crypto.randomInt(100000, 999999).toString();

    const supabase = createServerClient();

    // 存储验证码到数据库（有效期 10 分钟）
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 10);

    // 先删除该邮箱的旧验证码
    await supabase
      .from('verification_codes')
      .delete()
      .eq('email', email);

    // 插入新验证码
    const { error: insertError } = await supabase
      .from('verification_codes')
      .insert({
        email,
        code: verificationCode,
        expires_at: expiresAt.toISOString(),
      });

    if (insertError) {
      console.error('Error inserting verification code:', insertError);
      return NextResponse.json(
        { error: 'Failed to store verification code. Please ensure the verification_codes table exists in your database.' },
        { status: 500 }
      );
    }

    // 发送邮件
    // 如果配置了 Resend，使用 Resend；否则使用 Supabase 邮件功能
    const resendApiKey = process.env.RESEND_API_KEY;
    
    if (resendApiKey) {
      // 使用 Resend 发送邮件
      try {
        const { Resend } = await import('resend');
        const resend = new Resend(resendApiKey);

        const { error: emailError } = await resend.emails.send({
          from: 'AtoCKorea <support@atockorea.com>',
          to: email,
          subject: 'AtoCKorea Verification Code',
          html: `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
                .code { background: #fff; border: 2px dashed #667eea; padding: 20px; text-align: center; font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 8px; margin: 20px 0; border-radius: 8px; }
                .footer { text-align: center; margin-top: 20px; color: #666; font-size: 12px; }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>AtoCKorea</h1>
                </div>
                <div class="content">
                  <p>Hello,</p>
                  <p>AtoCKorea sent you a verification code, please confirm:</p>
                  <div class="code">${verificationCode}</div>
                  <p>This code will expire in 10 minutes.</p>
                  <p>If you didn't request this code, please ignore this email.</p>
                </div>
                <div class="footer">
                  <p>© 2024 AtoCKorea. All rights reserved.</p>
                  <p>This email was sent from support@atockorea.com</p>
                </div>
              </div>
            </body>
            </html>
          `,
          text: `Hello,\n\nAtoCKorea sent you a verification code, please confirm:\n\n${verificationCode}\n\nThis code will expire in 10 minutes.\n\nIf you didn't request this code, please ignore this email.\n\n© 2024 AtoCKorea. All rights reserved.\nThis email was sent from support@atockorea.com`,
        });

        if (emailError) {
          console.error('Resend email error:', emailError);
          // 继续执行，不返回错误（开发环境可能需要）
        }
      } catch (resendError) {
        console.error('Resend import or send error:', resendError);
        // 如果 Resend 不可用，继续执行
      }
    }

    // 开发环境：在控制台输出验证码（方便测试）
    if (process.env.NODE_ENV === 'development') {
      console.log(`\n📧 Verification code for ${email}: ${verificationCode}\n`);
    }

    return NextResponse.json({
      success: true,
      message: 'Verification code sent successfully',
      // 开发环境返回验证码（生产环境应移除）
      ...(process.env.NODE_ENV === 'development' && { code: verificationCode }),
    });
  } catch (error: any) {
    console.error('Send verification code error:', error);
    return NextResponse.json(
      { error: 'Failed to send verification code', details: error.message },
      { status: 500 }
    );
  }
}
