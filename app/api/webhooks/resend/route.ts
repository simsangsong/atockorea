import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';
import { Webhook } from 'svix';

type ParsedEmailAddress = { email: string; name: string | null };

/** Resend can send addresses as strings or objects, depending on the event version. */
function parseEmailAddress(value: unknown): ParsedEmailAddress {
  if (!value || typeof value !== 'string') return { email: '', name: null };
  const match = value.trim().match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^["']|["']$/g, '') || null;
    const email = match[2].trim().toLowerCase();
    return { email, name: name || null };
  }
  return { email: value.trim().toLowerCase(), name: null };
}

function extractEmailAddresses(value: unknown): ParsedEmailAddress[] {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.flatMap((item) => extractEmailAddresses(item));
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const parsed = parseEmailAddress(record.email ?? record.address ?? record.value);
    const name = typeof record.name === 'string' && record.name.trim()
      ? record.name.trim()
      : parsed.name;
    return parsed.email ? [{ email: parsed.email, name }] : [];
  }

  const parsed = parseEmailAddress(value);
  return parsed.email ? [parsed] : [];
}

function firstEmailAddress(...values: unknown[]): ParsedEmailAddress {
  for (const value of values) {
    const [parsed] = extractEmailAddresses(value);
    if (parsed?.email) return parsed;
  }
  return { email: '', name: null };
}

const DEFAULT_SUPPORT_INBOUND_ADDRESSES = [
  'support@atockorea.com',
  'support@atcokorea.com',
];

function supportInboundAddresses(): Set<string> {
  const configured = process.env.SUPPORT_INBOUND_ADDRESSES;
  const source = configured
    ? configured.split(',')
    : DEFAULT_SUPPORT_INBOUND_ADDRESSES;
  return new Set(source.map((email) => email.trim().toLowerCase()).filter(Boolean));
}

function isSupportRecipient(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  return supportInboundAddresses().has(normalized);
}

/**
 * POST /api/webhooks/resend
 * Resend Inbound 수신 메일 웹훅 (email.received)
 * Requires RESEND_WEBHOOK_SECRET and verifies Svix signature.
 */
export async function POST(req: NextRequest) {
  try {
    const webhookSecret = process.env.RESEND_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return NextResponse.json(
        { error: 'Webhook not configured' },
        { status: 503 }
      );
    }

    const rawBody = await req.text();

    const svixId = req.headers.get('svix-id');
    const svixTimestamp = req.headers.get('svix-timestamp');
    const svixSignature = req.headers.get('svix-signature');
    if (!svixId || !svixTimestamp || !svixSignature) {
      return NextResponse.json(
        { error: 'Missing webhook signature headers' },
        { status: 401 }
      );
    }
    try {
      const wh = new Webhook(webhookSecret);
      wh.verify(rawBody, {
        'svix-id': svixId,
        'svix-timestamp': svixTimestamp,
        'svix-signature': svixSignature,
      });
    } catch (e) {
      return NextResponse.json(
        { error: 'Invalid webhook signature' },
        { status: 401 }
      );
    }

    const body = JSON.parse(rawBody);
    const eventType = body.type ?? body.event;

    if (eventType !== 'email.received') {
      return NextResponse.json({ message: 'Webhook received', event_type: eventType }, { status: 200 });
    }

    const emailData = body.data || body;

    // Resend 문서: from/to can be strings or structured address objects, email_id 사용
    const messageId = emailData.email_id || emailData.message_id || emailData.id || crypto.randomUUID();
    const fromParsed = firstEmailAddress(emailData.from, emailData.from_email);
    const fromEmail = fromParsed.email || 'unknown@unknown';
    const fromName = fromParsed.name ?? emailData.from_name ?? null;

    const toRecipients = [
      ...extractEmailAddresses(emailData.to),
      ...extractEmailAddresses(emailData.to_email),
      ...extractEmailAddresses(emailData.recipients),
    ];
    const supportRecipient = toRecipients.find((recipient) => isSupportRecipient(recipient.email));
    const toEmail = supportRecipient?.email || '';

    const subject = emailData.subject ?? '(No Subject)';
    const textContent = emailData.text ?? emailData.text_content ?? '';
    const htmlContent = emailData.html ?? emailData.html_content ?? '';
    const attachments = Array.isArray(emailData.attachments) ? emailData.attachments : [];

    if (!toEmail) {
      return NextResponse.json({ message: 'Email not for support inbox, ignoring' }, { status: 200 });
    }
    const supabase = createServerClient();

    const insertPayload = {
      message_id: String(messageId),
      from_email: fromEmail,
      from_name: fromName,
      to_email: toEmail,
      subject,
      text_content: textContent || null,
      html_content: htmlContent || null,
      attachments: attachments.map((att: { filename?: string; name?: string; content_type?: string; type?: string; size?: number }) => ({
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
    const { error: inquiryErr } = await supabase.from('contact_inquiries').insert({
      full_name: fromName || fromEmail?.split('@')[0] || 'Unknown',
      email: fromEmail,
      subject,
      message: messageForInquiry,
      privacy_consent: true,
      status: 'new',
      is_read: false,
    });

    if (inquiryErr) {
      console.error('Error saving to contact_inquiries:', inquiryErr);
      return NextResponse.json(
        { error: 'Failed to save inquiry', details: inquiryErr.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Email received and saved',
      email_id: data.id,
    }, { status: 200 });
  } catch (error: unknown) {
    console.error('Resend webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : String(error) },
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
 * Method not allowed (webhook accepts POST only; avoids endpoint enumeration).
 */
export async function GET() {
  return new NextResponse(null, { status: 405 });
}
