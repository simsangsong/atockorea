/**
 * Admin new-booking alert — the premium, stage-aware notification
 * (사용자 요청 2026-07-18: "예약 들어오면 무조건" — fires on CREATION, not
 * just on payment webhooks, so pending/abandoned bookings surface as leads).
 *
 * Stages:
 *   created    — booking row just inserted; payment may still be in flight
 *                (or abandoned — worth chasing).
 *   authorized — card hold succeeded (webhook amount_capturable_updated).
 *   paid       — captured (webhook payment_intent.succeeded).
 *
 * Recipients: ADMIN_BOOKING_NOTIFICATION_EMAILS (comma-separated), same env
 * and default as the rest of the admin rails.
 */

import { sendEmail } from '@/lib/email';

export type BookingAlertStage = 'created' | 'authorized' | 'paid';

export interface AdminBookingAlertParams {
  stage: BookingAlertStage;
  bookingId: string;
  bookingReference?: string | null;
  tourTitle: string;
  tourDate?: string | null;
  bookingDate?: string | null;
  numberOfGuests?: number | null;
  totalPrice?: number | null;
  currency?: string | null;
  pickupPoint?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  preferredLanguage?: string | null;
  source?: string | null;
}

const STAGE_META: Record<BookingAlertStage, { badge: string; color: string; bg: string; note: string }> = {
  created: {
    badge: '결제 대기 · NEW',
    color: '#92700c',
    bg: '#fdf3d7',
    note: '예약이 접수됐어요. 결제(카드 홀드)가 아직 완료되지 않았을 수 있으니, 미결제 상태가 이어지면 고객 팔로업을 권장합니다.',
  },
  authorized: {
    badge: '카드 홀드 완료',
    color: '#166534',
    bg: '#dcfce7',
    note: '카드 홀드가 걸렸습니다. 관리자 확정(캡처/해제) 대기 중입니다.',
  },
  paid: {
    badge: '결제 완료',
    color: '#14532d',
    bg: '#bbf7d0',
    note: '결제가 캡처되었습니다.',
  },
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function money(amount: number | null | undefined, currency?: string | null): string {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return '—';
  const cur = (currency || 'KRW').toUpperCase();
  const formatted = amount.toLocaleString('en-US', { maximumFractionDigits: cur === 'KRW' ? 0 : 2 });
  return cur === 'KRW' ? `₩${formatted}` : `${formatted} ${cur}`;
}

function row(label: string, value: string): string {
  return `<tr>
    <td style="padding:9px 0;color:#8a8578;font-size:12px;letter-spacing:.04em;white-space:nowrap;vertical-align:top;">${label}</td>
    <td style="padding:9px 0 9px 18px;color:#1c1917;font-size:14px;font-weight:600;text-align:right;word-break:break-all;">${value}</td>
  </tr>`;
}

export function buildAdminBookingAlertHtml(params: AdminBookingAlertParams): {
  subject: string;
  html: string;
} {
  const meta = STAGE_META[params.stage];
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.atockorea.com').replace(/\/$/, '');
  const orderUrl = `${base}/admin/orders/${params.bookingId}`;
  const reference = params.bookingReference || params.bookingId.slice(0, 8).toUpperCase();
  const kstNow = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date());

  const rows = [
    row('투어일', esc(params.tourDate || params.bookingDate || '—')),
    row('인원', params.numberOfGuests ? `${params.numberOfGuests}명` : '—'),
    row('고객명', esc(params.customerName || 'Guest')),
    row('이메일', esc(params.customerEmail || '—')),
    params.customerPhone ? row('전화', esc(params.customerPhone)) : '',
    params.preferredLanguage ? row('언어', esc(params.preferredLanguage)) : '',
    params.pickupPoint ? row('픽업', esc(params.pickupPoint)) : '',
    row('예약 경로', esc(params.source || 'atockorea.com')),
    row('접수 시각', `${esc(kstNow)} KST`),
  ].join('');

  const subject =
    params.stage === 'created'
      ? `🆕 새 예약 접수 — ${params.tourTitle} (${params.tourDate || params.bookingDate || ''})`
      : params.stage === 'authorized'
        ? `💳 카드 홀드 완료 — ${params.tourTitle} (${reference})`
        : `✅ 결제 완료 — ${params.tourTitle} (${reference})`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="color-scheme" content="light"></head>
<body style="margin:0;padding:28px 12px;background:#f4f1e9;font-family:-apple-system,'Apple SD Gothic Neo',Segoe UI,Roboto,sans-serif;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e7e2d5;border-radius:18px;overflow:hidden;box-shadow:0 1px 2px rgba(28,25,23,.04);">

    <!-- header -->
    <div style="background:#181511;padding:26px 28px 22px;">
      <p style="margin:0;color:#c9a75c;font-size:11px;font-weight:700;letter-spacing:.22em;">ATOC KOREA · BOOKING DESK</p>
      <p style="margin:12px 0 0;color:#ffffff;font-size:21px;line-height:1.35;font-weight:700;font-family:Georgia,'Times New Roman',serif;">${esc(params.tourTitle)}</p>
      <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:14px;"><tr>
        <td style="background:${meta.bg};color:${meta.color};font-size:12px;font-weight:700;padding:5px 12px;border-radius:999px;">${meta.badge}</td>
        <td style="padding-left:10px;color:#a8a29e;font-size:12px;letter-spacing:.06em;">REF ${esc(reference)}</td>
      </tr></table>
    </div>

    <!-- amount strip -->
    <div style="padding:18px 28px;border-bottom:1px solid #f0ece1;background:#fbfaf6;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="color:#8a8578;font-size:12px;letter-spacing:.04em;">예약 금액</td>
        <td style="text-align:right;color:#181511;font-size:22px;font-weight:800;">${money(params.totalPrice, params.currency)}</td>
      </tr></table>
    </div>

    <!-- details -->
    <div style="padding:20px 28px 6px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table>
    </div>

    <!-- note + CTA -->
    <div style="padding:6px 28px 26px;">
      <p style="margin:10px 0 18px;padding:12px 14px;background:#faf7ef;border:1px solid #eadfc8;border-radius:12px;color:#57534e;font-size:13px;line-height:1.65;">${meta.note}</p>
      <a href="${orderUrl}" style="display:block;text-align:center;background:#b08d3e;color:#ffffff;font-size:15px;font-weight:700;padding:14px 0;border-radius:12px;text-decoration:none;">관리자에서 주문 열기 →</a>
    </div>

    <!-- footer -->
    <div style="padding:14px 28px;background:#181511;">
      <p style="margin:0;color:#78716c;font-size:11px;line-height:1.6;">이 메일은 새 예약이 접수될 때 자동 발송됩니다 · 수신자 변경: Vercel env <span style="color:#a8a29e;">ADMIN_BOOKING_NOTIFICATION_EMAILS</span></p>
    </div>
  </div>
</body></html>`;

  return { subject, html };
}

function recipients(excludeEmail?: string | null): string[] {
  const raw = process.env.ADMIN_BOOKING_NOTIFICATION_EMAILS || 'simsangsong@gmail.com,support@atockorea.com';
  const exclude = (excludeEmail || '').trim().toLowerCase();
  return raw
    .split(',')
    .map((value) => value.trim())
    .filter((value) => value && value.toLowerCase() !== exclude);
}

/** Fire-and-forget friendly: never throws, reports per-recipient success. */
export async function sendAdminBookingAlert(
  params: AdminBookingAlertParams,
): Promise<{ sent: number; failed: number }> {
  const { subject, html } = buildAdminBookingAlertHtml(params);
  let sent = 0;
  let failed = 0;
  for (const to of recipients(params.customerEmail)) {
    try {
      const result = await sendEmail({ to, subject, html });
      if (result.success) sent += 1;
      else failed += 1;
    } catch {
      failed += 1;
    }
  }
  return { sent, failed };
}
