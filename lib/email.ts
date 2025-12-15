import { Resend } from 'resend';

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
  } catch (error: any) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Booking confirmation email
 */
export async function sendBookingConfirmationEmail({
  to,
  bookingId,
  tourTitle,
  bookingDate,
  numberOfGuests,
  totalPrice,
  pickupPoint,
  paymentMethod,
  customerName,
}: {
  to: string;
  bookingId: string;
  tourTitle: string;
  bookingDate: string;
  numberOfGuests: number;
  totalPrice: number;
  pickupPoint?: string;
  paymentMethod: string;
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
        <div class="header">
          <h1>🎉 Booking Confirmed!</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>Thank you for your booking! We're excited to have you join us.</p>
          
          <div class="content-box">
            <h2 style="margin-top: 0; color: #667eea;">Booking Details</h2>
            <div class="info-row">
              <span class="info-label">Booking ID:</span>
              <span class="info-value">${bookingId}</span>
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
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com'}/mypage/mybookings" class="button">View My Bookings</a>
          </p>
        </div>
        <div class="footer">
          <p>© 2024 AtoCKorea. All rights reserved.</p>
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
          <p>© 2024 AtoCKorea. All rights reserved.</p>
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
        <div class="header" style="background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);">
          <h1>⏰ Tour Reminder</h1>
        </div>
        <div class="content">
          <p>Dear ${customerName},</p>
          <p>This is a friendly reminder that your tour is coming up soon!</p>
          
          <div class="content-box">
            <h2 style="margin-top: 0; color: #4facfe;">Tour Details</h2>
            <div class="info-row">
              <span class="info-label">Tour:</span>
              <span class="info-value">${tourTitle}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Date:</span>
              <span class="info-value">${formattedDate}</span>
            </div>
            ${bookingTime ? `
            <div class="info-row">
              <span class="info-label">Time:</span>
              <span class="info-value">${bookingTime}</span>
            </div>
            ` : ''}
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
            ${pickupAddress ? `
            <div class="info-row">
              <span class="info-label">Pickup Address:</span>
              <span class="info-value">${pickupAddress}</span>
            </div>
            ` : ''}
            ${pickupTime ? `
            <div class="info-row">
              <span class="info-label">Pickup Time:</span>
              <span class="info-value">${pickupTime}</span>
            </div>
            ` : ''}
          </div>

          <p><strong>Important Reminders:</strong></p>
          <ul>
            <li>Please arrive at the pickup point <strong>10 minutes before</strong> the scheduled time</li>
            <li>Bring a valid ID for verification</li>
            <li>Check the weather forecast and dress appropriately</li>
            <li>If you need to cancel, please do so at least 24 hours in advance</li>
          </ul>

          ${contactPhone ? `
          <p><strong>Need Help?</strong></p>
          <p>If you have any questions or need assistance, please contact us at <strong>${contactPhone}</strong></p>
          ` : ''}

          <p style="margin-top: 30px;">
            <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://atockorea.com'}/mypage/mybookings" class="button">View Booking Details</a>
          </p>

          <p>We look forward to seeing you soon!</p>
        </div>
        <div class="footer">
          <p>© 2024 AtoCKorea. All rights reserved.</p>
          <p>This email was sent from ${fromEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

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
          <p>© 2024 AtoCKorea. All rights reserved.</p>
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



