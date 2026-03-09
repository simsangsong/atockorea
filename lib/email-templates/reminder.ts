/**
 * Booking reminder email HTML builder.
 * Extracted from lib/email.ts to reduce file size and separate template from send logic.
 */

export interface ReminderEmailParams {
  baseStyles: string;
  fromEmail: string;
  appUrl: string;
  tourTitle: string;
  bookingDate: string;
  bookingTime?: string;
  numberOfGuests: number;
  pickupPoint?: string;
  pickupAddress?: string;
  pickupTime?: string;
  customerName: string;
  contactPhone?: string;
}

export function buildReminderEmailHtml(params: ReminderEmailParams): string {
  const {
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
  } = params;

  const formattedDate = new Date(bookingDate).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return `
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
            <a href="${appUrl}/mypage/mybookings" class="button">View Booking Details</a>
          </p>

          <p>We look forward to seeing you soon!</p>
        </div>
        <div class="footer">
          <p>© 2026 AtoCKorea. All rights reserved.</p>
          <p>This email was sent from ${fromEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;
}
