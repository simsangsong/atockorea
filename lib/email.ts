import { Resend } from 'resend';
import { buildReminderEmailHtml } from './email-templates/reminder';

const resendApiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.RESEND_FROM_EMAIL || 'AtoCKorea <support@atockorea.com>';

let resend: Resend | null = null;

if (resendApiKey) {
  resend = new Resend(resendApiKey);
}

/**
 * Base email template styles
 */
const baseStyles = `
  body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
  .container { max-width: 600px; margin: 0 auto; background: #ffffff; }
  .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px 20px; text-align: center; }
  .header h1 { margin: 0; font-size: 24px; }
  .content { padding: 30px 20px; background: #f9f9f9; }
  .content-box { background: white; padding: 20px; border-radius: 8px; margin: 20px 0; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
  .button { display: inline-block; padding: 12px 24px; background: #667eea; color: white; text-decoration: none; border-radius: 6px; margin: 10px 0; }
  .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; background: #f0f0f0; }
  .info-row { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #eee; }
  .info-label { font-weight: bold; color: #666; }
  .info-value { color: #333; }
`;

/**
 * Send email using Resend
 */
export async function sendEmail({
  to,
  subject,
  html,
  text,
}: {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
}): Promise<{ success: boolean; error?: string; messageId?: string }> {
  if (!resend) {
    console.warn('Resend not configured. Email not sent.');
    return { success: false, error: 'Resend not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''), // Strip HTML for text version
    });

    if (error) {
      console.error('Resend email error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, messageId: data?.id };
  } catch (error: unknown) {
    console.error('Error sending email:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return { success: false, error: message };
  }
}

/**
 * Booking confirmation email
 */
/** 결제상태 표시 라벨 (Payment status labels) */
const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: '결제대기 (Payment Pending)',
  authorized: '카드 등록 완료 — 노쇼 시에만 청구 (Card on file — charged only on no-show)',
  paid: '결제 완료 (Payment Completed)',
  failed: '결제실패 (Payment Failed)',
  refunded: '환불됨 (Refunded)',
};

/** Parameters for booking confirmation email (exported for type safety across dynamic imports) */
export interface SendBookingConfirmationEmailParams {
  to: string;
  bookingId: string;
  tourTitle: string;
  bookingDate: string;
  numberOfGuests: number;
  totalPrice: number;
  pickupPoint?: string;
  paymentMethod: string;
  paymentStatus?: 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded';
  customerName: string;
  tourImageUrl?: string;
  tourId?: string;
}

/** UUID에서 짧은 부킹 표시 ID 생성 (e.g. ATK-37787A34) */
function shortBookingId(bookingId: string): string {
  const hex = bookingId.replace(/-/g, '').slice(0, 8).toUpperCase();
  return `ATK-${hex}`;
}

export async function sendBookingConfirmationEmail(params: SendBookingConfirmationEmailParams) {
  const {
    to,
    bookingId,
    tourTitle,
    bookingDate,
    numberOfGuests,
    totalPrice,
    pickupPoint,
    paymentMethod,
    customerName,
    tourImageUrl,
    tourId,
  } = params;
  const paymentStatus = params.paymentStatus ?? 'pending';
  const paymentStatusLabel = PAYMENT_STATUS_LABELS[paymentStatus] ?? PAYMENT_STATUS_LABELS.pending;
  const displayBookingId = shortBookingId(bookingId);
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
  const reviewWriteUrl = tourId
    ? `${baseUrl}/mypage/reviews/write?tourId=${encodeURIComponent(tourId)}&bookingId=${encodeURIComponent(bookingId)}&tour=${encodeURIComponent(tourTitle)}`
    : `${baseUrl}/mypage/reviews`;

  const formattedDate = new Date(bookingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${baseStyles}
  .tour-thumb { width: 100%; max-width: 320px; height: auto; border-radius: 8px; margin: 0 0 16px 0; display: block; }
  .review-link { margin-top: 20px; padding-top: 20px; border-top: 1px solid #eee; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🎉 Booking Confirmed!</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>Thank you for your booking! We're excited to have you join us.</p>
          ${tourImageUrl ? `
          <p style="margin: 0 0 16px 0;">
            <img src="${tourImageUrl}" alt="${tourTitle.replace(/"/g, '&quot;')}" class="tour-thumb" />
          </p>
          ` : ''}
          <div class="content-box">
            <h2 style="margin-top: 0; color: #667eea;">Booking Details</h2>
            <div class="info-row">
              <span class="info-label">Booking ID:</span>
              <span class="info-value">${displayBookingId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tour:</span>
              <span class="info-value">${tourTitle}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Number of Guests:</span>
              <span class="info-value">${numberOfGuests}</span>
            </div>
            ${pickupPoint ? `
            <div class="info-row">
              <span class="info-label">Pickup Point:</span>
              <span class="info-value">${pickupPoint}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="info-label">Payment Method:</span>
              <span class="info-value">${paymentMethod}</span>
            </div>
            <div class="info-row">
              <span class="info-label">결제상태 (Payment Status):</span>
              <span class="info-value">${paymentStatusLabel}</span>
            </div>
            <div class="info-row" style="border-bottom: none; padding-top: 15px;">
              <span class="info-label" style="font-size: 18px;">Total Amount:</span>
              <span class="info-value" style="font-size: 18px; color: #667eea; font-weight: bold;">₩${totalPrice.toLocaleString()}</span>
            </div>
          </div>

          <p><strong>What's Next?</strong></p>
          <ul>
            <li>You will receive a reminder email 24 hours before your tour</li>
            <li>Please arrive at the pickup point 10 minutes before the scheduled time</li>
            <li>If you have any questions, feel free to contact us</li>
          </ul>

          <p style="margin-top: 30px;">
            <a href="${baseUrl}/mypage/mybookings" class="button">View My Bookings</a>
          </p>

          <div class="review-link">
            <p><strong>Enjoyed your tour?</strong></p>
            <p>Share your experience and help other travelers — write a review for <strong>${tourTitle}</strong>.</p>
            <p>
              <a href="${reviewWriteUrl}" class="button" style="background: #10b981;">Write a Review / 리뷰 작성</a>
            </p>
          </div>
        </div>
        <div class="footer">
          <p>© 2026 AtoCKorea. All rights reserved.</p>
          <p>This email was sent from ${fromEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Booking Confirmed: ${tourTitle}`,
    html,
  });
}

/**
 * Booking cancellation email
 */
export async function sendBookingCancellationEmail({
  to,
  bookingId,
  tourTitle,
  bookingDate,
  refundAmount,
  refundEligible,
  customerName,
}: {
  to: string;
  bookingId: string;
  tourTitle: string;
  bookingDate: string;
  refundAmount?: number;
  refundEligible: boolean;
  customerName: string;
}) {
  const formattedDate = new Date(bookingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);">
          <h1>Booking Cancelled</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>Your booking has been cancelled as requested.</p>
          
          <div class="content-box">
            <h2 style="margin-top: 0; color: #f5576c;">Cancellation Details</h2>
            <div class="info-row">
              <span class="info-label">Booking ID:</span>
              <span class="info-value">${bookingId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tour:</span>
              <span class="info-value">${tourTitle}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Original Date:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Refund Status:</span>
              <span class="info-value">${refundEligible ? 'Eligible' : 'Not Eligible'}</span>
            </div>
            ${refundAmount && refundEligible ? `
            <div class="info-row" style="border-bottom: none; padding-top: 15px;">
              <span class="info-label" style="font-size: 18px;">Refund Amount:</span>
              <span class="info-value" style="font-size: 18px; color: #667eea; font-weight: bold;">₩${refundAmount.toLocaleString()}</span>
            </div>
            ` : ''}
          </div>

          ${refundEligible ? `
          <p><strong>Refund Information:</strong></p>
          <ul>
            <li>Your refund will be processed within 5-7 business days</li>
            <li>You will receive a confirmation email once the refund is processed</li>
            <li>The refund will be credited to your original payment method</li>
          </ul>
          ` : `
          <p><strong>Note:</strong> This booking is not eligible for a refund based on our cancellation policy.</p>
          `}

          <p style="margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com'}/mypage/mybookings" class="button">View My Bookings</a>
          </p>

          <p>We're sorry to see you go. If you have any questions or would like to book another tour, please don't hesitate to contact us.</p>
        </div>
        <div class="footer">
          <p>© 2026 AtoCKorea. All rights reserved.</p>
          <p>This email was sent from ${fromEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Booking Cancelled: ${tourTitle}`,
    html,
  });
}

/**
 * Booking reminder email (sent 24 hours before tour)
 */
export async function sendBookingReminderEmail({
  to,
  bookingId,
  tourTitle,
  bookingDate,
  bookingTime,
  numberOfGuests,
  pickupPoint,
  pickupAddress,
  pickupTime,
  customerName,
  contactPhone,
}: {
  to: string;
  bookingId: string;
  tourTitle: string;
  bookingDate: string;
  bookingTime?: string;
  numberOfGuests: number;
  pickupPoint?: string;
  pickupAddress?: string;
  pickupTime?: string;
  customerName: string;
  contactPhone?: string;
}) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
  const html = buildReminderEmailHtml({
    baseStyles,
    fromEmail,
    appUrl,
    tourTitle,
    bookingDate,
    bookingTime,
    numberOfGuests,
    pickupPoint,
    pickupAddress,
    pickupTime,
    customerName,
    contactPhone,
  });

  return sendEmail({
    to,
    subject: `Reminder: Your Tour Tomorrow - ${tourTitle}`,
    html,
  });
}

/**
 * Merchant account creation email
 */
export async function sendMerchantWelcomeEmail({
  to,
  companyName,
  contactPerson,
  loginEmail,
  temporaryPassword,
  loginUrl,
}: {
  to: string;
  companyName: string;
  contactPerson: string;
  loginEmail: string;
  temporaryPassword: string;
  loginUrl: string;
}) {
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Welcome to AtoCKorea!</h1>
        </div>
        <div class="content">
          <p>Dear ${contactPerson},</p>
          <p>Congratulations! Your merchant account for <strong>${companyName}</strong> has been created successfully.</p>
          
          <div class="content-box">
            <h2 style="margin-top: 0; color: #667eea;">Your Login Credentials</h2>
            <div class="info-row">
              <span class="info-label">Login Email:</span>
              <span class="info-value">${loginEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Temporary Password:</span>
              <span class="info-value" style="font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px;">${temporaryPassword}</span>
            </div>
          </div>

          <p><strong>⚠️ Important Security Notice:</strong></p>
          <ul>
            <li>Please change your password immediately after your first login</li>
            <li>Do not share your login credentials with anyone</li>
            <li>Keep your password secure and confidential</li>
          </ul>

          <p><strong>Getting Started:</strong></p>
          <ol>
            <li>Click the button below to access your merchant dashboard</li>
            <li>Log in with the credentials provided above</li>
            <li>Change your password in the account settings</li>
            <li>Start adding your tours and managing your bookings</li>
          </ol>

          <p style="margin-top: 30px; text-align: center;">
            <a href="${loginUrl}" class="button">Access Merchant Dashboard</a>
          </p>

          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
        </div>
        <div class="footer">
          <p>© 2026 AtoCKorea. All rights reserved.</p>
          <p>This email was sent from ${fromEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Welcome to AtoCKorea - Your Merchant Account is Ready`,
    html,
  });
}

/**
 * Card authorization failed at booking time (Stripe `payment_intent.payment_failed`
 * or `setup_intent.setup_failed`). The booking is NOT confirmed — the customer
 * needs to re-enter a card.
 */
export async function sendCardAuthFailedEmail({
  to,
  customerName,
  bookingId,
  tourTitle,
  bookingDate,
}: {
  to: string;
  customerName: string;
  bookingId: string;
  tourTitle: string;
  bookingDate?: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
  const displayBookingId = shortBookingId(bookingId);
  const formattedDate = bookingDate
    ? new Date(bookingDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #f5576c 0%, #c81d4e 100%);">
          <h1>Card Authorization Failed</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>We were unable to authorize your card for the booking below, so <strong>your reservation is not yet confirmed</strong>.</p>

          <div class="content-box">
            <h2 style="margin-top: 0; color: #f5576c;">Booking Details</h2>
            <div class="info-row">
              <span class="info-label">Booking ID:</span>
              <span class="info-value">${displayBookingId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tour:</span>
              <span class="info-value">${tourTitle}</span>
            </div>
            ${formattedDate ? `
            <div class="info-row" style="border-bottom: none;">
              <span class="info-label">Date:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            ` : ''}
          </div>

          <p><strong>What to do next:</strong></p>
          <ul>
            <li>Your card was not charged.</li>
            <li>Please re-enter your payment details to secure your booking.</li>
            <li>Common causes: the card was declined, needs 3-D Secure verification, or has insufficient funds.</li>
          </ul>

          <p style="margin-top: 30px;">
            <a href="${baseUrl}/mypage/mybookings" class="button">Review My Booking</a>
          </p>

          <p>If you continue to have trouble, simply reply to this email and our team will help you complete the reservation.</p>
        </div>
        <div class="footer">
          <p>© 2026 AtoCKorea. All rights reserved.</p>
          <p>This email was sent from ${fromEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Action needed: card not authorized — ${tourTitle}`,
    html,
  });
}

/**
 * Re-authorization of the card on file failed (daily cron, ~5-6 days before the
 * tour). The booking was confirmed earlier via SetupIntent, but the off-session
 * hold could not be placed (e.g. 3-D Secure now required, card expired, declined).
 * The customer must re-confirm their card before the tour.
 */
export async function sendCardReauthFailedEmail({
  to,
  customerName,
  bookingId,
  tourTitle,
  tourDate,
}: {
  to: string;
  customerName: string;
  bookingId: string;
  tourTitle: string;
  tourDate?: string;
}) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com';
  const displayBookingId = shortBookingId(bookingId);
  const formattedDate = tourDate
    ? new Date(tourDate).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>${baseStyles}</style>
    </head>
    <body>
      <div class="container">
        <div class="header" style="background: linear-gradient(135deg, #f7971e 0%, #e36209 100%);">
          <h1>Card Re-confirmation Needed</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>Your tour is coming up soon, but we couldn't verify the card we have on file for your booking. <strong>Please re-confirm your card to keep your reservation secure.</strong></p>

          <div class="content-box">
            <h2 style="margin-top: 0; color: #e36209;">Booking Details</h2>
            <div class="info-row">
              <span class="info-label">Booking ID:</span>
              <span class="info-value">${displayBookingId}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tour:</span>
              <span class="info-value">${tourTitle}</span>
            </div>
            ${formattedDate ? `
            <div class="info-row" style="border-bottom: none;">
              <span class="info-label">Tour Date:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            ` : ''}
          </div>

          <p><strong>What to do next:</strong></p>
          <ul>
            <li>You have not been charged.</li>
            <li>Please re-enter your card details so we can secure your spot.</li>
            <li>Common causes: the card now needs 3-D Secure verification, has expired, or was declined.</li>
          </ul>

          <p style="margin-top: 30px;">
            <a href="${baseUrl}/mypage/mybookings" class="button">Re-confirm My Card</a>
          </p>

          <p>Need help? Just reply to this email and our team will assist you right away.</p>
        </div>
        <div class="footer">
          <p>© 2026 AtoCKorea. All rights reserved.</p>
          <p>This email was sent from ${fromEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Action needed: confirm your card — ${tourTitle}`,
    html,
  });
}













