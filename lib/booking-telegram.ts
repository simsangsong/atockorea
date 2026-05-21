import type { SupabaseClient } from '@supabase/supabase-js';

export type BookingTelegramPayload = {
  bookingId: string;
  bookingReference?: string | null;
  tourTitle: string;
  bookingDate: string;
  numberOfGuests: number;
  totalPrice: number;
  pickupPoint?: string | null;
  paymentMethod: string;
  paymentStatus: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
};

function publicBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(configured)) {
    return 'https://atockorea.com';
  }
  return configured.replace(/\/+$/, '');
}

function escapeTelegramHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatUsdAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function adminOrderUrl(bookingId: string): string {
  return `${publicBaseUrl()}/admin/orders/${encodeURIComponent(bookingId)}`;
}

function buildBookingMessage(payload: BookingTelegramPayload): string {
  const bookingLabel = payload.bookingReference || payload.bookingId;
  const lines = [
    '<b>New booking confirmed</b>',
    '',
    `<b>Booking:</b> ${escapeTelegramHtml(bookingLabel)}`,
    `<b>Tour:</b> ${escapeTelegramHtml(payload.tourTitle)}`,
    `<b>Date:</b> ${escapeTelegramHtml(formatDate(payload.bookingDate))}`,
    `<b>Guests:</b> ${escapeTelegramHtml(payload.numberOfGuests)}`,
    `<b>Payment:</b> ${escapeTelegramHtml(`${payload.paymentMethod} / ${payload.paymentStatus}`)}`,
    `<b>Total:</b> ${escapeTelegramHtml(formatUsdAmount(payload.totalPrice))}`,
  ];

  if (payload.pickupPoint) {
    lines.push(`<b>Pickup:</b> ${escapeTelegramHtml(payload.pickupPoint)}`);
  }

  lines.push('');
  lines.push(`<b>Guest:</b> ${escapeTelegramHtml(payload.customerName || 'Guest')}`);
  if (payload.customerEmail) lines.push(`<b>Email:</b> ${escapeTelegramHtml(payload.customerEmail)}`);
  if (payload.customerPhone) lines.push(`<b>Phone:</b> ${escapeTelegramHtml(payload.customerPhone)}`);
  lines.push('');
  lines.push(`<a href="${adminOrderUrl(payload.bookingId)}">Open booking in admin</a>`);

  return lines.join('\n');
}

export async function notifyTelegramBookingConfirmed(
  sb: SupabaseClient,
  payload: BookingTelegramPayload,
): Promise<{ delivered: boolean; reason: string; messageId?: number }> {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = (process.env.TELEGRAM_BOOKING_CHAT_ID || process.env.TELEGRAM_ADMIN_CHAT_ID)?.trim();

  if (!token || !chatId) {
    return { delivered: false, reason: 'telegram_env_unset' };
  }

  const body = {
    chat_id: chatId,
    text: buildBookingMessage(payload),
    parse_mode: 'HTML',
    disable_web_page_preview: true,
  };

  let status = 0;
  let responseBody: unknown = null;
  let errorMessage: string | null = null;

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    status = response.status;
    responseBody = await response.json().catch(() => null);
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : String(error);
  }

  try {
    await sb.from('telegram_webhook_log').insert({
      ticket_id: null,
      endpoint: 'telegram_booking',
      request_payload: {
        ...body,
        booking_id: payload.bookingId,
        booking_reference: payload.bookingReference ?? null,
      },
      response_status: status,
      response_body: responseBody as object | null,
      error_message: errorMessage,
    });
  } catch {
    // Never fail booking confirmation because audit logging failed.
  }

  if (status >= 200 && status < 300) {
    const messageId = (responseBody as { result?: { message_id?: number } } | null)?.result?.message_id;
    return { delivered: true, reason: 'ok', messageId };
  }

  return { delivered: false, reason: errorMessage ?? `status_${status}` };
}
