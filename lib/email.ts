// Defense-in-depth (LIB-good): this module instantiates the Resend client with
// RESEND_API_KEY at import time and is only ever pulled in by API routes (all
// importers live under app/api/**). The `server-only` guard makes any
// accidental import from a Client Component a hard build error, so the email
// secret can never end up in a browser bundle.
import 'server-only';
import { Resend } from 'resend';
import { buildReminderEmailHtml } from './email-templates/reminder';
import { paymentStatusLabel } from './email/payment-status-label';

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

function formatUsdAmount(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getAdminBookingRecipients(): string[] {
  const configured = process.env.ADMIN_BOOKING_NOTIFICATION_EMAILS;
  const raw = configured || 'simsangsong@gmail.com,support@atockorea.com';
  return raw
    .split(',')
    .map((email) => email.trim())
    .filter(Boolean);
}

function getEmailBaseUrl(): string {
  const configured =
    process.env.EMAIL_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'https://atockorea.com';
  if (/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?/i.test(configured)) {
    return 'https://atockorea.com';
  }
  return configured.replace(/\/$/, '');
}

function toAbsoluteUrl(url: string | undefined, baseUrl: string): string | undefined {
  if (!url) return undefined;
  if (/^https?:\/\//i.test(url)) return url;
  const base = baseUrl.replace(/\/$/, '');
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${base}${path}`;
}

function getEmailLogoUrl(baseUrl: string): string {
  return process.env.EMAIL_LOGO_URL || `${baseUrl}/atoc-oauth-logo-240.png`;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emailDetailRow(label: string, value: string, options?: { emphasize?: boolean }): string {
  const valueStyle = options?.emphasize
    ? 'font-size:18px;line-height:26px;font-weight:700;color:#111827;'
    : 'font-size:14px;line-height:20px;font-weight:500;color:#111827;';

  return `
    <tr>
      <td style="padding:12px 0;border-bottom:1px solid #ebe7df;">
        <div style="margin:0 0 4px;color:#7b746b;font-size:10px;line-height:13px;text-transform:uppercase;letter-spacing:0.12em;font-weight:800;">${escapeHtml(label)}</div>
        <div style="margin:0;${valueStyle}word-break:normal;overflow-wrap:break-word;">${value}</div>
      </td>
    </tr>
  `;
}

function emailBrandLockup(logoUrl: string): string {
  return `
    <table role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td style="vertical-align:middle;width:42px;">
          <img src="${escapeHtml(logoUrl)}" width="40" height="40" alt="AtoC Korea" style="width:40px;height:40px;border-radius:10px;">
        </td>
        <td style="vertical-align:middle;padding-left:10px;">
          <div style="color:#111827;font-size:18px;line-height:20px;font-weight:750;letter-spacing:0;">AtoC <span style="color:#3a4656;font-weight:500;">Korea</span></div>
        </td>
      </tr>
    </table>
  `;
}

/** Two-column summary row for the guest confirmation email (label left, value right). */
function confirmationRow(label: string, value: string): string {
  return `
    <tr>
      <td style="padding:8px 0;color:#8a8578;font-size:12px;line-height:18px;letter-spacing:0.04em;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td>
      <td align="right" style="padding:8px 0 8px 18px;color:#1c1917;font-size:14px;line-height:20px;font-weight:600;overflow-wrap:break-word;">${value}</td>
    </tr>
  `;
}

/**
 * Build the guest confirmation email (subject + html) — exported separately from
 * the sender so tests and previews can render without dispatching (same pattern
 * as buildAdminBookingAlertHtml).
 */
export function buildBookingConfirmationEmailHtml(params: SendBookingConfirmationEmailParams): {
  subject: string;
  html: string;
} {
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
  const paymentStatusLabelText = paymentStatusLabel(paymentStatus);
  const displayBookingId = shortBookingId(bookingId);
  const baseUrl = getEmailBaseUrl();
  const logoUrl = getEmailLogoUrl(baseUrl);
  const emailTourImageUrl = toAbsoluteUrl(tourImageUrl, baseUrl);
  const reviewWriteUrl = tourId
    ? `${baseUrl}/mypage/reviews/write?tourId=${encodeURIComponent(tourId)}&bookingId=${encodeURIComponent(bookingId)}&tour=${encodeURIComponent(tourTitle)}`
    : `${baseUrl}/mypage/reviews`;

  // Compact single-line date ("Monday, Aug 17, 2026") — the long-month form
  // wraps inside the summary card on narrow mail clients.
  const formattedDate = new Date(bookingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  const safeCustomerName = escapeHtml(customerName || 'Guest');
  const safeTourTitle = escapeHtml(tourTitle);
  const safePickupPoint = pickupPoint ? escapeHtml(pickupPoint) : null;
  const safePaymentMethod = escapeHtml(paymentMethod === 'stripe' ? 'Card (Stripe)' : paymentMethod);
  const safePaymentStatus = escapeHtml(paymentStatusLabelText);
  const safeHeroAlt = escapeHtml(tourTitle);
  const totalAmount = formatUsdAmount(totalPrice);
  const paymentNote =
    paymentStatus === 'authorized'
      ? 'Your card is securely authorized. You are not charged now; it will be charged automatically at 10:00 AM Korea time on the tour date after the pickup window has passed.'
      : paymentStatus === 'paid'
        ? 'Your payment has been completed.'
        : 'Your booking is being processed. We will notify you as soon as payment is finalized.';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <meta name="color-scheme" content="light">
      <style>
  body { margin:0; padding:0; background:#f4f1e9; color:#1c1917; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; display:block; }
  a { color:#1c1917; }
  .preheader { display:none!important; visibility:hidden; opacity:0; color:transparent; height:0; width:0; overflow:hidden; mso-hide:all; }
  .shell { width:100%; background:#f4f1e9; }
  .card { width:640px; max-width:640px; background:#ffffff; border:1px solid #e7e0d4; border-radius:18px; overflow:hidden; box-shadow:0 1px 2px rgba(28,25,23,.05); }
  .px { padding-left:36px; padding-right:36px; }
  .button { display:block; text-align:center; background:#b08d3e; color:#ffffff!important; text-decoration:none; border-radius:12px; padding:15px 18px; font-weight:700; font-size:15px; line-height:20px; letter-spacing:0.01em; }
  .serif { font-family:Georgia,'Times New Roman',serif; }
  .muted { color:#6b7280; }
  @media only screen and (max-width: 680px) {
    .outer-pad { padding:10px!important; }
    .card { width:100%!important; border-radius:12px!important; }
    .px { padding-left:18px!important; padding-right:18px!important; }
    .hd { padding-left:18px!important; padding-right:18px!important; }
    .h1 { font-size:22px!important; line-height:29px!important; }
    .sum-pad { padding:18px 16px 16px!important; }
    .stack { display:block!important; width:100%!important; }
    .stack-gap { padding-top:12px!important; }
    .hero-img { height:auto!important; }
  }
      </style>
    </head>
    <body>
      <div class="preheader">Your AtoC Korea reservation is confirmed for ${safeTourTitle}.</div>
      <table role="presentation" class="shell" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" class="outer-pad" style="padding:32px 16px;">
            <table role="presentation" class="card" cellpadding="0" cellspacing="0">

              <!-- ink header -->
              <tr>
                <td class="hd" style="background:#181511;padding:26px 36px 24px;">
                  <table role="presentation" width="100%">
                    <tr>
                      <td class="stack" style="vertical-align:middle;">
                        <table role="presentation" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="vertical-align:middle;width:40px;">
                              <img src="${escapeHtml(logoUrl)}" width="38" height="38" alt="AtoC Korea" style="width:38px;height:38px;border-radius:9px;">
                            </td>
                            <td style="vertical-align:middle;padding-left:11px;">
                              <div style="color:#ffffff;font-size:17px;line-height:19px;font-weight:700;">AtoC <span style="color:#c9c3b6;font-weight:400;">Korea</span></div>
                              <div style="margin-top:3px;color:#c9a75c;font-size:10px;line-height:12px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;">Reservation Desk</div>
                            </td>
                          </tr>
                        </table>
                      </td>
                      <td class="stack stack-gap" align="right" style="vertical-align:middle;">
                        <span style="display:inline-block;border:1px solid rgba(201,167,92,.55);border-radius:999px;padding:7px 14px;color:#c9a75c;background:rgba(201,167,92,.08);font-size:11px;line-height:13px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;">Confirmed</span>
                      </td>
                    </tr>
                  </table>
                  <div style="margin-top:22px;height:1px;background:rgba(201,167,92,.28);"></div>
                  <h1 class="serif h1" style="margin:20px 0 0;color:#ffffff;font-size:27px;line-height:35px;font-weight:600;letter-spacing:0.005em;">Your Korea tour is confirmed.</h1>
                  <p style="margin:10px 0 2px;color:#a8a29e;font-size:13px;line-height:20px;white-space:nowrap;">Reservation ${escapeHtml(displayBookingId)}</p>
                </td>
              </tr>

              ${emailTourImageUrl ? `
              <!-- hero -->
              <tr>
                <td style="padding:0;line-height:0;">
                  <img src="${emailTourImageUrl}" alt="${safeHeroAlt}" class="hero-img" style="width:100%;height:232px;object-fit:cover;">
                </td>
              </tr>
              ` : ''}

              <!-- greeting -->
              <tr>
                <td class="px" style="padding-top:28px;padding-bottom:6px;">
                  <p style="margin:0;color:#44403c;font-size:15px;line-height:24px;">Dear ${safeCustomerName},</p>
                  <p style="margin:10px 0 0;color:#57534e;font-size:14.5px;line-height:23px;">Your reservation is secured — we will take care of every detail. Simply arrive ready to enjoy the day.</p>
                </td>
              </tr>

              <!-- booking summary -->
              <tr>
                <td class="px" style="padding-top:20px;padding-bottom:6px;">
                  <table role="presentation" width="100%" style="background:#fbfaf6;border:1px solid #ece5d6;border-radius:14px;">
                    <tr>
                      <td class="sum-pad" style="padding:22px 24px 20px;">
                        <table role="presentation" width="100%">
                          <tr>
                            <td style="padding-bottom:12px;">
                              <span class="serif" style="color:#1c1917;font-size:16px;line-height:22px;font-weight:600;">${safeTourTitle}</span>
                            </td>
                          </tr>
                        </table>
                        <table role="presentation" width="100%" style="border-collapse:collapse;">
                          ${confirmationRow('Date', escapeHtml(formattedDate))}
                          ${confirmationRow('Guests', escapeHtml(String(numberOfGuests)))}
                          ${safePickupPoint ? confirmationRow('Pickup', safePickupPoint) : ''}
                          ${confirmationRow('Payment', safePaymentMethod)}
                          <tr>
                            <td colspan="2" style="padding:9px 0 2px;">
                              <div style="color:#8a8578;font-size:12px;line-height:18px;letter-spacing:0.04em;">Status</div>
                              <div style="margin-top:3px;color:#57534e;font-size:13px;line-height:19px;">${safePaymentStatus}</div>
                            </td>
                          </tr>
                        </table>
                        <div style="margin-top:14px;height:1px;background:#e5dcc8;"></div>
                        <table role="presentation" width="100%" style="margin-top:12px;">
                          <tr>
                            <td style="color:#8a8578;font-size:11px;line-height:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.14em;vertical-align:bottom;">Total</td>
                            <td align="right" class="serif" style="color:#181511;font-size:24px;line-height:28px;font-weight:600;">${escapeHtml(totalAmount)}</td>
                          </tr>
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- payment note -->
              <tr>
                <td class="px" style="padding-top:14px;padding-bottom:4px;">
                  <table role="presentation" width="100%">
                    <tr>
                      <td style="border-left:3px solid #c9a75c;background:#faf7ef;border-radius:0 12px 12px 0;padding:14px 18px;">
                        <p style="margin:0;color:#57534e;font-size:13px;line-height:20px;">${escapeHtml(paymentNote)}</p>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- before your tour -->
              <tr>
                <td class="px" style="padding-top:26px;padding-bottom:4px;">
                  <p style="margin:0 0 14px;color:#8a8578;font-size:11px;line-height:14px;font-weight:800;text-transform:uppercase;letter-spacing:0.16em;">Before your tour</p>
                  <table role="presentation" width="100%" style="border-collapse:collapse;">
                    <tr>
                      <td class="serif" style="width:30px;color:#b08d3e;font-size:19px;line-height:24px;font-weight:600;vertical-align:top;padding:7px 0;">1</td>
                      <td style="color:#44403c;font-size:14px;line-height:22px;padding:7px 0;border-bottom:1px solid #f0ece1;">A reminder email arrives 24 hours before departure.</td>
                    </tr>
                    <tr>
                      <td class="serif" style="width:30px;color:#b08d3e;font-size:19px;line-height:24px;font-weight:600;vertical-align:top;padding:9px 0 7px;">2</td>
                      <td style="color:#44403c;font-size:14px;line-height:22px;padding:9px 0 7px;border-bottom:1px solid #f0ece1;">Please arrive at the pickup point 10 minutes early.</td>
                    </tr>
                    <tr>
                      <td class="serif" style="width:30px;color:#b08d3e;font-size:19px;line-height:24px;font-weight:600;vertical-align:top;padding:9px 0 0;">3</td>
                      <td style="color:#44403c;font-size:14px;line-height:22px;padding:9px 0 0;">Questions? Email <a href="mailto:support@atockorea.com" style="color:#1c1917;font-weight:700;text-decoration:underline;text-underline-offset:2px;">support@atockorea.com</a> or use our website chatbot.</td>
                    </tr>
                  </table>
                </td>
              </tr>

              <!-- CTA -->
              <tr>
                <td class="px" style="padding-top:26px;padding-bottom:30px;">
                  <a href="${baseUrl}/mypage/mybookings" class="button">View my booking</a>
                  <p style="margin:14px 0 0;color:#8a8578;font-size:12px;line-height:19px;text-align:center;">After the tour — <a href="${reviewWriteUrl}" style="color:#57534e;font-weight:700;text-decoration:underline;text-underline-offset:2px;">write a review</a>.</p>
                </td>
              </tr>

              <!-- footer -->
              <tr>
                <td style="padding:22px 36px 24px;background:#181511;">
                  <p class="serif" style="margin:0;color:#ffffff;font-size:15px;line-height:21px;font-weight:600;">AtoC Korea</p>
                  <p style="margin:5px 0 0;color:#a8a29e;font-size:12px;line-height:18px;">Curated Korea tours, direct local support.</p>
                  <div style="margin:14px 0;height:1px;background:rgba(201,167,92,.22);"></div>
                  <p style="margin:0;color:#78716c;font-size:11px;line-height:17px;">© 2026 AtoC Korea LLC · This confirmation was sent to ${escapeHtml(to)}.</p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return { subject: `Booking Confirmed: ${tourTitle}`, html };
}

export async function sendBookingConfirmationEmail(params: SendBookingConfirmationEmailParams) {
  const { subject, html } = buildBookingConfirmationEmailHtml(params);
  return sendEmail({ to: params.to, subject, html });
}

export async function sendBookingAdminNotificationEmail({
  bookingId,
  bookingReference,
  tourTitle,
  bookingDate,
  numberOfGuests,
  totalPrice,
  pickupPoint,
  paymentMethod,
  paymentStatus,
  customerName,
  customerEmail,
  customerPhone,
}: {
  bookingId: string;
  bookingReference?: string | null;
  tourTitle: string;
  bookingDate: string;
  numberOfGuests: number;
  totalPrice: number;
  pickupPoint?: string;
  paymentMethod: string;
  paymentStatus: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
}) {
  const normalizedCustomerEmail = (customerEmail || '').trim().toLowerCase();
  const recipients = getAdminBookingRecipients().filter(
    (email) => email.trim().toLowerCase() !== normalizedCustomerEmail,
  );
  if (recipients.length === 0) {
    return { success: false, error: 'No admin booking recipients configured' };
  }

  const displayBookingId = bookingReference || shortBookingId(bookingId);
  const formattedDate = new Date(bookingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const baseUrl = getEmailBaseUrl();
  const logoUrl = getEmailLogoUrl(baseUrl);
  const safeTourTitle = escapeHtml(tourTitle);
  const safeCustomerName = escapeHtml(customerName || 'Guest');
  const safeCustomerEmail = escapeHtml(customerEmail || 'N/A');
  const safeCustomerPhone = escapeHtml(customerPhone || 'N/A');
  const safePickupPoint = pickupPoint ? escapeHtml(pickupPoint) : null;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
  body { margin:0; padding:0; background:#f5f3ee; color:#111827; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; }
  table { border-collapse:collapse; }
  img { border:0; outline:none; text-decoration:none; display:block; }
  .shell { width:100%; background:#f5f3ee; }
  .card { width:640px; max-width:640px; background:#ffffff; border:1px solid #e7e0d4; border-radius:14px; overflow:hidden; }
  .px { padding-left:34px; padding-right:34px; }
  @media only screen and (max-width: 680px) {
    .outer-pad { padding:14px!important; }
    .card { width:100%!important; border-radius:10px!important; }
    .px { padding-left:20px!important; padding-right:20px!important; }
  }
      </style>
    </head>
    <body>
      <table role="presentation" class="shell" width="100%" cellpadding="0" cellspacing="0">
        <tr>
          <td align="center" class="outer-pad" style="padding:28px 16px;">
            <table role="presentation" class="card" cellpadding="0" cellspacing="0">
              <tr>
                <td class="px" style="padding-top:26px;padding-bottom:18px;">
                  ${emailBrandLockup(logoUrl)}
                </td>
              </tr>
              <tr>
                <td class="px" style="padding-top:0;padding-bottom:18px;">
                  <p style="margin:0 0 8px;color:#7a5d2c;font-size:12px;line-height:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">Internal booking alert</p>
                  <h1 style="margin:0;color:#111827;font-size:26px;line-height:32px;font-weight:750;letter-spacing:0;">New booking confirmed</h1>
                  <p style="margin:10px 0 0;color:#4b5563;font-size:14px;line-height:22px;">A guest booking was confirmed and is ready to review in the admin dashboard.</p>
                </td>
              </tr>
              <tr>
                <td class="px" style="padding-top:0;padding-bottom:10px;">
                  <table role="presentation" width="100%" style="background:#fbfaf7;border:1px solid #ebe7df;border-radius:12px;">
                    <tr>
                      <td style="padding:20px 22px 8px;">
                        <p style="margin:0 0 8px;color:#7b746b;font-size:12px;line-height:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">Booking summary</p>
                        <table role="presentation" width="100%">
                          ${emailDetailRow('Booking ID', escapeHtml(displayBookingId))}
                          ${emailDetailRow('Tour', safeTourTitle)}
                          ${emailDetailRow('Tour date', escapeHtml(formattedDate))}
                          ${emailDetailRow('Guests', escapeHtml(numberOfGuests))}
                          ${safePickupPoint ? emailDetailRow('Pickup', safePickupPoint) : ''}
                          ${emailDetailRow('Payment', `${escapeHtml(paymentMethod)} / ${escapeHtml(paymentStatus)}`)}
                          ${emailDetailRow('Total', escapeHtml(formatUsdAmount(totalPrice)), { emphasize: true })}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td class="px" style="padding-top:10px;padding-bottom:28px;">
                  <table role="presentation" width="100%" style="background:#ffffff;border:1px solid #ebe7df;border-radius:12px;">
                    <tr>
                      <td style="padding:18px 22px 8px;">
                        <p style="margin:0 0 8px;color:#7b746b;font-size:12px;line-height:16px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;">Guest contact</p>
                        <table role="presentation" width="100%">
                          ${emailDetailRow('Name', safeCustomerName)}
                          ${emailDetailRow('Email', `<a href="mailto:${safeCustomerEmail}" style="color:#111827;font-weight:700;text-decoration:underline;">${safeCustomerEmail}</a>`)}
                          ${emailDetailRow('Phone', safeCustomerPhone)}
                        </table>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
              <tr>
                <td style="padding:18px 34px 24px;background:#111827;color:#d1d5db;">
                  <p style="margin:0;color:#ffffff;font-size:13px;line-height:20px;font-weight:700;">AtoC Korea admin notification</p>
                  <p style="margin:4px 0 0;color:#7f8997;font-size:11px;line-height:16px;">© 2026 AtoC Korea LLC.</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;

  return sendEmail({
    to: recipients,
    subject: `[ADMIN] New booking confirmed: ${tourTitle}`,
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
          <p>Dear ${escapeHtml(customerName)},</p>
          <p>Your booking has been cancelled as requested.</p>

          <div class="content-box">
            <h2 style="margin-top: 0; color: #f5576c;">Cancellation Details</h2>
            <div class="info-row">
              <span class="info-label">Booking ID:</span>
              <span class="info-value">${escapeHtml(bookingId)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Tour:</span>
              <span class="info-value">${escapeHtml(tourTitle)}</span>
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
            <a href="${getEmailBaseUrl()}/mypage/mybookings" class="button">View My Bookings</a>
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
  const appUrl = getEmailBaseUrl();
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
          <p>Dear ${escapeHtml(contactPerson)},</p>
          <p>Congratulations! Your merchant account for <strong>${escapeHtml(companyName)}</strong> has been created successfully.</p>

          <div class="content-box">
            <h2 style="margin-top: 0; color: #667eea;">Your Login Credentials</h2>
            <div class="info-row">
              <span class="info-label">Login Email:</span>
              <span class="info-value">${escapeHtml(loginEmail)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Temporary Password:</span>
              <span class="info-value" style="font-family: monospace; background: #f0f0f0; padding: 5px 10px; border-radius: 4px;">${escapeHtml(temporaryPassword)}</span>
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
  const baseUrl = getEmailBaseUrl();
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
  const baseUrl = getEmailBaseUrl();
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

