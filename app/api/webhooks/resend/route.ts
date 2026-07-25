import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import crypto from 'crypto';
import { Webhook } from 'svix';
import { storeReceivedEmail } from '@/lib/support/storeReceivedEmail';

async function hydrateReceivedEmail(emailData: Record<string, unknown>): Promise<Record<string, unknown>> {
  const resendApiKey = process.env.RESEND_API_KEY;
  const receivedEmailId = emailData.email_id ?? emailData.id;

  if (!resendApiKey || typeof receivedEmailId !== 'string' || !receivedEmailId) {
    return emailData;
  }

  try {
    const { Resend } = await import('resend');
    const resend = new Resend(resendApiKey);
    const { data, error } = await resend.emails.receiving.get(receivedEmailId);

    if (error || !data) {
      console.warn('Unable to hydrate received email from Resend:', error);
      return emailData;
    }

    return {
      ...emailData,
      ...data,
      email_id: emailData.email_id ?? data.id,
    };
  } catch (error) {
    console.warn('Unable to fetch received email content from Resend:', error);
    return emailData;
  }
}

/**
 * POST /api/webhooks/resend
 * Resend Inbound 수신 메일 웹훅 (email.received)
 * Requires RESEND_WEBHOOK_SECRET and verifies Svix signature.
 *
 * 저장 규칙은 lib/support/storeReceivedEmail.ts 하나뿐이다 — 백필 스크립트
 * (scripts/backfill-received-emails.ts)와 공유해서 실시간분과 복구분이
 * 서로 다르게 저장되는 일이 없게 한다.
 *
 * ⚠ 웹훅 URL은 반드시 www 정규 호스트여야 한다. apex(atockorea.com)는 307로
 * 리다이렉트되고 Resend는 리다이렉트를 따라가지 않고 실패로 기록한다 —
 * 2026-05-21 이후 수신분이 통째로 유실된 원인이 이것이었다.
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

    const emailData = await hydrateReceivedEmail((body.data || body) as Record<string, unknown>);

    const outcome = await storeReceivedEmail({
      supabase: createServerClient(),
      data: emailData,
      fallbackMessageId: crypto.randomUUID(),
    });

    switch (outcome.result) {
      case 'not_support':
        // 관측된 수신자를 함께 돌려준다 — 예전에 bcc를 못 읽어 정상 메일을
        // 조용히 버리던 실패가 로그만 보고는 진단이 안 됐다.
        return NextResponse.json(
          { message: 'Email not for support inbox, ignoring', recipients: outcome.recipients },
          { status: 200 }
        );
      case 'duplicate':
        return NextResponse.json({ success: true, message: 'Email already stored' }, { status: 200 });
      case 'error':
        console.error(`Error saving inbound email (${outcome.stage}):`, outcome.message);
        return NextResponse.json(
          { error: `Failed to save ${outcome.stage}`, details: outcome.message },
          { status: 500 }
        );
      case 'stored_self':
        // 우리가 보낸 알림이 catch-all로 되돌아온 것 — 기록만 남기고
        // contact_inquiries(고객 문의 큐)는 만들지 않았다.
        return NextResponse.json({
          success: true,
          message: 'Self-sent notification stored without creating an inquiry',
          email_id: outcome.emailId,
        }, { status: 200 });
      case 'stored':
        return NextResponse.json({
          success: true,
          message: 'Email received and saved',
          email_id: outcome.emailId,
        }, { status: 200 });
    }
  } catch (error: unknown) {
    console.error('Resend webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook processing failed', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}

/**
 * GET /api/webhooks/resend
 * Method not allowed (webhook accepts POST only; avoids endpoint enumeration).
 */
export async function GET() {
  return new NextResponse(null, { status: 405 });
}
